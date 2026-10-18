import {getTranslator} from "@/lib/i18n/server";
export async function DashboardLoading() {
    const { t } = await getTranslator();
    return (<div className="dashboard" role="status" aria-label={t("Carregando vis\u00E3o geral")}>
      <div className="page-heading">
        <div><h1>{t("Vis\u00E3o geral")}</h1><p className="page-description">{t("Carregando suas aulas e seus alunos\u2026")}</p></div>
      </div>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="overview-grid">
          {["Alunos ativos", "Próximas aulas", "Pacotes a renovar"].map((label) => (<div className="stat-card" key={label}><div className="stat-top">{t(label)}</div><div className="my-4 h-9 w-12 rounded-lg bg-line"/><div className="h-3 w-32 rounded bg-line"/></div>))}
        </div>
        <div className="dashboard-columns">
          <section className="card"><h2 className="h2">{t("Seus alunos")}</h2>{[0, 1, 2, 3].map((row) => <div key={row} className="flex items-center gap-3 border-t border-line py-5"><div className="h-10 w-10 shrink-0 rounded-xl bg-line"/><div className="flex-1 space-y-3"><div className="h-3 w-1/2 rounded bg-line"/><div className="h-2 w-1/3 rounded bg-line"/></div><div className="h-6 w-14 rounded bg-line"/></div>)}</section>
          <section className="card"><h2 className="h2">{t("Os pr\u00F3ximos encontros")}</h2>{[0, 1, 2].map((row) => <div key={row} className="space-y-3 border-t border-line py-5"><div className="h-3 w-3/4 rounded bg-line"/><div className="h-2 w-1/2 rounded bg-line"/></div>)}</section>
        </div>
      </div>
    </div>);
}
