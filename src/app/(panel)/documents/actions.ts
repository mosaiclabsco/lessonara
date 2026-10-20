"use server";
import { loadTeacherPlan } from "@/lib/platform-plan-server";
import { requireConfiguredTeacher } from "@/lib/onboarding";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { nowInTZ } from "@/lib/dates";
import {
  DOCUMENT_BUCKET,
  documentsSetupMissing,
  validDocumentText,
  validateDocumentFile,
  validExpiry,
} from "@/lib/document-rules";
import type { DocumentRecord } from "@/lib/documents";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; message: string };
const failure = (message: string): { ok: false; message: string } => ({ ok: false, message });
const refreshDocuments = () => revalidatePath("/", "layout");

export async function beginDocumentUpload(input: {
  title: string;
  subject: string;
  fileName: string;
  byteSize: number;
}): Promise<Result<{ id: string; path: string; token: string; mimeType: string }>> {
  const { supabase, userId } = await requireConfiguredTeacher();
  const plan = await loadTeacherPlan(userId, supabase);
  let details;
  let file;
  try {
    details = validDocumentText(input.title, input.subject);
    file = validateDocumentFile(input.fileName, input.byteSize, plan.maxFileBytes);
  } catch (error) {
    return failure((error as Error).message);
  }
  const id = randomUUID();
  const path = `${userId}/${id}/file.${file.extension}`;
  const { error } = await supabase.rpc("reserve_document_upload", {
    p_id: id,
    p_title: details.title,
    p_subject: details.subject,
    p_file_name: input.fileName,
    p_storage_path: path,
    p_mime_type: file.mimeType,
    p_byte_size: input.byteSize,
  });
  if (error) {
    if (documentsSetupMissing(error))
      return failure(
        "A área de Documentos ainda não está disponível. Conclua a configuração do armazenamento.",
      );
    if (error.code === "P0001" && error.message.includes("limite do plano"))
      return failure(error.message);
    if (error.code === "P0001" && error.message.includes("armazenamento"))
      return failure(
        "O espaço de Documentos está cheio. Remova arquivos que não utiliza antes de enviar outro.",
      );
    return failure("Não foi possível preparar o envio do arquivo.");
  }
  const signed = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUploadUrl(path);
  if (signed.error || !signed.data) {
    await supabase
      .from("documents")
      .delete()
      .eq("id", id)
      .eq("teacher_id", userId)
      .eq("status", "uploading");
    return failure(
      "Não foi possível preparar o armazenamento. Confira a configuração de Documentos.",
    );
  }
  return { ok: true, data: { id, path, token: signed.data.token, mimeType: file.mimeType } };
}

export async function finishDocumentUpload(id: string): Promise<Result> {
  const { supabase, userId } = await requireUser();
  const { data: document, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("teacher_id", userId)
    .maybeSingle<DocumentRecord>();
  if (error || !document || document.status !== "uploading")
    return failure("Envio não encontrado ou já concluído. Atualize a área de Documentos.");
  const info = await supabase.storage.from(DOCUMENT_BUCKET).info(document.storage_path);
  if (
    info.error ||
    !info.data ||
    info.data.size !== document.byte_size ||
    info.data.contentType !== document.mime_type
  )
    return failure("Não foi possível confirmar o tamanho e o tipo do arquivo enviado.");
  const updated = await supabase
    .from("documents")
    .update({ status: "ready" })
    .eq("id", id)
    .eq("teacher_id", userId)
    .eq("status", "uploading")
    .select("id")
    .maybeSingle();
  if (updated.error || !updated.data)
    return failure("Não foi possível concluir o envio. Atualize a área de Documentos.");
  refreshDocuments();
  return { ok: true, data: undefined };
}

export async function removeLibraryDocument(id: string, incompleteOnly = false): Promise<Result> {
  const { supabase, userId } = await requireUser();
  const { data: document, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("teacher_id", userId)
    .maybeSingle<DocumentRecord>();
  if (error || !document) return failure("Documento não encontrado.");
  if (incompleteOnly && document.status === "ready")
    return failure("O arquivo já está em Documentos.");
  const locked = await supabase
    .from("documents")
    .update({ status: "deleting" })
    .eq("id", id)
    .eq("teacher_id", userId)
    .eq("status", document.status)
    .select("id")
    .maybeSingle();
  if (locked.error || !locked.data)
    return failure("O documento mudou. Atualize a área de Documentos antes de remover.");
  const removed = await supabase.storage.from(DOCUMENT_BUCKET).remove([document.storage_path]);
  if (removed.error) {
    await supabase
      .from("documents")
      .update({ status: document.status })
      .eq("id", id)
      .eq("teacher_id", userId)
      .eq("status", "deleting");
    refreshDocuments();
    return failure("Não foi possível remover o arquivo. Tente novamente.");
  }
  const deleted = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("teacher_id", userId)
    .eq("status", "deleting");
  refreshDocuments();
  if (deleted.error)
    return failure(
      "O arquivo foi removido, mas é preciso tentar novamente para concluir a exclusão do registro.",
    );
  return { ok: true, data: undefined };
}

export async function updateLibraryDocument(
  id: string,
  input: { title: string; subject: string },
): Promise<Result> {
  const { supabase, userId } = await requireUser();
  let details;
  try {
    details = validDocumentText(input.title, input.subject);
  } catch (error) {
    return failure((error as Error).message);
  }
  const { data, error } = await supabase
    .from("documents")
    .update(details)
    .eq("id", id)
    .eq("teacher_id", userId)
    .eq("status", "ready")
    .select("id")
    .maybeSingle();
  if (error || !data) return failure("Não foi possível atualizar o documento.");
  refreshDocuments();
  return { ok: true, data: undefined };
}

export async function shareLibraryDocument(
  studentId: string,
  documentId: string,
  expiry: string,
): Promise<Result> {
  const { supabase, userId } = await requireUser();
  let expiresOn;
  try {
    expiresOn = validExpiry(expiry, nowInTZ().today);
  } catch (error) {
    return failure((error as Error).message);
  }
  const [student, document] = await Promise.all([
    supabase
      .from("students")
      .select("id")
      .eq("id", studentId)
      .eq("teacher_id", userId)
      .maybeSingle(),
    supabase
      .from("documents")
      .select("id")
      .eq("id", documentId)
      .eq("teacher_id", userId)
      .eq("status", "ready")
      .maybeSingle(),
  ]);
  if (student.error || document.error || !student.data || !document.data)
    return failure("Aluno ou documento não encontrado na sua conta.");
  const { error } = await supabase
    .from("document_shares")
    .upsert(
      { teacher_id: userId, student_id: studentId, document_id: documentId, expires_on: expiresOn },
      { onConflict: "document_id,student_id" },
    );
  if (error) return failure("Não foi possível compartilhar o documento.");
  refreshDocuments();
  return { ok: true, data: undefined };
}

export async function changeDocumentShare(
  studentId: string,
  shareId: string,
  expiry: string,
): Promise<Result> {
  const { supabase, userId } = await requireUser();
  let expiresOn;
  try {
    expiresOn = validExpiry(expiry, nowInTZ().today);
  } catch (error) {
    return failure((error as Error).message);
  }
  const { data, error } = await supabase
    .from("document_shares")
    .update({ expires_on: expiresOn })
    .eq("id", shareId)
    .eq("student_id", studentId)
    .eq("teacher_id", userId)
    .select("id")
    .maybeSingle();
  if (error || !data) return failure("Não foi possível alterar a validade do compartilhamento.");
  refreshDocuments();
  return { ok: true, data: undefined };
}

export async function revokeDocumentShare(studentId: string, shareId: string): Promise<Result> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("document_shares")
    .delete()
    .eq("id", shareId)
    .eq("student_id", studentId)
    .eq("teacher_id", userId)
    .select("id")
    .maybeSingle();
  if (error || !data) return failure("Não foi possível encerrar o compartilhamento.");
  refreshDocuments();
  return { ok: true, data: undefined };
}
