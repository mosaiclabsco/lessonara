import { FormActions } from "@/components/button";
import { needsSchedule } from "@/lib/student-setup";
import { ReplacementPrompt, CancelLessonButton } from "@/components/cancel-lesson-button";
import { planFrequency } from "@/lib/plan-frequency";
import { getJitsiConfig } from "@/lib/classroom-server";
import { ClassroomEntry } from "@/components/classroom-entry";
import { classroomHref, nextJoinableLesson } from "@/lib/classroom";
import { resendWelcome } from "../../emails/actions";
import { MoneyField } from "@/components/money-field";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { getTranslator } from "@/lib/i18n/server";
import { StudentActivitySection } from "@/components/student-activity-section";
import { StudentProfileTabs } from "@/components/student-profile-tabs";
import { StudentDocuments } from "@/components/student-documents";
import { ScheduleForm } from "@/components/schedule-form";
import { weeklyScheduleLimit } from "@/lib/schedule-rules";
import { TimeField } from "@/components/time-field";
import { LessonHistory } from "@/components/lesson-history";
import { Suspense } from "react";
import PanelLoading from "../../loading";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Balance } from "@/components/balance";
import { ConfirmButton } from "@/components/confirm-button";
import { CopyButton } from "@/components/copy-button";
import { LessonList } from "@/components/lesson-list";
import { loadLedgers, studentPrice, type Plan, type Student } from "@/lib/data";
import { nowInTZ, formatBRL, formatDate, WEEKDAYS } from "@/lib/dates";
import { visibleLessons } from "@/lib/ledger";
import { getOrigin } from "@/lib/origin";
import { requireUser } from "@/lib/supabase/server";
import {
  addPackage,
  addReposicao,
  deleteEvent,
  deletePackage,
  deleteStudent,
  endSchedule,
  markLesson,
  regenerateLink,
  updateStudent,
} from "../../actions";
import { StudentFields } from "../student-form";
export default function StudentPage({ params }: PageProps<"/students/[id]">) {
  return (
    <Suspense fallback={<PanelLoading />}>
      <StudentContent params={params} />
    </Suspense>
  );
}
async function StudentContent({ params }: Pick<PageProps<"/students/[id]">, "params">) {
  const { t, locale } = await getTranslator();
  const { id } = await params;
  const { supabase, userId } = await requireUser();
  const [{ data: student }, { data: plansData }] = await Promise.all([
    supabase.from("students").select("*").eq("id", id).maybeSingle<Student>(),
    supabase.from("plans").select("*").order("sort_order").order("created_at").order("id"),
  ]);
  if (!student) notFound();
  const plans = (plansData ?? []) as Plan[];
  const plan = plans.find((p) => p.id === student.plan_id);
  const { ledger, schedules, packages, today, appointments } = (
    await loadLedgers(supabase, [id])
  ).get(id)!;
  const teacherDuration = await supabase
    .from("teachers")
    .select("lesson_minutes")
    .eq("id", userId)
    .single();
  const pendingSetup = needsSchedule(
    student.active,
    schedules,
    (appointments ?? []).filter(
      (a) =>
        !ledger.lessons.some(
          (l) => l.date === a.date && l.time === a.time && l.status === "desmarcada",
        ),
    ),
    today,
  );
  const scheduleLimit = weeklyScheduleLimit(null, plan?.weekly_lessons);
  const lessons = visibleLessons(ledger, today);
  const upcoming = lessons.filter((l) => !l.past);
  const classroomNext = getJitsiConfig()
    ? nextJoinableLesson(ledger.lessons, Date.parse(`${today}T${nowInTZ().time}:00-03:00`))
    : null;
  const classroomLink = classroomNext ? classroomHref(id, classroomNext) : null;
  const replaced = new Set(lessons.map((l) => l.event?.source_event_id).filter(Boolean));
  const cancelled = ledger.lessons.filter(
    (l) => l.event?.kind === "desmarcada" && !replaced.has(l.event.id),
  );
  const link = `${await getOrigin()}/p/${student.teacher_id}/s/${encodeURIComponent(student.slug)}`;
  const lessonActions = (l: (typeof lessons)[number]) =>
    l.status === "feriado" ? null : l.event ? (
      <ActionForm action={deleteEvent.bind(null, id, l.event.id)}>
        <SubmitButton className="btn-xs">{t("desfazer")}</SubmitButton>
      </ActionForm>
    ) : (
      <>
        <ActionForm action={markLesson.bind(null, id, l.date, l.time, "falta")}>
          <SubmitButton
            className="btn-xs"
            title={t("Avisou em cima da hora ou n\u00E3o veio: conta como aula")}
          >
            {t("falta")}
          </SubmitButton>
        </ActionForm>
        <CancelLessonButton studentId={id} date={l.date} time={l.time} today={today} />
      </>
    );
  return (
    <main className="space-y-6">
      <div className="detail-heading flex flex-wrap items-center gap-3">
        <Link href="/students" className="text-sm text-muted hover:text-fg">
          {t("\u2190 Alunos")}
        </Link>
        <h1 className="w-full text-xl font-semibold">{student.name}</h1>
        {pendingSetup && (
          <span className="balance-pill balance-warning">{t("Pendente · configurar horário")}</span>
        )}
        <CopyButton text={link} />
        <ActionForm action={resendWelcome}>
          <input type="hidden" name="studentId" value={student.id} />
          <SubmitButton className="btn-xs" icon="mail">
            {t("Reenviar convite")}
          </SubmitButton>
        </ActionForm>
      </div>

      <ReplacementPrompt studentId={id} today={today} />
      <Balance ledger={ledger} />
      <StudentProfileTabs
        reposicoes={
          <section className="card space-y-4">
            <h2 className="h2">{t("Reposições")}</h2>
            <p className="text-sm text-muted">
              {t(
                "Agende a reposição de uma aula desmarcada, mantendo o vínculo com a aula original.",
              )}
            </p>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-accent">
                {t("+ Lan\u00E7ar reposi\u00E7\u00E3o")}
              </summary>
              <ActionForm
                action={addReposicao.bind(null, id)}
                className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                <select
                  className="input col-span-2"
                  name="source_event_id"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    {t("Selecione a aula desmarcada")}
                  </option>
                  {cancelled.map((l) => (
                    <option key={l.event!.id} value={l.event!.id}>
                      {formatDate(l.date, locale)} · {l.time}
                    </option>
                  ))}
                </select>
                <input className="input" name="date" type="date" required defaultValue={today} />
                <TimeField id="reposicao-time" />
                <input className="input" name="note" placeholder={t("observa\u00E7\u00E3o")} />
                <SubmitButton className="btn">{t("Adicionar")}</SubmitButton>
              </ActionForm>
            </details>
            <LessonList
              lessons={ledger.lessons.filter((l) => l.status === "reposicao")}
              actions={Object.fromEntries(
                lessons.map((l) => [`${l.date}-${l.time}-${l.status}`, lessonActions(l)]),
              )}
            />
          </section>
        }
        aulas={
          <div className="detail-grid profile-lessons-grid">
            <section className="card">
              <h2 className="h2">{t("Pr\u00F3ximas aulas")}</h2>
              {classroomLink && classroomNext && (
                <ClassroomEntry
                  href={classroomLink}
                  lesson={classroomNext}
                  now={Date.parse(`${today}T${nowInTZ().time}:00-03:00`)}
                />
              )}
              <LessonList
                lessons={upcoming}
                actions={Object.fromEntries(
                  lessons.map((l) => [`${l.date}-${l.time}-${l.status}`, lessonActions(l)]),
                )}
              />
            </section>

            <section className="card">
              <h2 className="h2">{t("Aulas por mês e pacote")}</h2>
              <LessonHistory
                lessons={lessons}
                today={today}
                packages={packages}
                actions={Object.fromEntries(
                  lessons.map((l) => [`${l.date}-${l.time}-${l.status}`, lessonActions(l)]),
                )}
              />
            </section>
          </div>
        }
        pacotes={
          <section id="pagamentos" className="card space-y-3 scroll-mt-6">
            <h2 className="h2">{t("Pacotes pagos")}</h2>
            {packages.length === 0 && (
              <p className="text-sm text-muted">{t("Nenhum pagamento registrado.")}</p>
            )}
            <ul className="divide-y divide-line text-sm">
              {[...packages]
                .sort((a, b) => b.paid_on.localeCompare(a.paid_on))
                .map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2">
                    <span className="tabular-nums">{formatDate(p.paid_on, locale)}</span>
                    <span>
                      {p.lessons}
                      {t(" aulas")}
                    </span>
                    <span className="text-muted">{formatBRL(p.amount, locale)}</span>
                    <ActionForm action={deletePackage.bind(null, id, p.id)} className="ml-auto">
                      <ConfirmButton message={t("Remover esse pagamento?")}>
                        {t("remover")}
                      </ConfirmButton>
                    </ActionForm>
                  </li>
                ))}
            </ul>
            <ActionForm
              action={addPackage.bind(null, id)}
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              <div>
                <label className="label">{t("Pago em")}</label>
                <input className="input" name="paid_on" type="date" required defaultValue={today} />
              </div>
              <div>
                <label className="label">{t("Aulas")}</label>
                <input
                  className="input"
                  name="lessons"
                  type="number"
                  min={1}
                  required
                  defaultValue={plan?.lessons}
                />
              </div>
              <div>
                <label className="label">{t("Valor (R$)")}</label>
                <MoneyField
                  className="input"
                  name="amount"
                  required
                  defaultValue={studentPrice(student, plan)}
                />
              </div>
              <div className="flex items-end">
                <SubmitButton className="btn w-full">{t("Registrar pagamento")}</SubmitButton>
              </div>
            </ActionForm>
          </section>
        }
        horarios={
          <section className="card space-y-3">
            <h2 className="h2">{t("Hor\u00E1rio fixo")}</h2>
            <ul className="divide-y divide-line text-sm">
              {schedules.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="font-medium">
                    {s.monthly_day
                      ? t("Dia {value0} de cada mês", { value0: s.monthly_day })
                      : t(WEEKDAYS[s.weekday])}{" "}
                    {s.time}
                  </span>
                  <span className="text-muted">
                    {t(" desde ")}
                    {formatDate(s.starts_on, locale)}
                    {s.ends_on &&
                      t(" at\u00E9 {value0}", { value0: formatDate(s.ends_on, locale) })}
                  </span>
                  <span className="ml-auto flex gap-1">
                    {!s.ends_on && (
                      <ActionForm action={endSchedule.bind(null, id, s.id)} className="flex gap-1">
                        <input
                          className="input py-1 text-xs"
                          name="ends_on"
                          type="date"
                          required
                          defaultValue={today}
                        />
                        <SubmitButton
                          className="btn-xs"
                          title={t("\u00DAltima aula nesse hor\u00E1rio")}
                        >
                          {t("encerrar")}
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <ScheduleForm
              key={`${plan?.id}-${plan?.frequency_period}-${plan?.scheduling_mode}-${plan?.frequency_count}`}
              duration={teacherDuration.data?.lesson_minutes ?? 60}
              studentId={id}
              schedules={schedules}
              limit={scheduleLimit}
              frequency={planFrequency(plan)}
              appointments={(appointments ?? []).filter(
                (a) =>
                  !ledger.lessons.some(
                    (l) => l.date === a.date && l.time === a.time && l.status === "desmarcada",
                  ),
              )}
              today={today}
            />
          </section>
        }
        dados={
          <section className="card space-y-3">
            <h2 className="h2">{t("Dados do aluno")}</h2>
            <ActionForm action={updateStudent.bind(null, id)} className="space-y-3">
              <StudentFields student={student} plans={plans} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked={student.active} />
                {t(" Ativo (recebe lembretes) ")}
              </label>
              <FormActions>
                <SubmitButton className="btn">{t("Salvar")}</SubmitButton>
              </FormActions>
            </ActionForm>
            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              <ActionForm action={regenerateLink.bind(null, id)}>
                <ConfirmButton message={t("O link antigo vai parar de funcionar. Continuar?")}>
                  {t("gerar novo link")}
                </ConfirmButton>
              </ActionForm>
              <ActionForm action={deleteStudent.bind(null, id)}>
                <ConfirmButton
                  message={t("Excluir o aluno e todo o hist\u00F3rico? N\u00E3o tem volta.")}
                  className="btn-xs text-bad"
                >
                  {t("excluir aluno")}
                </ConfirmButton>
              </ActionForm>
            </div>
          </section>
        }
        atividades={
          <Suspense
            fallback={
              <section className="card text-sm text-muted">
                {t("Carregando atividades\u2026")}
              </section>
            }
          >
            <StudentActivitySection
              supabase={supabase}
              teacherId={userId}
              studentId={id}
              studentName={student.name}
              today={today}
            />
          </Suspense>
        }
        materiais={
          <Suspense
            fallback={
              <section className="card text-sm text-muted">
                {t("Carregando materiais do aluno\u2026")}
              </section>
            }
          >
            <StudentDocuments supabase={supabase} studentId={id} teacherId={userId} today={today} />
          </Suspense>
        }
      />
    </main>
  );
}
