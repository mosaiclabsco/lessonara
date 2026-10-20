import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getStudentSession } from "@/lib/student-access";
import { getTranslator } from "@/lib/i18n/server";
async function Entry() {
  if (await getStudentSession()) redirect("/student");
  const { t } = await getTranslator();
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="card max-w-md">
        <h1 className="h2">{t("Seu espaço de aprendizagem")}</h1>
        <p className="mt-4 text-muted">
          {t(
            "Abra o link de acesso enviado pelo seu professor(a). Ele identifica seu cadastro com segurança.",
          )}
        </p>
      </section>
    </main>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<p>Lessonara…</p>}>
      <Entry />
    </Suspense>
  );
}
