"use client";
import { Pagination } from "./pagination";
import { useI18n } from "@/components/browser-preferences-provider";
import { localeTag } from "@/lib/i18n/core";
import { useState } from "react";
import Link from "next/link";
import { Icon } from "./icon";
import { CopyButton } from "./copy-button";
import { formatDateLong } from "@/lib/dates";
type Row = {
  id: string;
  name: string;
  active: boolean;
  pending?: boolean;
  plan: string;
  remaining: number;
  credits: number;
  used: number;
  link: string;
  next: {
    date: string;
    time: string;
  } | null;
};
type Upcoming = {
  studentId: string;
  name: string;
  date: string;
  time: string;
  status: string;
};
type Filter = "all" | "active" | "pending" | "renew" | "inactive";
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .filter((_, i, all) => i === 0 || i === all.length - 1)
    .join("")
    .toUpperCase();
const filters: {
  id: Filter;
  label: string;
}[] = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Ativos" },
  { id: "pending", label: "Pendentes" },
  { id: "renew", label: "A renovar" },
  { id: "inactive", label: "Inativos" },
];
export function Dashboard({
  rows,
  upcoming,
  teacherName,
  today,
  directoryOnly = false,
  setupReady = true,
}: {
  rows: Row[];
  upcoming: Upcoming[];
  teacherName: string;
  today: string;
  directoryOnly?: boolean;
  setupReady?: boolean;
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [pageByFilter, setPageByFilter] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const active = rows.filter((r) => r.active && !r.pending);
  const renew = active.filter((r) => r.remaining <= 1);
  const matches = rows.filter(
    (r) =>
      r.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")) &&
      (filter === "all" ||
        (filter === "active" && r.active && !r.pending) ||
        (filter === "pending" && r.pending === true) ||
        (filter === "renew" && r.active && r.remaining <= 1) ||
        (filter === "inactive" && !r.active)),
  );
  const page = Math.min(pageByFilter[filter] ?? 0, Math.max(0, Math.ceil(matches.length / 50) - 1));
  const pageRows = matches.slice(page * 50, (page + 1) * 50);
  const dateLabel = new Intl.DateTimeFormat(localeTag(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${today}T12:00:00Z`));
  const selectRenew = () => {
    setFilter("renew");
    document.getElementById("alunos")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <h1>
            {directoryOnly ? (
              t("Alunos")
            ) : (
              <>
                {t("Ol\u00E1")}
                {teacherName
                  ? t(", {value0}", { value0: teacherName.split(" ")[0] })
                  : t(", professora")}
                <span className="text-accent">{t(".")}</span>
              </>
            )}
          </h1>
          <p className="page-description">
            {directoryOnly
              ? t("Todos os seus alunos, planos e saldos em um s\u00F3 lugar.")
              : t("Um olhar sobre suas aulas e seus alunos.")}
          </p>
        </div>
        {directoryOnly && (
          <div className="flex flex-wrap gap-3">
            <Link href="/students/import" className="btn-ghost">
              <Icon name="download" className="h-4 w-4" />
              Importar dados
            </Link>
            <Link href={setupReady ? "/students/new" : "/settings"} className="btn">
              <Icon name="plus" className="h-4 w-4" />
              {t(setupReady ? "Novo aluno" : "Configurar espaço")}
            </Link>
          </div>
        )}
      </div>
      {!directoryOnly && (
        <div className="overview-grid">
          <div className="stat-card">
            <div className="stat-top">
              <span>{t("Alunos ativos")}</span>
              <span className="stat-icon">
                <Icon name="users" />
              </span>
            </div>
            <div className="stat-value">{active.length.toString().padStart(2, "0")}</div>
            <p>{t("Aprendendo com voc\u00EA")}</p>
          </div>
          <Link href="/calendar" className="stat-card">
            <div className="stat-top">
              <span>{t("Pr\u00F3ximas aulas")}</span>
              <span className="stat-icon stat-lilac">
                <Icon name="calendar" />
              </span>
            </div>
            <div className="stat-value">{upcoming.length.toString().padStart(2, "0")}</div>
            <p>
              {t("Nos pr\u00F3ximos 7 dias")}
              <Icon name="arrow" className="h-4 w-4" />
            </p>
          </Link>
          <button className="stat-card stat-renew" onClick={selectRenew}>
            <div className="stat-top">
              <span>{t("Pacotes a renovar")}</span>
              <span className="stat-icon stat-peach">
                <Icon name="book" />
              </span>
            </div>
            <div className="stat-value">{renew.length.toString().padStart(2, "0")}</div>
            <p>
              {renew.length
                ? t("Ver alunos com at\u00E9 1 aula restante")
                : t("Tudo em dia por aqui")}
              <Icon name="arrow" className="h-4 w-4" />
            </p>
          </button>
        </div>
      )}
      <div className={directoryOnly ? "directory-content" : "dashboard-columns"}>
        <section id="alunos" className="students-panel card">
          <div className="section-heading">
            <div>
              <h2>
                {t("Seus alunos")}
                <span className="count-badge">{rows.length}</span>
              </h2>
              <p>{t("Acompanhe cada jornada de perto.")}</p>
            </div>
            <Icon name="users" className="h-5 w-5 text-muted" />
          </div>
          <div className="student-tools">
            <div className="filter-tabs" aria-label={t("Filtrar alunos")}>
              {filters.map((f) => (
                <button
                  key={f.id}
                  aria-pressed={filter === f.id}
                  className={filter === f.id ? "filter-active" : ""}
                  onClick={() => setFilter(f.id)}
                >
                  {t(f.label)}
                </button>
              ))}
            </div>
            <label className="search-field">
              <Icon name="search" className="h-4 w-4" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPageByFilter({});
                }}
                placeholder={t("Buscar aluno\u2026")}
                aria-label={t("Buscar aluno pelo nome")}
              />
            </label>
          </div>
          <div className="student-table-heading">
            <span>{t("ALUNO / PLANO")}</span>
            <span>{t("PR\u00D3XIMA AULA")}</span>
            <span>{t("SALDO DE AULAS")}</span>
            <span />
          </div>
          <ul className="student-list">
            {pageRows.map((r, index) => (
              <li key={r.id} className={`student-row ${!r.active ? "student-inactive" : ""}`}>
                <Link href={`/students/${r.id}`} className="student-identity">
                  <span className={`student-avatar avatar-${index % 4}`}>{initials(r.name)}</span>
                  <span className="min-w-0">
                    <span className="student-name">{r.name}</span>
                    {r.pending && (
                      <span className="balance-pill balance-warning mt-1">
                        {t("Pendente · configurar horário")}
                      </span>
                    )}
                    <span className="student-plan">
                      {r.plan}
                      {!r.active && t(" \u00B7 Inativo")}
                    </span>
                  </span>
                </Link>
                <div className="student-next">
                  {r.next ? (
                    <>
                      <span>{formatDateLong(r.next.date, locale)}</span>
                      <span className="mt-1 flex items-center gap-1 text-xs text-muted">
                        <Icon name="clock" className="h-3 w-3" />
                        {r.next.time}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted">{t("Sem aula agendada")}</span>
                  )}
                </div>
                <div className="student-balance">
                  <span className={`balance-pill ${r.remaining <= 1 ? "balance-warning" : ""}`}>
                    {r.remaining} {r.remaining === 1 ? t("aula") : t("aulas")}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted">
                    {r.remaining < 0
                      ? t("Renova\u00E7\u00E3o pendente")
                      : r.remaining <= 1
                        ? t("Hora de renovar")
                        : t("Dispon\u00EDveis no pacote")}
                  </span>
                </div>
                <div className="student-actions">
                  <CopyButton text={r.link} label={t("Link do aluno")} />
                  <Link
                    href={`/students/${r.id}`}
                    className="row-arrow"
                    aria-label={t("Ver {value0}", { value0: r.name })}
                  >
                    <Icon name="arrow" className="h-4 w-4" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {matches.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">
                <Icon name="users" className="h-7 w-7" />
              </span>
              <h3>
                {rows.length
                  ? t("Nenhum aluno por aqui")
                  : t("Toda jornada come\u00E7a com o primeiro aluno")}
              </h3>
              <p>
                {rows.length
                  ? t("Experimente outro nome ou filtro.")
                  : t("Cadastre um aluno para organizar aulas, pacotes e pagamentos.")}
              </p>
              {rows.length === 0 && (
                <Link href="/students/new" className="btn mt-5">
                  <Icon name="plus" className="h-4 w-4" />
                  {t("Cadastrar primeiro aluno")}
                </Link>
              )}
            </div>
          )}
          <Pagination
            page={page}
            count={matches.length}
            size={50}
            onChange={(value) => setPageByFilter((previous) => ({ ...previous, [filter]: value }))}
          />
          <div className="table-footer">
            {matches.length}
            {t(" de ")}
            {rows.length} {rows.length === 1 ? t("aluno") : t("alunos")}
          </div>
        </section>
        {!directoryOnly && (
          <aside className="agenda-panel card" aria-label={t("Pr\u00F3ximas aulas")}>
            <div className="section-heading">
              <div>
                <h2>{t("Os pr\u00F3ximos encontros")}</h2>
              </div>
              <Icon name="calendar" className="h-5 w-5 text-accent" />
            </div>
            <p className="agenda-date">{dateLabel}</p>
            {upcoming.length ? (
              <ul className="agenda-list">
                {upcoming.slice(0, 5).map((l) => (
                  <li key={`${l.studentId}-${l.date}-${l.time}-${l.status}`}>
                    <div className="agenda-time">
                      {l.time}
                      <span>{l.date === today ? t("Hoje") : formatDateLong(l.date, locale)}</span>
                    </div>
                    <Link href={`/students/${l.studentId}`}>
                      <span className="font-semibold">{l.name}</span>
                      <span className="mt-1 block text-xs text-muted">
                        {l.status === "reposicao"
                          ? t("Aula de reposi\u00E7\u00E3o")
                          : t("Aula agendada")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="agenda-empty">
                <Icon name="calendar" className="mb-3 h-8 w-8 text-accent" />
                <p className="font-medium">{t("Espa\u00E7o para novos encontros")}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {t(
                    "As aulas dos pr\u00F3ximos 7 dias aparecem aqui assim que voc\u00EA cadastrar os hor\u00E1rios dos alunos.",
                  )}
                </p>
              </div>
            )}
            {upcoming.length > 5 && (
              <p className="mt-3 text-xs text-muted">
                {t("Mais ")}
                {upcoming.length - 5}
                {t(
                  " aulas nos pr\u00F3ximos 7 dias. Veja os hor\u00E1rios no perfil de cada aluno.",
                )}
              </p>
            )}
            <div className="agenda-tip">
              <span className="text-accent">
                <Icon name="check" className="h-4 w-4" />
              </span>
              <p>{t("Cada aluno tem um link para acompanhar suas pr\u00F3prias aulas.")}</p>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
