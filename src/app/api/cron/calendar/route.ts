import { runWorkerRoute } from "@/lib/worker-route";
import { processCalendarJobs } from "@/lib/google/worker";
import { processGoogleLessonLinks } from "@/lib/google/lesson-link-worker";
export const maxDuration = 60;
export async function GET(request: Request) {
  return runWorkerRoute(request, "calendar", async () => {
    const links = await processGoogleLessonLinks();
    const jobs = await processCalendarJobs();
    return { ...links, ...jobs, failed: links.linkFailed + jobs.failed };
  });
}
