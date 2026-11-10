import { createAdminClient } from "@/lib/supabase/server";
import { readGoogleLessonPreview, type GoogleLessonLink } from "./lesson-links";
export async function processGoogleLessonLinks() {
  const db = createAdminClient();
  const claimed = await db.rpc("claim_google_lesson_links");
  if (claimed.error) throw new Error("Não foi possível processar os vínculos Google.");
  let linked = 0,
    linkFailed = 0;
  for (const link of (claimed.data ?? []) as GoogleLessonLink[]) {
    try {
      const preview = await readGoogleLessonPreview(
        link.teacher_id,
        link.event_id,
        link.starts_on,
        true,
      );
      const result = await db.rpc("apply_google_lesson_link", {
        p_teacher: link.teacher_id,
        p_student: link.student_id,
        p_event: link.event_id,
        p_title: preview.title,
        p_recurring: link.recurring,
        p_starts: link.starts_on,
        p_until: preview.until,
        p_instances: preview.instances,
        p_link: link.id,
      });
      if (result.error) throw new Error();
      linked++;
    } catch {
      const saved = await db
        .from("google_lesson_links")
        .update({
          last_error:
            "Não foi possível atualizar o vínculo. Confira conflitos, plano e conexão Google.",
        })
        .eq("id", link.id)
        .eq("teacher_id", link.teacher_id);
      if (saved.error) throw new Error("google_link_write_failed");
      linkFailed++;
    }
  }
  return { linked, linkFailed };
}
