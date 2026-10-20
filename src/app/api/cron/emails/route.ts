import { validCronAuthorization } from "@/lib/cron-auth";
import { processCalendarJobs } from "@/lib/google/worker";
import { createAdminClient } from "@/lib/supabase/server";
import { processEmails } from "@/lib/mail/outbox";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!validCronAuthorization(request.headers.get("authorization"), secret))
    return new Response("Unauthorized", { status: 401 });
  const db = createAdminClient();
  const now = new Date().toISOString();
  await db.from("student_sessions").delete().lt("expires_at", now);
  await db.from("student_auth_challenges").delete().lt("expires_at", now);
  await db
    .from("student_auth_limits")
    .delete()
    .lt("window_start", new Date(Date.now() - 24 * 3600_000).toISOString());
  const email = await processEmails();
  const calendar = await processCalendarJobs();
  return Response.json({ email, calendar });
}
