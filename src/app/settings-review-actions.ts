"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
export async function reviewSettings(tab: string) {
  if (!["integrations", "holidays", "receivables", "subscription", "support"].includes(tab)) return;
  const { supabase } = await requireUser();
  const result = await supabase.rpc("review_settings", { p_tab: tab });
  if (result.error) throw new Error("Não foi possível guardar a etapa revisada.");
}

export async function dismissOnboarding() {
  const { supabase } = await requireUser();
  const result = await supabase.rpc("dismiss_onboarding");
  if (result.error) throw new Error("Conclua todas as etapas antes de fechar o guia.");
  revalidatePath("/", "layout");
}
