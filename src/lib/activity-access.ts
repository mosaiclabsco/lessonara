import { authorizedStudent } from "./student-access";
import type { SupabaseClient } from "@supabase/supabase-js";
export async function studentActivity(
  supabase: SupabaseClient,
  identifier: string,
  activityId: string,
  kind: "id" | "slug" = "id",
) {
  const access = await authorizedStudent(identifier, kind);
  if (!access) return null;
  const student = { data: access };
  const activity = await supabase
    .from("activities")
    .select("id,teacher_id,student_id,document_id,due_on,archived_at")
    .eq("id", activityId)
    .eq("student_id", student.data.id)
    .eq("teacher_id", student.data.teacher_id)
    .maybeSingle();
  return activity.error || !activity.data ? null : { ...activity.data, studentSlug: access.slug };
}
