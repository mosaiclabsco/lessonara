import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({
  access: vi.fn(),
  owner: vi.fn(),
  document: vi.fn(),
  download: vi.fn(),
}));
vi.mock("./classroom-server", () => ({ loadClassroomAccess: mock.access }));
vi.mock("./supabase/server", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: vi.fn().mockReturnThis(),
        single: mock.owner,
        maybeSingle: mock.document,
      }),
    }),
    storage: { from: () => ({ createSignedUrl: mock.download }) },
  }),
}));
import { POST } from "@/app/classroom/[studentId]/[sourceKind]/[sourceId]/[date]/material/route";
import { emptyMaterial } from "./classroom-material";
const ref = {
  studentId: "11111111-1111-4111-8111-111111111111",
  sourceKind: "appointment",
  sourceId: "22222222-2222-4222-8222-222222222222",
  date: "2026-10-10",
};
const post = (body: unknown, params = ref) =>
  POST(
    new Request("https://lessonara.example.test/classroom/material", {
      method: "POST",
      headers: { origin: "https://lessonara.example.test" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve(params) },
  );
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("EMAIL_ENCRYPTION_KEY", "ab".repeat(32));
  mock.owner.mockResolvedValue({ data: { teacher_id: "teacher" }, error: null });
  mock.access.mockResolvedValue({
    roomAllowed: true,
    participant: { id: "teacher", role: "teacher" },
    lesson: { status: "agendada" },
  });
  mock.document.mockResolvedValue({
    data: {
      id: "33333333-3333-4333-8333-333333333333",
      title: "PDF aula",
      storage_path: "teacher/file.pdf",
    },
    error: null,
  });
  mock.download.mockResolvedValue({
    data: { signedUrl: "https://files.example.test/qa.pdf" },
    error: null,
  });
});
it("aluno não publica estado mesmo enviando role=teacher", async () => {
  mock.access.mockResolvedValue({
    roomAllowed: true,
    participant: { id: "student", role: "student" },
    lesson: { status: "agendada" },
  });
  const response = await post({ op: "publish", role: "teacher", state: emptyMaterial() });
  expect(response.status).toBe(403);
});
it("uma pessoa sem vínculo não pode obter arquivo", async () => {
  mock.access.mockResolvedValue(null);
  expect((await post({ op: "file", token: "anything" })).status).toBe(403);
  expect(mock.download).not.toHaveBeenCalled();
});
it("aluno lê o PDF autorizado pelo professor, sem poder mudar o estado assinado", async () => {
  const state = { ...emptyMaterial(), documentId: "33333333-3333-4333-8333-333333333333" };
  const published = await post({ op: "publish", state });
  expect(published.status).toBe(200);
  const { token } = await published.json();
  mock.access.mockResolvedValue({
    roomAllowed: true,
    participant: { id: "student", role: "student" },
    lesson: { status: "agendada" },
  });
  const read = await post({ op: "read", token });
  expect(read.status).toBe(200);
  expect((await read.json()).state.documentId).toBe(state.documentId);
  expect((await post({ op: "file", token })).status).toBe(200);
  expect((await post({ op: "read", token }, { ...ref, date: "2026-10-11" })).status).toBe(403);
  expect((await post({ op: "read", token: token.slice(0, -4) + "aaaa" })).status).toBe(400);
});
it("cancelamento revoga novas leituras e publica apenas documentos da conta", async () => {
  mock.access.mockResolvedValue({
    roomAllowed: true,
    participant: { id: "teacher", role: "teacher" },
    lesson: { status: "desmarcada" },
  });
  expect((await post({ op: "publish", state: emptyMaterial() })).status).toBe(403);
  mock.access.mockResolvedValue({
    roomAllowed: true,
    participant: { id: "teacher", role: "teacher" },
    lesson: { status: "agendada" },
  });
  mock.document.mockResolvedValue({ data: null, error: null });
  expect(
    (
      await post({
        op: "publish",
        state: { ...emptyMaterial(), documentId: "33333333-3333-4333-8333-333333333333" },
      })
    ).status,
  ).toBe(404);
});

it("plano sem sala bloqueia material mesmo com sessão válida", async () => {
  mock.access.mockResolvedValue({
    roomAllowed: false,
    participant: { id: "teacher", role: "teacher" },
    lesson: { status: "agendada" },
  });
  expect((await post({ op: "publish", state: emptyMaterial() })).status).toBe(403);
  expect(mock.document).not.toHaveBeenCalled();
});
