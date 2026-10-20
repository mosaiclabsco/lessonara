import { EmailCampaign } from "@/components/email-campaign";
import { FeatureRequired } from "@/components/feature-required";
import { platformPlan } from "@/lib/platform-plans";
import { loadOnboarding } from "@/lib/onboarding";
import { SetupRequired } from "@/components/onboarding-guide";
import { Suspense } from "react";
import { getTranslator } from "@/lib/i18n/server";
import { requireUser } from "@/lib/supabase/server";
import { EmailTimeline, type EmailStatus } from "@/components/email-timeline";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { retryPendingEmails } from "./actions";
import PanelLoading from "../loading";
export const maxDuration = 300;
async function Emails() {
  const { t } = await getTranslator();
  const { supabase, userId } = await requireUser();
  const state = await loadOnboarding();
  if (!state.ready) return <SetupRequired />;
  if (!platformPlan(state.platformPlan).emails) return <FeatureRequired feature="Emails" />;
  const [jobs, recipients] = await Promise.all([
    supabase
      .from("email_outbox")
      .select("id,recipient,template,status,attempts,last_error,created_at")
      .eq("teacher_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("students")
      .select("id,name,email")
      .eq("teacher_id", userId)
      .eq("active", true)
      .eq("promotional_email_opt_out", false)
      .not("email", "is", null)
      .order("name")
      .limit(1000),
  ]);
  if (recipients.error) throw new Error("Não foi possível carregar os destinatários.");
  if (jobs.error) throw new Error("Não foi possível carregar os emails.");
  return (
    <main>
      <div className="page-heading">
        <div>
          <h1>{t("Emails")}</h1>
          <p>{t("Acompanhe os últimos 100 envios automáticos e lembretes de renovação.")}</p>
        </div>
        <ActionForm action={retryPendingEmails}>
          <SubmitButton className="btn-ghost" icon="mail">
            {t("Tentar envios pendentes")}
          </SubmitButton>
        </ActionForm>
      </div>
      <EmailCampaign
        recipients={(recipients.data ?? []) as { id: string; name: string; email: string }[]}
      />
      <div className="mt-6">
        <EmailTimeline jobs={(jobs.data ?? []) as EmailStatus[]} />
      </div>
    </main>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<PanelLoading />}>
      <Emails />
    </Suspense>
  );
}
