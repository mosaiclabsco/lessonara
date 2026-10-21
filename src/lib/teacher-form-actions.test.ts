import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  busy: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ requireUser: mocks.auth }));
vi.mock("@/lib/onboarding", () => ({ requireConfiguredTeacher: mocks.auth }));
vi.mock("@/lib/google/calendar", () => ({ googleBusy: mocks.busy }));
vi.mock("@/lib/google/worker", () => ({ processCalendarJobs: vi.fn() }));
vi.mock("@/lib/mail/outbox", () => ({ processEmails: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import {
  addPackage,
  addReposicao,
  addSchedule,
  endSchedule,
  createPlan,
  createStudent,
  updateTeacher,
  markLesson,
} from "@/app/(panel)/actions";
const uuid = "00000000-0000-4000-8000-000000000001";
function form(input: Record<string, string>) {
  const value = new FormData();
  Object.entries(input).forEach(([key, v]) => value.set(key, v));
  return value;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockImplementation((table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      insert: mocks.insert,
      update: mocks.update,
      maybeSingle: async () => ({
        data: { id: uuid, plan_id: uuid, starts_on: "2026-10-21" },
        error: null,
      }),
      single: async () => ({
        data:
          table === "plans"
            ? { frequency_period: "week", frequency_count: 1, scheduling_mode: "recurring" }
            : { lesson_minutes: 60 },
        error: null,
      }),
    };
    return query;
  });
  mocks.auth.mockResolvedValue({ supabase: { from: mocks.from }, userId: uuid });
});
it("uma requisição direta não grava nome vazio ou observações enormes", async () => {
  const base = { email: "aluno@example.com", name: " ", phone: "", plan_id: uuid };
  expect(await createStudent(form(base))).toMatchObject({ validation: { field: "name" } });
  expect(
    await createStudent(form({ ...base, name: "Aluno", notes: "x".repeat(4001) })),
  ).toMatchObject({ validation: { field: "notes" } });
  expect(mocks.insert).not.toHaveBeenCalled();
});
it("não grava pagamento com data impossível, dinheiro acima do teto ou créditos fracionados", async () => {
  for (const [patch, field] of [
    [{ paid_on: "2026-02-30" }, "paid_on"],
    [{ amount: "99000,01" }, "amount"],
    [{ lessons: "1.4" }, "lessons"],
  ] as const) {
    expect(
      await addPackage(
        uuid,
        form(Object.assign({ paid_on: "2026-10-20", lessons: "4", amount: "300,00" }, patch)),
      ),
    ).toMatchObject({ validation: { field } });
  }
  expect(mocks.insert).not.toHaveBeenCalled();
});
it("não consulta o Google para um dia inválido ou fracionado", async () => {
  expect(
    await addSchedule(uuid, form({ time: "10:00", starts_on: "2026-02-30", weekday: "1" })),
  ).toMatchObject({ ok: false });
  expect(
    await addSchedule(uuid, form({ time: "10:00", starts_on: "2026-10-20", weekday: "1.5" })),
  ).toMatchObject({ ok: false });
  expect(mocks.busy).not.toHaveBeenCalled();
  expect(mocks.insert).not.toHaveBeenCalled();
});
it("recusa planos incoerentes e perfil com duração fracionada", async () => {
  expect(
    await createPlan(
      form({
        name: "Plano",
        price: "300,00",
        lessons: "4",
        frequency_period: "week",
        frequency_count: "1",
        scheduling_mode: "flexible",
      }),
    ),
  ).toMatchObject({ validation: { field: "frequency_count" } });
  expect(await updateTeacher(form({ name: "Prof", lesson_minutes: "15.5" }))).toMatchObject({
    validation: { field: "lesson_minutes" },
  });
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});
it("recusa reposição sem data e alteração de tipo adulterada", async () => {
  expect(await addReposicao(uuid, form({ time: "10:00" }))).toMatchObject({
    validation: { field: "date" },
  });
  await expect(markLesson(uuid, "2026-10-20", "10:00", "reposicao" as "falta")).rejects.toThrow();
  expect(mocks.insert).not.toHaveBeenCalled();
});

it("recusa encerramento anterior ao início sem gravar", async () => {
  expect(await endSchedule(uuid, uuid, form({ ends_on: "2026-10-20" }))).toMatchObject({
    validation: { field: "ends_on" },
  });
  expect(mocks.update).not.toHaveBeenCalled();
});

it("exige uma aula desmarcada de origem para a reposição", async () => {
  expect(await addReposicao(uuid, form({ date: "2026-10-22", time: "10:00" }))).toMatchObject({
    validation: { field: "source_event_id" },
  });
  expect(mocks.insert).not.toHaveBeenCalled();
});
