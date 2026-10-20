import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ cookies: vi.fn(), admin: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: mocks.admin }));
import { authorizedStudent, getStudentSession } from "./student-access";
import { hashSession as hashSessionForTest } from "./mail/crypto";
const token = "a".repeat(43);
const session = {
  id: "session",
  email: "alice@example.com",
  expires_at: "2026-11-07T12:00:00Z",
  token_hash: hashSessionForTest(token),
};
const student = {
  id: "alice",
  teacher_id: "teacher-a",
  slug: "old-link",
  email: "alice@example.com",
  access_version: 2,
  active: true,
};
type Row = Record<string, unknown>;
function db(rows: Record<string, Row[]>) {
  return {
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = [];
      const query = {
        select() {
          return query;
        },
        eq(key: string, value: unknown) {
          filters.push((row) => row[key] === value);
          return query;
        },
        gt(key: string, value: string) {
          filters.push((row) => String(row[key]) > value);
          return query;
        },
        async maybeSingle() {
          return {
            data: (rows[table] ?? []).find((row) => filters.every((f) => f(row))) ?? null,
            error: null,
          };
        },
      };
      return query;
    },
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
  mocks.cookies.mockResolvedValue({ get: () => ({ value: token }) });
});
afterEach(() => vi.useRealTimers());
function prepare(changes: Record<string, Row[] | undefined> = {}) {
  mocks.admin.mockReturnValue(
    db({
      student_sessions: [session],
      students: [student],
      student_session_links: [{ session_id: "session", student_id: "alice", access_version: 2 }],
      ...changes,
    }),
  );
}
it("o link conhecido não autoriza acesso sem cookie", async () => {
  prepare();
  mocks.cookies.mockResolvedValue({ get: () => undefined });
  expect(await authorizedStudent("old-link", "slug")).toBeNull();
  expect(mocks.admin).not.toHaveBeenCalled();
});
it("rejeita sessão inexistente, alterada e expirada", async () => {
  prepare({ student_sessions: [] });
  expect(await getStudentSession()).toBeNull();
  prepare({ student_sessions: [{ ...session, expires_at: "2026-10-07T12:00:00Z" }] });
  expect(await getStudentSession()).toBeNull();
});
it("autoriza id e URL antiga somente pelo vínculo de sessão", async () => {
  prepare();
  expect(await authorizedStudent("alice")).toEqual(student);
  expect(await authorizedStudent("old-link", "slug")).toEqual(student);
});
it.each([
  { students: [{ ...student, email: "bob@example.com" }] },
  { students: [{ ...student, active: false }] },
  { student_session_links: [] },
  { student_session_links: [{ session_id: "session", student_id: "alice", access_version: 1 }] },
  {
    student_session_links: [{ session_id: "someone-else", student_id: "alice", access_version: 2 }],
  },
])("nega acesso após email/estado/vínculo mudar", async (rows) => {
  prepare(rows);
  expect(await authorizedStudent("alice")).toBeNull();
});
it("nega aluno de outra professora sem vínculo", async () => {
  prepare({ students: [student, { ...student, id: "bob", teacher_id: "teacher-b" }] });
  expect(await authorizedStudent("bob")).toBeNull();
});

it("mesmo email não autoriza outro perfil sem vínculo da sessão", async () => {
  prepare({ students: [student, { ...student, id: "other-profile", slug: "other-link" }] });
  expect(await authorizedStudent("other-link", "slug")).toBeNull();
  expect(await authorizedStudent("other-profile")).toBeNull();
});
