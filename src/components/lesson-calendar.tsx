"use client";
import { ClassroomEntry } from "./classroom-entry";
import { useI18n } from "@/components/browser-preferences-provider";
import { localeTag } from "@/lib/i18n/core";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "./icon";
import { formatDate, WEEKDAYS } from "@/lib/dates";
import {
  LESSON_STATUS,
  lessonTiming,
  monthCells,
  shiftMonth,
  type CalendarLesson,
} from "@/lib/calendar";
export function LessonCalendar({
  lessons,
  today,
  time,
  startDate,
  endDate,
}: {
  lessons: CalendarLesson[];
  today: string;
  time: string;
  startDate: string;
  endDate: string;
}) {
  const { t, locale } = useI18n();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const byDate = useMemo(() => {
    const days = new Map<string, CalendarLesson[]>();
    for (const lesson of lessons) days.set(lesson.date, [...(days.get(lesson.date) ?? []), lesson]);
    for (const entries of days.values())
      entries.sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name));
    return days;
  }, [lessons]);
  const selectedLessons = byDate.get(selected) ?? [];
  const monthLabel = new Intl.DateTimeFormat(localeTag(locale), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`));
  const navigate = (offset: number) => {
    const next = shiftMonth(month, offset);
    setMonth(next);
    setSelected(today.startsWith(next) ? today : `${next}-01`);
  };
  return (
    <div className="lesson-calendar">
      <section className="calendar-card card" aria-label={t("Calend\u00E1rio mensal de aulas")}>
        <div className="calendar-toolbar">
          <div>
            <p className="eyebrow">{t("UM M\u00CAS DE ENCONTROS")}</p>
            <h2>{monthLabel}</h2>
          </div>
          <div className="calendar-controls">
            <button
              className="btn-ghost"
              onClick={() => {
                setMonth(today.slice(0, 7));
                setSelected(today);
              }}
            >
              {t("Hoje")}
            </button>
            <button
              className="calendar-nav"
              aria-label={t("M\u00EAs anterior")}
              disabled={month <= startDate.slice(0, 7)}
              onClick={() => navigate(-1)}
            >
              <Icon name="arrow" className="h-4 w-4 rotate-180" />
            </button>
            <button
              className="calendar-nav"
              aria-label={t("Pr\u00F3ximo m\u00EAs")}
              disabled={month >= endDate.slice(0, 7)}
              onClick={() => navigate(1)}
            >
              <Icon name="arrow" className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6, 0].map((day) => (
            <span key={day}>{t(WEEKDAYS[day]).slice(0, 3)}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {monthCells(month).map((date) => {
            const entries = byDate.get(date) ?? [];
            const outside = !date.startsWith(month);
            const disabled = date < startDate || date > endDate;
            return (
              <button
                type="button"
                key={date}
                disabled={disabled}
                aria-pressed={selected === date}
                aria-label={t("{value0}, {value1} {value2}{value3}", {
                  value0: formatDate(date, locale),
                  value1: entries.length,
                  value2: entries.length === 1 ? t("aula") : t("aulas"),
                  value3: date === today ? t(", hoje") : t(""),
                })}
                onClick={() => {
                  setSelected(date);
                  if (outside) setMonth(date.slice(0, 7));
                }}
                className={`calendar-cell ${outside ? "calendar-outside" : ""} ${selected === date ? "calendar-selected" : ""}`}
              >
                <span className={`calendar-day ${date === today ? "calendar-today" : ""}`}>
                  {Number(date.slice(8))}
                </span>
                <span className="calendar-events">
                  {entries.slice(0, 2).map((entry) => (
                    <span key={entry.id} className={`calendar-event event-${entry.status}`}>
                      <span className="font-semibold">{entry.time}</span>
                      <span className="calendar-event-name">{entry.name}</span>
                    </span>
                  ))}
                  {entries.length > 2 && (
                    <span className="calendar-more">
                      {t("+")}
                      {entries.length - 2}
                      {t(" aulas")}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <div className="calendar-legend">
          {(["agendada", "dada", "reposicao", "falta", "desmarcada", "feriado"] as const).map(
            (status) => (
              <span key={status}>
                <span className={`legend-dot event-${status}`} />
                {t(LESSON_STATUS[status])}
              </span>
            ),
          )}
        </div>
      </section>
      <section className="card day-summary" aria-label={t("Resumo das aulas do dia")}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("O DIA EM DETALHES")}</p>
            <h2>
              {selected === today ? t("Hoje") : formatDate(selected, locale)}
              <span className="count-badge">{selectedLessons.length}</span>
            </h2>
          </div>
          <Icon name="calendar" className="h-5 w-5 text-accent" />
        </div>
        <div aria-live="polite" className="day-summary-body">
          {selectedLessons.length ? (
            <ul>
              {selectedLessons.map((lesson) => {
                const timing = lessonTiming(lesson, today, time);
                return (
                  <li
                    key={lesson.id}
                    className={`day-lesson ${timing === "completed" || timing === "cancelled" ? "lesson-finished" : ""} ${timing === "ongoing" ? "lesson-ongoing" : ""}`}
                  >
                    <span className="day-lesson-time">{lesson.time}</span>
                    <div className="min-w-0 flex-1">
                      {lesson.href ? (
                        <Link className="font-semibold hover:underline" href={lesson.href}>
                          {lesson.name}
                        </Link>
                      ) : (
                        <p className="font-semibold">{lesson.name}</p>
                      )}
                      {lesson.note && <p className="mt-1 text-xs text-muted">{lesson.note}</p>}
                    </div>
                    <span
                      className={`calendar-event ${timing === "ongoing" ? "event-ongoing" : timing === "completed" ? "event-completed" : `event-${lesson.status}`}`}
                    >
                      {timing === "ongoing"
                        ? t("Ocorrendo agora")
                        : timing === "completed"
                          ? t("J\u00E1 aconteceu")
                          : t(LESSON_STATUS[lesson.status])}
                    </span>
                    {lesson.classroomHref ? (
                      <ClassroomEntry
                        href={lesson.classroomHref}
                        lesson={lesson}
                        now={Date.parse(`${today}T${time}:00-03:00`)}
                        compact
                      />
                    ) : (
                      lesson.href && (
                        <Link
                          href={lesson.href}
                          className="row-arrow"
                          aria-label={t("Ver aulas de {value0}", { value0: lesson.name })}
                        >
                          <Icon name="arrow" className="h-4 w-4" />
                        </Link>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="day-summary-empty text-sm text-muted">
              {t("Nenhuma aula neste dia. Selecione outro dia no calend\u00E1rio.")}
            </p>
          )}
        </div>
      </section>
      <p className="calendar-range">
        {t("Hor\u00E1rios considerados no carregamento: ")}
        {time}
        {t(" (S\u00E3o Paulo). Agenda dispon\u00EDvel de ")}
        {formatDate(startDate, locale)}
        {t(" at\u00E9 ")}
        {formatDate(endDate, locale)}
        {t(". Aulas desmarcadas n\u00E3o descontam do pacote.")}
      </p>
    </div>
  );
}
