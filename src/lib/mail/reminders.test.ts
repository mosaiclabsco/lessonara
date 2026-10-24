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
import { computeLedger } from "../ledger";
import { prepareReminderBatch } from "./reminders";
function client() {
  const q = {
    select: (s: string) => {
      m.calls.push(s);
      return q;
    },
    eq: () => q,
    in: (key: string, values: string[]) => {
      m.calls.push(`${key}:${values.join(",")}`);
      return q;
    },
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
    name === "claim_renewal_run"
      ? {
          data: { scheduledFor: "2026-10-19T11:00:00Z", cursor: "previous", leaseId: "lease" },
          error: null,
        }
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
  expect(m.calls).toContain("teachers.platform_plan:plus,pro");
  expect(m.ledger).toHaveBeenCalledWith(expect.anything(), ["next"], m.rows);
  expect(m.rpc).toHaveBeenLastCalledWith(
    "finish_renewal_batch",
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
  expect(m.rpc).toHaveBeenLastCalledWith(
    "fail_renewal_run",
    expect.objectContaining({ p_lease: "lease" }),
  );
});
it("does not complete a failed queue/checkpoint transaction", async () => {
  m.rpc.mockImplementation(async (name: string) =>
    name === "claim_renewal_run"
      ? {
          data: { scheduledFor: "2026-10-19T11:00:00Z", cursor: null, leaseId: "lease" },
          error: null,
        }
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
    "finish_renewal_batch",
    expect.objectContaining({ p_items: [] }),
  );
});

it("renovação preserva aulas registradas após remover a agenda e mudar o plano", async () => {
  const history = [1, 2, 3].map((position) => ({
    historyId: `saved-${position}`,
    sourceKind: "schedule" as const,
    sourceId: "deleted",
    date: `2026-10-0${position}`,
    time: "18:00",
    status: "dada" as const,
    counts: true,
    past: true,
    packageId: "paid",
    packageIndex: 0,
    packagePosition: position,
    event: null,
    planName: "Original",
  }));
  const ledger = computeLedger({
    history,
    schedules: [],
    events: [],
    appointments: [{ id: "new", date: "2026-10-25", time: "21:00" }],
    packages: [{ id: "paid", paid_on: "2026-09-30", lessons: 4, amount: 300 }],
    today: "2026-10-24",
    time: "10:00",
  });
  expect(ledger.remaining).toBe(1);
  m.ledger.mockResolvedValue(new Map([["next", { ledger }]]));
  await prepareReminderBatch(client());
  expect(m.rpc).toHaveBeenLastCalledWith(
    "finish_renewal_batch",
    expect.objectContaining({
      p_items: [
        expect.objectContaining({ credits: 4, message: expect.stringContaining("Falta 1 aula") }),
      ],
    }),
  );
});
it("entrar cinco minutos antes não antecipa consumo nem aviso de renovação", async () => {
  const ledger = computeLedger({
    history: [
      {
        historyId: "joined",
        sourceKind: "appointment",
        sourceId: "early",
        date: "2026-10-24",
        time: "19:00",
        status: "agendada",
        counts: true,
        past: false,
        packageId: "paid",
        packageIndex: 0,
        packagePosition: 1,
        event: null,
      },
    ],
    schedules: [],
    events: [],
    packages: [{ id: "paid", paid_on: "2026-10-01", lessons: 4, amount: 300 }],
    today: "2026-10-24",
    time: "18:55",
  });
  expect(ledger.remaining).toBe(4);
  m.ledger.mockResolvedValue(new Map([["next", { ledger }]]));
  await prepareReminderBatch(client());
  expect(m.rpc).toHaveBeenLastCalledWith(
    "finish_renewal_batch",
    expect.objectContaining({ p_items: [] }),
  );
});
