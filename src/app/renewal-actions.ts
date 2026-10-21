"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorizedStudent } from "@/lib/student-access";
import { createAdminClient, requireUser } from "@/lib/supabase/server";
import {
  formText,
  uuidValue,
  validatedAction,
  FormValidationError,
  isoDate,
} from "@/lib/form-validation";
import { validatePix } from "@/lib/pix";
function failed(error: { message: string } | null) {
  if (error)
    throw new FormValidationError(
      "",
      "Não foi possível concluir. Atualize a página e confira os dados antes de tentar novamente.",
    );
}
export async function savePix(form: FormData) {
  return validatedAction(async () => {
    const { supabase, userId } = await requireUser();
    const pix = validatePix({
      key_type: formText(form, "key_type", 10, true),
      pix_key: formText(form, "pix_key", 77, true),
      receiver_name: formText(form, "receiver_name", 120, true),
      receiver_city: formText(form, "receiver_city", 120, true),
    });
    failed(
      (
        await supabase
          .from("teacher_receivables")
          .upsert({ ...pix, teacher_id: userId, updated_at: new Date().toISOString() })
      ).error,
    );
    revalidatePath("/settings");
  });
}
export async function removePix() {
  return validatedAction(async () => {
    const { supabase, userId } = await requireUser();
    failed((await supabase.from("teacher_receivables").delete().eq("teacher_id", userId)).error);
    revalidatePath("/settings");
  });
}
export async function studentRenewal(
  studentId: string,
  operation: "prepare" | "report" | "cancel",
  form: FormData,
) {
  return validatedAction(async () => {
    uuidValue(studentId, "student");
    const access = await authorizedStudent(studentId);
    if (!access) redirect("/student/login");
    const db = createAdminClient();
    if (operation === "prepare")
      failed((await db.rpc("prepare_student_renewal", { p_student: access.id })).error);
    else if (operation === "report" || operation === "cancel")
      failed(
        (
          await db.rpc("report_student_renewal", {
            p_student: access.id,
            p_request: uuidValue(formText(form, "request_id", 36, true), "request_id"),
            p_cancel: operation === "cancel",
          })
        ).error,
      );
    else throw new FormValidationError("", "Ação inválida.");
    revalidatePath(`/p/${access.teacher_id}/s/${encodeURIComponent(access.slug)}`);
  });
}
export async function resolveRenewal(requestId: string, reject: boolean, form: FormData) {
  return validatedAction(async () => {
    const { supabase } = await requireUser();
    if (typeof reject !== "boolean")
      throw new FormValidationError("", "Escolha confirmar ou devolver para revisão.");
    failed(
      (
        await supabase.rpc("resolve_student_renewal", {
          p_request: uuidValue(requestId, "request"),
          p_paid_on: reject ? null : isoDate(formText(form, "paid_on", 10, true), "paid_on"),
          p_reject: reject,
          p_note: formText(form, "note", 400, false, true),
        })
      ).error,
    );
    revalidatePath("/", "layout");
  });
}
