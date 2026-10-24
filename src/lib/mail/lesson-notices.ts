import type { SupabaseClient } from "@supabase/supabase-js";
import { loadLedgers } from "../data";
export function lessonNoticeDue(date: string, time: string, now = Date.now()) {
  const start = Date.parse(`${date}T${time.slice(0, 5)}:00-03:00`);
  return start > now && start - now <= 60 * 60000;
}
export async function prepareLessonNotices(db: SupabaseClient) {
  const state = await db.rpc("lesson_notice_cursor");
  if (state.error) throw new Error("Não foi possível retomar os lembretes.");
  let q = db
    .from("students")
    .select(
      "id,teacher_id,email,opening_credits,teachers!students_teacher_id_fkey!inner(platform_plan)",
    )
    .eq("active", true)
    .eq("operational_email_opt_out", false)
    .eq("teachers.platform_plan", "pro")
    .not("email", "is", null)
    .order("id")
    .limit(100);
  if (state.data) q = q.gt("id", state.data);
  const page = await q;
  if (page.error) throw new Error("Não foi possível consultar os destinatários.");
  const students = page.data ?? [],
    ledgers = await loadLedgers(
      db,
      students.map((s) => s.id),
      students,
    ),
    items = [];
  for (const s of students) {
    const ledger = ledgers.get(s.id)?.ledger;
    if (!ledger) throw new Error("Saldo indisponível.");
    for (const l of ledger.lessons) {
      if (
        l.past ||
        !l.counts ||
        l.status === "feriado" ||
        !l.packageId ||
        !l.sourceId ||
        !l.sourceKind ||
        !lessonNoticeDue(l.date, l.time)
      )
        continue;
      items.push({
        student_id: s.id,
        teacher_id: s.teacher_id,
        date: l.date,
        time: l.time.slice(0, 5),
        source_kind: l.sourceKind,
        source_id: l.sourceId,
      });
    }
  }
  const result = await db.rpc("queue_lesson_notices", {
    p_cursor: students.length === 100 ? students.at(-1)!.id : null,
    p_items: items,
  });
  if (result.error) throw new Error("Não foi possível preparar os lembretes.");
  return {
    checked: students.length,
    queued: Number(result.data ?? 0),
    done: students.length < 100,
  };
}
