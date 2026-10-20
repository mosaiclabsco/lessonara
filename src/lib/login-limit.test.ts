import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { allowTeacherLogin } from "./login-limit";
beforeEach(() => vi.stubEnv("EMAIL_ENCRYPTION_KEY", "01".repeat(32)));
afterEach(() => vi.unstubAllEnvs());
it("bloqueia quando o contador nega ou falha e não envia email/IP em claro", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
  expect(await allowTeacherLogin({ rpc }, "a@example.com", "192.0.2.1")).toBe(true);
  const args = rpc.mock.calls[0][1];
  expect(JSON.stringify(args)).not.toContain("a@example.com");
  expect(JSON.stringify(args)).not.toContain("192.0.2.1");
  expect(args.p_limits).toEqual([60, 20, 10]);
  await allowTeacherLogin({ rpc }, "a@example.com", "192.0.2.2");
  expect(rpc.mock.calls[1][1].p_keys[1]).toBe(args.p_keys[1]);
  rpc.mockResolvedValue({ data: false, error: null });
  expect(await allowTeacherLogin({ rpc }, "a@example.com", "local")).toBe(false);
  rpc.mockResolvedValue({ data: true, error: { message: "unavailable" } });
  expect(await allowTeacherLogin({ rpc }, "a@example.com", "local")).toBe(false);
});
