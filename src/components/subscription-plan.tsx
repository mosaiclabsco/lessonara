import { getTranslator } from "@/lib/i18n/server";
import { PLATFORM_PLANS, type PlatformPlan } from "@/lib/platform-plans";
import { formatFileSize } from "@/lib/document-rules";
import { Icon } from "./icon";
export async function SubscriptionPlan({ active }: { active: PlatformPlan }) {
  const { t } = await getTranslator();
  return (
    <section className="card">
      <h2 className="h2">{t("Plano da empresa")}</h2>
      <p className="mt-3 text-sm text-muted">
        {t(
          "A assinatura do Lessonara define recursos e espaço de arquivos. Os pacotes de aulas dos alunos são configurados separadamente.",
        )}
      </p>
      <div className="subscription-grid">
        {Object.values(PLATFORM_PLANS).map((plan) => (
          <article
            className={`subscription-card ${plan.id === active ? "subscription-active" : ""}`}
            key={plan.id}
          >
            <div className="section-heading">
              <h3>{plan.name}</h3>
              <span className="balance-pill">
                {t(plan.id === active ? "Plano ativo" : "Outro plano")}
              </span>
            </div>
            <ul>
              <li>
                <Icon name="check" className="h-4 w-4" />
                {t("Agenda, alunos, pagamentos e atividades")}
              </li>
              <li>
                <Icon name="check" className="h-4 w-4" />
                {formatFileSize(plan.maxFileBytes)} {t("por arquivo")}
              </li>
              <li>
                <Icon name="check" className="h-4 w-4" />
                {formatFileSize(plan.storageBytes)} {t("de armazenamento")}
              </li>
              <li>
                <Icon name={plan.emails ? "check" : "clock"} className="h-4 w-4" />
                {t(plan.emails ? "Gestão de emails" : "Gestão de emails no Pro")}
              </li>
              <li>
                <Icon name={plan.classroom ? "check" : "clock"} className="h-4 w-4" />
                {t(plan.classroom ? "Sala de aula no navegador e no app" : "Sala de aula no Pro")}
              </li>
            </ul>
          </article>
        ))}
      </div>
      <p className="mt-5 text-xs text-muted">
        {t(
          "Os planos estão em teste. Não há cobrança automática; alterações são feitas pela administração.",
        )}
      </p>
    </section>
  );
}
