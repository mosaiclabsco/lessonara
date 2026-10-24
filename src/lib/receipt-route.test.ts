import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  access: vi.fn(),
  user: vi.fn(),
  admin: vi.fn(),
  read: vi.fn(),
  pdf: vi.fn(),
}));
vi.mock("./student-access", () => ({ authorizedStudent: m.access }));
vi.mock("./supabase/server", () => ({ requireUser: m.user, createAdminClient: m.admin }));
vi.mock("./financial-download", async (original) => ({
  ...(await original<typeof import("./financial-download")>()),
  readPayments: m.read,
}));
vi.mock("./financial-files", () => ({ financialPdf: m.pdf }));
import { paymentReceipt } from "./receipt-route";
const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.resetAllMocks();
  m.access.mockResolvedValue(null);
  m.pdf.mockResolvedValue(new Uint8Array([1]));
  m.read.mockResolvedValue([]);
});
it("nega identificador de aluno sem sessão e vínculo, antes de ler pagamentos", async () => {
  expect((await paymentReceipt(id, "student")).status).toBe(404);
  expect(m.read).not.toHaveBeenCalled();
  expect(m.admin).not.toHaveBeenCalled();
});
it("professor consulta somente o próprio tenant, mesmo com UUID de outro pagamento", async () => {
  m.user.mockResolvedValue({ supabase: "scoped-db", userId: "teacher", teacher: { name: "Prof" } });
  expect((await paymentReceipt(id)).status).toBe(404);
  expect(m.read).toHaveBeenCalledWith("scoped-db", "teacher", "", undefined, id);
  expect(m.pdf).not.toHaveBeenCalled();
});
it("aluno não acessa pagamento de outro aluno do mesmo professor", async () => {
  m.access.mockResolvedValue({ teacher_id: "teacher", id: "student-a" });
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { name: "Prof" }, error: null }) }),
      }),
    }),
  };
  m.admin.mockReturnValue(db);
  expect((await paymentReceipt(id, "student-a")).status).toBe(404);
  expect(m.read).toHaveBeenCalledWith(db, "teacher", "", "student-a", id);
});
