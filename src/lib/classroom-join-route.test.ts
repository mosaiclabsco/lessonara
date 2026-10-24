import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  access: vi.fn(),
  previous: null as null | { admitted_at: string; joined_at: string | null },
  writes: [] as { operation: string; value: unknown }[],
  filters: [] as [string, unknown][],
  writeError: false,
}));
vi.mock("@/lib/classroom-server", () => ({
  getJitsiConfig: () => ({
    url: "https://meet.example.test",
    appId: "test",
    appSecret: "secret-".repeat(8),
  }),
  loadClassroomAccess: m.access,
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const query: Record<string, unknown> = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          m.filters.push([key, value]);
          return query;
        },
        single: async () => ({
          data: { teacher_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
          error: null,
        }),
        maybeSingle: async () => ({ data: m.previous, error: null }),
        update: (value: unknown) => {
          m.writes.push({ operation: "update", value });
          return query;
        },
        upsert: async (value: unknown) => {
          m.writes.push({ operation: "upsert", value });
          return { error: m.writeError ? { message: "database unavailable" } : null };
        },
        then: (resolve: (value: { error: { message: string } | null }) => unknown) =>
          resolve({ error: m.writeError ? { message: "database unavailable" } : null }),
      };
      if (!["students", "classroom_participation"].includes(table)) throw Error("unexpected table");
      return query;
    },
  }),
}));
import { POST } from "@/app/classroom/[studentId]/[sourceKind]/[sourceId]/[date]/join/route";
const ref = {
  studentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  sourceKind: "schedule",
  sourceId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  date: "2026-10-23",
};
const call = (body?: unknown, origin = "https://app.test") =>
  POST(
    new Request("https://app.test/classroom/join", {
      method: "POST",
      headers: { origin, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    { params: Promise.resolve(ref) },
  );
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-23T11:30:00-03:00"));
  m.previous = null;
  m.writes = [];
  m.filters = [];
  m.writeError = false;
  m.access.mockResolvedValue({
    participant: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Teacher", role: "teacher" },
    roomAllowed: true,
    lesson: {
      sourceKind: ref.sourceKind,
      sourceId: ref.sourceId,
      date: ref.date,
      time: "11:00",
      durationMinutes: 60,
      status: "agendada",
    },
  });
});
it("records server-authorized identity and ignores a forged actor in the payload", async () => {
  expect((await call({ participant_id: "other", participant_role: "student" })).status).toBe(200);
  expect(m.writes[0]).toMatchObject({
    operation: "upsert",
    value: {
      participant_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      participant_role: "teacher",
      student_id: ref.studentId,
      lesson_date: ref.date,
    },
  });
});
it("does not issue a token after the lesson without actual joined callback", async () => {
  vi.setSystemTime(new Date("2026-10-23T12:10:00-03:00"));
  expect((await call()).status).toBe(423);
  m.previous = { admitted_at: "2026-10-23T14:30:00Z", joined_at: null };
  expect((await call()).status).toBe(423);
  m.previous.joined_at = "2026-10-23T14:31:00Z";
  expect((await call()).status).toBe(200);
  vi.setSystemTime(new Date("2026-10-23T12:30:00-03:00"));
  expect((await call()).status).toBe(423);
});
it("requires a prior admission before accepting a conference callback", async () => {
  expect((await call({ op: "joined" })).status).toBe(423);
  m.previous = { admitted_at: "2026-10-23T14:30:00Z", joined_at: null };
  expect((await call({ op: "joined" })).status).toBe(200);
  expect(m.writes[0].operation).toBe("update");
  expect(m.filters).toContainEqual(["participant_id", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]);
});
it("fails closed when admission cannot be saved or identity is not authorized", async () => {
  m.writeError = true;
  expect((await call()).status).toBe(503);
  m.writeError = false;
  m.access.mockResolvedValue(null);
  expect((await call()).status).toBe(403);
  expect((await call(undefined, "https://other.test")).status).toBe(403);
});
