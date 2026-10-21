import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  user: vi.fn(),
  admin: vi.fn(),
  rpc: vi.fn(),
  revalidate: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("./student-access", () => ({ authorizedStudent: mocks.access }));
vi.mock("./supabase/server", () => ({ requireUser: mocks.user, createAdminClient: mocks.admin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { studentRenewal, resolveRenewal, savePix } from "@/app/renewal-actions";
const student = "00000000-0000-4000-8000-000000000001",
  request = "00000000-0000-4000-8000-000000000002";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue({ id: student, teacher_id: "teacher", slug: "student-slug" });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.admin.mockReturnValue({ rpc: mocks.rpc });
  mocks.user.mockResolvedValue({ supabase: { rpc: mocks.rpc }, userId: "teacher" });
});
it("never calls the privileged RPC without a student session link", async () => {
  mocks.access.mockResolvedValue(null);
  await expect(studentRenewal(student, "prepare", new FormData())).rejects.toThrow(
    "redirect:/student/login",
  );
  expect(mocks.admin).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("quotes from authorized server data, ignoring browser price and credits", async () => {
  const form = new FormData();
  form.set("amount", "0.01");
  form.set("lessons", "1000");
  await studentRenewal(student, "prepare", form);
  expect(mocks.rpc).toHaveBeenCalledWith("prepare_student_renewal", { p_student: student });
});
it("binds the payment report to the authenticated student and request", async () => {
  const form = new FormData();
  form.set("request_id", request);
  await studentRenewal(student, "report", form);
  expect(mocks.rpc).toHaveBeenCalledWith("report_student_renewal", {
    p_student: student,
    p_request: request,
    p_cancel: false,
  });
  expect(mocks.revalidate).toHaveBeenCalledWith("/p/teacher/s/student-slug");
});
it("does not claim success when the report is stale or belongs to another student", async () => {
  mocks.rpc.mockResolvedValue({ error: { message: "not found" } });
  const form = new FormData();
  form.set("request_id", request);
  expect(await studentRenewal(student, "report", form)).toHaveProperty("validation.message");
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
it("teacher confirmation never accepts browser amount/credit overrides", async () => {
  const form = new FormData();
  form.set("paid_on", "2026-10-21");
  form.set("amount", "0.01");
  form.set("lessons", "999");
  await resolveRenewal(request, false, form);
  expect(mocks.rpc).toHaveBeenCalledWith("resolve_student_renewal", {
    p_request: request,
    p_paid_on: "2026-10-21",
    p_reject: false,
    p_note: "",
  });
});
it("serializes invalid dates/keys before mutation", async () => {
  const form = new FormData();
  form.set("paid_on", "2026-02-30");
  expect(await resolveRenewal(request, false, form)).toHaveProperty("validation.field", "paid_on");
  expect(await savePix(new FormData())).toHaveProperty("validation");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("rejects a null resolution option rather than confirming without a package", async () => {
  expect(await resolveRenewal(request, null as unknown as boolean, new FormData())).toHaveProperty(
    "validation",
  );
  expect(mocks.rpc).not.toHaveBeenCalled();
});
