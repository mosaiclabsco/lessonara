import type { SupabaseClient } from "@supabase/supabase-js";
import { documentsSetupMissing, shareAvailable } from "./document-rules";

export type LibraryDocument = {
  id: string;
  title: string;
  subject: string;
  file_name: string;
  mime_type: string;
  byte_size: number;
  status: "uploading" | "ready" | "deleting";
  created_at: string;
  shareCount: number;
};
export type DocumentRecord = Omit<LibraryDocument, "shareCount"> & {
  teacher_id: string;
  storage_path: string;
};
export type Material = {
  id: string;
  title: string;
  subject: string;
  fileName: string;
  byteSize: number;
  expiresOn: string | null;
};
export type StudentShare = Material & { documentId: string };
type LibraryRow = DocumentRecord & { document_shares: { expires_on: string | null }[] };

export async function loadDocumentLibrary(
  supabase: SupabaseClient,
  teacherId: string,
  today: string,
  includeSubmissions = false,
) {
  async function readDocuments() {
    const documents: LibraryDocument[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from("documents")
        .select("*, document_shares(expires_on)")
        .eq("teacher_id", teacherId)
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 999)
        .returns<LibraryRow[]>();
      if (documentsSetupMissing(error))
        return { ready: false, documents: [] as LibraryDocument[], submissionBytes: 0 };
      if (error) throw error;
      const rows = data ?? [];
      documents.push(
        ...rows.map(({ document_shares, storage_path, teacher_id, ...document }) => {
          void storage_path;
          void teacher_id;
          return {
            ...document,
            shareCount:
              document.status === "ready"
                ? (document_shares ?? []).filter((share) => shareAvailable(share.expires_on, today))
                    .length
                : 0,
          };
        }),
      );
      if (rows.length < 1000) break;
    }
    return {
      ready: true,
      documents: [...new Map(documents.map((document) => [document.id, document])).values()],
    };
  }
  const [library, usage] = await Promise.all([
    readDocuments(),
    includeSubmissions
      ? supabase.rpc("submission_storage_usage")
      : Promise.resolve({ data: 0, error: null }),
  ]);
  if (!library.ready) return { ...library, submissionBytes: 0 };
  if (usage.error && !documentsSetupMissing(usage.error)) throw usage.error;
  return { ...library, submissionBytes: Number(usage.data ?? 0) };
}

export async function loadStudentShares(
  supabase: SupabaseClient,
  studentId: string,
  teacherId: string,
  today: string,
  activeOnly = false,
) {
  const shares: StudentShare[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("document_shares")
      .select(
        "id, document_id, expires_on, documents!inner(title, subject, file_name, byte_size, status, teacher_id)",
      )
      .eq("student_id", studentId)
      .eq("teacher_id", teacherId)
      .eq("documents.teacher_id", teacherId)
      .eq("documents.status", "ready")
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + 999)
      .returns<
        {
          id: string;
          document_id: string;
          expires_on: string | null;
          documents: { title: string; subject: string; file_name: string; byte_size: number };
        }[]
      >();
    if (documentsSetupMissing(error)) return { ready: false, shares: [] as StudentShare[] };
    if (error) throw error;
    const rows = data ?? [];
    shares.push(
      ...rows
        .filter((share) => !activeOnly || shareAvailable(share.expires_on, today))
        .map((share) => ({
          id: share.id,
          documentId: share.document_id,
          title: share.documents.title,
          subject: share.documents.subject,
          fileName: share.documents.file_name,
          byteSize: share.documents.byte_size,
          expiresOn: share.expires_on,
        })),
    );
    if (rows.length < 1000) break;
  }
  return { ready: true, shares: [...new Map(shares.map((share) => [share.id, share])).values()] };
}
