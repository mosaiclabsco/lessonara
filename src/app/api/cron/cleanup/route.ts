import { runWorkerRoute } from "@/lib/worker-route";
import { cleanupImportOriginals } from "@/lib/import-cleanup";
export const maxDuration = 60;
export async function GET(request: Request) {
  return runWorkerRoute(request, "cleanup", async (db) => {
    const now = new Date().toISOString();
    const results = await Promise.all([
      db.from("student_sessions").delete({ count: "exact" }).lt("expires_at", now),
      db.from("student_auth_challenges").delete({ count: "exact" }).lt("expires_at", now),
      db
        .from("student_auth_limits")
        .delete({ count: "exact" })
        .lt("window_start", new Date(Date.now() - 24 * 3600_000).toISOString()),
    ]);
    if (results.some((r) => r.error)) throw new Error("Cleanup failed");
    const imports = await cleanupImportOriginals(db);
    return {
      sessions: results[0].count ?? 0,
      codes: results[1].count ?? 0,
      limits: results[2].count ?? 0,
      ...imports,
    };
  });
}
