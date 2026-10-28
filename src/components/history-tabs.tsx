"use client";
import { useI18n } from "@/components/browser-preferences-provider";
import { useState, type ReactNode } from "react";
export function HistoryTabs({
  monthContent,
  packageContent,
}: {
  monthContent: ReactNode;
  packageContent: ReactNode;
}) {
  const { t } = useI18n();
  const [grouping, setGrouping] = useState<"month" | "package">("month");
  return (
    <div>
      <div className="history-controls">
        <span className="text-xs text-muted">{t("Organizar histórico por")}</span>
        <div className="filter-tabs">
          <button
            type="button"
            aria-pressed={grouping === "month"}
            className={grouping === "month" ? "filter-active" : ""}
            onClick={() => setGrouping("month")}
          >
            {t("Por mês")}
          </button>
          <button
            type="button"
            aria-pressed={grouping === "package"}
            className={grouping === "package" ? "filter-active" : ""}
            onClick={() => setGrouping("package")}
          >
            {t("Por pacote")}
          </button>
        </div>
      </div>
      <div key={grouping}>{grouping === "month" ? monthContent : packageContent}</div>
    </div>
  );
}
