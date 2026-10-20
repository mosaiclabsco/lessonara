"use server";
import { requireUser } from "@/lib/supabase/server";
import { googleBusy } from "@/lib/google/calendar";
export async function teacherAvailability(date: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    new Date(date + "T12:00:00Z").toISOString().slice(0, 10) !== date
  )
    throw new Error("Escolha uma data válida.");
  const { supabase, userId } = await requireUser();
  const students = await supabase.from("students").select("id,name").eq("teacher_id", userId);
  if (students.error) throw new Error("Não foi possível consultar a agenda.");
  const names = new Map((students.data ?? []).map((s) => [s.id, s.name]));
  const ids = [...names.keys()];
  const local: { start: string; end: string; label: string }[] = [];
  if (ids.length) {
    const [schedules, appointments, events] = await Promise.all([
      supabase
        .from("schedules")
        .select("student_id,weekday,monthly_day,time,starts_on,ends_on,duration_minutes")
        .in("student_id", ids)
        .lte("starts_on", date)
        .or(`ends_on.is.null,ends_on.gte.${date}`),
      supabase
        .from("appointments")
        .select("student_id,time,duration_minutes")
        .in("student_id", ids)
        .eq("date", date),
      supabase
        .from("lesson_events")
        .select("student_id,time,kind,duration_minutes")
        .in("student_id", ids)
        .eq("date", date),
    ]);
    if (schedules.error || appointments.error || events.error)
      throw new Error("Não foi possível consultar a agenda.");
    const weekday = new Date(date + "T12:00:00Z").getUTCDay();
    const day = Number(date.slice(8));
    const cancelled = (student: string, time: string) =>
      (events.data ?? []).some(
        (e) => e.student_id === student && e.kind === "desmarcada" && (!e.time || e.time === time),
      );
    const rows = [
      ...(schedules.data ?? []).filter((s) =>
        s.monthly_day ? s.monthly_day === day : s.weekday === weekday,
      ),
      ...(appointments.data ?? []),
    ].filter((row) => !cancelled(row.student_id, row.time));
    rows.push(...(events.data ?? []).filter((e) => e.kind === "reposicao"));
    for (const row of rows) {
      const start = `${date}T${row.time.slice(0, 5)}:00-03:00`;
      local.push({
        start,
        end: new Date(Date.parse(start) + (row.duration_minutes ?? 60) * 60000).toISOString(),
        label: names.get(row.student_id) ?? "Aula",
      });
    }
  }
  let googleError = false;
  let external: { start: string; end: string; label: string }[] = [];
  try {
    external = (
      (await googleBusy(userId, date + "T00:00:00-03:00", date + "T23:59:59-03:00")) ?? []
    ).map((item) => ({ ...item, label: "Ocupado no Google" }));
  } catch {
    googleError = true;
  }
  return { busy: [...local, ...external], googleError };
}
