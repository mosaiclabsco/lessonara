import { validCronAuthorization } from "./cron-auth";
import { createAdminClient } from "./supabase/server";
import { trackWorker, type WorkerKey } from "./worker-run";
import type { SupabaseClient } from "@supabase/supabase-js";
export async function runWorkerRoute(
  request: Request,
  key: WorkerKey,
  work: (db: SupabaseClient) => Promise<Record<string, number | boolean>>,
) {
  if (!validCronAuthorization(request.headers.get("authorization"), process.env.CRON_SECRET))
    return new Response("Unauthorized", { status: 401 });
  try {
    const db = createAdminClient();
    return Response.json(await trackWorker(db, key, () => work(db)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Não foi possível concluir o processamento. Confira o painel de jobs." },
      { status: 500 },
    );
  }
}
