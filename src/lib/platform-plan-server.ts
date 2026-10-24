import "server-only";
import { createAdminClient, requireUser } from "./supabase/server";
import { platformPlan, type PlatformFeature } from "./platform-plans";
import type { SupabaseClient } from "@supabase/supabase-js";
export async function loadTeacherPlan(teacherId: string, client?: SupabaseClient) {
  const db = client ?? createAdminClient();
  const row = await db
    .from("teachers")
    .select("platform_plan,access_suspended")
    .eq("id", teacherId)
    .single();
  if (row.error || !row.data) throw new Error("Não foi possível verificar o plano desta conta.");
  return platformPlan(row.data.access_suspended ? null : row.data.platform_plan);
}
export async function requirePlatformFeature(feature: PlatformFeature) {
  const account = await requireUser();
  const plan = platformPlan(account.teacher.platform_plan);
  if (!plan[feature])
    throw new Error(
      ["emails", "google", "exports", "imports"].includes(feature)
        ? "Este recurso está disponível nos planos Plus e Pro."
        : "Este recurso está disponível no plano Pro.",
    );
  return account;
}
