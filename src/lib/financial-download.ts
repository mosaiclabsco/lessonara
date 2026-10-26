import type { SupabaseClient } from "@supabase/supabase-js";
import type { IncomePayment } from "./finance";
export const downloadHeaders = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
export async function readPayments(
  db: SupabaseClient,
  teacherId: string,
  period: string,
  studentId?: string,
  paymentId?: string,
) {
  const output: IncomePayment[] = [];
  for (let offset = 0; offset < 10000; offset += 1000) {
    let q = db
      .from("packages")
      .select("id,student_id,paid_on,amount,lessons,students!inner(name,teacher_id)")
      .eq("students.teacher_id", teacherId)
      .order("paid_on")
      .order("id")
      .range(offset, offset + 999);
    if (period)
      q = q
        .gte("paid_on", period.length === 4 ? `${period}-01-01` : `${period}-01`)
        .lt(
          "paid_on",
          period.length === 4
            ? `${Number(period) + 1}-01-01`
            : new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 1))
                .toISOString()
                .slice(0, 10),
        );
    if (studentId) q = q.eq("student_id", studentId);
    if (paymentId) q = q.eq("id", paymentId);
    const result = await q.returns<
      {
        id: string;
        student_id: string;
        paid_on: string;
        amount: number;
        lessons: number;
        students: { name: string; teacher_id: string };
      }[]
    >();
    if (result.error) throw new Error("Não foi possível consultar os pagamentos.");
    for (const p of result.data ?? []) {
      output.push({
        id: p.id,
        studentId: p.student_id,
        studentName: p.students.name,
        paidOn: p.paid_on,
        amount: Number(p.amount),
        lessons: p.lessons,
      });
    }
    if ((result.data?.length ?? 0) < 1000) return output;
  }
  throw new Error("Use um período menor para exportar.");
}
export function binaryDownload(bytes: Uint8Array | string, name: string, type: string) {
  return new Response(typeof bytes === "string" ? bytes : new Uint8Array(bytes).buffer, {
    headers: {
      ...downloadHeaders,
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
