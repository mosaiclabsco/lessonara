import { nowInTZ, addDays } from "./dates";
export function lessonAvailability(opensAt: number, now?: number) {
  const target = nowInTZ(new Date(opensAt));
  const today = now === undefined ? null : nowInTZ(new Date(now)).today;
  return {
    time: target.time,
    date: target.today,
    day:
      target.today === today
        ? "today"
        : today && target.today === addDays(today, 1)
          ? "tomorrow"
          : "date",
  } as const;
}
