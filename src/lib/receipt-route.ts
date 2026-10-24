import { authorizedStudent } from "./student-access";
import { requireUser, createAdminClient } from "./supabase/server";
import { readPayments, binaryDownload, downloadHeaders } from "./financial-download";
import { financialPdf } from "./financial-files";
import { nowInTZ } from "./dates";
export async function paymentReceipt(paymentId: string, studentId?: string) {
  if (!/^[a-f\d-]{36}$/i.test(paymentId))
    return new Response("Recibo não encontrado.", { status: 404, headers: downloadHeaders });
  let teacherId: string, teacherName: string, db;
  if (studentId) {
    const access = await authorizedStudent(studentId);
    if (!access)
      return new Response("Recibo não encontrado.", { status: 404, headers: downloadHeaders });
    teacherId = access.teacher_id;
    db = createAdminClient();
    const teacher = await db.from("teachers").select("name").eq("id", teacherId).single();
    if (teacher.error) throw new Error("Não foi possível consultar o professor.");
    teacherName = teacher.data.name ?? "Professor";
  } else {
    const account = await requireUser();
    db = account.supabase;
    teacherId = account.userId;
    teacherName = account.teacher.name ?? "Professor";
  }
  const payments = await readPayments(db, teacherId, "", studentId, paymentId);
  const payment = payments[0];
  if (!payment || payment.paidOn > nowInTZ().today || payment.amount < 0)
    return new Response("Recibo não encontrado.", { status: 404, headers: downloadHeaders });
  return binaryDownload(
    await financialPdf({ teacherName, period: payment.paidOn, payments: [payment] }, true),
    `recibo-${payment.id}.pdf`,
    "application/pdf",
  );
}
