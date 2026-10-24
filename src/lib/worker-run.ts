import type { SupabaseClient } from "@supabase/supabase-js";
export type WorkerKey = "renewals" | "emails" | "calendar" | "cleanup" | "lesson-reminders";
export async function trackWorker<T extends Record<string, number | boolean>>(
  db: SupabaseClient,
  key: WorkerKey,
  work: () => Promise<T>,
) {
  const claim = await db.rpc("start_job_run", { p_job: key });
  if (claim.error) throw new Error("Could not register worker start");
  if (!claim.data) return { busy: true };
  try {
    const metrics = await work();
    const status =
      Number(metrics.failed ?? 0) > 0 ? "failed" : metrics.busy ? "skipped" : "succeeded";
    const done = await db.rpc("finish_job_run", {
      p_id: claim.data,
      p_status: status,
      p_metrics: metrics,
    });
    if (done.error) throw new Error("Could not register worker completion");
    return metrics;
  } catch (error) {
    const failed = await db.rpc("finish_job_run", {
      p_id: claim.data,
      p_status: "failed",
      p_metrics: { failed: 1 },
    });
    if (failed.error) console.error("worker_failure_checkpoint_failed", key);
    throw error;
  }
}
