import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lesson, LessonEvent, LessonStatus } from "./ledger";
export type OccurrenceRow = {
  id: string;
  provenance?: "schedule" | "retroactive" | "manual";
  student_id: string;
  source_kind: "schedule" | "appointment" | "makeup";
  source_id: string;
  lesson_date: string;
  lesson_time: string;
  duration_minutes: number;
  status: LessonStatus;
  counts: boolean;
  status_source: "presumed" | "exception" | "holiday";
  plan_snapshot: { name?: string | null };
  package_ref: string | null;
  package_position: number | null;
  package_snapshot: { lessons?: number } | null;
  event_snapshot: LessonEvent | null;
  holiday_name: string | null;
  meet_url: string | null;
  first_joined_at: string | null;
};
export async function loadLessonHistory(db: SupabaseClient, studentIds: string[]) {
  const collected: OccurrenceRow[] = [];
  // Capture is atomic per student; page the subsequent read to avoid truncating history.
  for (let offset = 0; offset < studentIds.length; offset += 200) {
    const ids = studentIds.slice(offset, offset + 200);
    const capture = await db.rpc("ensure_lesson_history", { p_student_ids: ids });
    if (capture.error) throw capture.error;
    for (let page = 0; ; page += 1000) {
      const result = await db
        .from("lesson_occurrences")
        .select("*")
        .in("student_id", ids)
        .order("id")
        .range(page, page + 999)
        .returns<OccurrenceRow[]>();
      if (result.error) throw result.error;
      collected.push(...(result.data ?? []));
      if ((result.data?.length ?? 0) < 1000) break;
    }
  }
  return collected;
}
export function historicalLesson(row: OccurrenceRow, today: string, time: string): Lesson {
  const past =
    row.lesson_date < today || (row.lesson_date === today && row.lesson_time.slice(0, 5) <= time);
  return {
    historyId: row.id,
    provenance: row.provenance,
    sourceKind: row.source_kind,
    sourceId: row.source_id,
    date: row.lesson_date,
    time: row.lesson_time.slice(0, 5),
    durationMinutes: row.duration_minutes,
    status: row.status,
    counts: row.counts,
    past,
    packageId: row.package_ref,
    packageIndex: null,
    packagePosition: row.package_position,
    packageLessons: row.package_snapshot?.lessons,
    planName: row.plan_snapshot.name,
    statusSource: row.status_source,
    event: row.event_snapshot,
    holidayName: row.holiday_name,
    meetUrl: row.meet_url,
    firstJoinedAt: row.first_joined_at,
  };
}
