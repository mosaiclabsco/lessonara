import Link from "next/link";
import { Icon } from "./icon";
import { ActionForm, SubmitButton } from "./action-form";
import { FormActions } from "./button";
import { skipImport } from "@/app/import-actions";
import type { OnboardingState } from "@/lib/onboarding";
import { platformPlan } from "@/lib/platform-plans";
export function ImportOnboarding({ state }: { state: OnboardingState }) {
  if (!state.ready || state.importState !== "pending" || !platformPlan(state.platformPlan).imports)
    return null;
  return (
    <section className="card import-onboarding space-y-3">
      <h2 className="h2">Como você quer começar?</h2>
      <p className="text-sm text-muted">
        Cadastre seus alunos individualmente ou importe uma lista que você já usa. A importação é
        opcional e continua disponível depois, na tela Alunos.
      </p>
      <FormActions className="import-onboarding-actions">
        <Link href="/students/import" className="btn-ghost">
          <Icon name="download" className="h-4 w-4" />
          Importar lista de alunos
        </Link>
        <ActionForm action={skipImport}>
          <input type="hidden" name="next" value="student" />
          <SubmitButton icon="plus">Cadastrar meu primeiro aluno</SubmitButton>
        </ActionForm>
      </FormActions>
    </section>
  );
}
