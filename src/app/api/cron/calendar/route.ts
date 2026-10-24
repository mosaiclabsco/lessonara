import { runWorkerRoute } from "@/lib/worker-route";
import { processCalendarJobs } from "@/lib/google/worker";
export const maxDuration = 60;
export async function GET(request: Request) {
  return runWorkerRoute(request, "calendar", () => processCalendarJobs());
}
