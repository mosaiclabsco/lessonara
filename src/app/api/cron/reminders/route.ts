import { validCronAuthorization } from "@/lib/cron-auth";
import { prepareReminderBatch } from "@/lib/mail/reminders";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!validCronAuthorization(request.headers.get("authorization"), process.env.CRON_SECRET))
    return new Response("Unauthorized", { status: 401 });
  const db = createAdminClient();
  try {
    return Response.json(await prepareReminderBatch(db));
  } catch {
    return Response.json(
      {
        error:
          "Não foi possível preparar os lembretes. O cursor será retomado na próxima execução.",
      },
      { status: 500 },
    );
  }
}
