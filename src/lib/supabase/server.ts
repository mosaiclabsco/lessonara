import { isIP } from "node:net";
import { redirect } from "next/navigation";
import { teacherSessionValid } from "../teacher-session";
import { measure, measuredFetch } from "../performance";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

function assertDataEnvironment() {
  if (process.env.VERCEL_ENV === "preview")
    throw new Error("Preview requires an isolated data environment.");
}

/** Cliente com a sessão do professor logado (RLS ativo). */
export const createClient = cache(async function createClient() {
  // A inicialização do auth consulta o relógio; deve ocorrer só na requisição.
  await connection();
  assertDataEnvironment();
  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, {
    global: { fetch: measuredFetch },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado de Server Component: o proxy já renova a sessão.
        }
      },
    },
  });
});

/** Cliente com a secret key: ignora RLS. Usar somente após autorização explícita no servidor e no cron. */
export function createAdminClient(forwardedIp?: string) {
  assertDataEnvironment();
  return createSupabaseClient(url, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: forwardedIp && isIP(forwardedIp) ? { "sb-forwarded-for": forwardedIp } : {},
    },
  });
}

export const requireUser = cache(async function requireUser() {
  const supabase = await createClient();
  const { data } = await measure("auth.session", () => supabase.auth.getClaims());
  if (!data?.claims || !(await teacherSessionValid(supabase, data.claims)))
    redirect("/login?expired=1");
  const teacher = await measure("auth.teacher", () =>
    supabase
      .from("teachers")
      .select(
        "id,name,email,lesson_minutes,profile_completed_at,platform_plan,import_onboarding,reviewed_settings,onboarding_dismissed_at,attendance_mode,attendance_effective_at",
      )
      .eq("id", data.claims.sub)
      .maybeSingle(),
  );
  if (teacher.error || !teacher.data) throw new Error("Acesso de professor(a) necessário.");
  return {
    supabase,
    userId: data.claims.sub as string,
    teacher: teacher.data,
    claims: data.claims,
  };
});
