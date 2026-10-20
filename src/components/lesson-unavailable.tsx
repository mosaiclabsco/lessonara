"use client";
import { TZ } from "@/lib/dates";
import { useI18n } from "./browser-preferences-provider";
import { Icon } from "./icon";
export function LessonUnavailable({
  opensAt,
  closed = false,
  compact = false,
}: {
  opensAt: number;
  closed?: boolean;
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(opensAt);
  const label = closed ? t("Acesso encerrado") : t("Disponível às {time}", { time });
  return (
    <button type="button" disabled className={compact ? "btn-xs" : "btn-ghost"} title={label}>
      <Icon name="clock" className="h-4 w-4" />
      {label}
    </button>
  );
}
