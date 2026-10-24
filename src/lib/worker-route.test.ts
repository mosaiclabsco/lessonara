import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ admin: vi.fn(), track: vi.fn() }));
vi.mock("./supabase/server", () => ({ createAdminClient: m.admin }));
vi.mock("./worker-run", () => ({ trackWorker: m.track }));
import { runWorkerRoute } from "./worker-route";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-worker-secret");
});
it("nega requisições sem segredo antes de consultar dados ou executar", async () => {
  const work = vi.fn();
  expect((await runWorkerRoute(new Request("https://example.com"), "emails", work)).status).toBe(
    401,
  );
  expect(m.admin).not.toHaveBeenCalled();
  expect(work).not.toHaveBeenCalled();
});
it("não expõe erros internos nem credenciais", async () => {
  m.track.mockRejectedValue(new Error("secret-value"));
  const response = await runWorkerRoute(
    new Request("https://example.com", { headers: { Authorization: "Bearer test-worker-secret" } }),
    "emails",
    vi.fn(),
  );
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("secret-value");
});
