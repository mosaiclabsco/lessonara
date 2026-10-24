"use client";

import { useI18n } from "@/components/browser-preferences-provider";
import type { ReactNode } from "react";
import { formatDateLong } from "@/lib/dates";
import type { Lesson, LessonStatus } from "@/lib/ledger";
const STATUS: Record<
  LessonStatus,
  {
    label: string;
    className: string;
  }
> = {
  feriado: { label: "Feriado", className: "text-muted" },
  dada: { label: "Dada", className: "text-ok" },
  agendada: { label: "Agendada", className: "text-info" },
  falta: { label: "Falta", className: "text-bad" },
  desmarcada: { label: "Desmarcada", className: "text-muted line-through" },
  reposicao: { label: "Reposição", className: "text-extra" },
};
export function LessonList({
  lessons,
  actions,
}: {
  lessons: Lesson[];
  actions?: Record<string, ReactNode>;
}) {
  const { t, locale } = useI18n();
  if (lessons.length === 0) return <p className="text-sm text-muted">{t("Nenhuma aula.")}</p>;
  return (
    <ul className="lesson-list divide-y divide-line">
      {lessons.map((l) => {
        const s = STATUS[l.status];
        const uncovered = l.counts && l.packageIndex === null;
        const controls = actions?.[`${l.date}-${l.time}-${l.status}`];
        return (
          <li
            key={l.historyId ?? `${l.sourceKind}-${l.sourceId}-${l.date}-${l.time}`}
            className={`lesson-row ${controls ? "lesson-row-with-actions" : ""}`}
          >
            <div className="lesson-info">
              <div className={`lesson-when tabular-nums ${l.past ? "" : "font-medium"}`}>
                <span>{formatDateLong(l.date, locale)}</span>
                <span className="text-muted">{l.time}</span>
              </div>
              <div className="lesson-details">
                <span className={`lesson-status ${s.className}`}>
                  {l.status === "feriado"
                    ? l.counts
                      ? t("Feriado \u00B7 conta")
                      : t("Feriado \u00B7 cr\u00E9dito mantido")
                    : t(s.label)}
                </span>
                {l.historyId && l.status === "dada" && l.statusSource === "presumed" && (
                  <span className="text-xs text-muted">{t("Presumida pelo horário")}</span>
                )}
                {l.planName && <span className="text-xs text-muted">{l.planName}</span>}
                {l.packagePosition && l.packageLessons && (
                  <span className="text-xs text-muted">
                    {t("Aula")} {l.packagePosition}/{l.packageLessons}
                  </span>
                )}
                {l.firstJoinedAt && (
                  <span className="text-xs text-muted">{t("Entrada na sala registrada")}</span>
                )}
                {l.status === "falta" && (
                  <span className="text-xs text-muted">
                    {t("Aviso em cima da hora ou n\u00E3o compareceu")}
                  </span>
                )}
                {uncovered && (
                  <span className="rounded bg-bad/10 px-1.5 py-0.5 text-xs text-bad">
                    {t("sem pacote")}
                  </span>
                )}
                {l.holidayName && (
                  <span className="text-xs text-muted">
                    {t("\u00B7 ")}
                    {l.holidayName}
                  </span>
                )}
                {l.event?.note && (
                  <span className="text-xs text-muted">
                    {t("\u00B7 ")}
                    {l.event.note}
                  </span>
                )}
              </div>
            </div>
            {controls && <div className="lesson-actions">{controls}</div>}
          </li>
        );
      })}
    </ul>
  );
}
