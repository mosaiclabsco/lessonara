import { runWorkerRoute } from "@/lib/worker-route";
import { prepareReminderBatch } from "@/lib/mail/reminders";
export const maxDuration = 60;
export async function GET(request: Request) {
  return runWorkerRoute(request, "renewals", async (db) => {
    const deadline = Date.now() + 20_000;
    let checked = 0,
      queued = 0;
    for (let page = 0; page < 20; page++) {
      const batch = await prepareReminderBatch(db);
      checked += batch.checked;
      queued += batch.queued;
      if (batch.done || batch.busy || Date.now() >= deadline)
        return { checked, queued, done: batch.done, busy: batch.busy };
    }
    return { checked, queued, done: false, busy: false };
  });
}
