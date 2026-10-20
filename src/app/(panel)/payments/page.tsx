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
  const { paymentRows } = await loadTeacherOverview("payments");
  return <PaymentCenter rows={paymentRows} />;
}
