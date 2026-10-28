import type { SupabaseClient } from "@supabase/supabase-js";
export async function resolveStudentTarget(db: SupabaseClient, slug: string, teacherId?: string) {
  if (
    !/^[A-Za-z\d_-]{8,128}$/.test(slug) ||
    (teacherId !== undefined &&
      !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(teacherId))
  )
    return null;
  let query = db.from("students").select("id,teacher_id,slug").eq("slug", slug).eq("active", true);
  if (teacherId !== undefined) query = query.eq("teacher_id", teacherId);
  const result = await query.maybeSingle();
  if (result.error) throw new Error("Não foi possível preparar seu acesso.");
  return result.data as { id: string; teacher_id: string; slug: string } | null;
}
