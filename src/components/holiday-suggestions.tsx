"use client";
import { Toast } from "./toast";
import { useState, useTransition } from "react";
import { useI18n } from "./browser-preferences-provider";
import { suggestedHolidays } from "@/lib/holiday-suggestions";
import { saveSuggestedHolidays } from "@/app/(panel)/settings/holiday-actions";
import { formatDate } from "@/lib/dates";
import { BusyContent } from "./busy-content";
import { Icon } from "./icon";
export function HolidaySuggestions({
  today,
  existing,
  disabled = false,
  onBusyChange,
}: {
  today: string;
  existing: string[];
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const current = Number(today.slice(0, 4));
  const [year, setYear] = useState(current);
  const choices = suggestedHolidays(year, today).filter((h) => !existing.includes(h.date));
  const [excluded, setExcluded] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const selected = choices.filter((h) => !excluded.includes(h.date));
  return (
    <details className="border-t border-line pt-5">
      <summary className="cursor-pointer text-sm font-semibold">
        {t("Feriados sugeridos · Brasil")}
      </summary>
      <p className="mt-3 text-xs text-muted">
        {t(
          "Pré-seleção de feriados nacionais com data fixa. Confira as datas e salve; feriados locais e religiosos podem ser cadastrados separadamente.",
        )}
      </p>
      <label className="label mt-4">{t("Ano")}</label>
      <select
        className="input max-w-40"
        value={year}
        disabled={pending || disabled}
        onChange={(e) => {
          setYear(Number(e.target.value));
          setExcluded([]);
          setMessage("");
        }}
      >
        {[current, current + 1, current + 2].map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <div className="mt-4 space-y-3">
        {choices.map((item) => (
          <label key={item.date} className="flex gap-3 items-center text-sm">
            <input
              type="checkbox"
              checked={!excluded.includes(item.date)}
              disabled={pending || disabled}
              onChange={(e) =>
                setExcluded((old) =>
                  e.target.checked ? old.filter((d) => d !== item.date) : [...old, item.date],
                )
              }
            />
            <span>
              {formatDate(item.date, locale)} · {t(item.name)}
            </span>
          </label>
        ))}
      </div>
      {!choices.length && (
        <p className="mt-4 text-sm text-muted">
          {t("As sugestões disponíveis deste ano já estão cadastradas.")}
        </p>
      )}
      <button
        type="button"
        className="btn mt-5"
        aria-busy={pending}
        disabled={pending || disabled || !selected.length}
        onClick={() => {
          setMessage("");
          onBusyChange?.(true);
          start(async () => {
            try {
              const result = await saveSuggestedHolidays(
                year,
                selected.map((h) => h.date),
              );
              setMessage(result.ok ? "Feriados sugeridos salvos." : result.message);
            } catch {
              setMessage("Não foi possível salvar as sugestões.");
            } finally {
              onBusyChange?.(false);
            }
          });
        }}
      >
        <BusyContent pending={pending}>
          <Icon name="calendar" className="h-4 w-4" />
          {t("Salvar feriados selecionados")}
        </BusyContent>
      </button>
      {message && <Toast message={t(message)} />}
    </details>
  );
}
