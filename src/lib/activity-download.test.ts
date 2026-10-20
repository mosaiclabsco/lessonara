import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  user: vi.fn(),
  signed: vi.fn(),
  authorized: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: mocks.admin,
  requireUser: mocks.user,
}));
vi.mock("./student-access", () => ({ authorizedStudent: mocks.authorized }));
import { activityDownload } from "./activity-download";
import { activityStatus } from "./activities";
type Row = Record<string, unknown>;
const student = { id: "student", teacher_id: "teacher", slug: "link" };
const activity = {
  id: "activity",
  teacher_id: "teacher",
  student_id: "student",
  document_id: "document",
  archived_at: null,
};
const document = {
  id: "document",
  teacher_id: "teacher",
  status: "ready",
  storage_path: "teacher/document/file.txt",
  file_name: "exercise.txt",
};
const submission = {
  activity_id: "activity",
  teacher_id: "teacher",
  student_id: "student",
  status: "ready",
  storage_path: "teacher/submission/file.txt",
  file_name: "answer.txt",
};
function client(records: Record<string, Row[]>) {
  return {
    from(table: string) {
      const filters: [string, unknown][] = [];
      const query = {
        select() {
          return query;
        },
        eq(key: string, value: unknown) {
          filters.push([key, value]);
          return query;
        },
        async maybeSingle() {
          return {
            error: null,
            data:
              (records[table] ?? []).find((row) =>
                filters.every(([key, value]) => row[key] === value),
              ) ?? null,
          };
        },
      };
      return query;
    },
    storage: { from: () => ({ createSignedUrl: mocks.signed }) },
  };
}
function prepare(overrides: Partial<Record<string, Row[]>> = {}) {
  mocks.authorized.mockResolvedValue((overrides.students ?? [student])[0] ?? null);
  mocks.admin.mockReturnValue(
    client({
      students: [student],
      activities: [activity],
      documents: [document],
      activity_submissions: [submission],
      ...overrides,
    }),
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.signed.mockResolvedValue({
    data: { signedUrl: "https://files.example.com/file.txt" },
    error: null,
  });
});
it.each([
  { students: [] },
  { activities: [{ ...activity, student_id: "someone-else" }] },
  { activities: [{ ...activity, teacher_id: "other-teacher" }] },
  { documents: [{ ...document, teacher_id: "other-teacher" }] },
  { documents: [{ ...document, status: "deleting" }] },
])("não assina o enunciado fora do aluno/professora autorizados", async (records) => {
  prepare(records);
  expect((await activityDownload("activity", "source", "link")).status).toBe(404);
  expect(mocks.signed).not.toHaveBeenCalled();
});
it.each([
  { ...submission, student_id: "other-student" },
  { ...submission, teacher_id: "other-teacher" },
  { ...submission, status: "uploading" },
  { ...submission, status: "deleted" },
])("não revela entrega alheia, incompleta ou removida", async (row) => {
  prepare({ activity_submissions: [row] });
  expect((await activityDownload("activity", "submission", "link")).status).toBe(404);
  expect(mocks.signed).not.toHaveBeenCalled();
});
it("o aluno baixa apenas sua entrega, com autorização curta e sem cache", async () => {
  prepare();
  const result = await activityDownload("activity", "submission", "link");
  expect(result.status).toBe(303);
  expect(result.headers.get("Cache-Control")).toBe("private, no-store");
  expect(mocks.signed).toHaveBeenCalledWith(submission.storage_path, 60, {
    download: "answer.txt",
  });
});
it("a professora não baixa entregas de outra conta", async () => {
  mocks.user.mockResolvedValue({
    userId: "other-teacher",
    supabase: client({ activities: [activity], activity_submissions: [submission] }),
  });
  expect((await activityDownload("activity", "submission")).status).toBe(404);
  expect(mocks.signed).not.toHaveBeenCalled();
});
it("prazo inclui o dia escolhido e sinaliza entrega tardia", () => {
  const base = { archived_at: null, reviewed_at: null, due_on: "2026-10-08", submission: null };
  expect(activityStatus(base, "2026-10-08")).toBe("Aguardando entrega");
  expect(activityStatus(base, "2026-10-09")).toBe("Prazo vencido");
  expect(
    activityStatus(
      {
        ...base,
        submission: {
          id: "s",
          status: "ready",
          file_name: "x.txt",
          byte_size: 2,
          submitted_at: "2026-10-09T13:00:00Z",
          submitted_late: true,
          note: "",
        },
      },
      "2026-10-09",
    ),
  ).toBe("Entregue após o prazo");
});

it("o slug não permite download sem sessão do aluno", async () => {
  prepare();
  mocks.authorized.mockResolvedValue(null);
  expect((await activityDownload("activity", "submission", "link")).status).toBe(404);
  expect(mocks.signed).not.toHaveBeenCalled();
});
