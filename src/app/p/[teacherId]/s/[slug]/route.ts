import { createAdminClient } from "@/lib/supabase/server";
import { resolveStudentTarget } from "@/lib/student-target";
import { studentPortalPath } from "@/lib/student-links";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teacherId: string; slug: string }> },
) {
  const { teacherId, slug } = await params;
  const student = await resolveStudentTarget(createAdminClient(), slug, teacherId);
  const headers = { "Cache-Control": "no-store, private" };
  if (!student) return new Response("Página não encontrada.", { status: 404, headers });
  return new Response(null, {
    status: 307,
    headers: { ...headers, Location: new URL(studentPortalPath(student.slug), request.url).href },
  });
}
