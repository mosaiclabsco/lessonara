import { calendarExclusions } from "./recurrence";
import { createAdminClient } from "@/lib/supabase/server";
import { calendarEventId, googleRequest, safeMeetUrl } from "./calendar";
import { firstScheduleDate } from "@/lib/schedule-rules";
type Job = {
  id: string;
  teacher_id: string;
  source_id: string;
  source_kind: "schedule" | "appointment" | "makeup";
  operation: "upsert" | "delete";
  version: number;
  lease_id: string;
  attempts: number;
};
function firstMonthlyDate(starts: string, day: number) {
  let month = starts.slice(0, 7);
  for (let n = 0; n < 24; n++) {
    const candidate = `${month}-${String(day).padStart(2, "0")}`;
    if (
      new Date(candidate + "T12:00:00Z").toISOString().slice(0, 10) === candidate &&
      candidate >= starts
    )
      return candidate;
    const next = new Date(month + "-01T12:00:00Z");
    next.setUTCMonth(next.getUTCMonth() + 1);
    month = next.toISOString().slice(0, 7);
  }
  throw new Error("invalid_date");
}
export async function processCalendarJobs(teacherId?: string) {
  const db = createAdminClient();
  const jobs = await db.rpc("claim_calendar_jobs", { p_teacher: teacherId ?? null });
  if (jobs.error) throw new Error("Não foi possível processar a agenda.");
  const result = { sent: 0, failed: 0 };
  for (const job of (jobs.data ?? []) as Job[]) {
    const finish = async (values: Record<string, unknown>) => {
      const updated = await db
        .from("calendar_jobs")
        .update(values)
        .eq("id", job.id)
        .eq("version", job.version)
        .eq("lease_id", job.lease_id);
      if (updated.error) throw new Error("calendar_job_write_failed");
      const released = await db
        .from("calendar_jobs")
        .update({
          status: "pending",
          available_at: new Date().toISOString(),
          lease_id: null,
          locked_at: null,
          attempts: 0,
        })
        .eq("id", job.id)
        .eq("lease_id", job.lease_id)
        .gt("version", job.version);
      if (released.error) throw new Error("calendar_job_write_failed");
    };
    try {
      const eventId = calendarEventId(job.source_kind, job.source_id, job.teacher_id);
      const table =
        job.source_kind === "schedule"
          ? "schedules"
          : job.source_kind === "appointment"
            ? "appointments"
            : "lesson_events";
      const source = await db
        .from(table)
        .select("*,students!inner(name,email,active,teacher_id)")
        .eq("id", job.source_id)
        .eq("students.teacher_id", job.teacher_id)
        .maybeSingle();
      if (source.error) throw new Error("source_read_failed");
      const item = source.data;
      let remove = job.operation === "delete" || !item || !item.students.active;
      if (item && job.source_kind === "appointment") {
        const cancelled = await db
          .from("lesson_events")
          .select("id")
          .eq("student_id", item.student_id)
          .eq("date", item.date)
          .eq("kind", "desmarcada")
          .or(`time.is.null,time.eq.${item.time}`)
          .limit(1);
        if (cancelled.error) throw new Error("cancellation_read_failed");
        remove ||= Boolean(cancelled.data?.length);
      }
      if (remove) {
        const removed = await googleRequest(
          job.teacher_id,
          `calendars/primary/events/${eventId}?sendUpdates=all`,
          { method: "DELETE" },
        );
        if (removed && !removed.ok && ![404, 410].includes(removed.status))
          throw new Error("google_delete_failed");
        await finish({ status: removed ? "sent" : "cancelled", last_error: null });
        if (removed) result.sent++;
        continue;
      }
      const date =
        job.source_kind === "schedule"
          ? item.monthly_day
            ? firstMonthlyDate(item.starts_on, item.monthly_day)
            : firstScheduleDate(item.starts_on, item.weekday)
          : item.date;
      const start = `${date}T${String(item.time).slice(0, 5)}:00-03:00`;
      const end = new Date(
        Date.parse(start) + (item.duration_minutes ?? 60) * 60_000,
      ).toISOString();
      const recurrence: string[] = [];
      if (job.source_kind === "schedule") {
        if (item.ends_on && item.ends_on < date) {
          const removed = await googleRequest(
            job.teacher_id,
            `calendars/primary/events/${eventId}?sendUpdates=all`,
            { method: "DELETE" },
          );
          if (removed && !removed.ok && ![404, 410].includes(removed.status))
            throw new Error("google_delete_failed");
          await finish({ status: removed ? "sent" : "cancelled", last_error: null });
          if (removed) result.sent++;
          continue;
        }
        let rule = item.monthly_day
          ? `RRULE:FREQ=MONTHLY;BYMONTHDAY=${item.monthly_day}`
          : `RRULE:FREQ=WEEKLY;BYDAY=${["SU", "MO", "TU", "WE", "TH", "FR", "SA"][item.weekday]}`;
        if (item.ends_on)
          rule +=
            ";UNTIL=" +
            new Date(Date.parse(item.ends_on + "T23:59:59-03:00"))
              .toISOString()
              .replace(/[-:]/g, "")
              .replace(".000", "");
        recurrence.push(rule);
        const cancelled = await db
          .from("lesson_events")
          .select("date,time")
          .eq("student_id", item.student_id)
          .eq("kind", "desmarcada");
        if (cancelled.error) throw new Error("cancellation_read_failed");
        const holidayRule = await db
          .from("holiday_settings")
          .select("enabled,effective_from")
          .eq("teacher_id", job.teacher_id)
          .maybeSingle();
        const holidays = holidayRule.data?.enabled
          ? await db
              .from("holidays")
              .select("date")
              .eq("teacher_id", job.teacher_id)
              .gte("date", holidayRule.data.effective_from)
          : { data: [] };
        const exceptions = calendarExclusions(
          date,
          item.ends_on ?? null,
          item.time,
          cancelled.data ?? [],
          holidays.data ?? [],
        );
        if (exceptions.length)
          recurrence.push("EXDATE;TZID=America/Sao_Paulo:" + exceptions.join(","));
      }
      const body = {
        id: eventId,
        status: "confirmed",
        summary: `Aula · ${item.students.name}`,
        description: "Aula organizada pelo Lessonara.",
        start: { dateTime: start, timeZone: "America/Sao_Paulo" },
        end: { dateTime: end, timeZone: "America/Sao_Paulo" },
        ...(recurrence.length ? { recurrence } : {}),
        attendees: item.students.email ? [{ email: item.students.email }] : [],
        conferenceData: {
          createRequest: { requestId: eventId, conferenceSolutionKey: { type: "hangoutsMeet" } },
        },
      };
      let response = await googleRequest(
        job.teacher_id,
        "calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
        { method: "POST", body: JSON.stringify(body) },
      );
      if (!response) {
        await finish({ status: "cancelled", last_error: "Conta Google desconectada." });
        continue;
      }
      if (response.status === 409)
        response = await googleRequest(
          job.teacher_id,
          `calendars/primary/events/${eventId}?conferenceDataVersion=1&sendUpdates=all`,
          { method: "PATCH", body: JSON.stringify(body) },
        );
      if (!response?.ok) throw new Error("google_sync_failed");
      let event = await response.json();
      for (
        let poll = 0;
        poll < 3 &&
        !event.hangoutLink &&
        event.conferenceData?.createRequest?.status?.statusCode === "pending";
        poll++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const refreshed = await googleRequest(
          job.teacher_id,
          `calendars/primary/events/${eventId}`,
        );
        if (refreshed?.ok) event = await refreshed.json();
      }
      const link = safeMeetUrl(
        event.hangoutLink ??
          event.conferenceData?.entryPoints?.find(
            (e: { entryPointType: string }) => e.entryPointType === "video",
          )?.uri,
      );
      if (!link) throw new Error("meeting_not_ready");
      {
        const saved = await db.from(table).update({ meet_url: link }).eq("id", job.source_id);
        if (saved.error) throw new Error("meeting_write_failed");
      }
      await finish({ status: "sent", last_error: null });
      result.sent++;
    } catch {
      await finish({
        status: job.attempts >= 5 ? "failed" : "pending",
        available_at: new Date(
          Date.now() + Math.min(600, 30 * 2 ** (job.attempts - 1)) * 1000,
        ).toISOString(),
        last_error: "Não foi possível sincronizar. Confira a integração Google.",
      });
      result.failed++;
    }
  }
  return result;
}
