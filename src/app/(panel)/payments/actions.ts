"use server";

import { requireUser } from "@/lib/supabase/server";
import { loadLedgers, type Student, type Teacher } from "@/lib/data";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { processEmails } from "@/lib/mail/outbox";

export type ReminderResult = { ok: boolean; message: string; status?: "sent" | "queued" } | null;

export async function sendPaymentReminder(studentId: string): Promise<ReminderResult> {
  const { supabase, userId } = await requireUser();
  const [{ data: student, error }, { data: teacher, error: teacherError }] = await Promise.all([
    supabase
      .from("students")
      .select("*")
      .eq("id", studentId)
      .eq("teacher_id", userId)
      .maybeSingle<Student>(),
    supabase
      .from("teachers")
      .select("name, email")
      .eq("id", userId)
      .single<Pick<Teacher, "name" | "email">>(),
  ]);
  if (error || teacherError || !student || !teacher)
    return { ok: false, message: "Não foi possível consultar os dados do aluno." };
  if (!student.email) return { ok: false, message: "Cadastre um email no perfil do aluno." };
  if (!student.active) return { ok: false, message: "O aluno está inativo." };
  const { ledger } = (await loadLedgers(supabase, [studentId])).get(studentId)!;
  if (ledger.remaining > 2)
    return {
      ok: false,
      message: "O aluno ainda tem mais de 2 aulas no pacote. Atualize a página.",
    };
  const balance =
    ledger.remaining < 0
      ? `Há ${-ledger.remaining} aula(s) realizada(s) além do pacote pago.`
      : ledger.remaining === 0
        ? "Seu pacote de aulas chegou ao fim."
        : `Restam ${ledger.remaining} aula(s) no seu pacote.`;
  try {
    const db = createAdminClient();
    const allowed = await db.rpc("allow_student_auth", {
      p_keys: [`reminder/student/${studentId}`, `reminder/teacher/${userId}`],
      p_limits: [1, 20],
      p_seconds: [900, 3600],
    });
    if (allowed.error || !allowed.data)
      return {
        ok: false,
        message: "Aguarde antes de enviar outro lembrete. O intervalo é de 15 minutos por aluno.",
      };
    const id = randomUUID();
    const job = await db.from("email_outbox").insert({
      id,
      event_key: `manual-reminder/${id}`,
      teacher_id: userId,
      student_id: studentId,
      recipient: student.email,
      template: "reminder",
      payload: { message: balance },
    });
    if (job.error) throw new Error("outbox_unavailable");
    const result = await processEmails(id);
    return result.sent
      ? { ok: true, message: "Email enviado.", status: "sent" }
      : result.pending
        ? { ok: true, message: "Envio na fila.", status: "queued" }
        : { ok: false, message: "Não foi possível enviar. Consulte os envios em Emails." };
  } catch {
    return { ok: false, message: "Não foi possível registrar o envio. Tente novamente." };
  }
}
