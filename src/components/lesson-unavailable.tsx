"use client";
import { formatDate } from "@/lib/dates";
import { lessonAvailability } from "@/lib/lesson-availability";
import { useI18n } from "./browser-preferences-provider";
import { Icon } from "./icon";
export function LessonUnavailable({
  opensAt,
  closed = false,
  compact = false,
  now,
}: {
  opensAt: number;
  closed?: boolean;
  compact?: boolean;
  now?: number;
}) {
  const { t, locale } = useI18n();
  const availability = lessonAvailability(opensAt, now);
  const date = formatDate(availability.date, locale);
  const label = closed
    ? t("Acesso encerrado")
    : availability.day === "today"
      ? t("Disponível hoje às {time}", { time: availability.time })
      : availability.day === "tomorrow"
        ? t("Disponível amanhã às {time}", { time: availability.time })
        : t("Disponível em {date} às {time}", { date, time: availability.time });
  return (
    <button
      type="button"
      disabled
      className={`lesson-unavailable ${compact ? "btn-xs" : "btn-ghost"}`}
      title={label}
    >
      <Icon name="clock" className="h-4 w-4" />
      {label}
    </button>
  );
}
