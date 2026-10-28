"use server";
import { createClient as createAuthClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { createAdminClient, createClient, requireUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { fingerprint } from "@/lib/mail/crypto";
export async function startSupportAccess(
  _previous: { error?: string } | null,
  form: FormData,
): Promise<{ error?: string } | null> {
  const token = form.get("token");
  if (typeof token !== "string" || !/^[-_a-zA-Z0-9]{43}$/.test(token))
    return { error: "Link inválido. Gere outro acesso pelo admin." };
  const db = createAdminClient();
  const ip = process.env.VERCEL
    ? (await headers()).get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    : "local";
  const limited = await db.rpc("allow_student_auth", {
    p_keys: [`support-access/${fingerprint(ip)}`],
    p_limits: [20],
    p_seconds: [60],
  });
  if (limited.error || limited.data !== true)
    return { error: "Muitas tentativas. Aguarde um minuto antes de tentar novamente." };
  const grant = await db.rpc("consume_support_grant", {
    p_token_hash: createHash("sha256").update(token).digest("hex"),
  });
  if (grant.error || !grant.data)
    return { error: "Link expirado ou já utilizado. Gere outro acesso pelo admin." };
  const auth = createAuthClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  try {
    const generated = await db.auth.admin.generateLink({
      type: "magiclink",
      email: grant.data.email,
    });
    if (
      generated.error ||
      generated.data.user.id !== grant.data.teacher_id ||
      !generated.data.properties?.hashed_token
    )
      throw new Error();
    const verified = await auth.auth.verifyOtp({
      type: "magiclink",
      token_hash: generated.data.properties.hashed_token,
    });
    if (
      verified.error ||
      verified.data.user?.id !== grant.data.teacher_id ||
      !verified.data.session
    )
      throw new Error();
    const claims = await auth.auth.getClaims();
    const sessionId = claims.data?.claims.session_id;
    if (claims.error || typeof sessionId !== "string") throw new Error();
    const bound = await db.rpc("bind_support_session", {
      p_grant_id: grant.data.id,
      p_session_id: sessionId,
    });
    if (bound.error || !bound.data) throw new Error();
    // The initial token stays server-side; only the refreshed, bounded session reaches cookies.
    const refreshed = await auth.auth.refreshSession();
    const bounded = await auth.auth.getClaims();
    const deadline = bounded.data?.claims.session_expires_at;
    if (
      refreshed.error ||
      !refreshed.data.session ||
      bounded.error ||
      bounded.data?.claims.support_actor !== grant.data.actor ||
      typeof deadline !== "number" ||
      deadline * 1000 > Date.parse(bound.data) + 1000 ||
      deadline * 1000 <= Date.now()
    )
      throw new Error();
    const portal = await createClient();
    const saved = await portal.auth.setSession({
      access_token: refreshed.data.session.access_token,
      refresh_token: refreshed.data.session.refresh_token,
    });
    if (saved.error) throw new Error();
  } catch {
    await auth.auth.signOut({ scope: "local" });
    return { error: "Não foi possível iniciar a sessão temporária. Gere outro acesso pelo admin." };
  }
  redirect("/");
}
export async function endSupportAccess() {
  const { supabase } = await requireUser();
  const ended = await supabase.rpc("end_support_session");
  if (ended.error) throw new Error("Não foi possível encerrar o suporte agora.");
  await supabase.auth.signOut({ scope: "local" });
  redirect("https://admin.mosaic-labs.co/lessonara/accounts");
}
