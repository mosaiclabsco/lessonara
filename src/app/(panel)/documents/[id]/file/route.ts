import { downloadLimit } from "@/lib/download-limit";
import { requireUser } from "@/lib/supabase/server";
import { DOCUMENT_BUCKET } from "@/lib/document-rules";
import type { DocumentRecord } from "@/lib/documents";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("teacher_id", userId)
    .eq("status", "ready")
    .maybeSingle<DocumentRecord>();
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
  if (error || !data) return new Response("Documento não encontrado.", { status: 404, headers });
  const blocked = await downloadLimit(`teacher/${userId}`, data.storage_path, "file");
  if (blocked) return blocked;
  const signed = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(data.storage_path, 60, { download: data.file_name });
  if (signed.error || !signed.data)
    return new Response("Não foi possível abrir o documento.", { status: 503, headers });
  return new Response(null, {
    status: 303,
    headers: { ...headers, Location: signed.data.signedUrl },
  });
}
