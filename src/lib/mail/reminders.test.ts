import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const m = vi.hoisted(() => ({
  ledger: vi.fn(),
  rpc: vi.fn(),
  rows: [] as { id: string; teacher_id: string; email: string }[],
  error: null as unknown,
  calls: [] as string[],
}));
vi.mock("../data", () => ({ loadLedgers: m.ledger }));
import { prepareReminderBatch } from "./reminders";
function client() {
  const q = {
    select: (s: string) => {
      m.calls.push(s);
      return q;
    },
    eq: () => q,
    not: () => q,
    order: () => q,
    limit: () => q,
    gt: (k: string, v: string) => {
      m.calls.push(`${k}>${v}`);
      return q;
    },
    then: (resolve: (r: unknown) => unknown) =>
      Promise.resolve({ data: m.rows, error: m.error }).then(resolve),
  };
  return { rpc: m.rpc, from: () => q } as unknown as SupabaseClient;
}
beforeEach(() => {
  vi.clearAllMocks();
  m.calls = [];
  m.error = null;
  m.rows = [{ id: "next", teacher_id: "teacher", email: "student@example.com" }];
  m.rpc.mockImplementation(async (name: string) =>
    name === "claim_reminder_run"
      ? { data: { day: "2026-10-19", cursor: "previous", leaseId: "lease" }, error: null }
      : { data: 1, error: null },
  );
  m.ledger.mockResolvedValue(
    new Map([
      ["next", { ledger: { credits: 4, remaining: 1, lessons: [{ past: false, counts: true }] } }],
    ]),
  );
});
it("reads only a page, reuses known owners and queues/checkpoints in one call", async () => {
  const result = await prepareReminderBatch(client());
  expect(result).toEqual({ checked: 1, queued: 1, done: true, busy: false });
  expect(m.calls).toContain("id>previous");
  expect(m.calls[0]).not.toContain("*");
  expect(m.ledger).toHaveBeenCalledWith(expect.anything(), ["next"], m.rows);
  expect(m.rpc).toHaveBeenLastCalledWith(
    "finish_reminder_batch",
    expect.objectContaining({
      p_cursor: "next",
      p_lease: "lease",
      p_complete: true,
      p_checked: 1,
      p_items: [expect.objectContaining({ student_id: "next", credits: 4 })],
    }),
  );
});
it("a full page keeps the run open for continuation", async () => {
  expect((await prepareReminderBatch(client(), 1)).done).toBe(false);
});
it("does not move the cursor on a failed page read", async () => {
  m.error = {};
  await expect(prepareReminderBatch(client())).rejects.toThrow();
  expect(m.rpc).toHaveBeenCalledTimes(1);
});
it("does not complete a failed queue/checkpoint transaction", async () => {
  m.rpc.mockImplementation(async (name: string) =>
    name === "claim_reminder_run"
      ? { data: { day: "2026-10-19", cursor: null, leaseId: "lease" }, error: null }
      : { data: null, error: {} },
  );
  await expect(prepareReminderBatch(client())).rejects.toThrow("checkpoint");
});
it("a busy or completed run reads no student data", async () => {
  for (const flag of ["busy", "done"]) {
    m.rpc.mockResolvedValue({ data: { [flag]: true }, error: null });
    await prepareReminderBatch(client());
  }
  expect(m.ledger).not.toHaveBeenCalled();
});
it("skips packages with remaining credits and checkpoints an empty queue", async () => {
  m.ledger.mockResolvedValue(
    new Map([
      ["next", { ledger: { credits: 4, remaining: 2, lessons: [{ past: false, counts: true }] } }],
    ]),
  );
  await prepareReminderBatch(client());
  expect(m.rpc).toHaveBeenLastCalledWith(
    "finish_reminder_batch",
    expect.objectContaining({ p_items: [] }),
  );
});
