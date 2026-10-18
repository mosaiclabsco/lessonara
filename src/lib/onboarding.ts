import {resolvePlatformPlan,type PlatformPlan} from "./platform-plans";
import {cache} from "react";
import {requireUser} from "./supabase/server";
export type OnboardingState={profileDone:boolean;plansDone:boolean;ready:boolean;platformPlan:PlatformPlan};
export function onboardingState(teacher:{name?:string|null;lesson_minutes?:number|null;profile_completed_at?:string|null;platform_plan?:string|null},planCount:number):OnboardingState{const profileDone=Boolean(teacher.profile_completed_at&&teacher.name?.trim()&&teacher.lesson_minutes&&teacher.lesson_minutes>=15&&teacher.lesson_minutes<=180&&teacher.lesson_minutes%15===0);const plansDone=planCount>0;const platformPlan=resolvePlatformPlan(teacher.platform_plan);return {profileDone,plansDone,ready:profileDone&&plansDone,platformPlan};}
export const loadOnboarding=cache(async()=>{
 const {supabase,userId,teacher}=await requireUser();
 const plans=await supabase.from("plans").select("id").eq("teacher_id",userId).eq("is_active",true).limit(1);
 if(plans.error)throw new Error("Não foi possível carregar a configuração inicial.");
 return onboardingState(teacher,plans.data?.length??0);
});
export async function requireConfiguredTeacher(){const state=await loadOnboarding();if(!state.ready)throw new Error("Conclua a configuração inicial em Configurações antes de continuar.");return requireUser();}
