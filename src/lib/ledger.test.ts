import { describe, expect, it } from "vitest";
import {
  visibleLessons,
  computeLedger,
  type LessonEvent,
  type Package,
  type Schedule,
} from "./ledger";

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

it("keeps positive opening credits separate from paid packages", () => {
  const result = computeLedger({
    schedules: [{ ...tuesday, starts_on: "2026-10-06" }],
    events: [],
    packages: [pkg("2026-10-08", 4)],
    openingCredits: 2,
    today: "2026-10-07",
    time: "10:00",
  });
  expect(result.credits).toBe(6);
  expect(result.remaining).toBe(5);
  expect(result.lessons[0].packageId).toBe("opening");
  expect(result.lessons[2].packageId).toBe("2026-10-08");
});
it("uses later package credits to settle imported debt before future coverage", () => {
  const result = computeLedger({
    schedules: [{ ...tuesday, starts_on: "2026-10-06" }],
    events: [],
    packages: [pkg("2026-10-08", 4)],
    openingCredits: -2,
    today: "2026-10-07",
    time: "10:00",
  });
  expect(result.credits).toBe(2);
  expect(result.remaining).toBe(1);
  expect(result.lessons[0].packageId).toBe("2026-10-08");
  expect(result.lessons[2].packageId).toBeNull();
});
it("does not turn imported debt into historical income or used lessons", () => {
  const result = computeLedger({
    schedules: [],
    events: [],
    packages: [],
    openingCredits: -3,
    today: "2026-10-21",
    time: "10:00",
  });
  expect(result.remaining).toBe(-3);
  expect(result.used).toBe(0);
});

it("only displays future occurrences covered by real package or opening credits", () => {
  const ledger = computeLedger({
    schedules: [{ ...tuesday, starts_on: "2026-10-06" }],
    events: [],
    packages: [pkg("2026-10-05", 4)],
    today: "2026-10-05",
    time: "10:00",
  });
  expect(visibleLessons(ledger, "2026-10-05")).toHaveLength(4);
  const empty = computeLedger({
    schedules: [{ ...tuesday, starts_on: "2026-10-06" }],
    events: [],
    packages: [],
    today: "2026-10-05",
    time: "10:00",
  });
  expect(visibleLessons(empty, "2026-10-05")).toEqual([]);
});
it("preserves past lessons without packages when trimming the future projection", () => {
  const ledger = run([], []);
  const visible = visibleLessons(ledger, "2026-10-07");
  expect(visible).toHaveLength(6);
  expect(visible.every((l) => l.past)).toBe(true);
  expect(ledger.remaining).toBe(-6);
});

it("keeps saved lessons and their package slots after the schedule is replaced", () => {
  const history = [
    {
      historyId: "saved",
      sourceKind: "schedule" as const,
      sourceId: "old",
      date: "2026-10-06",
      time: "19:00",
      durationMinutes: 60,
      status: "dada" as const,
      statusSource: "presumed" as const,
      counts: true,
      past: true,
      packageId: "paid",
      packageIndex: 0,
      packagePosition: 1,
      event: null,
      planName: "Original",
    },
  ];
  const ledger = computeLedger({
    history,
    schedules: [{ ...tuesday, id: "new", starts_on: "2026-10-06" }],
    events: [],
    packages: [{ id: "paid", paid_on: "2026-10-01", lessons: 4, amount: 300 }],
    today: "2026-10-07",
    time: "10:00",
  });
  expect(ledger.lessons.filter((l) => l.date === "2026-10-06")).toHaveLength(1);
  expect(ledger.lessons[0]).toMatchObject({
    historyId: "saved",
    planName: "Original",
    packageId: "paid",
    packagePosition: 1,
  });
  expect(ledger.used).toBe(1);
  expect(ledger.remaining).toBe(3);
  expect(ledger.lessons.find((l) => l.date === "2026-10-13")).toMatchObject({ packagePosition: 2 });
  const removed = computeLedger({
    history,
    schedules: [],
    events: [],
    packages: [{ id: "paid", paid_on: "2026-10-01", lessons: 4, amount: 300 }],
    today: "2026-10-07",
    time: "10:00",
  });
  expect(removed.used).toBe(1);
  expect(removed.lessons[0].historyId).toBe("saved");
});
it("reserves an early joined occurrence once without consuming a credit before its time", () => {
  const history = [
    {
      historyId: "joined",
      sourceKind: "appointment" as const,
      sourceId: "once",
      date: "2026-10-07",
      time: "19:00",
      status: "agendada" as const,
      counts: true,
      past: false,
      packageId: "paid",
      packageIndex: 0,
      packagePosition: 1,
      event: null,
    },
  ];
  const ledger = computeLedger({
    history,
    schedules: [],
    events: [],
    packages: [{ id: "paid", paid_on: "2026-10-01", lessons: 4, amount: 300 }],
    today: "2026-10-07",
    time: "18:55",
  });
  expect(ledger.used).toBe(0);
  expect(ledger.remaining).toBe(4);
  expect(ledger.lessons).toHaveLength(1);
});
