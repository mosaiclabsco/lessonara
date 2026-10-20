import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/server", () => ({ connection: async () => {} }));
import { measure, measuredFetch } from "./performance";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("logs stages without leaking request URLs, credentials or filters", async () => {
  vi.stubEnv("PERFORMANCE_LOGGING", "true");
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  const response = new Response("[]");
  const fetch = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetch);
  const input = "https://example.supabase.co/rest/v1/students?email=eq.private@example.com";
  expect(await measuredFetch(input, { headers: { Authorization: "Bearer private-token" } })).toBe(
    response,
  );
  const metric = JSON.parse(log.mock.calls[0][0]);
  expect(metric).toMatchObject({ event: "performance", stage: "supabase.students", outcome: "ok" });
  expect(metric.request_id).toEqual(expect.any(String));
  expect(metric.duration_ms).toBeGreaterThanOrEqual(0);
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|Authorization|https/);
  expect(fetch).toHaveBeenCalledWith(input, { headers: { Authorization: "Bearer private-token" } });
});
it("preserves failures and can disable metric output", async () => {
  vi.stubEnv("PERFORMANCE_LOGGING", "false");
  const log = vi.spyOn(console, "info");
  const error = new Error("failed");
  await expect(
    measure("test", async () => {
      throw error;
    }),
  ).rejects.toBe(error);
  expect(log).not.toHaveBeenCalled();
});
