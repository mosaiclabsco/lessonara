import { runWorkerRoute } from "@/lib/worker-route";
import { processEmails } from "@/lib/mail/outbox";
export const maxDuration = 60;
export async function GET(request: Request) {
  return runWorkerRoute(request, "emails", () => processEmails());
}
