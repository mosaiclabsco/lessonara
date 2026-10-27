"use client";
import { useState, useId } from "react";
import { useI18n } from "./browser-preferences-provider";
import { Icon } from "./icon";
import { MoneyField } from "./money-field";
import {
  frequencyName,
  planFrequency,
  type FrequencyPeriod,
  type SchedulingMode,
} from "@/lib/plan-frequency";
import type { Plan } from "@/lib/data";
export function PlanFields({ plan }: { plan?: Plan }) {
  const { t } = useI18n();
  const initial = planFrequency(plan);
  const [period, setPeriod] = useState<FrequencyPeriod>(initial.period);
  const [count, setCount] = useState(initial.count || 1);
  const [mode, setMode] = useState<SchedulingMode>(initial.mode);
  const suggestion = period === "week" ? count * 4 : count;
  const id = useId();
  const [credits, setCredits] = useState(String(plan?.lessons ?? 4));
  const [custom, setCustom] = useState(Boolean(plan));
  return (
    <>
      <div>
        <label className="label" htmlFor={`${id}-name`}>
          {t("Nome do plano")}
        </label>
        <input
          id={`${id}-name`}
          name="name"
          className="input"
          required
          maxLength={120}
          defaultValue={plan?.name ?? ""}
          placeholder={t("Ex.: Inglês individual")}
        />
      </div>
      <div>
        <p className="label" id={`${id}-code-label`}>
          {t("Código do plano")}
        </p>
        <output
          id={`${id}-code`}
          className="input generated-plan-code"
          aria-labelledby={`${id}-code-label`}
          aria-describedby={`${id}-code-help`}
        >
          {plan?.code ? `#${plan.code}` : t("Gerado automaticamente ao salvar")}
        </output>
        <p id={`${id}-code-help`} className="mt-2 text-sm text-muted">
          {t("Use este código no CSV. Ele não muda ao editar o plano.")}
        </p>
      </div>
      <div>
        <label className="label" htmlFor={`${id}-period`}>
          {t("Frequência")}
        </label>
        <select
          id={`${id}-period`}
          name="frequency_period"
          className="input"
          required
          value={period}
          onChange={(e) => {
            const next = e.target.value as FrequencyPeriod;
            setPeriod(next);
            const nextCount = next === "week" ? Math.min(count, 7) : count;
            setCount(nextCount);
            if (!custom) setCredits(String(next === "week" ? nextCount * 4 : nextCount));
          }}
        >
          <option value="week">{t("Semanal")}</option>
          <option value="month">{t("Mensal")}</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor={`${id}-count`}>
          {t(period === "week" ? "Aulas por semana" : "Aulas por mês")}
        </label>
        <select
          id={`${id}-count`}
          name="frequency_count"
          aria-describedby={`${id}-count-help`}
          className="input"
          required
          value={count}
          onChange={(e) => {
            const value = Number(e.target.value);
            setCount(value);
            if (!custom) setCredits(String(period === "week" ? value * 4 : value));
          }}
        >
          {Array.from({ length: period === "week" ? 7 : 31 }, (_, i) => (
            <option key={i} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
        <p id={`${id}-count-help`} className="field-explanation">
          <Icon name="info" className="h-4 w-4" />
          {t(
            period === "week"
              ? "Quantas aulas acontecem a cada semana. O total comprado fica no campo de aulas do pacote."
              : "Quantas aulas acontecem a cada mês. O total comprado fica no campo de aulas do pacote.",
          )}
        </p>
      </div>
      <div>
        <label className="label" htmlFor={`${id}-mode`}>
          {t("Agendamento")}
        </label>
        <input
          type="hidden"
          name="scheduling_mode"
          value={period === "week" ? "recurring" : mode}
        />
        <div className="plan-mode-options">
          <label>
            <input
              type="radio"
              name={`${id}-mode`}
              checked={period === "week" || mode === "recurring"}
              onChange={() => setMode("recurring")}
            />
            <span>{t("Datas fixas")}</span>
          </label>
          <label>
            <input
              type="radio"
              name={`${id}-mode`}
              checked={period === "month" && mode === "flexible"}
              disabled={period === "week"}
              onChange={() => setMode("flexible")}
            />
            <span>{t("Datas avulsas")}</span>
          </label>
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`${id}-lessons`}>
          {t("Total de aulas no pacote")}
        </label>
        <input
          id={`${id}-lessons`}
          className="input"
          name="lessons"
          type="number"
          min={1}
          max={1000}
          required
          value={credits}
          onChange={(e) => {
            setCredits(e.target.value.replace(/^0+(?=\d)/, ""));
            setCustom(true);
          }}
        />
      </div>
      <div className="plan-money">
        <label className="label" htmlFor={`${id}-price`}>
          {t("Preço (R$)")}
        </label>
        <MoneyField
          id={`${id}-price`}
          className="input"
          name="price"
          required
          defaultValue={plan?.price ?? 0}
        />
      </div>
      <p className="plan-generated-name">
        {t(frequencyName(period, count))} · {credits || "—"} {t("créditos no pacote")}
        {period === "week" && credits && (
          <span>
            {" "}
            ·{" "}
            {t("Cobre aproximadamente {value0} semana(s)", {
              value0: Number((Number(credits) / count).toFixed(1)),
            })}
          </span>
        )}
        {period === "month" && (
          <span> · {t("Em meses menores, o limite acompanha os dias disponíveis.")}</span>
        )}
        {Number(credits) !== suggestion && (
          <button
            type="button"
            className="portal-text-button ml-3"
            onClick={() => {
              setCredits(String(suggestion));
              setCustom(false);
            }}
          >
            {t("Usar sugestão: {value0} créditos", { value0: suggestion })}
          </button>
        )}
      </p>
    </>
  );
}
