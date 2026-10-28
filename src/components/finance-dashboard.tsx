"use client";
import { ReceiptDownload } from "./receipt-download";
import { useI18n } from "@/components/browser-preferences-provider";
import { ButtonLink } from "./button";
import { usePlatformPlan } from "./platform-plan-provider";
import { useState } from "react";
import Link from "next/link";
import { Icon } from "./icon";
import { formatBRL, formatDate } from "@/lib/dates";
import { incomeSummary, type IncomePayment } from "@/lib/finance";
const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const moneyTick = (amount: number) =>
  amount >= 1000
    ? `R$ ${(amount / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
    : `R$ ${Math.round(amount)}`;
const percentage = (amount: number) =>
  `${amount > 0 ? "+" : ""}${amount.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
export function FinanceDashboard({
  payments,
  today,
}: {
  payments: IncomePayment[];
  today: string;
}) {
  const { t, locale } = useI18n();
  const plan = usePlatformPlan();
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7)) - 1;
  const years = [
    ...new Set([
      currentYear,
      currentYear + 1,
      2027,
      ...payments.map((payment) => Number(payment.paidOn.slice(0, 4))),
    ]),
  ]
    .filter((year) => year <= Math.max(2027, currentYear + 1))
    .sort((a, b) => b - a);
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [receiptMonth, setReceiptMonth] = useState<number | "all">("all");
  const [page, setPage] = useState(0);
  const summary = incomeSummary(payments, year, today, month);
  const receipts = summary.payments.filter(
    (payment) => receiptMonth === "all" || Number(payment.paidOn.slice(5, 7)) - 1 === receiptMonth,
  );
  const pageSize = 10;
  const pages = Math.max(1, Math.ceil(receipts.length / pageSize));
  const maxMonth = Math.max(
    100,
    Math.ceil(Math.max(...summary.months.map((entry) => entry.amount)) / 100) * 100,
  );
  const maxAccumulated = Math.max(100, Math.ceil(summary.total / 100) * 100);
  const width = 620,
    height = 255,
    left = 65,
    right = 15,
    top = 22,
    bottom = 40;
  const plotWidth = width - left - right,
    plotHeight = height - top - bottom;
  const step = plotWidth / 12;
  const x = (index: number) => left + step * (index + 0.5);
  const y = (amount: number, max: number) => top + plotHeight * (1 - amount / max);
  const lineMonths = summary.months.filter((entry) => !entry.future);
  const line = lineMonths
    .map(
      (entry, index) =>
        `${index ? "L" : "M"}${x(entry.index)},${y(entry.accumulated, maxAccumulated)}`,
    )
    .join(" ");
  const area = lineMonths.length
    ? `${line} L${x(lineMonths.at(-1)!.index)},${top + plotHeight} L${x(0)},${top + plotHeight} Z`
    : "";
  function changeYear(nextYear: number) {
    const next = incomeSummary(payments, nextYear, today, 0);
    const last = next.months.filter((entry) => entry.count > 0).at(-1)?.index ?? 11;
    setYear(nextYear);
    setMonth(nextYear === currentYear ? currentMonth : last);
    setReceiptMonth("all");
    setPage(0);
  }
  function selectMonth(index: number) {
    setMonth(index);
    setReceiptMonth(index);
    setPage(0);
  }
  return (
    <main className="finance-dashboard">
      <div className="page-heading">
        <div>
          <h1>{t("Financeiro")}</h1>
          <p className="page-description">
            {t("Entradas registradas, evolu\u00E7\u00E3o mensal e o resultado dos seus encontros.")}
          </p>
        </div>
        <label className="finance-year">
          <span>{t("Ano")}</span>
          <select
            aria-label={t("Ano do financeiro")}
            className="input"
            value={year}
            onChange={(event) => changeYear(Number(event.target.value))}
          >
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="overview-grid finance-stats">
        <div className="stat-card">
          <div className="stat-top">
            {t("Entradas em ")}
            {MONTHS[month].toLowerCase()}
            <Icon name="book" className="h-4 w-4" />
          </div>
          <div className="stat-value">{formatBRL(summary.month.amount, locale)}</div>
          <p>
            {summary.month.count}
            {t(" pagamentos registrados")}
          </p>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            {t("Acumulado em ")}
            {year}
            <Icon name="chart" className="h-4 w-4" />
          </div>
          <div className="stat-value">{formatBRL(summary.total, locale)}</div>
          <p>
            {summary.count}
            {t(" pagamentos no ano")}
          </p>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            {t("Ticket m\u00E9dio no ano")}
            <Icon name="users" className="h-4 w-4" />
          </div>
          <div className="stat-value">{formatBRL(summary.ticket, locale)}</div>
          <p>{t("M\u00E9dia por pagamento recebido")}</p>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            {t("Evolu\u00E7\u00E3o do m\u00EAs")}
            <Icon name="arrow" className="h-4 w-4 -rotate-45" />
          </div>
          <div
            className={`stat-value ${summary.growth !== null && summary.growth < 0 ? "text-bad" : "text-accent"}`}
          >
            {summary.growth === null ? t("\u2014") : percentage(summary.growth)}
          </div>
          <p>
            {summary.previousAmount === 0
              ? summary.month.amount > 0
                ? t("Sem entradas no m\u00EAs anterior")
                : t("Sem movimento para comparar")
              : summary.partial
                ? t("vs. mesmos dias do m\u00EAs anterior")
                : t("vs. m\u00EAs anterior completo")}
          </p>
        </div>
      </div>
      <div className="finance-charts">
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>{t("Entradas por m\u00EAs")}</h2>
              <p>{t("Selecione uma barra para ver os recebimentos.")}</p>
            </div>
            <Icon name="chart" className="h-5 w-5 text-accent" />
          </div>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="finance-chart"
            role="group"
            aria-label={t("Entradas mensais de {value0}", { value0: year })}
          >
            {[0, 1, 2, 3, 4].map((tick) => {
              const amount = (maxMonth * tick) / 4;
              return (
                <g key={tick} aria-hidden="true">
                  <line
                    x1={left}
                    x2={width - right}
                    y1={y(amount, maxMonth)}
                    y2={y(amount, maxMonth)}
                    className="finance-grid-line"
                  />
                  <text
                    x={left - 10}
                    y={y(amount, maxMonth) + 4}
                    textAnchor="end"
                    className="finance-axis"
                  >
                    {moneyTick(amount)}
                  </text>
                </g>
              );
            })}
            {summary.months.map((entry) => (
              <g
                key={entry.key}
                role="button"
                tabIndex={entry.future ? -1 : 0}
                aria-disabled={entry.future}
                aria-pressed={entry.index === month}
                aria-label={t("{value0}: {value1}", {
                  value0: MONTHS[entry.index],
                  value1: entry.future
                    ? t("ainda n\u00E3o iniciado")
                    : formatBRL(entry.amount, locale),
                })}
                onClick={() => !entry.future && selectMonth(entry.index)}
                onKeyDown={(event) => {
                  if (!entry.future && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    selectMonth(entry.index);
                  }
                }}
                className={`finance-bar ${entry.index === month ? "finance-bar-active" : ""} ${entry.future ? "finance-future" : ""}`}
              >
                <title>
                  {t("{value0} \u00B7 {value1}", {
                    value0: MONTHS[entry.index],
                    value1: entry.future
                      ? t("Aguardando o m\u00EAs")
                      : t("{value0} \u00B7 {value1} pagamentos", {
                          value0: formatBRL(entry.amount, locale),
                          value1: entry.count,
                        }),
                  })}
                </title>
                <rect
                  x={x(entry.index) - 13}
                  y={
                    entry.future || entry.amount === 0
                      ? top + plotHeight - 3
                      : y(entry.amount, maxMonth)
                  }
                  width={26}
                  height={Math.max(3, (plotHeight * entry.amount) / maxMonth)}
                  rx={5}
                />
                <text
                  x={x(entry.index)}
                  y={height - 15}
                  textAnchor="middle"
                  className="finance-axis"
                >
                  {MONTHS[entry.index].slice(0, 3)}
                </text>
              </g>
            ))}
          </svg>
          <label className="finance-month-picker">
            <span>{t("M\u00EAs em destaque")}</span>
            <select
              className="input"
              aria-label={t("M\u00EAs em destaque no financeiro")}
              value={month}
              onChange={(event) => selectMonth(Number(event.target.value))}
            >
              {summary.months.map((entry) => (
                <option key={entry.key} value={entry.index} disabled={entry.future}>
                  {MONTHS[entry.index]}
                </option>
              ))}
            </select>
          </label>
        </section>
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>{t("Crescimento acumulado")}</h2>
              <p>{t("Como as entradas se somam ao longo do ano.")}</p>
            </div>
            <span className="balance-pill">{formatBRL(summary.total, locale)}</span>
          </div>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="finance-chart"
            role="img"
            aria-label={t("Entradas acumuladas em {value0}: {value1}", {
              value0: year,
              value1: formatBRL(summary.total, locale),
            })}
          >
            <title>{t("Crescimento acumulado por m\u00EAs")}</title>
            {[0, 1, 2, 3, 4].map((tick) => {
              const amount = (maxAccumulated * tick) / 4;
              return (
                <g key={tick}>
                  <line
                    x1={left}
                    x2={width - right}
                    y1={y(amount, maxAccumulated)}
                    y2={y(amount, maxAccumulated)}
                    className="finance-grid-line"
                  />
                  <text
                    x={left - 10}
                    y={y(amount, maxAccumulated) + 4}
                    textAnchor="end"
                    className="finance-axis"
                  >
                    {moneyTick(amount)}
                  </text>
                </g>
              );
            })}
            <path d={area} className="finance-area" />
            <path d={line} className="finance-line" />
            {lineMonths.map((entry) => (
              <circle
                key={entry.key}
                cx={x(entry.index)}
                cy={y(entry.accumulated, maxAccumulated)}
                r={4}
                className="finance-point"
              >
                <title>
                  {t("{value0} \u00B7 {value1}", {
                    value0: MONTHS[entry.index],
                    value1: formatBRL(entry.accumulated, locale),
                  })}
                </title>
              </circle>
            ))}
            {summary.months.map((entry) => (
              <text
                key={entry.key}
                x={x(entry.index)}
                y={height - 15}
                textAnchor="middle"
                className={`finance-axis ${entry.future ? "finance-future" : ""}`}
              >
                {MONTHS[entry.index].slice(0, 3)}
              </text>
            ))}
          </svg>
          <div className="finance-highlights">
            <span>
              <b>{summary.students}</b>
              {t(" alunos com pagamentos no ano")}
            </span>
            <span>
              {summary.bestMonth ? (
                <>
                  {t("Melhor m\u00EAs: ")}
                  <b>{MONTHS[summary.bestMonth.index]}</b>
                </>
              ) : (
                t("Seu hist\u00F3rico come\u00E7a no primeiro pagamento")
              )}
            </span>
          </div>
        </section>
      </div>
      <section className="card finance-receipts">
        <div className="section-heading">
          <div>
            <h2>
              {t("Recebimentos registrados")}
              <span className="count-badge">{receipts.length}</span>
            </h2>
            <p>{t("Pagamentos dos pacotes, pela data em que foram recebidos.")}</p>
          </div>
          <label>
            <span className="sr-only">{t("Filtrar recebimentos por m\u00EAs")}</span>
            <select
              className="input"
              aria-label={t("Filtrar recebimentos por m\u00EAs")}
              value={receiptMonth}
              onChange={(event) => {
                setReceiptMonth(event.target.value === "all" ? "all" : Number(event.target.value));
                setPage(0);
              }}
            >
              <option value="all">{t("Ano inteiro")}</option>
              {summary.months
                .filter((entry) => !entry.future)
                .map((entry) => (
                  <option key={entry.key} value={entry.index}>
                    {MONTHS[entry.index]}
                  </option>
                ))}
            </select>
          </label>
        </div>
        {plan.exports && (
          <div className="mb-5 flex flex-wrap gap-2" aria-label="Exportar recebimentos">
            {["csv", "xlsx", "pdf"].map((format) => (
              <ButtonLink
                download
                prefetch={false}
                icon="download"
                key={format}
                href={`/finance/export?period=${year}${receiptMonth === "all" ? "" : `-${String(receiptMonth + 1).padStart(2, "0")}`}&format=${format}`}
              >
                {format.toUpperCase()}
              </ButtonLink>
            ))}
          </div>
        )}
        {receipts.length ? (
          <>
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>{t("Recebido em")}</th>
                    <th>{t("Aluno")}</th>
                    <th>{t("Pacote")}</th>
                    <th className="finance-amount">{t("Entrada")}</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.slice(page * pageSize, (page + 1) * pageSize).map((payment) => (
                    <tr key={payment.id}>
                      <td>{formatDate(payment.paidOn, locale)}</td>
                      <td>
                        <Link href={`/students/${payment.studentId}`}>{payment.studentName}</Link>
                      </td>
                      <td>
                        {payment.lessons}
                        {t(" aulas")}
                      </td>
                      <td className="finance-amount">
                        {formatBRL(payment.amount, locale)}
                        <ReceiptDownload
                          className="ml-3"
                          href={`/payments/${payment.id}/receipt`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>
                      {t("Total ")}
                      {receiptMonth === "all"
                        ? t("em {value0}", { value0: year })
                        : t("em {value0}", { value0: MONTHS[receiptMonth].toLowerCase() })}
                    </td>
                    <td className="finance-amount">
                      {formatBRL(
                        receipts.reduce((sum, payment) => sum + payment.amount, 0),
                        locale,
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {pages > 1 && (
              <div className="finance-pagination">
                <button
                  className="btn-xs"
                  disabled={page === 0}
                  onClick={() => setPage((value) => value - 1)}
                >
                  {t("Anterior")}
                </button>
                <span>
                  {t("P\u00E1gina ")}
                  {page + 1}
                  {t(" de ")}
                  {pages}
                </span>
                <button
                  className="btn-xs"
                  disabled={page + 1 >= pages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  {t("Pr\u00F3xima")}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <Icon name="chart" className="mx-auto mb-4 h-8 w-8 text-accent" />
            <h3>{t("Espa\u00E7o para suas pr\u00F3ximas entradas")}</h3>
            <p>{t("Os pagamentos registrados nos perfis dos alunos aparecem aqui.")}</p>
            <Link href="/payments" className="btn mt-5">
              {t("Ir para pagamentos")}
            </Link>
          </div>
        )}
      </section>
      <details className="finance-data-details">
        <summary>{t("Ver os valores dos gr\u00E1ficos")}</summary>
        <div className="finance-table-wrap">
          <table className="finance-table">
            <caption className="sr-only">
              {t("Entradas mensais e acumuladas em ")}
              {year}
            </caption>
            <thead>
              <tr>
                <th>{t("M\u00EAs")}</th>
                <th>{t("Pagamentos")}</th>
                <th>{t("Entradas")}</th>
                <th>{t("Acumulado")}</th>
              </tr>
            </thead>
            <tbody>
              {summary.months.map((entry) => (
                <tr key={entry.key}>
                  <td>{MONTHS[entry.index]}</td>
                  <td>{entry.future ? t("\u2014") : entry.count}</td>
                  <td>{entry.future ? t("\u2014") : formatBRL(entry.amount, locale)}</td>
                  <td>{entry.future ? t("\u2014") : formatBRL(entry.accumulated, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="calendar-range">
        {t("Valores baseados nos pagamentos registrados at\u00E9 ")}
        {formatDate(today, locale)}
        {t(
          ". O m\u00EAs atual compara os dias transcorridos com o mesmo per\u00EDodo do m\u00EAs anterior.",
        )}
      </p>
      {summary.excluded > 0 && (
        <p className="mt-3 text-xs text-bad">
          {summary.excluded}
          {t(
            " registro(s) com valor negativo n\u00E3o entraram no c\u00E1lculo das receitas. Confira esses pagamentos nos perfis dos alunos.",
          )}
        </p>
      )}
    </main>
  );
}
