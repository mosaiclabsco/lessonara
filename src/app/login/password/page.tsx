import { cookies } from "next/headers";
import { Suspense } from "react";
import { LogoMark } from "@/components/logo";
import { TeacherPasswordForm } from "@/components/teacher-password-form";
import { PASSWORD_SETUP_COOKIE, readPasswordSetup } from "@/lib/teacher-password";
export const metadata = {
  title: "Definir sua senha · Lessonara",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
async function PasswordContent() {
  const setup = readPasswordSetup((await cookies()).get(PASSWORD_SETUP_COOKIE)?.value);
  return <TeacherPasswordForm hasSetup={Boolean(setup)} email={setup?.email} />;
}
export default function PasswordPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-bg p-6">
      <section className="card w-full max-w-md space-y-6">
        <div className="brand">
          <LogoMark className="h-8 w-8 text-accent" />
          <span>lessonara.</span>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Defina sua senha</h1>
          <p className="mt-3 text-sm text-muted">
            Escolha uma senha para acessar seu espaço de ensino.
          </p>
        </div>
        <Suspense
          fallback={
            <p role="status" className="text-sm text-muted">
              Preparando seu acesso…
            </p>
          }
        >
          <PasswordContent />
        </Suspense>
      </section>
    </main>
  );
}
