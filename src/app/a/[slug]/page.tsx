import { getTranslator } from "@/lib/i18n/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
async function Legacy({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}) {
  const { slug } = await params;
  const { data: student } = await createAdminClient()
    .from("students")
    .select("teacher_id,slug")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  return redirect(
    student ? `/p/${student.teacher_id}/s/${encodeURIComponent(student.slug)}` : "/student/login",
  );
}
export default async function LegacyStudentLink(props: {
  params: Promise<{
    slug: string;
  }>;
}) {
  const { t } = await getTranslator();
  return (
    <Suspense
      fallback={
        <p className="p-8" role="status">
          {t("Preparando seu acesso\u2026")}
        </p>
      }
    >
      <Legacy {...props} />
    </Suspense>
  );
}
