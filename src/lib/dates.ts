import { localeTag, type Locale } from "./i18n/core";
// Datas no formato ISO "YYYY-MM-DD", tratadas sempre em UTC para não sofrer com fuso.
export const TZ = "America/Sao_Paulo";

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function toUTC(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

export function weekday(date: string): number {
  return toUTC(date).getUTCDay();
}

/** Data e hora atuais no fuso de São Paulo. */
export function nowInTZ(now = new Date()): { today: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    today: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

export function formatDate(date: string, locale: Locale = "pt-BR"): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(toUTC(date));
}

export function formatDateLong(date: string, locale: Locale = "pt-BR"): string {
  const day = new Intl.DateTimeFormat(localeTag(locale), { timeZone: "UTC", weekday: "short" })
    .format(toUTC(date))
    .replace(/\.$/, "");
  const short = new Intl.DateTimeFormat(localeTag(locale), {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
  }).format(toUTC(date));
  return `${day}, ${short}`;
}

export function formatBRL(value: number, locale: Locale = "pt-BR"): string {
  return value.toLocaleString(localeTag(locale), { style: "currency", currency: "BRL" });
}
