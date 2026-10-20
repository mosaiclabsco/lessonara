import { cache } from "react";
import { connection } from "next/server";
import { randomUUID } from "node:crypto";

// React.cache is scoped to one server render, never shared between accounts.
const requestMetrics = cache(async () => {
  await connection();
  return { requestId: randomUUID(), started: performance.now() };
});

export async function measure<T>(stage: string, operation: () => PromiseLike<T>): Promise<T> {
  const context = await requestMetrics();
  const started = performance.now();
  let outcome = "ok";
  try {
    return await operation();
  } catch (error) {
    outcome = "error";
    throw error;
  } finally {
    if (process.env.PERFORMANCE_LOGGING !== "false") {
      console.info(
        JSON.stringify({
          event: "performance",
          request_id: context.requestId,
          stage,
          outcome,
          duration_ms: Math.round(performance.now() - started),
          elapsed_ms: Math.round(performance.now() - context.started),
          region: process.env.VERCEL_REGION ?? "local",
        }),
      );
    }
  }
}

// Log only the operation/table. URLs, filters, bodies and credentials stay private.
export const measuredFetch: typeof fetch = (input, init) => {
  const url = new URL(
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
  );
  const match = url.pathname.match(/^\/rest\/v1\/(?:rpc\/)?([a-z_]+)$/);
  return measure(match ? `supabase.${match[1]}` : "supabase.request", () => fetch(input, init));
};
