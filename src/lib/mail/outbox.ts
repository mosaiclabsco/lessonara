import { createUnsubscribeToken } from "./unsubscribe-token";
import { loadTeacherPlan } from "../platform-plan-server";
import { createWelcomeInvite } from "./welcome-invite";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { EmailSendError, sendEmail, type EmailInput } from "@/lib/email";
import { seal, unseal } from "./crypto";
import { otpEmail, reminderEmail, welcomeEmail, campaignEmail } from "./templates";

type MailStudent = {
  id: string;
  access_version: number;
  teacher_id: string;
  slug: string;
  name: string;
  email: string;
  active: boolean;
  promotional_email_opt_out: boolean;
  teachers: { name: string; email: string };
};
type Job = {
  id: string;
  event_key: string;
  lease_id: string;
  student_id: string | null;
  recipient: string;
  template: "otp" | "welcome" | "reminder" | "campaign";
  payload: Record<string, string>;
  attempts: number;
  delivery: { sealed: string } | null;
  expires_at: string;
};

export async function enqueueOtp(
  email: string,
  code: string,
  challengeId: string,
  studentId?: string,
) {
  const db = createAdminClient();
  const id = randomUUID();
  const { error } = await db.from("email_outbox").insert({
    id,
    event_key: `otp/${challengeId}`,
    student_id: studentId ?? null,
    recipient: email,
    template: "otp",
    payload: { sealed: seal({ code }, "otp") },
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (error) throw new Error("Não foi possível preparar o email de acesso.");
  return id;
}

export async function enqueueReminder(input: {
  studentId: string;
  teacherId: string;
  email: string;
  credits: number;
  message: string;
}) {
  if (!(await loadTeacherPlan(input.teacherId)).emails)
    throw new Error("Emails está disponível no plano Pro.");
  const { error } = await createAdminClient()
    .from("email_outbox")
    .upsert(
      {
        event_key: `reminder/${input.studentId}/${input.credits}`,
        student_id: input.studentId,
        teacher_id: input.teacherId,
        recipient: input.email,
        template: "reminder",
        payload: { message: input.message },
      },
      { onConflict: "event_key", ignoreDuplicates: true },
    );
  if (error) throw new Error("Não foi possível registrar o lembrete.");
}

/** Claim com lease e SKIP LOCKED evita dois workers enviarem o mesmo trabalho. */
export async function processEmails(id?: string) {
  const db = createAdminClient();
  const { data, error } = await db.rpc("claim_email_jobs", { p_limit: 10, p_id: id ?? null });
  if (error) throw new Error("Não foi possível processar a fila de emails.");
  const result = { sent: 0, failed: 0, pending: 0, cancelled: 0 };
  for (const job of (data ?? []) as Job[]) {
    async function finish(values: Record<string, unknown>) {
      const { error } = await db
        .from("email_outbox")
        .update(values)
        .eq("id", job.id)
        .eq("lease_id", job.lease_id)
        .eq("status", "sending");
      if (error) throw new Error("Não foi possível atualizar o estado do email.");
    }
    try {
      const blocked = await db.rpc("email_recipient_blocked", { p_recipient: job.recipient });
      if (blocked.error) throw new EmailSendError("database_unavailable", true);
      if (blocked.data === true) {
        await finish({
          status: "failed",
          last_error: "recipient_suppressed",
          payload: {},
          delivery: null,
        });
        result.failed++;
        continue;
      }
      if (job.template === "reminder" || job.template === "campaign") {
        const owner = await db
          .from("students")
          .select("teacher_id")
          .eq("id", job.student_id)
          .maybeSingle();
        if (owner.error) throw owner.error;
        if (!owner.data || !(await loadTeacherPlan(owner.data.teacher_id, db)).emails) {
          await finish({ status: "cancelled", payload: {}, delivery: null });
          result.cancelled++;
          continue;
        }
      }
      let body: EmailInput;
      // Revalida o destinatário mesmo no retry de um email já materializado.
      let student: MailStudent | null = null;
      if (job.student_id) {
        const row = await db
          .from("students")
          .select(
            "id,access_version,teacher_id,slug,name,email,active,promotional_email_opt_out,teachers(name,email)",
          )
          .eq("id", job.student_id)
          .maybeSingle<MailStudent>();
        if (row.error) throw new EmailSendError("database_unavailable", true);
        student = row.data;
        if (
          !student ||
          !student.active ||
          (job.template === "campaign" && student.promotional_email_opt_out) ||
          student.email?.trim().toLowerCase() !== job.recipient
        ) {
          await finish({ status: "cancelled", payload: {}, delivery: null });
          result.cancelled++;
          continue;
        }
      }
      if (job.template === "otp") {
        const challengeKey = job.event_key.slice(4);
        const challenge = await db
          .from("student_auth_challenges")
          .select("id")
          .eq("id", challengeKey)
          .is("consumed_at", null)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        if (challenge.error) throw new EmailSendError("database_unavailable", true);
        if (!challenge.data) {
          await finish({ status: "cancelled", payload: {}, delivery: null });
          result.cancelled++;
          continue;
        }
      }
      if (job.delivery)
        body = unseal<EmailInput>(job.delivery.sealed, "mail-delivery", { allowLegacy: true });
      else {
        const content =
          job.template === "otp"
            ? otpEmail(
                unseal<{ code: string }>(job.payload.sealed, "otp", { allowLegacy: true }).code,
              )
            : job.template === "welcome"
              ? welcomeEmail(
                  student!.name,
                  student!.teachers.name,
                  student!.teacher_id,
                  student!.slug,
                  await createWelcomeInvite(student!),
                )
              : job.template === "campaign"
                ? (() => {
                    const content = unseal<{ subject: string; message: string }>(
                      job.payload.sealed,
                      "campaign",
                      { allowLegacy: true },
                    );
                    const origin =
                      process.env.APP_URL || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
                    const token = createUnsubscribeToken({
                      studentId: student!.id,
                      teacherId: student!.teacher_id,
                      email: student!.email,
                    });
                    return campaignEmail(
                      student!.name,
                      student!.teachers.name,
                      content.subject,
                      content.message,
                      new URL(`/emails/unsubscribe?token=${encodeURIComponent(token)}`, origin)
                        .href,
                    );
                  })()
                : reminderEmail(
                    student!.name,
                    student!.teachers.name,
                    job.payload.message,
                    student!.teacher_id,
                    student!.slug,
                  );
        body = {
          ...content,
          to: job.recipient,
          from: process.env.EMAIL_FROM || "Lessonara <onboarding@resend.dev>",
          ...(student?.teachers.email &&
          !/\.(test|invalid|localhost)$/i.test(student.teachers.email)
            ? { replyTo: student.teachers.email }
            : process.env.EMAIL_REPLY_TO
              ? { replyTo: process.env.EMAIL_REPLY_TO }
              : {}),
        };
        // Corpo/remetente imutáveis para retries com a mesma chave do Resend.
        await finish({ delivery: { sealed: seal(body, "mail-delivery") } });
      }
      if (Date.parse(job.expires_at) <= Date.now()) {
        await finish({
          status: "failed",
          last_error: "Prazo de envio encerrado.",
          payload: {},
          delivery: null,
        });
        result.failed++;
        continue;
      }
      const sent = await sendEmail(body, `lessonara/${job.id}`);
      await finish({
        status: "sent",
        provider_id: sent.id,
        sent_at: new Date().toISOString(),
        last_error: null,
        payload: {},
        delivery: null,
      });
      result.sent++;
    } catch (error) {
      const retry = error instanceof EmailSendError && error.retryable && job.attempts < 5;
      const next = Date.now() + Math.min(600, 30 * 2 ** (job.attempts - 1)) * 1000;
      const pending = retry && next < Date.parse(job.expires_at);
      await finish({
        status: pending ? "pending" : "failed",
        available_at: new Date(next).toISOString(),
        last_error:
          error instanceof EmailSendError ? error.code : "Falha interna no processamento.",
        ...(!pending ? { payload: {}, delivery: null } : {}),
      });
      if (pending) result.pending++;
      else result.failed++;
    }
  }
  return result;
}
