import { loadOnboarding } from "@/lib/onboarding";
import { OnboardingGuide } from "@/components/onboarding-guide";
import { getTranslator } from "@/lib/i18n/server";
import { Suspense } from "react";
import Link from "next/link";
import PanelLoading from "./loading";
import { LessonCalendar } from "@/components/lesson-calendar";
import { Icon } from "@/components/icon";
import { loadTeacherOverview } from "@/lib/teacher-overview";
export default function Home() {
  return (
    <Suspense fallback={<PanelLoading />}>
      <Overview />
    </Suspense>
  );
}
async function Overview() {
  const { t } = await getTranslator();
  const [onboarding, overview] = await Promise.all([
    loadOnboarding(),
    loadTeacherOverview("calendar"),
  ]);
  const { calendarLessons, today, time, range, rows, paymentRows } = overview;
  return (
    <main>
      <div className="page-heading">
        <div>
          <h1>{t("Vis\u00E3o geral")}</h1>
          <p className="page-description">
            {t("Seu m\u00EAs de aulas e os encontros do dia, em um s\u00F3 lugar.")}
          </p>
        </div>
      </div>
      <div className="overview-grid">
        <div className="stat-card">
          <div className="stat-top">{t("Alunos ativos")}</div>
          <div className="stat-value">
            {rows.filter((row) => row.active && !row.pending).length}
          </div>
          <p>{t("Aprendendo com voc\u00EA")}</p>
        </div>
        <div className="stat-card">
          <div className="stat-top">{t("Aulas de hoje")}</div>
          <div className="stat-value">
            {
              calendarLessons.filter(
                (lesson) =>
                  lesson.date === today &&
                  lesson.status !== "desmarcada" &&
                  lesson.status !== "feriado",
              ).length
            }
          </div>
          <p>{t("Hor\u00E1rios atualizados ao carregar a p\u00E1gina")}</p>
        </div>
        <Link href="/payments" className="stat-card stat-renew">
          <div className="stat-top">{t("Renova\u00E7\u00F5es para acompanhar")}</div>
          <div className="stat-value">{paymentRows.filter((row) => row.remaining <= 2).length}</div>
          <p>
            {t("Pacotes com at\u00E9 2 aulas restantes")}
            <Icon name="arrow" className="h-4 w-4" />
          </p>
        </Link>
      </div>
      {!onboarding.complete && <OnboardingGuide state={onboarding} />}
      <LessonCalendar lessons={calendarLessons} today={today} time={time} {...range} />
    </main>
  );
}
