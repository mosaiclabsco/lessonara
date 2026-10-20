import { describe, expect, it } from "vitest";
import { computeLedger, type LessonEvent, type Package, type Schedule } from "./ledger";

// 2026-10-06 é terça-feira.
const tuesday: Schedule = { weekday: 2, time: "19:00", starts_on: "2026-09-01", ends_on: null };
const pkg = (paid_on: string, lessons = 4): Package => ({
  id: paid_on,
  paid_on,
  lessons,
  amount: 300,
});
const ev = (date: string, kind: LessonEvent["kind"], time: string | null = null): LessonEvent => ({
  id: date + kind,
  date,
  kind,
  time,
  note: null,
});

const run = (events: LessonEvent[], packages: Package[], today = "2026-10-07", time = "10:00") =>
  computeLedger({ schedules: [tuesday], events, packages, today, time });

describe("computeLedger", () => {
  it("aulas passadas contam como dadas", () => {
    const l = run([], [pkg("2026-09-01", 8)]);
    // terças de set/01 a out/06 = 6 aulas
    expect(l.used).toBe(6);
    expect(l.remaining).toBe(2);
    expect(l.coveredUntil).toBe("2026-10-20");
  });

  it("falta conta, desmarcada não", () => {
    const l = run(
      [ev("2026-09-08", "falta"), ev("2026-09-15", "desmarcada")],
      [pkg("2026-09-01", 8)],
    );
    expect(l.used).toBe(5);
    expect(l.lessons.find((x) => x.date === "2026-09-08")!.status).toBe("falta");
    expect(l.lessons.find((x) => x.date === "2026-09-15")!.counts).toBe(false);
  });

  it("reposição consome aula", () => {
    const l = run(
      [ev("2026-09-15", "desmarcada"), ev("2026-09-18", "reposicao", "18:00")],
      [pkg("2026-09-01", 8)],
    );
    expect(l.used).toBe(6);
  });

  it("aula de hoje só conta depois do horário", () => {
    expect(run([], [pkg("2026-09-01", 8)], "2026-10-06", "18:59").used).toBe(5);
    expect(run([], [pkg("2026-09-01", 8)], "2026-10-06", "19:00").used).toBe(6);
  });

  it("distribui aulas entre pacotes na ordem de pagamento", () => {
    const l = run([], [pkg("2026-10-01"), pkg("2026-09-01")]);
    const counted = l.lessons.filter((x) => x.counts);
    expect(counted[3].packageIndex).toBe(0);
    expect(counted[4].packageIndex).toBe(1);
    expect(counted[8].packageIndex).toBe(null);
    expect(l.remaining).toBe(2);
  });

  it("saldo negativo quando dá aula sem pagamento", () => {
    const l = run([], [pkg("2026-09-01")]);
    expect(l.remaining).toBe(-2);
  });

  it("respeita fim da agenda", () => {
    const l = computeLedger({
      schedules: [{ ...tuesday, ends_on: "2026-09-20" }],
      events: [],
      packages: [],
      today: "2026-10-07",
      time: "10:00",
    });
    expect(l.lessons.map((x) => x.date)).toEqual(["2026-09-01", "2026-09-08", "2026-09-15"]);
  });
});
