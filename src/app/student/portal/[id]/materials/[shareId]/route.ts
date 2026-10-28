import { downloadLimit } from "@/lib/download-limit";
import { authorizedStudent } from "@/lib/student-access";
import { createAdminClient } from "@/lib/supabase/server";
import { DOCUMENT_BUCKET, downloadLifetime } from "@/lib/document-rules";
import { nowInTZ } from "@/lib/dates";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; shareId: string }> },
) {
  const { id, shareId } = await params;
  const supabase = createAdminClient();
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
  };
  const access = await authorizedStudent(id);
  if (!access) return new Response("Material não encontrado.", { status: 404, headers });
  const share = await supabase
    .from("document_shares")
    .select("expires_on, documents!inner(storage_path, file_name, teacher_id, status)")
    .eq("id", shareId)
    .eq("student_id", access.id)
    .eq("teacher_id", access.teacher_id)
    .eq("documents.teacher_id", access.teacher_id)
    .eq("documents.status", "ready")
    .maybeSingle<{
      expires_on: string | null;
      documents: { storage_path: string; file_name: string };
    }>();
  if (share.error || !share.data)
    return new Response("Material não encontrado.", { status: 404, headers });
  const now = new Date();
  const { today, time } = nowInTZ(now);
  const lifetime = downloadLifetime(share.data.expires_on, today, time, now.getUTCSeconds());
  if (!lifetime)
    return new Response("O prazo de acesso a este material terminou.", { status: 403, headers });
  const blocked = await downloadLimit(
    `student/${access.id}`,
    share.data.documents.storage_path,
    "file",
  );
  if (blocked) return blocked;
  const signed = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(share.data.documents.storage_path, lifetime, {
      download: share.data.documents.file_name,
    });
  if (signed.error || !signed.data)
    return new Response("Não foi possível abrir o material. Tente novamente.", {
      status: 503,
      headers,
    });
  return new Response(null, {
    status: 303,
    headers: { ...headers, Location: signed.data.signedUrl },
  });
}
