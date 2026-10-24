"use client";
import { useI18n } from "./browser-preferences-provider";
import { localeTag } from "@/lib/i18n/core";
import type { ReactNode } from "react";
import { HistoryTabs } from "./history-tabs";
import { LessonList } from "./lesson-list";
import { formatDate } from "@/lib/dates";
import { sortPackages, type Lesson, type Package } from "@/lib/ledger";
function Groups({
  lessons,
  packages,
  actions,
  grouping,
  openingCredits = 0,
  today,
  pastOnly = false,
}: {
  lessons: Lesson[];
  packages: Package[];
  actions?: Record<string, ReactNode>;
  openingCredits?: number;
  grouping: "month" | "package";
  today: string;
  pastOnly?: boolean;
}) {
  const { t, locale } = useI18n();
  const groups = new Map<string, Lesson[]>();
  const ordered = sortPackages(packages);
  const settled = new Map<string, number>();
  let debt = Math.max(0, -openingCredits);
  for (const pack of ordered) {
    const value = Math.min(debt, pack.lessons);
    settled.set(pack.id, value);
    debt -= value;
  }
  if (grouping === "package" && !pastOnly) for (const pack of ordered) groups.set(pack.id, []);
  for (const lesson of lessons) {
    if (!lesson.past && !lesson.packageId && grouping === "package") continue;
    const key = grouping === "month" ? lesson.date.slice(0, 7) : (lesson.packageId ?? "uncovered");
    groups.set(key, [...(groups.get(key) ?? []), lesson]);
  }
  const currentMonth = today.slice(0, 7);
  const monthOrder = (a: string, b: string) =>
    a === currentMonth
      ? -1
      : b === currentMonth
        ? 1
        : a >= currentMonth && b >= currentMonth
          ? a.localeCompare(b)
          : a >= currentMonth
            ? -1
            : b >= currentMonth
              ? 1
              : b.localeCompare(a);
  const entries =
    grouping === "month"
      ? [...groups].sort(([a], [b]) => monthOrder(a, b))
      : [...groups].sort(([a], [b]) =>
          b === "uncovered"
            ? -1
            : a === "uncovered"
              ? 1
              : ordered.findIndex((pack) => pack.id === b) -
                ordered.findIndex((pack) => pack.id === a),
        );
  return (
    <div>
      {entries.length ? (
        entries.map(([key, items], index) => {
          const pack = ordered.find((pack) => pack.id === key);
          const title =
            grouping === "month"
              ? new Intl.DateTimeFormat(localeTag(locale), {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(new Date(`${key}-01T12:00:00Z`))
              : pack
                ? `Pacote de ${pack.lessons} aulas · ${formatDate(pack.paid_on, locale)}`
                : key === "opening"
                  ? t("Saldo inicial importado — sem pagamento registrado")
                  : t("Aulas sem pacote / sem consumo");
          const previous = items
            .filter((l) => l.past)
            .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
          const next = items
            .filter((l) => !l.past)
            .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
          const used = previous.filter((l) => l.counts).length;
          return (
            <details className="history-group" key={`${grouping}-${key}`} open={index === 0}>
              <summary>
                <span>{title}</span>
                <span className="count-badge">{items.length}</span>
              </summary>
              {pack && (
                <p className="mb-4 text-xs text-muted">
                  {used} {t("utilizadas")} · {next.length} {t("agendadas")} ·{" "}
                  {settled.get(pack.id)
                    ? `${settled.get(pack.id)} para quitar saldo inicial · `
                    : ""}
                  {Math.max(0, pack.lessons - used - (settled.get(pack.id) ?? 0))}{" "}
                  {t("créditos restantes")}
                </p>
              )}
              {next.length > 0 && (
                <>
                  <h3 className="text-xs font-semibold mt-4 mb-2">{t("Próximas aulas")}</h3>
                  <LessonList lessons={next} actions={actions} />
                </>
              )}
              {previous.length > 0 && (
                <>
                  <h3 className="text-xs font-semibold mt-4 mb-2">{t("Aulas anteriores")}</h3>
                  <LessonList lessons={previous} actions={actions} />
                </>
              )}
              {!items.length && (
                <p className="text-sm text-muted py-3">
                  {t("As aulas deste pacote aparecerão aqui quando forem agendadas.")}
                </p>
              )}
            </details>
          );
        })
      ) : (
        <p className="py-4 text-sm text-muted">{t("Nenhuma aula.")}</p>
      )}
      {grouping === "package" && (
        <p className="mt-4 text-xs leading-relaxed text-muted">
          {t(
            "Aulas agendadas não são aulas utilizadas. Reposições usam o próximo crédito disponível; aulas desmarcadas não consomem créditos.",
          )}
        </p>
      )}
    </div>
  );
}
export function LessonHistory({
  lessons,
  packages,
  actions,
  openingCredits = 0,
  today = "",
  pastOnly = false,
}: {
  lessons: Lesson[];
  packages: Package[];
  actions?: Record<string, ReactNode>;
  openingCredits?: number;
  today?: string;
  pastOnly?: boolean;
}) {
  return (
    <HistoryTabs
      monthContent={
        <Groups
          pastOnly={pastOnly}
          openingCredits={openingCredits}
          lessons={lessons}
          packages={packages}
          actions={actions}
          grouping="month"
          today={today}
        />
      }
      packageContent={
        <Groups
          pastOnly={pastOnly}
          openingCredits={openingCredits}
          lessons={lessons}
          packages={packages}
          actions={actions}
          grouping="package"
          today={today}
        />
      }
    />
  );
}
