import { expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ user: vi.fn(), cookies: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ requireUser: m.user }));
vi.mock("next/headers", () => ({ cookies: m.cookies }));
vi.mock("@/lib/google/calendar", () => ({
  googleConfigured: () => true,
  googleRedirectUri: () => "https://example.com/callback",
}));
import { GET } from "./route";
it("acesso direto Essential não inicia OAuth nem grava estado, mesmo com integração configurada", async () => {
  m.user.mockResolvedValue({ userId: "teacher", teacher: { platform_plan: "essential" } });
  const response = await GET();
  expect(response.status).toBe(403);
  expect(m.cookies).not.toHaveBeenCalled();
});
