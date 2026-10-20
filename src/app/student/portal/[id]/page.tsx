import { Suspense } from "react";
import { redirect } from "next/navigation";
import { authorizedStudent } from "@/lib/student-access";
async function Legacy({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await authorizedStudent(id);
  return redirect(
    access ? `/p/${access.teacher_id}/s/${encodeURIComponent(access.slug)}` : "/student/login",
  );
}
export default function Page(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p>Lessonara…</p>}>
      <Legacy {...props} />
    </Suspense>
  );
}
