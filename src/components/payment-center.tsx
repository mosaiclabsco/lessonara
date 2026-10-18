"use client";
import {useI18n} from "@/components/browser-preferences-provider";
import { useState } from "react";
import Link from "next/link";
import { formatBRL, formatDate } from "@/lib/dates";
import { paymentStatus, type PaymentStatus } from "@/lib/payment-rules";
import { WhatsAppPayment } from "./whatsapp-payment";
import { PaymentReminderButton } from "./payment-reminder-button";
import { Icon } from "./icon";
export type PaymentRow = {
    id: string;
    name: string;
    remaining: number;
    link: string;
    hasEmail: boolean;
    phone?: string | null;
    phoneCountry?: string | null;
    coveredUntil: string | null;
    lastPaidOn: string | null;
    plan: string;
    price: number | null;
};
export function PaymentCenter({ rows }: {
    rows: PaymentRow[];
}) {
    const { t, locale } = useI18n();
    const [filter, setFilter] = useState<PaymentStatus | "all">("pending");
    const [query, setQuery] = useState("");
    const pending = rows.filter((row) => paymentStatus(row.remaining) === "pending");
    const soon = rows.filter((row) => paymentStatus(row.remaining) === "soon");
    const matches = rows.filter((row) => (filter === "all" || paymentStatus(row.remaining) === filter) && row.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
    return <main><div className="page-heading"><div><h1>{t("Pagamentos")}</h1><p className="page-description">{t("Acompanhe renova\u00E7\u00F5es e avise seus alunos com o link das aulas.")}</p></div></div><div className="overview-grid"><button className="stat-card stat-renew" onClick={() => setFilter("pending")}><div className="stat-top">{t("Renova\u00E7\u00E3o pendente")}<Icon name="book" className="h-5 w-5"/></div><div className="stat-value">{pending.length}</div><p>{t("Pacote acabou ou saldo negativo")}</p></button><button className="stat-card" onClick={() => setFilter("soon")}><div className="stat-top">{t("Pr\u00F3ximos a renovar")}<Icon name="clock" className="h-5 w-5 text-muted"/></div><div className="stat-value">{soon.length}</div><p>{t("Faltam 1 ou 2 aulas")}</p></button><div className="stat-card"><div className="stat-top">{t("Pacotes em dia")}<Icon name="check" className="h-5 w-5 text-ok"/></div><div className="stat-value">{rows.length - pending.length - soon.length}</div><p>{t("Mais de 2 aulas dispon\u00EDveis")}</p></div></div><section className="card payment-panel"><div className="student-tools"><div className="filter-tabs">{([{ id: "pending", label: "Pendentes" }, { id: "soon", label: "A renovar" }, { id: "ok", label: "Em dia" }, { id: "all", label: "Todos" }] as const).map((item) => <button key={item.id} aria-pressed={filter === item.id} className={filter === item.id ? "filter-active" : ""} onClick={() => setFilter(item.id)}>{t(item.label)}</button>)}</div><label className="search-field"><Icon name="search" className="h-4 w-4"/><input aria-label={t("Buscar aluno nos pagamentos")} placeholder={t("Buscar aluno\u2026")} value={query} onChange={(event) => setQuery(event.target.value)}/></label></div>{matches.length ? <ul>{matches.map((row) => <li key={row.id} className="payment-row"><div className="payment-identity"><Link href={`/students/${row.id}`} className="font-semibold hover:underline">{row.name}</Link><p className="mt-1 text-xs text-muted">{row.plan}{row.price !== null && t(" \u00B7 {value0}", { value0: formatBRL(row.price, locale) })}</p><p className="mt-2 text-[11px] text-muted">{row.lastPaidOn ? t("\u00DAltimo pagamento: {value0}", { value0: formatDate(row.lastPaidOn, locale) }) : t("Nenhum pagamento registrado")}{row.coveredUntil && t(" \u00B7 \u00FAltimas aulas cobertas at\u00E9 {value0}", { value0: formatDate(row.coveredUntil, locale) })}</p></div><div><span className={`balance-pill ${row.remaining <= 2 ? "balance-warning" : ""}`}>{row.remaining} {row.remaining === 1 ? t("aula") : t("aulas")}</span><p className="mt-2 text-xs text-muted">{row.remaining < 0 ? t("Aulas usadas al\u00E9m do pacote") : row.remaining === 0 ? t("Pacote encerrado") : row.remaining <= 2 ? t("Prepare a renova\u00E7\u00E3o") : t("Pacote em dia")}</p></div><div className="payment-actions"><Link href={`/students/${row.id}#payments`} className="btn-ghost"><Icon name="plus" className="h-4 w-4"/>{t("Registrar pagamento")}</Link>{row.remaining <= 2 && <><WhatsAppPayment studentName={row.name} initialPhone={row.phone} initialCountry={row.phoneCountry}/><PaymentReminderButton studentId={row.id} hasEmail={row.hasEmail}/></>}</div></li>)}</ul> : <div className="empty-state"><Icon name="check" className="mx-auto mb-3 h-7 w-7 text-accent"/><h3>{t("Nenhum aluno neste filtro")}</h3><p>{t("Experimente outra busca ou acompanhe os pr\u00F3ximos a renovar.")}</p></div>}</section><p className="calendar-range">{t("Os pacotes n\u00E3o expiram por data: a renova\u00E7\u00E3o acompanha o saldo de aulas. No WhatsApp, voc\u00EA pode informar o telefone do aluno ou escolher o contato no aplicativo.")}</p></main>;
}
