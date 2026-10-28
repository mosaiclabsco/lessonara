import { downloadLimit } from "./download-limit";
import { createAdminClient, requireUser } from "./supabase/server";
import { ACTIVITY_BUCKET } from "./activities";
import { DOCUMENT_BUCKET } from "./document-rules";
import { studentActivity } from "./activity-access";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};
const missing = () => new Response("Arquivo não encontrado.", { status: 404, headers });
export async function activityDownload(
  activityId: string,
  kind: "source" | "submission" | "feedback",
  slug?: string,
  kindOfId: "id" | "slug" = "id",
) {
  const user = slug ? null : await requireUser();
  const supabase = user?.supabase ?? createAdminClient();
  const activity = slug
    ? await studentActivity(supabase, slug, activityId, kindOfId)
    : (
        await supabase
          .from("activities")
          .select("id,teacher_id,student_id,document_id")
          .eq("id", activityId)
          .eq("teacher_id", user!.userId)
          .maybeSingle()
      ).data;
  if (!activity) return missing();
  let path: string;
  let name: string;
  let bucket: string;
  if (kind === "source" || kind === "feedback") {
    let documentId = activity.document_id;
    if (kind === "feedback") {
      const row = await supabase
        .from("activity_feedback_documents")
        .select("document_id")
        .eq("activity_id", activity.id)
        .eq("teacher_id", activity.teacher_id)
        .eq("student_id", activity.student_id)
        .maybeSingle();
      if (row.error || !row.data) return missing();
      documentId = row.data.document_id;
    }
    if (!documentId) return missing();
    const document = await supabase
      .from("documents")
      .select("storage_path,file_name")
      .eq("id", documentId)
      .eq("teacher_id", activity.teacher_id)
      .eq("status", "ready")
      .maybeSingle();
    if (document.error || !document.data) return missing();
    path = document.data.storage_path;
    name = document.data.file_name;
    bucket = DOCUMENT_BUCKET;
  } else {
    const submission = await supabase
      .from("activity_submissions")
      .select("storage_path,file_name")
      .eq("activity_id", activity.id)
      .eq("teacher_id", activity.teacher_id)
      .eq("student_id", activity.student_id)
      .eq("status", "ready")
      .maybeSingle();
    if (submission.error || !submission.data) return missing();
    path = submission.data.storage_path;
    name = submission.data.file_name;
    bucket = ACTIVITY_BUCKET;
  }
  const blocked = await downloadLimit(
    user ? `teacher/${user.userId}` : `student/${activity.student_id}`,
    path,
    "file",
  );
  if (blocked) return blocked;
  const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60, { download: name });
  if (signed.error || !signed.data)
    return new Response("Não foi possível abrir o arquivo.", { status: 503, headers });
  return new Response(null, {
    status: 303,
    headers: { ...headers, Location: signed.data.signedUrl },
  });
}
