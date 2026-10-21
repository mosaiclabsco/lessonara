import { RenewalReview } from "@/components/renewal-review";
import { requireUser } from "@/lib/supabase/server";
import { nowInTZ, formatBRL } from "@/lib/dates";
import { pixPayload, type PixSettings, type RenewalQuote } from "@/lib/pix";
import { Suspense } from "react";
import PanelLoading from "../loading";
import { PaymentCenter } from "@/components/payment-center";
import { loadTeacherOverview } from "@/lib/teacher-overview";

export default function PaymentsPage() {
  return (
    <Suspense fallback={<PanelLoading />}>
      <PaymentData />
    </Suspense>
  );
}

async function PaymentData() {
  const { supabase, userId } = await requireUser();
  const [{ paymentRows }, requests, settings] = await Promise.all([
    loadTeacherOverview("payments"),
    supabase
      .from("renewal_requests")
      .select("*")
      .eq("teacher_id", userId)
      .eq("status", "pending")
      .order("reported_at")
      .returns<RenewalQuote[]>(),
    supabase
      .from("teacher_receivables")
      .select("key_type,pix_key,receiver_name,receiver_city")
      .eq("teacher_id", userId)
      .maybeSingle<PixSettings>(),
  ]);
  if (requests.error || settings.error)
    throw new Error("Não foi possível carregar os recebimentos.");
  const byId = new Map(paymentRows.map((s) => [s.id, s]));
  const pending = (requests.data ?? []).map((q) => {
    const st = byId.get(q.student_id);
    return {
      ...q,
      studentName: st?.name ?? "Aluno",
      changed:
        Number(q.amount) !== Number(st?.price) ||
        q.lessons !== st?.lessons ||
        !settings.data ||
        Object.keys(q.pix).some(
          (key) => q.pix[key as keyof PixSettings] !== settings.data?.[key as keyof PixSettings],
        ),
    };
  });
  const rows = paymentRows.map((row) => ({
    ...row,
    pixMessage:
      settings.data && row.price && row.price > 0
        ? `Olá, ${row.name}! Para renovar ${row.plan}, o valor é ${formatBRL(row.price)}.\nConfira o recebedor no banco: ${settings.data.receiver_name}.\nPix copia-e-cola:\n${pixPayload(settings.data, row.price)}\n\nApós pagar, abra seu portal e use “Já paguei” para eu conferir o recebimento:\n${row.link}`
        : undefined,
  }));
  return (
    <PaymentCenter
      rows={rows}
      renewals={<RenewalReview rows={pending} today={nowInTZ().today} />}
    />
  );
}
