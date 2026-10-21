import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("./performance", () => ({
  measure: (_stage: string, operation: () => unknown) => operation(),
}));
const holiday = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("./holiday-data", () => ({ loadHolidayRules: holiday.load }));
import { loadLedgers } from "./data";
beforeEach(() => {
  vi.clearAllMocks();
  holiday.load.mockResolvedValue({ ready: true, settings: [], holidays: [] });
});
function database(students: { id: string; teacher_id: string }[]) {
  const queries: string[] = [];
  const pending: (() => void)[] = [];
  const from = vi.fn((table: string) => {
    queries.push(table);
    const builder = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      returns: () =>
        new Promise((resolve) =>
          pending.push(() => resolve({ data: table === "students" ? students : [], error: null })),
        ),
    };
    return builder;
  });
  return {
    db: { from } as unknown as SupabaseClient,
    queries,
    release: () => pending.splice(0).forEach((resolve) => resolve()),
  };
}
it("reuses server-loaded ownership and starts holidays before ledger reads finish", async () => {
  const owned = [{ id: "student", teacher_id: "teacher", opening_credits: 0 }];
  const fixture = database(owned);
  const result = loadLedgers(fixture.db, ["student"], owned);
  await Promise.resolve();
  expect(fixture.queries).toEqual(["schedules", "packages", "lesson_events", "appointments"]);
  expect(holiday.load).toHaveBeenCalledWith(fixture.db, ["teacher"]);
  fixture.release();
  expect((await result).get("student")?.ledger.remaining).toBe(0);
});
it("still resolves ownership for public and existing callers without supplied rows", async () => {
  const fixture = database([{ id: "student", teacher_id: "teacher" }]);
  const result = loadLedgers(fixture.db, ["student"]);
  expect(fixture.queries).toContain("students");
  expect(holiday.load).not.toHaveBeenCalled();
  fixture.release();
  await result;
  expect(holiday.load).toHaveBeenCalledWith(fixture.db, ["teacher"]);
});
it("does not query holiday data for unrelated supplied students", async () => {
  const fixture = database([]);
  const result = loadLedgers(
    fixture.db,
    ["student"],
    [{ id: "unrelated", teacher_id: "other", opening_credits: 0 }],
  );
  await Promise.resolve();
  expect(holiday.load).toHaveBeenCalledWith(fixture.db, []);
  fixture.release();
  await result;
});

it("reuses supplied opening balance without adding a sequential student query", async () => {
  const owned = [{ id: "student", teacher_id: "teacher", opening_credits: 6 }];
  const fixture = database(owned);
  const result = loadLedgers(fixture.db, ["student"], owned);
  await Promise.resolve();
  expect(fixture.queries).not.toContain("students");
  fixture.release();
  expect((await result).get("student")?.ledger.remaining).toBe(6);
});
