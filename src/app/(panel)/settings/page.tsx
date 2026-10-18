import {FormActions} from "@/components/button";
import {PlanManager} from "@/components/plan-manager";
import {IntegrationCatalog} from "@/components/integration-catalog";
import {loadOnboarding} from "@/lib/onboarding";
import {OnboardingGuide} from "@/components/onboarding-guide";
import {SubscriptionPlan} from "@/components/subscription-plan";


import {SettingsTabs} from "@/components/settings-tabs";
import {GoogleIntegration} from "@/components/google-integration";
import {googleConfigured} from "@/lib/google/calendar";

import {ActionForm,SubmitButton} from "@/components/action-form";
import { getTranslator } from "@/lib/i18n/server";
import { BrowserPreferences } from "@/components/browser-preferences";
import { HolidaySettingsForm } from "@/components/holiday-settings";
import { loadHolidayRules } from "@/lib/holiday-data";
import { nowInTZ } from "@/lib/dates";
import { Suspense } from "react";
import PanelLoading from "../loading";
import { updateTeacher } from "../actions";

import type { Plan, Teacher } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
export default function ConfigPage() {
    return <Suspense fallback={<PanelLoading />}><PageContent /></Suspense>;
}
async function PageContent() {
    const { t } = await getTranslator();
    const { supabase, userId } = await requireUser();
    const [{ data: teacher }, { data: plans }] = await Promise.all([
        supabase.from("teachers").select("*").eq("id", userId).single<Teacher>(),
        supabase.from("plans").select("*").order("sort_order").order("created_at").order("id"),
    ]);
    const google=await supabase.from("google_calendar_connections").select("teacher_id,last_error").eq("teacher_id",userId).maybeSingle();
    const onboarding=await loadOnboarding();
    const rules = await loadHolidayRules(supabase, [userId]);
    const settings = rules.settings[0] ?? null;
    const now = new Date();
    const locked = Boolean(settings?.lock_at && new Date(settings.lock_at) <= now);
    return (<main className="form-page space-y-6">
      <div><h1 className="text-3xl font-semibold tracking-tight">{t("Configura\u00E7\u00F5es")}</h1><p className="page-description">{t("Seu perfil e os planos que fazem sentido para suas aulas.")}</p></div>

{!onboarding.ready&&<OnboardingGuide state={onboarding}/>}<SettingsTabs subscription={<SubscriptionPlan active={onboarding.platformPlan}/>} general={<><ActionForm action={updateTeacher} className="card space-y-3">
        <div>
          <label className="label" htmlFor="teacher-name">{t("Seu nome (aparece para os alunos)")}</label>
          <input className="input" id="teacher-name" name="name" required maxLength={120} defaultValue={teacher?.name}/>
        </div>
        <div><label className="label" htmlFor="lesson-minutes">{t("Duração da aula (minutos)")}</label><select id="lesson-minutes" className="input" name="lesson_minutes" required defaultValue={teacher?.lesson_minutes??60}>{Array.from({length:12},(_,i)=>(i+1)*15).map(minutes=><option key={minutes} value={minutes}>{minutes} min</option>)}</select><p className="mt-2 text-xs text-muted">{t("Aplica-se a novos agendamentos. Aulas existentes mantêm sua duração.")}</p></div><FormActions><SubmitButton className="btn">{t("Salvar")}</SubmitButton></FormActions>
      </ActionForm>

      <BrowserPreferences /></>} integrations={<IntegrationCatalog connected={Boolean(google.data)}><GoogleIntegration configured={googleConfigured()} connected={Boolean(google.data)} error={google.data?.last_error}/></IntegrationCatalog>} holidays={<HolidaySettingsForm key={`${settings?.enabled}-${settings?.policy}-${locked}`} settings={settings} holidays={rules.holidays} today={nowInTZ(now).today} locked={locked} ready={rules.ready}/>} plans={<PlanManager plans={(plans??[]) as Plan[]}/>}/>
    </main>);
}
