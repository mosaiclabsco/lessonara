import type { SupabaseClient } from "@supabase/supabase-js";
import { loadLedgers } from "../data";
import { formatDate } from "../dates";

type Run = {
  scheduledFor: string;
  cursor: string | null;
  leaseId: string;
  done?: boolean;
  busy?: boolean;
};
type Recipient = { id: string; teacher_id: string; email: string; opening_credits: number };
export async function prepareReminderBatch(db: SupabaseClient, pageSize = 100) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
    throw new Error("Invalid reminder batch size");
  const claim = await db.rpc("claim_renewal_run");
  if (claim.error) throw new Error("Could not claim reminders");
  const run = claim.data as Run;
  if (!run || run.done || run.busy)
    return { checked: 0, queued: 0, done: !!run?.done, busy: !!run?.busy };
  try {
    let query = db
      .from("students")
      .select(
        "id,teacher_id,email,opening_credits,teachers!students_teacher_id_fkey!inner(platform_plan)",
      )
      .eq("active", true)
      .eq("operational_email_opt_out", false)
      .not("email", "is", null)
      .in("teachers.platform_plan", ["plus", "pro"])
      .order("id")
      .limit(pageSize);
    if (run.cursor) query = query.gt("id", run.cursor);
    const selected = await query;
    if (selected.error) throw new Error("Could not load reminder recipients");
    const students = (selected.data ?? []) as unknown as Recipient[];
    const ledgers = await loadLedgers(
      db,
      students.map((s) => s.id),
      students,
    );
    const items = [];
    for (const s of students) {
      const state = ledgers.get(s.id);
      if (!state) throw new Error("Missing reminder ledger");
      const ledger = state.ledger;
      if (
        ledger.credits === 0 ||
        ledger.remaining > 1 ||
        !ledger.lessons.some((l) => !l.past && l.counts)
      )
        continue;
      const message =
        ledger.remaining <= 0
          ? "Seu pacote de aulas acabou."
          : `Falta 1 aula para acabar seu pacote${ledger.coveredUntil ? ` (última em ${formatDate(ledger.coveredUntil)})` : ""}.`;
      items.push({
        student_id: s.id,
        teacher_id: s.teacher_id,
        email: s.email,
        credits: ledger.credits,
        message,
      });
    }
    const done = students.length < pageSize;
    const saved = await db.rpc("finish_renewal_batch", {
      p_run: run.scheduledFor,
      p_lease: run.leaseId,
      p_cursor: students.at(-1)?.id ?? run.cursor,
      p_complete: done,
      p_items: items,
      p_checked: students.length,
    });
    if (saved.error) throw new Error("Could not checkpoint reminders");
    return { checked: students.length, queued: Number(saved.data ?? 0), done, busy: false };
  } catch (error) {
    const failed = await db.rpc("fail_renewal_run", {
      p_run: run.scheduledFor,
      p_lease: run.leaseId,
    });
    if (failed.error) console.error("renewal_failure_checkpoint_failed");
    throw error;
  }
}
