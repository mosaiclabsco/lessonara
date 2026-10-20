import { expect, it } from "vitest";
import { computeLedger, type HolidayPolicy } from "./ledger";
const run = (
  holidayPolicy: HolidayPolicy,
  events: Parameters<typeof computeLedger>[0]["events"] = [],
) =>
  computeLedger({
    schedules: [{ weekday: 1, time: "10:00", starts_on: "2026-10-05", ends_on: "2026-11-02" }],
    packages: [{ id: "package", paid_on: "2026-10-01", lessons: 4, amount: 300 }],
    holidays: [{ date: "2026-10-12", name: "Feriado cadastrado" }],
    holidayPolicy,
    events,
    today: "2026-10-13",
    time: "12:00",
  });
it("feriado que consome crédito mantém a quantidade e a cobertura do pacote", () => {
  const ledger = run("consume");
  expect(ledger.used).toBe(2);
  expect(ledger.remaining).toBe(2);
  expect(ledger.coveredUntil).toBe("2026-10-26");
  expect(ledger.lessons[1]).toMatchObject({
    status: "feriado",
    counts: true,
    packageId: "package",
  });
});
it("feriado preserva o crédito e estende a cobertura para a próxima aula", () => {
  const ledger = run("preserve");
  expect(ledger.credits).toBe(4);
  expect(ledger.used).toBe(1);
  expect(ledger.remaining).toBe(3);
  expect(ledger.coveredUntil).toBe("2026-11-02");
  expect(ledger.lessons[1]).toMatchObject({ status: "feriado", counts: false, packageId: null });
});
it("reposições continuam consumindo crédito mesmo em feriado", () => {
  const ledger = run("preserve", [
    { id: "extra", date: "2026-10-12", time: "14:00", kind: "reposicao", note: null },
  ]);
  expect(ledger.used).toBe(2);
  expect(ledger.lessons.find((l) => l.status === "reposicao")?.counts).toBe(true);
});
it("desmarcação explícita permanece sem cobrança mesmo na política de consumo", () => {
  expect(
    run("consume", [
      { id: "cancel", date: "2026-10-12", time: "10:00", kind: "desmarcada", note: null },
    ]).used,
  ).toBe(1);
});
it("contas sem feriados configurados mantêm o comportamento anterior", () => {
  const ledger = computeLedger({
    schedules: [{ weekday: 1, time: "10:00", starts_on: "2026-10-05", ends_on: "2026-10-12" }],
    packages: [],
    events: [],
    today: "2026-10-13",
    time: "12:00",
  });
  expect(ledger.used).toBe(2);
  expect(ledger.lessons.every((l) => l.status === "dada")).toBe(true);
});
