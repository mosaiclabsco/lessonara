import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({
  plan: vi.fn(),
  studentAccess: vi.fn(),
  claims: vi.fn(),
  teacher: vi.fn(),
  target: vi.fn(),
  ledgers: vi.fn(),
}));
vi.mock("./student-access", () => ({ authorizedStudent: mock.studentAccess }));
vi.mock("./data", () => ({ loadLedgers: mock.ledgers }));
vi.mock("./supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: mock.claims },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mock.teacher }) }) }),
  }),
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: vi.fn().mockReturnThis(), maybeSingle: mock.target }) }),
  }),
}));
vi.mock("./platform-plan-server", () => ({ loadTeacherPlan: mock.plan }));
import { loadClassroomAccess } from "./classroom-server";
const ref = {
  studentId: "11111111-1111-4111-8111-111111111111",
  sourceKind: "schedule" as const,
  sourceId: "22222222-2222-4222-8222-222222222222",
  date: "2026-10-12",
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.plan.mockResolvedValue({ id: "pro", classroom: true });
  mock.studentAccess.mockResolvedValue(null);
  mock.claims.mockResolvedValue({ data: { claims: null }, error: null });
  mock.teacher.mockResolvedValue({ data: null, error: null });
  mock.target.mockResolvedValue({ data: null, error: null });
});
it("sem sessão não consulta a agenda nem emite acesso", async () => {
  expect(await loadClassroomAccess(ref)).toBeNull();
  expect(mock.target).not.toHaveBeenCalled();
  expect(mock.ledgers).not.toHaveBeenCalled();
});
it("uma conta autenticada sem cadastro de professor não ganha acesso", async () => {
  mock.claims.mockResolvedValue({
    data: {
      claims: { sub: "other", session_id: "session", session_expires_at: Date.now() / 1000 + 3600 },
    },
  });
  expect(await loadClassroomAccess(ref)).toBeNull();
  expect(mock.target).not.toHaveBeenCalled();
});
it("outro professor não acessa aluno fora de sua conta", async () => {
  mock.claims.mockResolvedValue({
    data: {
      claims: { sub: "other", session_id: "session", session_expires_at: Date.now() / 1000 + 3600 },
    },
  });
  mock.teacher.mockResolvedValue({ data: { id: "other", name: "Outro" }, error: null });
  expect(await loadClassroomAccess(ref)).toBeNull();
  expect(mock.ledgers).not.toHaveBeenCalled();
});
it("usa vínculo validado do aluno e ocorrência real da agenda", async () => {
  mock.studentAccess.mockResolvedValue({ id: ref.studentId, teacher_id: "teacher" });
  mock.target.mockResolvedValue({
    data: { id: ref.studentId, teacher_id: "teacher", name: "Aluno", slug: "student-link" },
    error: null,
  });
  mock.ledgers.mockResolvedValue(
    new Map([
      [
        ref.studentId,
        {
          ledger: {
            lessons: [{ date: ref.date, sourceKind: ref.sourceKind, sourceId: ref.sourceId }],
          },
        },
      ],
    ]),
  );
  const result = await loadClassroomAccess(ref);
  expect(result?.participant).toEqual({ id: ref.studentId, name: "Aluno", role: "student" });
  expect(result?.backHref).toBe("/a/student-link");
  expect(mock.claims).toHaveBeenCalled();
});

it("o professor da turma continua moderador se houver sessão de aluno no mesmo navegador", async () => {
  mock.claims.mockResolvedValue({
    data: {
      claims: {
        sub: "teacher",
        session_id: "session",
        session_expires_at: Date.now() / 1000 + 3600,
      },
    },
  });
  mock.teacher.mockResolvedValue({ data: { id: "teacher", name: "Professora" }, error: null });
  mock.target.mockResolvedValue({
    data: { id: ref.studentId, teacher_id: "teacher", name: "Aluno", slug: "student-link" },
    error: null,
  });
  mock.ledgers.mockResolvedValue(
    new Map([
      [
        ref.studentId,
        {
          ledger: {
            lessons: [{ date: ref.date, sourceKind: ref.sourceKind, sourceId: ref.sourceId }],
          },
        },
      ],
    ]),
  );
  const result = await loadClassroomAccess(ref);
  expect(result?.participant.role).toBe("teacher");
  expect(mock.studentAccess).not.toHaveBeenCalled();
});

it("o plano da empresa restringe a sala sem promover o aluno", async () => {
  mock.plan.mockResolvedValue({ id: "essential", classroom: false });
  mock.studentAccess.mockResolvedValue({ id: ref.studentId, teacher_id: "teacher" });
  mock.target.mockResolvedValue({
    data: { id: ref.studentId, teacher_id: "teacher", name: "Aluno", slug: "student-link" },
    error: null,
  });
  mock.ledgers.mockResolvedValue(
    new Map([
      [
        ref.studentId,
        {
          ledger: {
            lessons: [{ date: ref.date, sourceKind: ref.sourceKind, sourceId: ref.sourceId }],
          },
        },
      ],
    ]),
  );
  const access = await loadClassroomAccess(ref);
  expect(access?.roomAllowed).toBe(false);
  expect(access?.participant.role).toBe("student");
});

it("sessão de professor vencida não consulta dados privilegiados", async () => {
  mock.claims.mockResolvedValue({
    data: { claims: { sub: "teacher", session_id: "session", session_expires_at: 1 } },
  });
  expect(await loadClassroomAccess(ref)).toBeNull();
  expect(mock.teacher).not.toHaveBeenCalled();
  expect(mock.target).not.toHaveBeenCalled();
});
