import { addDays, weekday } from "./dates";
export type FrequencyPeriod = "week" | "month";
export type SchedulingMode = "recurring" | "flexible";
export function planFrequency(
  plan?: {
    frequency_period?: string;
    frequency_count?: number;
    weekly_lessons?: number;
    scheduling_mode?: string;
  } | null,
) {
  const period = plan?.frequency_period === "month" ? "month" : "week";
  return {
    period,
    count: plan?.frequency_count ?? plan?.weekly_lessons ?? 0,
    mode: period === "month" && plan?.scheduling_mode === "flexible" ? "flexible" : "recurring",
  } as { period: FrequencyPeriod; count: number; mode: SchedulingMode };
}
export function frequencyName(period: FrequencyPeriod, count: number) {
  return `${count} ${count === 1 ? "aula" : "aulas"} por ${period === "week" ? "semana" : "mês"}`;
}
export function validatePlanFrequency(period: unknown, count: unknown, mode: unknown) {
  if (period !== "week" && period !== "month") throw new Error("Escolha semana ou mês.");
  const n = Number(count);
  if (!Number.isInteger(n) || n < 1 || n > (period === "week" ? 7 : 31))
    throw new Error(
      period === "week" ? "Escolha de 1 a 7 aulas por semana." : "Escolha de 1 a 31 aulas por mês.",
    );
  if (mode !== "recurring" && mode !== "flexible")
    throw new Error("Escolha datas fixas ou avulsas.");
  return {
    frequency_period: period,
    frequency_count: n,
    scheduling_mode: period === "week" ? "recurring" : mode,
    weekly_lessons: period === "week" ? n : 1,
  };
}

export function firstPlannedDate(starts: string, period: FrequencyPeriod, day: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(starts)) throw new Error("Escolha uma data válida.");
  if (period === "week") return addDays(starts, (day - weekday(starts) + 7) % 7);
  if (day < 1 || day > 31 || !Number.isInteger(day)) throw new Error("Escolha um dia válido.");
  let month = starts.slice(0, 7);
  for (let i = 0; i < 3; i++) {
    const candidate = `${month}-${String(day).padStart(2, "0")}`;
    if (
      new Date(candidate + "T12:00:00Z").toISOString().slice(0, 10) === candidate &&
      candidate >= starts
    )
      return candidate;
    const next = new Date(month + "-01T12:00:00Z");
    next.setUTCMonth(next.getUTCMonth() + 1);
    month = next.toISOString().slice(0, 7);
  }
  throw new Error("Escolha um dia válido.");
}
