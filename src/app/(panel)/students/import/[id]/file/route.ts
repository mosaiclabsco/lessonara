import { downloadLimit } from "@/lib/download-limit";
import { requireUser, createAdminClient } from "@/lib/supabase/server";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await requireUser();
  if (!/^[a-f0-9-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const row = await supabase
    .from("student_imports")
    .select("object_path,filename")
    .eq("id", id)
    .eq("teacher_id", userId)
    .maybeSingle();
  if (row.error) return new Response("Unavailable", { status: 503 });
  if (!row.data?.object_path) return new Response("Not found", { status: 404 });
  if (
    ![`${userId}/${id}/original.csv`, `${userId}/${id}/original.xlsx`].includes(
      row.data.object_path,
    )
  )
    return new Response("Not found", { status: 404 });
  const blocked = await downloadLimit(`teacher/${userId}`, row.data.object_path, "file");
  if (blocked) return blocked;
  const file = await createAdminClient()
    .storage.from("lessonara-imports")
    .download(row.data.object_path);
  if (file.error || !file.data) return new Response("Unavailable", { status: 503 });
  return new Response(await file.data.arrayBuffer(), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.data.filename).replace(/'/g, "%27")}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
