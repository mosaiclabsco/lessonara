import { PlatformPlanProvider } from "@/components/platform-plan-provider";
import { FeatureRequired } from "@/components/feature-required";
import { Suspense } from "react";
import Link from "next/link";
import { Classroom } from "@/components/classroom";
import { getJitsiConfig, loadClassroomAccess } from "@/lib/classroom-server";
import {
  classroomRefValid,
  classroomHref,
  lessonCanJoin,
  type ClassroomParams,
} from "@/lib/classroom";
import { connection } from "next/server";
import { notFound } from "next/navigation";

export const metadata = { title: "Sala de aula · Lessonara" };
async function Room({ params }: { params: Promise<ClassroomParams> }) {
  await connection();
  const ref = await params;
  if (!classroomRefValid(ref)) notFound();
  const access = await loadClassroomAccess(ref);
  if (!access)
    return (
      <main className="classroom-state">
        <h1>Entre no seu espaço para acessar a aula</h1>
        <p>Este link só libera a sala ao professor e ao aluno vinculados à aula.</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link className="btn" href="/student/login">
            Sou aluno
          </Link>
          <Link className="btn-ghost" href="/login">
            Sou professor(a)
          </Link>
        </div>
      </main>
    );
  if (!access.roomAllowed)
    return access.participant.role === "teacher" ? (
      <FeatureRequired feature="Sala de aula" />
    ) : (
      <main className="classroom-state">
        <h1>Sala indisponível</h1>
        <p>Combine com seu professor como acessar a aula.</p>
        <Link className="btn-ghost" href={access.backHref}>
          Voltar ao meu espaço
        </Link>
      </main>
    );
  if (!lessonCanJoin(access.lesson))
    return (
      <main className="classroom-state">
        <h1>Aula não disponível</h1>
        <p>Esta aula foi desmarcada, marcada como falta ou coincide com um feriado.</p>
        <Link className="btn-ghost" href={access.backHref}>
          Voltar ao meu espaço
        </Link>
      </main>
    );
  if (!getJitsiConfig())
    return (
      <main className="classroom-state">
        <h1>Sala de aula indisponível</h1>
        <p>Tente novamente mais tarde.</p>
        <Link className="btn-ghost" href={access.backHref}>
          Voltar ao meu espaço
        </Link>
      </main>
    );
  return (
    <PlatformPlanProvider plan={access.platformPlan}>
      <Classroom
        joinUrl={`${classroomHref(ref.studentId, access.lesson)}/join`}
        backHref={access.backHref}
      />
    </PlatformPlanProvider>
  );
}
export default function Page(props: { params: Promise<ClassroomParams> }) {
  return (
    <Suspense
      fallback={
        <main className="classroom-state" role="status">
          Carregando a sala…
        </main>
      }
    >
      <Room {...props} />
    </Suspense>
  );
}
