import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  neq: vi.fn(),
  duplicate: false,
  race: false,
}));
vi.mock("@/lib/supabase/server", () => ({ requireUser: m.auth }));
vi.mock("@/lib/onboarding", () => ({ requireConfiguredTeacher: m.auth }));
vi.mock("@/lib/google/calendar", () => ({ googleBusy: vi.fn() }));
vi.mock("@/lib/google/worker", () => ({ processCalendarJobs: vi.fn() }));
vi.mock("@/lib/mail/outbox", () => ({ processEmails: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { createStudent, updateStudent } from "@/app/(panel)/actions";
const id = "00000000-0000-4000-8000-000000000001";
function form() {
  const f = new FormData();
  Object.entries({
    name: "Student",
    email: "  STUDENT@EXAMPLE.COM  ",
    plan_id: id,
    phone: "",
  }).forEach(([k, v]) => f.set(k, v));
  return f;
}
beforeEach(() => {
  vi.clearAllMocks();
  m.duplicate = false;
  m.race = false;
  m.auth.mockResolvedValue({ supabase: { from: m.from }, userId: id });
  m.from.mockImplementation((table: string) => {
    const result = () => ({
      data: { id },
      error: m.race
        ? {
            code: "23505",
            message: 'duplicate key violates unique constraint "students_teacher_email_unique"',
          }
        : null,
    });
    const q = {
      select: () => q,
      eq: (...args: unknown[]) => {
        m.eq(...args);
        return q;
      },
      neq: (...args: unknown[]) => {
        m.neq(...args);
        return q;
      },
      insert: (...args: unknown[]) => {
        m.insert(...args);
        return q;
      },
      update: (...args: unknown[]) => {
        m.update(...args);
        return q;
      },
      maybeSingle: async () => ({
        data: table === "students" ? (m.duplicate ? { id } : null) : { id },
        error: null,
      }),
      single: async () => result(),
      then: (resolve: (r: unknown) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return q;
  });
});
it("criação recusa duplicata antes de gravar e limita consulta ao próprio professor", async () => {
  m.duplicate = true;
  expect(await createStudent(form())).toMatchObject({ validation: { field: "email" } });
  expect(m.insert).not.toHaveBeenCalled();
  expect(m.eq).toHaveBeenCalledWith("teacher_id", id);
  expect(m.eq).toHaveBeenCalledWith("email", "student@example.com");
});
it("edição exclui o próprio aluno da consulta e protege o teacher_id na gravação", async () => {
  await updateStudent(id, form());
  expect(m.neq).toHaveBeenCalledWith("id", id);
  expect(m.update).toHaveBeenCalled();
  expect(m.eq.mock.calls.filter((c) => c[0] === "teacher_id")).toHaveLength(2);
});
it("colisão no índice entre a consulta e a gravação volta como erro no campo email", async () => {
  m.race = true;
  expect(await createStudent(form())).toMatchObject({ validation: { field: "email" } });
});
