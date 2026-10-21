import "server-only";
import QRCode from "qrcode";
import { pixPayload, type RenewalQuote } from "./pix";
import { createAdminClient } from "./supabase/server";
export type RenewalPlan = {
  price_override: number | null;
  plans: { price: number; lessons: number; name: string; is_active: boolean } | null;
};
export async function loadStudentRenewal(
  studentId: string,
  teacherId: string,
  current: RenewalPlan,
) {
  const db = createAdminClient();
  const [request, settings, lastResolved] = await Promise.all([
    db
      .from("renewal_requests")
      .select("*")
      .eq("student_id", studentId)
      .eq("teacher_id", teacherId)
      .in("status", ["ready", "pending"])
      .maybeSingle<RenewalQuote>(),
    db.from("teacher_receivables").select("teacher_id").eq("teacher_id", teacherId).maybeSingle(),
    db
      .from("renewal_requests")
      .select("status,resolution_note,resolved_at")
      .eq("student_id", studentId)
      .eq("teacher_id", teacherId)
      .in("status", ["confirmed", "rejected"])
      .order("resolved_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (request.error || settings.error || lastResolved.error)
    throw new Error("Não foi possível carregar a renovação.");
  const quote = request.data;
  const amount = current.price_override ?? current.plans?.price ?? 0;
  const available = Boolean(settings.data && current.plans?.is_active && amount > 0);
  const payload =
    quote?.status === "ready"
      ? pixPayload(quote.pix, Number(quote.amount), quote.id.replaceAll("-", "").slice(0, 25))
      : null;
  const qr = payload
    ? await QRCode.toString(payload, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 4,
        width: 232,
      })
    : null;
  return {
    lastResolved: lastResolved.data,
    quote,
    payload,
    qr,
    available,
    amount,
    lessons: current.plans?.lessons ?? 0,
    planName: current.plans?.name ?? "",
  };
}
export type StudentRenewal = Awaited<ReturnType<typeof loadStudentRenewal>>;
