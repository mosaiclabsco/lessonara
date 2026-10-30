import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ user: vi.fn(), rpc: vi.fn(), groups: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  requireUser: m.user,
  createAdminClient: () => ({ rpc: m.rpc }),
}));
vi.mock("@/lib/mail/crypto", () => ({ fingerprint: (id: string) => `hash-${id}` }));
vi.mock("@/lib/pending-groups", () => ({ loadPendingGroups: m.groups }));
import { GET } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
  m.user.mockResolvedValue({ userId: "owner" });
  m.rpc.mockResolvedValue({ data: true, error: null });
  m.groups.mockResolvedValue([{ count: 2 }, { count: 1 }]);
});
it("requires a session before privileged queries", async () => {
  m.user.mockRejectedValue(new Error("no session"));
  await expect(GET()).rejects.toThrow("no session");
  expect(m.rpc).not.toHaveBeenCalled();
  expect(m.groups).not.toHaveBeenCalled();
});
it("derives its identity on the server and returns a private count, including zero after resolution", async () => {
  const response = await GET();
  expect(await response.json()).toEqual({ count: 3 });
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(m.rpc).toHaveBeenCalledWith("allow_student_auth", {
    p_keys: ["pending-count/hash-owner"],
    p_limits: [30],
    p_seconds: [60],
  });
  m.groups.mockResolvedValue([]);
  expect(await (await GET()).json()).toEqual({ count: 0 });
});
it("limits polling and fails closed before loading details", async () => {
  m.rpc.mockResolvedValue({ data: false, error: null });
  expect((await GET()).status).toBe(429);
  expect(m.groups).not.toHaveBeenCalled();
  m.rpc.mockResolvedValue({ data: null, error: {} });
  expect((await GET()).status).toBe(503);
});
