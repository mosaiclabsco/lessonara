import { Suspense } from "react";
import PanelLoading from "../loading";
import { FinanceDashboard } from "@/components/finance-dashboard";
import type { IncomePayment } from "@/lib/finance";
import { nowInTZ } from "@/lib/dates";
import { requireUser } from "@/lib/supabase/server";

type PaymentRow = {
  id: string;
  student_id: string;
  paid_on: string;
  amount: number;
  lessons: number;
  students: { name: string; teacher_id: string };
};

export default function FinancePage() {
  return (
    <Suspense fallback={<PanelLoading />}>
      <FinanceData />
    </Suspense>
  );
}

async function FinanceData() {
  const { supabase, userId } = await requireUser();
  const { today } = nowInTZ();
  const payments: IncomePayment[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("packages")
      .select("id, student_id, paid_on, amount, lessons, students!inner(name, teacher_id)")
      .eq("students.teacher_id", userId)
      .lte("paid_on", today)
      .order("paid_on")
      .order("id")
      .range(offset, offset + pageSize - 1)
      .returns<PaymentRow[]>();
    if (error) throw error;
    const entries = data ?? [];
    payments.push(
      ...entries.map((payment) => ({
        id: payment.id,
        studentId: payment.student_id,
        studentName: payment.students.name,
        paidOn: payment.paid_on,
        amount: payment.amount,
        lessons: payment.lessons,
      })),
    );
    if (entries.length < pageSize) break;
  }
  return <FinanceDashboard payments={payments} today={today} />;
}
