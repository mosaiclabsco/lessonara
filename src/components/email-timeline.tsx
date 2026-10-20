"use client";
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
  attempts: number;
  created_at: string;
  last_error: string | null;
};
const labels: Record<string, string> = {
  pending: "Aguardando envio",
  sending: "Enviando",
  sent: "Enviado ao provedor",
  failed: "Falha no envio",
  cancelled: "Cancelado",
};
export function EmailTimeline({ jobs }: { jobs: EmailStatus[] }) {
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState("all");
  const [pages, setPages] = useState<Record<string, number>>({});
  const visible = jobs.filter((job) => filter === "all" || job.status === filter);
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
          { label: "Enviados", value: jobs.filter((j) => j.status === "sent").length },
          {
            label: "Pendentes",
            value: jobs.filter((j) => j.status === "pending" || j.status === "sending").length,
          },
          { label: "Falhas", value: jobs.filter((j) => j.status === "failed").length },
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
          { id: "sent", label: "Enviados" },
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
          "Enviado ao provedor significa aceito para envio; não confirma chegada à caixa de entrada.",
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
              <span className={`text-xs ${job.status === "failed" ? "text-bad" : "text-muted"}`}>
                {t(labels[job.status] ?? job.status)}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted">
              {new Date(job.created_at).toLocaleString(localeTag(locale), {
                timeZone: "America/Sao_Paulo",
              })}{" "}
              · {job.attempts} {t("tentativa(s)")}
            </p>
            {job.last_error && (
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
