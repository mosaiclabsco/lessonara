"use client";
import { emailDisplayStatus, type DeliveryStatus } from "@/lib/mail/delivery-status";
import { useState } from "react";
import { useI18n } from "./browser-preferences-provider";
import { Pagination } from "./pagination";
import { Icon } from "./icon";
import { localeTag } from "@/lib/i18n/core";
export type EmailStatus = {
  id: string;
  recipient: string;
  template: string;
  status: string;
  delivery_status?: DeliveryStatus | null;
  delivery_updated_at?: string | null;
  attempts: number;
  created_at: string;
  last_error: string | null;
};
const labels: Record<string, string> = {
  pending: "Aguardando envio",
  sending: "Enviando",
  sent: "Aceito pelo provedor",
  delivered: "Entregue ao servidor de email",
  delayed: "Entrega atrasada",
  failed: "Falha no envio",
  cancelled: "Cancelado",
};
export function EmailTimeline({ jobs }: { jobs: EmailStatus[] }) {
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState("all");
  const [pages, setPages] = useState<Record<string, number>>({});
  const visible = jobs.filter(
    (job) =>
      filter === "all" ||
      (filter === "pending"
        ? ["pending", "sending", "delayed"].includes(emailDisplayStatus(job))
        : emailDisplayStatus(job) === filter),
  );
  const page = Math.min(pages[filter] ?? 0, Math.max(0, Math.ceil(visible.length / 20) - 1));
  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <h2>{t("Histórico de envios")}</h2>
          <p>
            {t("Boas-vindas são automáticas. Lembretes de renovação são enviados em Pagamentos.")}
          </p>
        </div>
        <Icon name="mail" className="h-5 w-5 text-accent" />
      </div>
      <div className="grid grid-cols-3 gap-3 my-5">
        {[
          {
            label: "Entregues",
            value: jobs.filter((j) => emailDisplayStatus(j) === "delivered").length,
          },
          {
            label: "Pendentes",
            value: jobs.filter((j) =>
              ["pending", "sending", "delayed"].includes(emailDisplayStatus(j)),
            ).length,
          },
          { label: "Falhas", value: jobs.filter((j) => emailDisplayStatus(j) === "failed").length },
        ].map((item) => (
          <div key={item.label}>
            <p className="text-xs text-muted">{t(item.label)}</p>
            <strong className="text-2xl">{item.value}</strong>
          </div>
        ))}
      </div>
      <div className="filter-tabs mt-5">
        {[
          { id: "all", label: "Todos" },
          { id: "sent", label: "Aceitos pelo provedor" },
          { id: "delivered", label: "Entregues" },
          { id: "pending", label: "Pendentes" },
          { id: "failed", label: "Falhas" },
        ].map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={filter === item.id}
            className={filter === item.id ? "filter-active" : ""}
            onClick={() => setFilter(item.id)}
          >
            {t(item.label)}
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">
        {t(
          "Aceito pelo provedor ainda não confirma entrega. Entregue indica aceite pelo servidor de email do destinatário, sem garantir leitura ou chegada à caixa principal.",
        )}
      </p>
      <ul className="mt-4 divide-y divide-line">
        {visible.slice(page * 20, (page + 1) * 20).map((job) => (
          <li key={job.id} className="py-4">
            <div className="flex flex-wrap justify-between gap-2">
              <p className="text-sm font-medium">
                {t(
                  job.template === "welcome"
                    ? "Boas-vindas"
                    : job.template === "campaign"
                      ? "Campanha"
                      : "Renovação do pacote",
                )}{" "}
                · {job.recipient}
              </p>
              <span
                className={`text-xs ${emailDisplayStatus(job) === "failed" ? "text-bad" : emailDisplayStatus(job) === "delivered" ? "text-accent" : "text-muted"}`}
              >
                {t(labels[emailDisplayStatus(job)] ?? job.status)}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted">
              {new Date(job.created_at).toLocaleString(localeTag(locale), {
                timeZone: "America/Sao_Paulo",
              })}{" "}
              · {job.attempts} {t("tentativa(s)")}
            </p>
            {job.delivery_status === "bounced" && (
              <p className="mt-2 text-xs text-bad">
                {t(
                  "O endereço recusou o email. Novos envios para esse endereço foram interrompidos.",
                )}
              </p>
            )}
            {job.delivery_status === "complained" && (
              <p className="mt-2 text-xs text-bad">
                {t(
                  "Mensagem marcada como spam. Novos envios para esse endereço foram interrompidos.",
                )}
              </p>
            )}
            {(job.delivery_status === "suppressed" ||
              job.last_error === "recipient_suppressed") && (
              <p className="mt-2 text-xs text-bad">
                {t("Envio bloqueado após falha permanente ou reclamação de spam.")}
              </p>
            )}
            {job.delivery_status === "failed" && (
              <p className="mt-2 text-xs text-bad">
                {t("O provedor informou uma falha após aceitar o envio.")}
              </p>
            )}
            {job.delivery_status === "delivery_delayed" && (
              <p className="mt-2 text-xs text-muted">
                {t("O provedor ainda está tentando entregar esta mensagem.")}
              </p>
            )}
            {job.last_error && job.last_error !== "recipient_suppressed" && (
              <p className="mt-2 text-xs text-bad">
                {t("Confira a configuração do envio ou tente novamente após corrigir a falha.")}
              </p>
            )}
          </li>
        ))}
      </ul>
      {!visible.length && (
        <p className="mt-5 text-sm text-muted">{t("Nenhum envio neste filtro.")}</p>
      )}
      <Pagination
        page={page}
        count={visible.length}
        size={20}
        onChange={(value) => setPages((old) => ({ ...old, [filter]: value }))}
      />
    </section>
  );
}
