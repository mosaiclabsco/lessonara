import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { trackWorker } from "./worker-run";
function fixture() {
  const rpc = vi.fn().mockResolvedValue({ data: "run", error: null });
  return { rpc, db: { rpc } as unknown as SupabaseClient };
}
it("não processa uma segunda execução enquanto existe lease ativo", async () => {
  const { rpc, db } = fixture();
  rpc.mockResolvedValue({ data: null, error: null });
  const work = vi.fn();
  expect(await trackWorker(db, "emails", work)).toEqual({ busy: true });
  expect(work).not.toHaveBeenCalled();
});
it("falha fechada se não conseguir registrar início", async () => {
  const { rpc, db } = fixture();
  rpc.mockResolvedValue({ error: {} });
  const work = vi.fn();
  await expect(trackWorker(db, "emails", work)).rejects.toThrow();
  expect(work).not.toHaveBeenCalled();
});
it("registra falha parcial mesmo se a função retornou normalmente", async () => {
  const { rpc, db } = fixture();
  await trackWorker(db, "emails", async () => ({ sent: 1, failed: 1 }));
  expect(rpc).toHaveBeenLastCalledWith("finish_job_run", {
    p_id: "run",
    p_status: "failed",
    p_metrics: { sent: 1, failed: 1 },
  });
});
it("registra exceção sem copiar mensagem sensível para a telemetria", async () => {
  const { rpc, db } = fixture();
  await expect(
    trackWorker(db, "calendar", async () => {
      throw new Error("private token");
    }),
  ).rejects.toThrow();
  expect(rpc).toHaveBeenLastCalledWith("finish_job_run", {
    p_id: "run",
    p_status: "failed",
    p_metrics: { failed: 1 },
  });
});
it("não declara sucesso quando perdeu o checkpoint de conclusão", async () => {
  const { rpc, db } = fixture();
  rpc.mockResolvedValueOnce({ data: "run", error: null }).mockResolvedValueOnce({ error: {} });
  await expect(trackWorker(db, "cleanup", async () => ({ removed: 2 }))).rejects.toThrow(
    "completion",
  );
});
