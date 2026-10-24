import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ access: vi.fn(), admin: vi.fn(), update: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/student-access", () => ({ authorizedStudent: m.access }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: m.admin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { updateStudentEmailPreferences } from "./email-preferences";
beforeEach(() => {
  vi.clearAllMocks();
  m.access.mockResolvedValue(null);
});
it("sem vínculo não grava preferência de outro aluno", async () => {
  expect(
    (await updateStudentEmailPreferences("victim", { operational: false, promotional: false })).ok,
  ).toBe(false);
  expect(m.admin).not.toHaveBeenCalled();
});
it("não aceita campos com tipos adulterados", async () => {
  m.access.mockResolvedValue({ id: "own", teacher_id: "teacher" });
  expect(
    (
      await updateStudentEmailPreferences("own", {
        operational: "true" as unknown as boolean,
        promotional: false,
      })
    ).ok,
  ).toBe(false);
  expect(m.admin).not.toHaveBeenCalled();
});
