import { beforeEach, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  configured: vi.fn(),
  user: vi.fn(),
  admin: vi.fn(),
  rpc: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("./onboarding", () => ({ requireConfiguredTeacher: mock.configured }));
vi.mock("./supabase/server", () => ({ createAdminClient: mock.admin, requireUser: mock.user }));
vi.mock("next/cache", () => ({ revalidatePath: mock.revalidate }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { uploadImport, confirmImport } from "@/app/import-actions";
beforeEach(() => {
  vi.clearAllMocks();
  mock.configured.mockResolvedValue({
    teacher: { platform_plan: "plus" },
    userId: "teacher",
    supabase: { rpc: mock.rpc },
  });
});
it("enforces Plus/Pro before accepting files or using the privileged client", async () => {
  mock.configured.mockResolvedValue({ teacher: { platform_plan: "essential" } });
  expect(await uploadImport(new FormData())).toHaveProperty(
    "validation.message",
    "Importação disponível no Plus e Pro.",
  );
  expect(mock.admin).not.toHaveBeenCalled();
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("rejects missing, oversized or unsupported files before creating a request", async () => {
  for (const file of [
    null,
    new File([new Uint8Array(524289)], "large.csv"),
    new File(["x"], "file.exe"),
  ]) {
    const form = new FormData();
    form.set("mode", "guided");
    if (file) form.set("file", file);
    expect(await uploadImport(form)).toHaveProperty("validation.field", "file");
  }
  expect(mock.rpc).not.toHaveBeenCalled();
  expect(mock.admin).not.toHaveBeenCalled();
});
it("never parses XLSX as guided CSV or accepts a forged assisted XLSX signature", async () => {
  for (const mode of ["guided", "assisted"]) {
    const form = new FormData();
    form.set("mode", mode);
    form.set("file", new File(["not-a-zip"], "file.xlsx"));
    expect(await uploadImport(form)).toHaveProperty("validation.field", "file");
  }
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("requires explicit review and row selection before final confirmation", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  expect(await confirmImport(id, new FormData())).toHaveProperty("validation.field", "reviewed");
  const form = new FormData();
  form.set("reviewed", "yes");
  expect(await confirmImport(id, form)).toHaveProperty("validation.field", "rows");
  form.set("rows", "../other");
  expect(await confirmImport(id, form)).toHaveProperty("validation.field", "rows");
  expect(mock.rpc).not.toHaveBeenCalled();
});
