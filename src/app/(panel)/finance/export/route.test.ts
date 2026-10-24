import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ user: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ requireUser: m.user }));
vi.mock("@/lib/financial-download", async (original) => ({
  ...(await original<typeof import("@/lib/financial-download")>()),
  readPayments: m.read,
}));
import { GET } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
  m.user.mockResolvedValue({
    supabase: "db",
    userId: "owner",
    teacher: { name: "Prof", platform_plan: "essential" },
  });
  m.read.mockResolvedValue([]);
});
it("query ou flag no navegador não concede exportação ao Essencial", async () => {
  const response = await GET(
    new Request("https://example.com/finance/export?period=2026-10&format=xlsx&plan=pro"),
  );
  expect(response.status).toBe(403);
  expect(m.read).not.toHaveBeenCalled();
});
it("Plus exporta apenas seu tenant e parâmetros são validados no servidor", async () => {
  m.user.mockResolvedValue({
    supabase: "db",
    userId: "owner",
    teacher: { name: "Prof", platform_plan: "plus" },
  });
  expect(
    (await GET(new Request("https://example.com/finance/export?period=2026-13&format=xlsx")))
      .status,
  ).toBe(400);
  expect(m.read).not.toHaveBeenCalled();
  const response = await GET(
    new Request(
      "https://example.com/finance/export?period=2026-10&format=csv&teacherId=someone-else",
    ),
  );
  expect(response.status).toBe(200);
  expect(m.read).toHaveBeenCalledWith("db", "owner", "2026-10");
  expect(response.headers.get("cache-control")).toContain("private");
});
