import Link from "next/link";
import { Icon } from "./icon";
import { ActionForm, SubmitButton } from "./action-form";
import { FormActions } from "./button";
import { skipImport } from "@/app/import-actions";
import { getTranslator } from "@/lib/i18n/server";
import type { OnboardingState } from "@/lib/onboarding";
import { platformPlan } from "@/lib/platform-plans";
export async function ImportOnboarding({ state }: { state: OnboardingState }) {
  if (!state.ready || state.importState !== "pending" || !platformPlan(state.platformPlan).imports)
    return null;
  const { t } = await getTranslator();
  return (
    <section className="card import-onboarding space-y-3">
      <h2 className="h2">
        {t(state.hasStudents ? "Continue organizando seus alunos" : "Como você quer começar?")}
      </h2>
      <p className="text-sm text-muted">
        {t(
          "Cadastre seus alunos individualmente ou importe uma lista que você já usa. A importação é opcional e continua disponível depois, na tela Alunos.",
        )}
      </p>
      <FormActions className="import-onboarding-actions">
        <Link href="/students/import" className="btn-ghost">
          <Icon name="download" className="h-4 w-4" />
          {t("Importar lista de alunos")}
        </Link>
        <ActionForm action={skipImport}>
          <input type="hidden" name="next" value="student" />
          <SubmitButton icon="plus">
            {t(state.hasStudents ? "Cadastrar outro aluno" : "Cadastrar meu primeiro aluno")}
          </SubmitButton>
        </ActionForm>
      </FormActions>
    </section>
  );
}
