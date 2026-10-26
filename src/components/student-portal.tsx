"use client";
import { ButtonLink } from "./button";
import { StudentEmailPreferences } from "./student-email-preferences";
import { StudentRenewalCard } from "./student-renewal";
import type { StudentRenewal } from "@/lib/renewals";
import { useI18n } from "@/components/browser-preferences-provider";
import { useClassroomRejoin } from "./use-classroom-rejoin";
import { useState, type KeyboardEvent } from "react";
import { classroomHref, nextJoinableLesson, lessonAccess, lessonWindow } from "@/lib/classroom";
import { useLessonClock } from "./use-lesson-clock";
import { LessonUnavailable } from "./lesson-unavailable";
import { PortalPreferences } from "./portal-preferences";
import { StudentActivities, type StudentActivity } from "./student-activities";
import { StudentMaterials } from "./student-materials";
import type { Material } from "@/lib/documents";
import { LessonHistory } from "./lesson-history";
import { Logo } from "./logo";
import { Icon } from "./icon";
import { Balance } from "./balance";
import { LessonList } from "./lesson-list";
import { LessonCalendar } from "./lesson-calendar";
import { calendarRange } from "@/lib/calendar";
import { formatDate, formatDateLong } from "@/lib/dates";
import { visibleLessons, type Ledger, type Package } from "@/lib/ledger";
const tabs = [
  { id: "resumo", label: "Meu resumo", icon: "grid" as const },
  { id: "calendario", label: "Calendário", icon: "calendar" as const },
  { id: "materiais", label: "Documentos", icon: "book" as const },
  { id: "atividades", label: "Atividades", icon: "check" as const },
  { id: "historico", label: "Histórico e pacotes", icon: "book" as const },
  { id: "preferencias", label: "Emails", icon: "settings" as const },
];
export function StudentPortal({
  renewal,
  classroomEnabled = false,
  meetEnabled = false,
  emailPreferences,
  name,
  teacherName,
  ledger,
  packages,
  today,
  time,
  slug,
  materials,
  activities,
}: {
  renewal: StudentRenewal;
  classroomEnabled?: boolean;
  meetEnabled?: boolean;
  emailPreferences?: { operational: boolean; promotional: boolean };
  name: string;
  teacherName: string;
  ledger: Ledger;
  packages: Package[];
  today: string;
  time: string;
  slug: string;
  materials: Material[];
  activities: StudentActivity[];
}) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState("resumo");
  const displayedLessons = visibleLessons(ledger, today);
  const upcoming = displayedLessons.filter(
    (lesson) => !lesson.past && lesson.counts && lesson.status !== "feriado",
  );
  const roomNow = useLessonClock(
    Date.parse(`${today}T${time}:00-03:00`),
    ledger.lessons.flatMap((lesson) => {
      const window = lessonWindow(lesson);
      return [window.opensAt, window.startsAt, window.endsAt, window.closesAt];
    }),
  );
  const next = nextJoinableLesson(ledger.lessons, roomNow);
  const access = next ? lessonAccess(next, roomNow) : null;
  const entryHref = next
    ? classroomEnabled
      ? classroomHref(slug, next)
      : meetEnabled
        ? next.meetUrl
        : null
    : null;
  const afterEnd = Boolean(access && roomNow >= access.endsAt);
  const canRejoin = useClassroomRejoin(classroomEnabled ? (entryHref ?? null) : null, afterEnd);
  const range = calendarRange(today);
  const progress =
    ledger.credits > 0 ? Math.min(100, Math.round((ledger.used / ledger.credits) * 100)) : 0;
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    setTab(tabs[nextIndex].id);
    const buttons =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]");
    buttons?.[nextIndex].focus();
  }
  return (
    <div className="student-portal">
      <header className="portal-header">
        <div className="brand">
          <Logo />
        </div>
        <PortalPreferences />
      </header>
      <main className="portal-content">
        <div className="portal-welcome">
          <div>
            <p className="eyebrow">
              {teacherName
                ? t("AULAS COM {value0}", { value0: teacherName })
                : t("SUAS AULAS, EM UM S\u00D3 LUGAR")}
            </p>
            <h1>
              {t("Ol\u00E1, ")}
              {name.trim().split(/\s+/)[0]}
              <span className="text-accent">{t(".")}</span>
            </h1>
            <p className="page-description">
              {t("Seu pr\u00F3ximo encontro e sua jornada de aprendizagem.")}
            </p>
          </div>
          <span className="portal-name">
            <Icon name="users" className="h-4 w-4" />
            {name}
          </span>
        </div>
        <div className="portal-tabs" role="tablist" aria-label={t("\u00C1rea do aluno")}>
          {tabs.map((item, index) => (
            <button
              type="button"
              key={item.id}
              id={`tab-${item.id}`}
              role="tab"
              tabIndex={tab === item.id ? 0 : -1}
              aria-selected={tab === item.id}
              aria-controls={`panel-${item.id}`}
              onKeyDown={(event) => tabKey(event, index)}
              onClick={() => setTab(item.id)}
            >
              <Icon name={item.icon} className="h-4 w-4" />
              {t(item.label)}
            </button>
          ))}
        </div>
        {tab === "resumo" && (
          <div id="panel-resumo" role="tabpanel" aria-labelledby="tab-resumo" className="space-y-6">
            {ledger.remaining <= 1 && <StudentRenewalCard studentId={slug} data={renewal} />}
            {ledger.remaining <= 1 && (
              <div className="portal-renew" role="status">
                <Icon name="book" className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    {ledger.remaining > 0
                      ? t("Seu pacote est\u00E1 chegando ao fim.")
                      : t("\u00C9 hora de renovar seu pacote.")}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed">
                    {ledger.remaining < 0
                      ? t("H\u00E1 {value0} aula(s) realizada(s) sem cobertura de um pacote.", {
                          value0: -ledger.remaining,
                        })
                      : t(
                          "Combine a renova\u00E7\u00E3o com seu professor(a) para continuar suas aulas.",
                        )}
                  </p>
                </div>
              </div>
            )}
            <div className="portal-summary-grid">
              <section className="portal-next card">
                <p className="eyebrow">{t("SEU PR\u00D3XIMO ENCONTRO")}</p>
                {next ? (
                  <>
                    <h2>{formatDateLong(next.date, locale)}</h2>
                    <p className="portal-next-time">
                      <Icon name="clock" className="h-5 w-5" />
                      {next.time}
                    </p>
                    <p className="mt-4 text-sm text-muted">
                      {teacherName
                        ? t("Uma nova aula com {value0}.", { value0: teacherName })
                        : t("Mais um passo na sua aprendizagem.")}
                    </p>
                    <div className="portal-next-actions">
                      {entryHref &&
                        access &&
                        (access.state === "open" &&
                        (!classroomEnabled || !afterEnd || canRejoin) ? (
                          <a className="btn" href={entryHref} target="_blank" rel="noreferrer">
                            <Icon name="video" className="h-4 w-4" />
                            {t(afterEnd && classroomEnabled ? "Voltar à aula" : "Entrar na aula")}
                          </a>
                        ) : (
                          <LessonUnavailable
                            opensAt={access.opensAt}
                            closed={access.state === "closed" || afterEnd}
                          />
                        ))}
                      <button className="btn-ghost" onClick={() => setTab("calendario")}>
                        {t("Ver meu calend\u00E1rio")}
                        <Icon name="arrow" className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2>{t("Um novo encontro vem a\u00ED.")}</h2>
                    <p className="mt-4 text-sm leading-relaxed text-muted">
                      {t(
                        "Quando seu professor(a) cadastrar um hor\u00E1rio, sua pr\u00F3xima aula aparecer\u00E1 aqui.",
                      )}
                    </p>
                  </>
                )}
              </section>
              <section className="card portal-package">
                <p className="eyebrow">{t("SUA JORNADA AT\u00C9 AQUI")}</p>
                <h2>
                  {ledger.remaining > 0
                    ? t("Tudo pronto para continuar.")
                    : t("Vamos preparar as pr\u00F3ximas aulas?")}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {ledger.used} {ledger.used === 1 ? t("aula utilizada") : t("aulas utilizadas")}
                  {t(" \u00B7 ")}
                  {ledger.credits}
                  {t(" aulas em pacotes pagos")}
                </p>
                {ledger.credits > 0 && (
                  <>
                    <div
                      className="package-progress"
                      role="progressbar"
                      aria-label={t("Aulas utilizadas dos pacotes pagos")}
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      {progress}
                      {t("% dos cr\u00E9ditos utilizados")}
                      {ledger.used > ledger.credits
                        ? t(" \u00B7 h\u00E1 aulas utilizadas al\u00E9m do saldo pago")
                        : t("")}
                    </p>
                  </>
                )}
                <div className="mt-6">
                  <Balance ledger={ledger} />
                </div>
              </section>
            </div>
            <section className="card">
              <div className="section-heading mb-4">
                <h2>{t("Pr\u00F3ximas aulas")}</h2>
                <button className="portal-text-button" onClick={() => setTab("calendario")}>
                  {t("Ver calend\u00E1rio")}
                  <Icon name="arrow" className="h-4 w-4" />
                </button>
              </div>
              <LessonList lessons={upcoming.slice(0, 5)} />
            </section>
          </div>
        )}
        {tab === "calendario" && (
          <div id="panel-calendario" role="tabpanel" aria-labelledby="tab-calendario">
            <LessonCalendar
              today={today}
              time={time}
              {...range}
              lessons={ledger.lessons
                .filter((lesson) => lesson.date >= range.startDate && lesson.date <= range.endDate)
                .map((lesson, index) => ({
                  id: String(index),
                  date: lesson.date,
                  time: lesson.time,
                  durationMinutes: lesson.durationMinutes,
                  status: lesson.status,
                  name: teacherName ? `Aula com ${teacherName}` : "Sua aula",
                  note: lesson.holidayName
                    ? `${lesson.holidayName} · ${lesson.counts ? "conta no pacote" : "crédito mantido"}`
                    : lesson.event?.note,
                }))}
            />
          </div>
        )}
        {tab === "materiais" && (
          <div id="panel-materiais" role="tabpanel" aria-labelledby="tab-materiais">
            <StudentMaterials materials={materials} slug={slug} today={today} />
          </div>
        )}
        {tab === "atividades" && (
          <div id="panel-atividades" role="tabpanel" aria-labelledby="tab-atividades">
            <StudentActivities activities={activities} studentId={slug} today={today} />
          </div>
        )}
        {tab === "historico" && (
          <div
            id="panel-historico"
            role="tabpanel"
            aria-labelledby="tab-historico"
            className="space-y-6"
          >
            <StudentRenewalCard studentId={slug} data={renewal} />
            <div className="portal-history-grid">
              <section className="card">
                <h2 className="h2">{t("Aulas por mês e pacote")}</h2>
                <LessonHistory
                  openingCredits={ledger.openingCredits}
                  lessons={displayedLessons}
                  today={today}
                  packages={packages}
                />
              </section>

              <section className="card">
                <h2 className="h2">{t("Meus pacotes")}</h2>
                {packages.length ? (
                  <ul className="portal-packages">
                    {packages
                      .slice()
                      .sort((a, b) => b.paid_on.localeCompare(a.paid_on))
                      .map((pack) => (
                        <li key={pack.id}>
                          <span className="stat-icon">
                            <Icon name="book" className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="font-semibold">
                              {pack.lessons}
                              {t(" aulas")}
                            </p>
                            <p className="mt-1 text-xs text-muted">
                              {t("Pagamento registrado em ")}
                              {formatDate(pack.paid_on, locale)}
                            </p>
                          </div>
                          {pack.paid_on <= today && pack.amount >= 0 && (
                            <ButtonLink
                              download
                              prefetch={false}
                              icon="download"
                              className="ml-auto"
                              href={`/student/portal/${slug}/receipts/${pack.id}`}
                            >
                              Recibo PDF
                            </ButtonLink>
                          )}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">{t("Nenhum pacote registrado ainda.")}</p>
                )}
              </section>
            </div>
          </div>
        )}
        {tab === "preferencias" && (
          <div id="panel-preferencias" role="tabpanel" aria-labelledby="tab-preferencias">
            {emailPreferences && (
              <StudentEmailPreferences studentId={slug} initial={emailPreferences} />
            )}
          </div>
        )}
        <footer className="portal-footer">
          <p>
            <b>{t("Falta:")}</b>
            {t(" aviso em cima da hora ou n\u00E3o compareceu; conta como aula. ")}
            <b>{t("Desmarcada:")}</b>
            {t(" avisada com anteced\u00EAncia; n\u00E3o conta.")}
          </p>
          <span>{t("Seu aprendizado, um encontro de cada vez.")}</span>
        </footer>
      </main>
    </div>
  );
}
