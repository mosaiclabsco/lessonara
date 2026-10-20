import { expect, it } from "vitest";
import { incomeSummary, type IncomePayment } from "./finance";

const payment = (
  id: string,
  paidOn: string,
  amount: number,
  studentId = "student",
): IncomePayment => ({ id, paidOn, amount, studentId, studentName: "Aluno", lessons: 4 });

it("soma por data do pagamento, preenche meses sem entradas e calcula acumulado", () => {
  const summary = incomeSummary(
    [
      payment("a", "2026-01-10", 200),
      payment("b", "2026-01-20", 300, "other"),
      payment("c", "2026-03-01", 500),
    ],
    2026,
    "2026-10-07",
    2,
  );
  expect(summary.total).toBe(1000);
  expect(summary.months[0].amount).toBe(500);
  expect(summary.months[1].amount).toBe(0);
  expect(summary.months[2].accumulated).toBe(1000);
  expect(summary.count).toBe(3);
  expect(summary.students).toBe(2);
  expect(summary.ticket).toBeCloseTo(1000 / 3);
});

it("compara o mês corrente somente com os mesmos dias do mês anterior", () => {
  const summary = incomeSummary(
    [
      payment("a", "2026-09-02", 100),
      payment("b", "2026-09-20", 900),
      payment("c", "2026-10-05", 150),
    ],
    2026,
    "2026-10-07",
    9,
  );
  expect(summary.previousAmount).toBe(100);
  expect(summary.growth).toBe(50);
  expect(summary.partial).toBe(true);
});

it("compara janeiro com dezembro e meses encerrados com o mês anterior inteiro", () => {
  const summary = incomeSummary(
    [payment("a", "2025-12-31", 200), payment("b", "2026-01-20", 100)],
    2026,
    "2026-10-07",
    0,
  );
  expect(summary.previousAmount).toBe(200);
  expect(summary.growth).toBe(-50);
  expect(summary.total).toBe(100);
  expect(summary.partial).toBe(false);
});

it("não conta pagamentos futuros nem valores negativos como entradas", () => {
  const summary = incomeSummary(
    [
      payment("a", "2026-10-10", 500),
      payment("b", "2026-10-01", -100),
      payment("c", "2026-10-02", 0),
    ],
    2026,
    "2026-10-07",
    9,
  );
  expect(summary.total).toBe(0);
  expect(summary.count).toBe(1);
  expect(summary.excluded).toBe(1);
  expect(summary.months[10].future).toBe(true);
  expect(summary.growth).toBeNull();
});

it("retorna zero e crescimento indefinido quando não há histórico", () => {
  const summary = incomeSummary([], 2026, "2026-10-07", 9);
  expect(summary.total).toBe(0);
  expect(summary.ticket).toBe(0);
  expect(summary.growth).toBeNull();
  expect(summary.bestMonth).toBeNull();
});
