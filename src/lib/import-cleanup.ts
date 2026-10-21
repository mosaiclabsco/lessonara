import type { SupabaseClient } from "@supabase/supabase-js";
export async function cleanupImportOriginals(
  db: SupabaseClient,
  scope?: { id: string; teacherId: string },
) {
  let query = db
    .from("student_imports")
    .select("id,teacher_id,object_path")
    .in("status", ["completed", "cancelled"])
    .not("object_path", "is", null)
    .order("created_at")
    .limit(10);
  if (scope) query = query.eq("id", scope.id).eq("teacher_id", scope.teacherId);
  const selected = await query;
  if (selected.error) return { removed: 0, failed: 1 };
  let removed = 0,
    failed = 0;
  for (const row of selected.data ?? []) {
    if (
      ![
        `${row.teacher_id}/${row.id}/original.csv`,
        `${row.teacher_id}/${row.id}/original.xlsx`,
      ].includes(row.object_path)
    ) {
      failed++;
      continue;
    }
    const result = await db.storage.from("lessonara-imports").remove([row.object_path]);
    if (result.error) {
      failed++;
      continue;
    }
    const saved = await db
      .from("student_imports")
      .update({ object_path: null })
      .eq("id", row.id)
      .eq("object_path", row.object_path)
      .in("status", ["completed", "cancelled"]);
    if (saved.error) failed++;
    else removed++;
  }
  return { removed, failed };
}
