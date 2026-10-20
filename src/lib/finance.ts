import { addDays } from "./dates";
import { shiftMonth } from "./calendar";

export type IncomePayment = {
  id: string;
  studentId: string;
  studentName: string;
  paidOn: string;
  amount: number;
  lessons: number;
};

export function incomeSummary(
  payments: IncomePayment[],
  year: number,
  today: string,
  selectedMonth: number,
) {
  const received = payments.filter((payment) => payment.paidOn <= today && payment.amount >= 0);
  const yearPayments = received.filter((payment) => Number(payment.paidOn.slice(0, 4)) === year);
  let accumulated = 0;
  const months = Array.from({ length: 12 }, (_, index) => {
    const key = `${year}-${String(index + 1).padStart(2, "0")}`;
    const entries = yearPayments.filter((payment) => payment.paidOn.startsWith(key));
    const amount = entries.reduce((total, payment) => total + payment.amount, 0);
    accumulated += amount;
    return {
      key,
      index,
      amount,
      accumulated,
      count: entries.length,
      future: key > today.slice(0, 7),
    };
  });
  const month = months[selectedMonth];
  const previousKey = shiftMonth(month.key, -1);
  const partial = month.key === today.slice(0, 7);
  const previousLastDay = Number(addDays(`${shiftMonth(previousKey, 1)}-01`, -1).slice(8));
  const compareDay = partial ? Math.min(Number(today.slice(8)), previousLastDay) : 31;
  const previousAmount = received
    .filter(
      (payment) =>
        payment.paidOn.startsWith(previousKey) && Number(payment.paidOn.slice(8)) <= compareDay,
    )
    .reduce((total, payment) => total + payment.amount, 0);
  const growth =
    previousAmount > 0 ? ((month.amount - previousAmount) / previousAmount) * 100 : null;
  const total = yearPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const students = new Set(yearPayments.map((payment) => payment.studentId)).size;
  const bestMonth =
    months
      .filter((entry) => !entry.future && entry.amount > 0)
      .sort((a, b) => b.amount - a.amount)[0] ?? null;
  return {
    months,
    month,
    previousAmount,
    previousKey,
    partial,
    growth,
    total,
    count: yearPayments.length,
    ticket: yearPayments.length ? total / yearPayments.length : 0,
    students,
    bestMonth,
    payments: yearPayments
      .slice()
      .sort(
        (a, b) =>
          b.paidOn.localeCompare(a.paidOn) || a.studentName.localeCompare(b.studentName, "pt-BR"),
      ),
    excluded: payments.filter(
      (payment) =>
        Number(payment.paidOn.slice(0, 4)) === year &&
        payment.paidOn <= today &&
        payment.amount < 0,
    ).length,
  };
}
