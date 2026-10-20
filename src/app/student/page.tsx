import { ActionForm, SubmitButton } from "@/components/action-form";
import { getTranslator } from "@/lib/i18n/server";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStudentSession } from "@/lib/student-access";
import { createAdminClient } from "@/lib/supabase/server";
import { studentSignOut } from "./login/actions";
async function MyArea() {
  const { t } = await getTranslator();
  const session = await getStudentSession();
  if (!session) redirect("/student/login");
  const db = createAdminClient();
  const { data, error } = await db
    .from("student_session_links")
    .select(
      "access_version,students!inner(id,teacher_id,slug,name,email,active,access_version,teachers(name))",
    )
    .eq("session_id", session.id);
  if (error) throw new Error("Não foi possível abrir sua área.");
  const links = (data ?? []) as unknown as {
    access_version: number;
    students: {
      id: string;
      teacher_id: string;
      slug: string;
      name: string;
      email: string;
      active: boolean;
      access_version: number;
      teachers: {
        name: string;
      };
    };
  }[];
  const students = links
    .filter(
      (link) =>
        link.students.active &&
        link.students.email?.toLowerCase().trim() === session.email &&
        link.access_version === link.students.access_version,
    )
    .map((link) => link.students);
  if (students.length === 1)
    redirect(`/p/${students[0].teacher_id}/s/${encodeURIComponent(students[0].slug)}`);
  return (
    <main className="portal-content py-12">
      <p className="eyebrow">{t("\u00C1REA DO ALUNO")}</p>
      <h1 className="text-3xl font-semibold">{t("Seu espa\u00E7o de aprendizagem")}</h1>
      <div className="mt-8 space-y-4">
        {students.map((student) => (
          <Link key={student.id} className="card block" href={`/student/portal/${student.id}`}>
            <h2 className="font-semibold">{student.name}</h2>
            <p className="mt-2 text-sm text-muted">
              {t("Aulas com ")}
              {student.teachers.name || "sua professora"}
            </p>
          </Link>
        ))}
        {!students.length && (
          <section className="card">
            <p>
              {t(
                "Seu acesso foi atualizado ou encerrado. Se sua professora j\u00E1 corrigiu o cadastro, saia e entre novamente para atualizar os v\u00EDnculos.",
              )}
            </p>
          </section>
        )}
      </div>
      <ActionForm action={studentSignOut} className="mt-8">
        <SubmitButton className="btn-ghost">{t("Sair da minha conta")}</SubmitButton>
      </ActionForm>
    </main>
  );
}
export default async function StudentArea() {
  const { t } = await getTranslator();
  return (
    <Suspense
      fallback={
        <p className="p-8" role="status">
          {t("Preparando suas aulas\u2026")}
        </p>
      }
    >
      <MyArea />
    </Suspense>
  );
}
