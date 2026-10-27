import { addDays, weekday } from "./dates";
import type { LessonStatus } from "./ledger";

export type CalendarLesson = {
  id: string;
  date: string;
  time: string;
  status: LessonStatus;
  durationMinutes?: number;
  name: string;
  href?: string;
  classroomHref?: string;
  note?: string | null;
  holidayName?: string | null;
  counts?: boolean;
};

export const LESSON_STATUS: Record<LessonStatus, string> = {
  feriado: "Feriado",
  agendada: "Agendada",
  dada: "Realizada",
  falta: "Falta",
  desmarcada: "Desmarcada",
  reposicao: "Reposição",
};

export function shiftMonth(month: string, offset: number): string {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
}

/** Semanas completas, de segunda a domingo, sem depender do fuso do navegador. */
export function monthCells(month: string): string[] {
  const first = `${month}-01`;
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const offset = (weekday(first) + 6) % 7;
  const count = Math.max(35, Math.ceil((offset + Number(last.slice(8))) / 7) * 7);
  const start = addDays(first, -offset);
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

export function calendarRange(today: string) {
  return {
    startDate: `${shiftMonth(today.slice(0, 7), -12)}-01`,
    endDate: addDays(`${shiftMonth(today.slice(0, 7), 13)}-01`, -1),
  };
}

export function lessonTiming(
  lesson: Pick<CalendarLesson, "date" | "time" | "status" | "durationMinutes">,
  today: string,
  time: string,
  durationMinutes = lesson.durationMinutes ?? 60,
) {
  if (lesson.status === "desmarcada" || lesson.status === "feriado") return "cancelled";
  if (lesson.status === "falta") return "absent";
  const start = Date.parse(`${lesson.date}T${lesson.time}:00Z`);
  const now = Date.parse(`${today}T${time}:00Z`);
  if (now >= start && now < start + durationMinutes * 60_000) return "ongoing";
  return now >= start + durationMinutes * 60_000 ? "completed" : "upcoming";
}

export function halfHourTime(value: string | null) {
  if (!value || !/^(?:[01]\d|2[0-3]):(?:00|30)$/.test(value))
    throw new Error("Escolha uma hora com minutos 00 ou 30.");
  return value;
}

export function calendarLessonLabel(lesson: Pick<CalendarLesson, "status" | "counts">) {
  if (lesson.status === "feriado" && lesson.counts !== undefined)
    return lesson.counts ? "Feriado · consome 1 crédito" : "Feriado · mantém o crédito";
  return LESSON_STATUS[lesson.status];
}
