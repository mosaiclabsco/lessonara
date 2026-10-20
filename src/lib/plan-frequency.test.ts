import { expect, it } from "vitest";
import { computeLedger } from "./ledger";
import { firstPlannedDate, validatePlanFrequency } from "./plan-frequency";
it("agenda dia 31 somente nos meses em que existe", () => {
  const ledger = computeLedger({
    schedules: [
      {
        weekday: 0,
        monthly_day: 31,
        time: "10:00",
        starts_on: "2027-01-01",
        ends_on: "2027-04-30",
      },
    ],
    events: [],
    packages: [],
    today: "2027-01-01",
    time: "00:00",
  });
  expect(ledger.lessons.map((l) => l.date)).toEqual(["2027-01-31", "2027-03-31"]);
  expect(firstPlannedDate("2027-02-01", "month", 31)).toBe("2027-03-31");
});
it("datas avulsas consomem crédito e respeitam desmarcação", () => {
  const ledger = computeLedger({
    schedules: [],
    appointments: [
      { id: "a", date: "2027-02-15", time: "10:00" },
      { id: "b", date: "2027-02-20", time: "10:00" },
    ],
    events: [
      { id: "cancelled", date: "2027-02-15", time: "10:00", kind: "desmarcada", note: null },
    ],
    packages: [{ id: "package", paid_on: "2027-02-01", lessons: 2, amount: 300 }],
    today: "2027-02-21",
    time: "10:00",
  });
  expect(ledger.used).toBe(1);
  expect(ledger.remaining).toBe(1);
});
it.each([
  ["week", 8, "recurring"],
  ["month", 32, "flexible"],
  ["month", 0, "recurring"],
  ["year", 1, "recurring"],
])("valida frequência %s/%s", (period, count, mode) =>
  expect(() => validatePlanFrequency(period, count, mode)).toThrow(),
);
