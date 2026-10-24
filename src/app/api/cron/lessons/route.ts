import { runWorkerRoute } from "@/lib/worker-route";
import { prepareLessonNotices } from "@/lib/mail/lesson-notices";
export const maxDuration = 60;
export async function GET(request: Request) {
  return runWorkerRoute(request, "lesson-reminders", async (db) => {
    const deadline = Date.now() + 20000;
    let checked = 0,
      queued = 0;
    for (let i = 0; i < 20; i++) {
      const page = await prepareLessonNotices(db);
      checked += page.checked;
      queued += page.queued;
      if (page.done || Date.now() >= deadline) return { checked, queued, done: page.done };
    }
    return { checked, queued, done: false };
  });
}
