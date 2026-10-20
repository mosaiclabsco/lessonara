import { nowInTZ, formatDate } from "./dates";
import type { Locale } from "./i18n/core";
export function activityDateTime(value: string, locale: Locale = "pt-BR") {
  const { today, time } = nowInTZ(new Date(value));
  return `${formatDate(today, locale)} · ${time}`;
}
