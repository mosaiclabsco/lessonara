import { getTranslator } from "@/lib/i18n/server";
import { ButtonLink } from "@/components/button";
import { Suspense } from "react";
import { loadPendingGroups } from "@/lib/pending-groups";
import PanelLoading from "../loading";
export default function PendingPage() {
  return (
    <Suspense fallback={<PanelLoading />}>
      <PendingData />
    </Suspense>
  );
}
async function PendingData() {
  const groups = await loadPendingGroups();
  const { t } = await getTranslator();
  const total = groups.reduce((n, g) => n + g.count, 0);
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("O que preciso resolver")}</h1>
        <p className="page-description">
          {t("Próximas ações para manter suas aulas e recebimentos em dia.")}
        </p>
      </div>
      {total === 0 && (
        <section className="card">
          <h2 className="h2">{t("Tudo em dia por aqui")}</h2>
          <p className="mt-2 text-sm text-muted">
            {t("Nenhuma pendência encontrada nas áreas disponíveis no seu plano.")}
          </p>
        </section>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        {groups.map((g) => (
          <section
            key={t(g.title)}
            className={`card flex flex-col items-start ${g.count > 0 ? "pending-card-active" : ""}`}
          >
            <div className="flex w-full items-center justify-between gap-4">
              <h2 className="h2 mb-0">{t(g.title)}</h2>
              <span
                className={`count-badge ${g.count > 0 ? "count-badge-active" : ""}`}
                aria-label={t("{value0} pendências", { value0: g.count })}
              >
                {g.count}
              </span>
            </div>
            <p className="mt-3 text-sm text-muted">{t(g.description)}</p>
            <div className="mt-auto pt-6">
              <ButtonLink href={g.href} icon={g.icon}>
                {t("Revisar")}
              </ButtonLink>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
