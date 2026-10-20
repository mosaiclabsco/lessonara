import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/server";
import { hashSession } from "@/lib/mail/crypto";
import { InviteAcceptance } from "@/components/invite-acceptance";
import { authorizedStudent } from "@/lib/student-access";
import { redirect } from "next/navigation";
async function Content({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let loginUrl: string | null = null;
  let valid = false;
  if (/^[A-Za-z\d_-]{43}$/.test(token)) {
    const db = createAdminClient();
    const row = await db
      .from("student_invites")
      .select(
        "student_id,teacher_id,email,access_version,expires_at,used_at,students!inner(slug,email,active,access_version)",
      )
      .eq("token_hash", hashSession(token))
      .maybeSingle();
    if (row.error) throw new Error("Não foi possível preparar seu acesso.");
    const invite = row.data as unknown as {
      student_id: string;
      teacher_id: string;
      email: string;
      access_version: number;
      expires_at: string;
      used_at: string | null;
      students: { slug: string; email: string; active: boolean; access_version: number };
    } | null;
    if (
      invite &&
      invite.students.active &&
      invite.email === invite.students.email &&
      invite.access_version === invite.students.access_version
    ) {
      loginUrl = `/p/${invite.teacher_id}/s/${encodeURIComponent(invite.students.slug)}`;
      if (await authorizedStudent(invite.student_id)) redirect(loginUrl);
      valid = !invite.used_at && Date.parse(invite.expires_at) > new Date().getTime();
    }
  }
  return <InviteAcceptance token={token} loginUrl={loginUrl} valid={valid} />;
}
export default function Page(props: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<p className="p-8">Lessonara…</p>}>
      <Content {...props} />
    </Suspense>
  );
}
