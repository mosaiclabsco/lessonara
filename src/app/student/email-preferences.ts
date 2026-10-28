"use server";
import { studentPortalPath } from "@/lib/student-links";
import { authorizedStudent } from "@/lib/student-access";
import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
export async function updateStudentEmailPreferences(
  studentId: string,
  input: { lesson: boolean; renewal: boolean; promotional: boolean },
) {
  const access = await authorizedStudent(studentId);
  if (
    !access ||
    !input ||
    typeof input !== "object" ||
    typeof input.lesson !== "boolean" ||
    typeof input.renewal !== "boolean" ||
    typeof input.promotional !== "boolean"
  )
    return { ok: false, message: "Não foi possível atualizar as preferências." };
  const result = await createAdminClient()
    .from("students")
    .update({
      lesson_email_opt_out: !input.lesson,
      renewal_email_opt_out: !input.renewal,
      operational_email_opt_out: !input.lesson && !input.renewal,
      promotional_email_opt_out: !input.promotional,
    })
    .eq("id", access.id)
    .eq("teacher_id", access.teacher_id);
  if (result.error) return { ok: false, message: "Não foi possível salvar as preferências." };
  revalidatePath(`/student/portal/${access.id}`);
  if (access.slug) revalidatePath(studentPortalPath(access.slug));
  return { ok: true, message: "Preferências salvas." };
}
