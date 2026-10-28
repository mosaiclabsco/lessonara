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
    (
      await updateStudentEmailPreferences("victim", {
        lesson: false,
        renewal: false,
        promotional: false,
      })
    ).ok,
  ).toBe(false);
  expect(m.admin).not.toHaveBeenCalled();
});
it("não aceita campos com tipos adulterados", async () => {
  m.access.mockResolvedValue({ id: "own", teacher_id: "teacher" });
  expect(
    (
      await updateStudentEmailPreferences("own", {
        lesson: "true" as unknown as boolean,
        renewal: false,
        promotional: false,
      })
    ).ok,
  ).toBe(false);
  expect(m.admin).not.toHaveBeenCalled();
});

it("salva preferências independentes somente no aluno e professor autorizados", async () => {
  m.access.mockResolvedValue({ id: "own", teacher_id: "teacher" });
  const chain = { eq: m.eq };
  m.eq.mockReturnValue(chain);
  m.update.mockReturnValue(chain);
  m.admin.mockReturnValue({ from: () => ({ update: m.update }) });
  expect(
    (
      await updateStudentEmailPreferences("own", {
        lesson: false,
        renewal: true,
        promotional: false,
      })
    ).ok,
  ).toBe(true);
  expect(m.update).toHaveBeenCalledWith({
    lesson_email_opt_out: true,
    renewal_email_opt_out: false,
    operational_email_opt_out: false,
    promotional_email_opt_out: true,
  });
  expect(m.eq).toHaveBeenCalledWith("id", "own");
  expect(m.eq).toHaveBeenCalledWith("teacher_id", "teacher");
});

it("recusa payload nulo sem gravar", async () => {
  m.access.mockResolvedValue({ id: "own", teacher_id: "teacher" });
  expect((await updateStudentEmailPreferences("own", null as never)).ok).toBe(false);
  expect(m.admin).not.toHaveBeenCalled();
});
