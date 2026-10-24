"use server";
import { authorizedStudent } from "@/lib/student-access";
import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
export async function updateStudentEmailPreferences(
  studentId: string,
  input: { operational: boolean; promotional: boolean },
) {
  const access = await authorizedStudent(studentId);
  if (!access || typeof input.operational !== "boolean" || typeof input.promotional !== "boolean")
    return { ok: false, message: "Não foi possível atualizar as preferências." };
  const result = await createAdminClient()
    .from("students")
    .update({
      operational_email_opt_out: !input.operational,
      promotional_email_opt_out: !input.promotional,
    })
    .eq("id", access.id)
    .eq("teacher_id", access.teacher_id);
  if (result.error) return { ok: false, message: "Não foi possível salvar as preferências." };
  revalidatePath(`/student/portal/${access.id}`);
  return { ok: true, message: "Preferências salvas." };
}
