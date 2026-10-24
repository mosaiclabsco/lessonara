import { hasPlatformFeature } from "@/lib/platform-plans";
import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import type { OnboardingState } from "@/lib/onboarding";
import { Icon } from "./icon";
export async function OnboardingGuide({ state }: { state: OnboardingState }) {
  const { t } = await getTranslator();
  const steps = [
    {
      id: "general",
      label: "Configure seu perfil",
      icon: "settings" as const,
      done: state.profileDone,
      required: true,
    },
    {
      id: "plans",
      label: "Crie seu primeiro plano",
      icon: "book" as const,
      done: state.plansDone,
      required: true,
    },
    ...[
      { id: "integrations", label: "Conheça as integrações", icon: "calendar" as const },
      { id: "holidays", label: "Revise os feriados", icon: "calendar" as const },
      { id: "receivables", label: "Conheça os recebimentos por Pix", icon: "check" as const },
      { id: "subscription", label: "Confira seu plano da empresa", icon: "book" as const },
      { id: "support", label: "Saiba onde pedir ajuda", icon: "chat" as const },
    ]
      .filter(
        (step) => step.id !== "integrations" || hasPlatformFeature(state.platformPlan, "google"),
      )
      .map((step) => ({
        ...step,
        done: state.reviewedSettings?.includes(step.id) ?? false,
        required: false,
      })),
  ];
  return (
    <section className="card onboarding-guide">
      <div className="section-heading">
        <div>
          <h2>{t("Prepare seu espaço de ensino")}</h2>
          <p>{t("Configure o essencial e conheça as opções para sua rotina.")}</p>
        </div>
        <span className="count-badge">
          {steps.filter((s) => s.done).length}/{steps.length}
        </span>
      </div>
      <ol className="onboarding-steps">
        {steps.map((step, index) => (
          <li key={step.id}>
            <Icon name={step.done ? "check" : step.icon} className="h-5 w-5" />
            <div>
              <strong>
                {index + 1}. {t(step.label)}
              </strong>
              <p>
                {t(
                  step.required
                    ? step.done
                      ? "Configurado"
                      : "Obrigatório para começar"
                    : step.done
                      ? "Revisado · configuração opcional"
                      : "Opcional · acessar a tela já conclui esta etapa",
                )}
              </p>
            </div>
            <Link className="btn-ghost" href={`/settings?tab=${step.id}#${step.id}`}>
              <Icon name="arrow" className="h-4 w-4" />
              {t(step.done ? "Revisar" : "Acessar")}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export async function SetupNotice() {
  const { t } = await getTranslator();
  return (
    <section className="card empty-state">
      <Icon name="settings" className="mx-auto mb-4 h-8 w-8 text-accent" />
      <h1 className="h2">{t("Configure seu primeiro acesso")}</h1>
      <p>{t("Vá para Configurações, salve seu perfil e ative ao menos um plano para começar.")}</p>
      <Link className="btn mt-6" href="/settings">
        <Icon name="arrow" className="h-4 w-4" />
        {t("Ir para Configurações")}
      </Link>
    </section>
  );
}

export async function SetupRequired() {
  return (
    <main className="form-page">
      <SetupNotice />
    </main>
  );
}
