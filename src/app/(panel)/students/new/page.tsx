import { FormActions } from "@/components/button";
import { Icon } from "@/components/icon";
import { loadOnboarding } from "@/lib/onboarding";
import { SetupRequired } from "@/components/onboarding-guide";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { getTranslator } from "@/lib/i18n/server";
import { Suspense } from "react";
import PanelLoading from "../../loading";
import Link from "next/link";
import { createStudent } from "../../actions";
import { StudentFields } from "../student-form";
import type { Plan } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
export default function NewStudentPage() {
  return (
    <Suspense fallback={<PanelLoading />}>
      <PageContent />
    </Suspense>
  );
}
async function PageContent() {
  const { t } = await getTranslator();
  if (!(await loadOnboarding()).ready) return <SetupRequired />;
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at")
    .order("id");
  return (
    <main className="form-page space-y-6">
      <div>
        <Link href="/students" className="mb-5 inline-block text-sm text-muted hover:text-fg">
          {t("\u2190 Alunos")}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{t("Novo aluno")}</h1>
        <p className="page-description">{t("O primeiro passo para aulas bem organizadas.")}</p>
      </div>
      <ActionForm action={createStudent} className="card space-y-6">
        <StudentFields plans={(plans ?? []) as Plan[]} />
        <FormActions>
          <Link href="/students" className="btn-ghost">
            <Icon name="close" className="h-4 w-4" />
            {t("Cancelar")}
          </Link>
          <SubmitButton className="btn">{t("Cadastrar aluno")}</SubmitButton>
        </FormActions>
      </ActionForm>
      <p className="text-sm text-muted">
        {t("Depois de criar, cadastre o hor\u00E1rio fixo e o primeiro pacote.")}
      </p>
    </main>
  );
}
