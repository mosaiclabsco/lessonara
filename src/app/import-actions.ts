"use server";
import { cleanupImportOriginals } from "@/lib/import-cleanup";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireConfiguredTeacher } from "@/lib/onboarding";
import { createAdminClient, requireUser } from "@/lib/supabase/server";
import { platformPlan } from "@/lib/platform-plans";
import { IMPORT_MAX_BYTES, previewImport } from "@/lib/import-rules";
import {
  formText,
  uuidValue,
  integerValue,
  validatedAction,
  FormValidationError,
} from "@/lib/form-validation";
import { nowInTZ } from "@/lib/dates";
import type { Plan } from "@/lib/data";
function fail(error: { message: string; code?: string } | null) {
  if (error)
    throw new FormValidationError(
      "",
      error.code === "23505" && error.message.includes("students_teacher_email_unique")
        ? "Já existe um aluno com este email. Revise também os cadastros inativos antes de importar."
        : error.code === "P0001"
          ? error.message
          : "Não foi possível concluir a importação. Revise os dados e tente novamente.",
    );
}
export async function uploadImport(form: FormData) {
  return validatedAction(async () => {
    const { supabase, userId, teacher } = await requireConfiguredTeacher();
    if (!platformPlan(teacher.platform_plan).imports)
      throw new FormValidationError("", "Importação disponível no Plus e Pro.");
    const mode = formText(form, "mode", 10, true);
    if (mode !== "guided" && mode !== "assisted")
      throw new FormValidationError("mode", "Escolha como importar.");
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 1 || file.size > IMPORT_MAX_BYTES)
      throw new FormValidationError("file", "Escolha um arquivo de até 512 KB.");
    const extension = file.name.toLowerCase().split(".").at(-1);
    if (extension !== "csv" && (mode !== "assisted" || extension !== "xlsx"))
      throw new FormValidationError(
        "file",
        mode === "guided" ? "Use um CSV UTF-8 seguindo o modelo." : "Use CSV ou XLSX, sem macros.",
      );
    if (file.name.length > 120)
      throw new FormValidationError("file", "Use um nome de arquivo com até 120 caracteres.");
    const buffer = Buffer.from(await file.arrayBuffer());
    if (extension === "xlsx" && (buffer[0] !== 0x50 || buffer[1] !== 0x4b))
      throw new FormValidationError("file", "O arquivo não parece ser uma planilha XLSX.");
    let preview = null;
    if (mode === "guided") {
      const [plans, students] = await Promise.all([
        supabase
          .from("plans")
          .select("*")
          .eq("teacher_id", userId)
          .eq("is_active", true)
          .returns<Plan[]>(),
        supabase.from("students").select("name,email").eq("teacher_id", userId).limit(1000),
      ]);
      fail(plans.error);
      fail(students.error);
      try {
        preview = previewImport(
          new TextDecoder("utf-8", { fatal: true }).decode(buffer),
          plans.data ?? [],
          students.data ?? [],
          nowInTZ().today,
        );
      } catch (error) {
        throw new FormValidationError(
          "file",
          error instanceof Error ? error.message : "Confira o CSV UTF-8.",
        );
      }
    }
    const opened = await supabase.rpc("open_student_import", {
      p_mode: mode,
      p_filename: file.name,
      p_hash: createHash("sha256").update(buffer).digest("hex"),
    });
    fail(opened.error);
    const id = opened.data as string;
    const db = createAdminClient();
    const batch = await db
      .from("student_imports")
      .select("status,teacher_id,object_path")
      .eq("id", id)
      .eq("teacher_id", userId)
      .single();
    fail(batch.error);
    if (batch.data?.status === "waiting") {
      if (mode === "guided")
        fail((await db.rpc("stage_student_import", { p_id: id, p_preview: preview })).error);
      else {
        const path = `${userId}/${id}/original.${extension}`;
        const uploaded = await db.storage.from("lessonara-imports").upload(path, buffer, {
          contentType:
            extension === "csv"
              ? "text/csv"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          upsert: true,
        });
        fail(uploaded.error);
        fail(
          (
            await db
              .from("student_imports")
              .update({ object_path: path })
              .eq("id", id)
              .eq("teacher_id", userId)
              .eq("status", "waiting")
          ).error,
        );
      }
    }
    revalidatePath("/", "layout");
    redirect(`/students/import?batch=${id}`);
  });
}
export async function confirmImport(id: string, form: FormData) {
  return validatedAction(async () => {
    const { supabase, userId } = await requireConfiguredTeacher();
    uuidValue(id, "batch");
    if (form.get("reviewed") !== "yes")
      throw new FormValidationError("reviewed", "Confirme que revisou os dados e os saldos.");
    const rows = form.getAll("rows");
    if (!rows.length || rows.some((x) => typeof x !== "string" || !/^\d{1,3}$/.test(x)))
      throw new FormValidationError("rows", "Selecione as linhas válidas para importar.");
    const result = await supabase.rpc("confirm_student_import", {
      p_id: id,
      p_revision: integerValue(form.get("revision"), "revision", 1, 10000),
      p_rows: rows,
      p_invite: form.get("invite") === "yes",
    });
    fail(result.error);
    await clearOriginal(id, userId);
    revalidatePath("/", "layout");
  });
}
async function clearOriginal(id: string, userId: string) {
  return cleanupImportOriginals(createAdminClient(), { id, teacherId: userId });
}

export async function cancelImport(id: string) {
  return validatedAction(async () => {
    const { supabase, userId } = await requireUser();
    fail((await supabase.rpc("cancel_student_import", { p_id: uuidValue(id, "batch") })).error);
    await clearOriginal(id, userId);
    revalidatePath("/", "layout");
  });
}
export async function skipImport(form?: FormData) {
  return validatedAction(async () => {
    const { supabase } = await requireUser();
    fail((await supabase.rpc("skip_student_import")).error);
    revalidatePath("/", "layout");
    if (form?.get("next") === "student") redirect("/students/new");
  });
}
