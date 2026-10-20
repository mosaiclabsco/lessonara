export const DOCUMENT_BUCKET = "lessonara-documents";
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const LIBRARY_BYTES = 1024 * 1024 * 1024;
export const DOCUMENT_ACCEPT = ".pdf,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp";

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function validateDocumentFile(
  fileName: string,
  byteSize: number,
  maxBytes = MAX_DOCUMENT_BYTES,
) {
  if (!fileName || fileName.length > 180 || /[\x00-\x1f/\\]/.test(fileName))
    throw new Error("Confira o nome do arquivo.");
  const extension = fileName.split(".").at(-1)?.toLowerCase() ?? "";
  if (!MIME[extension])
    throw new Error(
      "Use PDF, documentos, apresentações, planilhas, texto ou imagens JPG/PNG/WebP.",
    );
  if (!Number.isSafeInteger(byteSize) || byteSize < 1 || byteSize > maxBytes)
    throw new Error(`O arquivo precisa ter conteúdo e no máximo ${formatFileSize(maxBytes)}.`);
  return { extension, mimeType: MIME[extension] };
}

export function validDocumentText(title: string, subject: string) {
  if (!title.trim() || title.trim().length > 120 || subject.trim().length > 80)
    throw new Error("Informe um título de até 120 caracteres e assunto de até 80.");
  return { title: title.trim(), subject: subject.trim() };
}

export function validExpiry(value: string, today: string) {
  if (!value) return null;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(new Date(`${value}T12:00:00Z`).getTime()) ||
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value ||
    value < today
  )
    throw new Error("Escolha uma data de validade a partir de hoje ou deixe sem prazo.");
  return value;
}

export function shareAvailable(expiresOn: string | null, today: string) {
  return !expiresOn || expiresOn >= today;
}

export function downloadLifetime(
  expiresOn: string | null,
  today: string,
  time: string,
  seconds: number,
) {
  if (!shareAvailable(expiresOn, today)) return 0;
  if (expiresOn !== today) return 60;
  const [hours, minutes] = time.split(":").map(Number);
  return Math.max(0, Math.min(60, (24 * 60 - hours * 60 - minutes) * 60 - seconds));
}

export function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

export function documentsSetupMissing(error: { code?: string } | null) {
  return Boolean(error && ["42P01", "PGRST205", "PGRST202"].includes(error.code ?? ""));
}
