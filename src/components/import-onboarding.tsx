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
    <section className="card space-y-3">
      <h2 className="h2">Já tem alunos? Importe seus dados</h2>
      <p className="text-sm text-muted">
        Etapa opcional: use o modelo CSV ou peça ajuda à equipe. Você poderá importar depois pelo
        botão em Alunos.
      </p>
      <FormActions>
        <ActionForm action={skipImport}>
          <SubmitButton icon="arrow" className="btn-ghost">
            Pular por enquanto
          </SubmitButton>
        </ActionForm>
        <Link href="/students/import" className="btn">
          <Icon name="download" className="h-4 w-4" />
          Importar dados
        </Link>
      </FormActions>
    </section>
  );
}
