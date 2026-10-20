import { Suspense } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { authorizedStudent, CHALLENGE_COOKIE } from "@/lib/student-access";
import { StudentLogin } from "@/components/student-login";
import { StudentContent } from "@/components/student-content";
async function Scoped({ params }: { params: Promise<{ teacherId: string; slug: string }> }) {
  const { teacherId, slug } = await params;
  if (!/^[a-f\d-]{36}$/i.test(teacherId) || !/^[A-Za-z\d_-]{8,128}$/.test(slug)) notFound();
  const db = createAdminClient();
  const target = await db
    .from("students")
    .select("id")
    .eq("teacher_id", teacherId)
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (target.error) throw new Error("Não foi possível preparar seu acesso.");
  if (!target.data) notFound();
  const access = await authorizedStudent(target.data.id);
  if (access) return <StudentContent params={Promise.resolve({ id: access.id })} />;
  const id = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  const challenge = id
    ? await db
        .from("student_auth_challenges")
        .select("created_at,email")
        .eq("id", id)
        .eq("student_id", target.data.id)
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle()
    : null;
  return (
    <StudentLogin
      teacherId={teacherId}
      slug={slug}
      initialPhase={challenge?.data ? "code" : "email"}
      initialEmail={challenge?.data?.email ?? ""}
      initialRetryAt={challenge?.data ? Date.parse(challenge.data.created_at) + 300_000 : 0}
    />
  );
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
      <Scoped {...props} />
    </Suspense>
  );
}
