import { beforeEach, afterEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./supabase/server", () => ({ createAdminClient: () => ({ rpc: m.rpc }) }));
import { downloadLimit } from "./download-limit";
beforeEach(() => {
  vi.stubEnv("EMAIL_ENCRYPTION_KEY", "01".repeat(32));
  m.rpc.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
it("usa contador persistente, identidade canônica e hash, sem expor identidade/caminho", async () => {
  m.rpc.mockResolvedValue({ data: { allowed: true, retry_after: 0 }, error: null });
  expect(await downloadLimit("student/one", "PAYMENT", "receipt")).toBeNull();
  const args = m.rpc.mock.calls[0][1];
  expect(args.p_limits).toEqual([1, 10, 60]);
  expect(args.p_seconds).toEqual([10, 60, 3600]);
  expect(JSON.stringify(args)).not.toContain("student/one");
  expect(JSON.stringify(args)).not.toContain("PAYMENT");
  await downloadLimit("student/one", "payment", "receipt");
  expect(m.rpc.mock.calls[1][1].p_keys).toEqual(args.p_keys);
  await downloadLimit("student/two", "payment", "receipt");
  expect(m.rpc.mock.calls[2][1].p_keys).not.toEqual(args.p_keys);
});
it("nega repetição com 429 e Retry-After e falha fechada quando o contador não está disponível", async () => {
  m.rpc.mockResolvedValue({ data: { allowed: false, retry_after: 24 }, error: null });
  const blocked = await downloadLimit("teacher/one", "receipt", "receipt");
  expect(blocked?.status).toBe(429);
  expect(blocked?.headers.get("Retry-After")).toBe("24");
  expect(blocked?.headers.get("Cache-Control")).toContain("no-store");
  m.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
  expect((await downloadLimit("teacher/one", "receipt", "receipt"))?.status).toBe(503);
  m.rpc.mockRejectedValue(new Error("offline"));
  expect((await downloadLimit("teacher/one", "receipt", "receipt"))?.status).toBe(503);
});
