import {loadOnboarding} from "@/lib/onboarding";
import {PlatformPlanProvider} from "@/components/platform-plan-provider";
import PanelLoading from "./loading";
import {Suspense} from "react";
import {PanelNav,PanelNavFallback} from "@/components/panel-nav";
import {WorkspaceShell} from "@/components/workspace-shell";
import {requireUser} from "@/lib/supabase/server";
async function Workspace({children}:LayoutProps<"/">) {
 const state=await loadOnboarding();const {supabase,userId}=await requireUser();const {data:teacher}=await supabase.from("teachers").select("name").eq("id",userId).single();
 return <PlatformPlanProvider plan={state.platformPlan}><WorkspaceShell name={teacher?.name??"Professor"} nav={<Suspense fallback={<PanelNavFallback/>}><PanelNav platformPlan={state.platformPlan}/></Suspense>}>{children}</WorkspaceShell></PlatformPlanProvider>;
}
export default function PanelLayout(props:LayoutProps<"/">){return <Suspense fallback={<PanelLoading/>}><Workspace {...props}/></Suspense>;}
