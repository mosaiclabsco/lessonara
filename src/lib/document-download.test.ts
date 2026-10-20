import { afterEach, beforeEach, expect, it, vi } from "vitest";

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

vi.mock("@/lib/student-access", () => ({ authorizedStudent: mocks.authorized }));
import { GET as studentDownload } from "@/app/a/[slug]/materials/[shareId]/route";
import { GET as teacherDownload } from "@/app/(panel)/documents/[id]/file/route";

type Row = Record<string, unknown>;
const student = { id: "student-a", teacher_id: "teacher-a", slug: "student-link" };
const shared = {
  id: "share-a",
  student_id: "student-a",
  teacher_id: "teacher-a",
  expires_on: null,
  documents: {
    storage_path: "teacher-a/doc/file.pdf",
    file_name: "aula.pdf",
    teacher_id: "teacher-a",
    status: "ready",
  },
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
          const data =
            (records[table] ?? []).find((row) =>
              filters.every(
                ([key, value]) =>
                  key
                    .split(".")
                    .reduce<unknown>((current, part) => (current as Row)?.[part], row) === value,
              ),
            ) ?? null;
          return { data, error: null };
        },
      };
      return query;
    },
    storage: { from: () => ({ createSignedUrl: mocks.signed }) },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorized.mockResolvedValue(student);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-07T15:00:00Z"));
  mocks.signed.mockResolvedValue({
    data: { signedUrl: "https://files.example.com/test.pdf" },
    error: null,
  });
});
afterEach(() => vi.useRealTimers());

const request = new Request("https://lessonara.example/a/student-link/materials/share-a");
const params = { params: Promise.resolve({ slug: "student-link", shareId: "share-a" }) };

it("não assina download para um link de aluno desconhecido", async () => {
  mocks.authorized.mockResolvedValue(null);
  mocks.admin.mockReturnValue(client({ students: [], document_shares: [shared] }));
  expect((await studentDownload(request, params)).status).toBe(404);
  expect(mocks.signed).not.toHaveBeenCalled();
});

it.each([
  { ...shared, student_id: "student-b" },
  { ...shared, teacher_id: "teacher-b" },
  { ...shared, documents: { ...shared.documents, teacher_id: "teacher-b" } },
  { ...shared, documents: { ...shared.documents, status: "uploading" } },
])("não revela arquivos de outro aluno/professora nem envios incompletos", async (share) => {
  mocks.admin.mockReturnValue(client({ students: [student], document_shares: [share] }));
  expect((await studentDownload(request, params)).status).toBe(404);
  expect(mocks.signed).not.toHaveBeenCalled();
});

it("nega prazo vencido mesmo quando o aluno ainda tem a URL antiga", async () => {
  mocks.admin.mockReturnValue(
    client({ students: [student], document_shares: [{ ...shared, expires_on: "2026-10-06" }] }),
  );
  expect((await studentDownload(request, params)).status).toBe(403);
  expect(mocks.signed).not.toHaveBeenCalled();
});

it("assina apenas o material liberado, por 60 segundos e sem cache", async () => {
  mocks.admin.mockReturnValue(client({ students: [student], document_shares: [shared] }));
  const response = await studentDownload(request, params);
  expect(response.status).toBe(303);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  expect(mocks.signed).toHaveBeenCalledWith(shared.documents.storage_path, 60, {
    download: "aula.pdf",
  });
});

it("a professora não baixa um documento pertencente a outra conta", async () => {
  mocks.user.mockResolvedValue({
    userId: "teacher-a",
    supabase: client({ documents: [{ id: "doc", teacher_id: "teacher-b", status: "ready" }] }),
  });
  expect((await teacherDownload(request, { params: Promise.resolve({ id: "doc" }) })).status).toBe(
    404,
  );
  expect(mocks.signed).not.toHaveBeenCalled();
});

it("conhecer a URL não permite baixar materiais sem sessão", async () => {
  mocks.authorized.mockResolvedValue(null);
  mocks.admin.mockReturnValue(client({ students: [student], document_shares: [shared] }));
  expect((await studentDownload(request, params)).status).toBe(404);
  expect(mocks.signed).not.toHaveBeenCalled();
});
