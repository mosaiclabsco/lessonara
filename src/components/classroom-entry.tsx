"use client";
import { useClassroomRejoin } from "./use-classroom-rejoin";
import type { Lesson } from "@/lib/ledger";
import { lessonAccess, lessonWindow } from "@/lib/classroom";
import { useLessonClock } from "./use-lesson-clock";
import { LessonUnavailable } from "./lesson-unavailable";
import { useRef } from "react";
import { Icon } from "./icon";
import { useI18n } from "./browser-preferences-provider";
import { usePlatformPlan } from "./platform-plan-provider";
import { desktopClassroomHref } from "@/lib/desktop-links";
import "@/lib/desktop-client";
export function ClassroomEntry({
  href,
  lesson,
  now,
  compact = false,
}: {
  href: string;
  lesson: Pick<Lesson, "date" | "time" | "durationMinutes">;
  now: number;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const plan = usePlatformPlan();
  const dialog = useRef<HTMLDialogElement>(null);
  const timing = lessonWindow(lesson);
  const clock = useLessonClock(now, [timing.opensAt, timing.endsAt, timing.closesAt]);
  const access = lessonAccess(lesson, clock);
  const afterEnd = clock >= timing.endsAt;
  const canRejoin = useClassroomRejoin(href, afterEnd);
  if (!plan.classroom)
    return (
      <a href="/settings?tab=subscription#subscription" className="btn-xs">
        <Icon name="video" className="h-4 w-4" />
        {t("Sala de aula · Pro")}
      </a>
    );
  if (access.state !== "open" || (afterEnd && !canRejoin))
    return (
      <LessonUnavailable
        now={clock}
        opensAt={access.opensAt}
        closed={access.state === "closed" || afterEnd}
        compact={compact}
      />
    );
  const appHref = desktopClassroomHref(href);
  return (
    <>
      <button
        className={compact ? "btn-xs" : "btn mb-4"}
        aria-label={t("Entrar na aula")}
        onClick={() => {
          if (window.lessonaraDesktop) {
            window.open(href, "_blank", "noopener,noreferrer");
            return;
          }
          dialog.current?.showModal();
        }}
      >
        <Icon name="video" className="h-4 w-4" />
        {!compact && t(afterEnd ? "Voltar à aula" : "Entrar na aula")}
      </button>
      <dialog
        ref={dialog}
        aria-label={t("Como você quer entrar?")}
        className="document-picker-dialog card"
      >
        <div className="section-heading">
          <h2 className="h2">{t("Como você quer entrar?")}</h2>
          <button className="btn-xs" onClick={() => dialog.current?.close()}>
            {t("Fechar")}
          </button>
        </div>
        <div className="document-picker-choices">
          <a
            className="btn"
            href={href}
            target="_blank"
            rel="noreferrer"
            onClick={() => dialog.current?.close()}
          >
            {t("Entrar no navegador")}
          </a>
          {appHref && (
            <a className="btn-ghost" href={appHref} onClick={() => dialog.current?.close()}>
              {t("Abrir no app")}
            </a>
          )}
        </div>
        <p className="text-xs text-muted mt-4">
          {t("Na primeira vez, abra o app e entre com sua conta de professor.")}
        </p>
        <a
          className="portal-text-button text-sm mt-4"
          href="/desktop"
          target="_blank"
          rel="noreferrer"
        >
          {t("Baixar app para computador")}
        </a>
      </dialog>
    </>
  );
}
