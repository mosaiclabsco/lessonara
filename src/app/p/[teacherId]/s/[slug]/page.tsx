import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveStudentTarget } from "@/lib/student-target";
import { studentPortalPath } from "@/lib/student-links";
async function Legacy({ params }: { params: Promise<{ teacherId: string; slug: string }> }) {
  const { teacherId, slug } = await params;
  const student = await resolveStudentTarget(createAdminClient(), slug, teacherId);
  if (!student) notFound();
  return redirect(studentPortalPath(student.slug));
}
export default function Page(props: { params: Promise<{ teacherId: string; slug: string }> }) {
  return (
    <Suspense
      fallback={
        <p className="p-8" role="status">
          Lessonara…
        </p>
      }
    >
      <Legacy {...props} />
    </Suspense>
  );
}
