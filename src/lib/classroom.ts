import type { Lesson } from "./ledger";

export type ClassroomSource = "schedule" | "appointment" | "makeup";
export type ClassroomParams = {
  studentId: string;
  sourceKind: string;
  sourceId: string;
  date: string;
};
export type ClassroomRef = {
  studentId: string;
  sourceKind: ClassroomSource;
  sourceId: string;
  date: string;
};
export const EARLY_MINUTES = 5;
export const LATE_MINUTES = 30;

export function classroomRefValid(ref: ClassroomParams): ref is ClassroomRef {
  const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
  return (
    uuid.test(ref.studentId) &&
    uuid.test(ref.sourceId) &&
    ["schedule", "appointment", "makeup"].includes(ref.sourceKind) &&
    /^\d{4}-\d{2}-\d{2}$/.test(ref.date) &&
    Number.isFinite(Date.parse(`${ref.date}T12:00:00Z`)) &&
    new Date(`${ref.date}T12:00:00Z`).toISOString().slice(0, 10) === ref.date
  );
}

export function lessonWindow(lesson: Pick<Lesson, "date" | "time" | "durationMinutes">) {
  const startsAt = Date.parse(`${lesson.date}T${lesson.time}:00-03:00`);
  const endsAt = startsAt + (lesson.durationMinutes ?? 60) * 60_000;
  return {
    startsAt,
    endsAt,
    opensAt: startsAt - EARLY_MINUTES * 60_000,
    closesAt: endsAt + LATE_MINUTES * 60_000,
  };
}

export function lessonAccess(
  lesson: Pick<Lesson, "date" | "time" | "durationMinutes">,
  now: number,
) {
  const window = lessonWindow(lesson);
  const state = now < window.opensAt ? "before" : now >= window.closesAt ? "closed" : "open";
  return { ...window, state };
}

export function lessonCanJoin(lesson: Lesson) {
  return !["desmarcada", "feriado", "falta"].includes(lesson.status);
}

export function classroomHref(studentId: string, lesson: Lesson) {
  if (!lesson.sourceKind || !lesson.sourceId || !lessonCanJoin(lesson)) return null;
  return `/classroom/${studentId}/${lesson.sourceKind}/${lesson.sourceId}/${lesson.date}`;
}

/** A aula em andamento continua no resumo mesmo após passar do horário de início. */
export function nextJoinableLesson(lessons: Lesson[], now: number) {
  const available = lessons.filter(
    (lesson) => lessonCanJoin(lesson) && lessonWindow(lesson).closesAt > now,
  );
  return (
    available.find((lesson) => {
      const window = lessonWindow(lesson);
      return window.startsAt <= now && now < window.endsAt;
    }) ?? available[0]
  );
}
