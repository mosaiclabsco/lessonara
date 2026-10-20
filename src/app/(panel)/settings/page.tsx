import { measure } from "@/lib/performance";
import { settingsTab, type SettingsTab } from "@/lib/settings-navigation";
import type { ReactNode } from "react";
import { SupportContact } from "@/components/support-contact";
import { FormActions } from "@/components/button";
import { PlanManager } from "@/components/plan-manager";
import { IntegrationCatalog } from "@/components/integration-catalog";
import { loadOnboarding } from "@/lib/onboarding";
import { OnboardingGuide } from "@/components/onboarding-guide";
import { SubscriptionPlan } from "@/components/subscription-plan";

import { SettingsTabs } from "@/components/settings-tabs";
import { GoogleIntegration } from "@/components/google-integration";
import { googleConfigured } from "@/lib/google/calendar";

import { ActionForm, SubmitButton } from "@/components/action-form";
import { getTranslator } from "@/lib/i18n/server";
import { BrowserPreferences } from "@/components/browser-preferences";
import { HolidaySettingsForm } from "@/components/holiday-settings";
import { loadHolidayRules } from "@/lib/holiday-data";
import { nowInTZ } from "@/lib/dates";
import { Suspense } from "react";
import PanelLoading from "../loading";
import { updateTeacher } from "../actions";

import type { Plan } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
type Search = Promise<{ tab?: string; google?: string; integration?: string }>;
export default function ConfigPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<PanelLoading />}>
      <PageContent searchParams={searchParams} />
    </Suspense>
  );
}
async function PageContent({ searchParams }: { searchParams: Search }) {
  return measure("settings.page", async () => {
    const params = await searchParams;
    const active = settingsTab(params.tab ?? (params.google ? "integrations" : "general"));
    const [{ t }, onboarding] = await Promise.all([getTranslator(), loadOnboarding()]);
    return (
      <main className="form-page space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("Configurações")}</h1>
          <p className="page-description">
            {t("Seu perfil e os planos que fazem sentido para suas aulas.")}
          </p>
        </div>
        {!onboarding.ready && <OnboardingGuide state={onboarding} />}
        <SettingsTabs active={active}>
          <SettingsContent
            active={active}
            integration={params.integration}
            platformPlan={onboarding.platformPlan}
          />
        </SettingsTabs>
      </main>
    );
  });
}
async function SettingsContent({
  active,
  integration,
  platformPlan,
}: {
  active: SettingsTab;
  integration?: string;
  platformPlan: Parameters<typeof SubscriptionPlan>[0]["active"];
}) {
  return measure(`settings.${active}`, async () => {
    const { t } = await getTranslator();
    const { supabase, userId, teacher } = await requireUser();
    let content: ReactNode;
    switch (active) {
      case "support":
        return <SupportContact />;
      case "subscription":
        return <SubscriptionPlan active={platformPlan} />;
      case "plans": {
        const plans = await supabase
          .from("plans")
          .select("*")
          .eq("teacher_id", userId)
          .order("sort_order")
          .order("created_at")
          .order("id");
        if (plans.error) throw plans.error;
        return <PlanManager plans={(plans.data ?? []) as Plan[]} />;
      }
      case "holidays": {
        const rules = await loadHolidayRules(supabase, [userId]);
        const settings = rules.settings[0] ?? null;
        const now = new Date();
        const locked = Boolean(settings?.lock_at && new Date(settings.lock_at) <= now);
        return (
          <HolidaySettingsForm
            key={`${settings?.enabled}-${settings?.policy}-${locked}`}
            settings={settings}
            holidays={rules.holidays}
            today={nowInTZ(now).today}
            locked={locked}
            ready={rules.ready}
          />
        );
      }
      case "integrations": {
        const google = await supabase
          .from("google_calendar_connections")
          .select("teacher_id,last_error")
          .eq("teacher_id", userId)
          .maybeSingle();
        if (google.error) throw google.error;
        return (
          <IntegrationCatalog connected={Boolean(google.data)} open={integration === "google"}>
            {integration === "google" && (
              <GoogleIntegration
                configured={googleConfigured()}
                connected={Boolean(google.data)}
                error={google.data?.last_error}
              />
            )}
          </IntegrationCatalog>
        );
      }
      default:
        content = (
          <>
            <ActionForm action={updateTeacher} className="card space-y-3">
              <div>
                <label className="label" htmlFor="teacher-name">
                  {t("Seu nome (aparece para os alunos)")}
                </label>
                <input
                  className="input"
                  id="teacher-name"
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={teacher?.name}
                />
              </div>
              <div>
                <label className="label" htmlFor="lesson-minutes">
                  {t("Duração da aula (minutos)")}
                </label>
                <select
                  id="lesson-minutes"
                  className="input"
                  name="lesson_minutes"
                  required
                  defaultValue={teacher?.lesson_minutes ?? 60}
                >
                  {Array.from({ length: 12 }, (_, i) => (i + 1) * 15).map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} min
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-muted">
                  {t("Aplica-se a novos agendamentos. Aulas existentes mantêm sua duração.")}
                </p>
              </div>
              <FormActions>
                <SubmitButton className="btn">{t("Salvar")}</SubmitButton>
              </FormActions>
            </ActionForm>

            <BrowserPreferences />
          </>
        );
    }
    return content;
  });
}
