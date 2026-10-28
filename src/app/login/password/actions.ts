"use server";
import { TEACHER_PASSWORD_MIN_LENGTH } from "@/lib/password-policy";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { fingerprint } from "@/lib/mail/crypto";
import {
  encodePasswordSetup,
  newTeacherPassword,
  PASSWORD_SETUP_COOKIE,
  PASSWORD_SETUP_PATH,
  passwordLinkInput,
  readPasswordSetup,
} from "@/lib/teacher-password";
export type PasswordState = { error?: string; done?: boolean } | null;
export async function defineTeacherPassword(
  _previous: PasswordState,
  form: FormData,
): Promise<PasswordState> {
  try {
    return await performPasswordChange(form);
  } catch {
    console.error("teacher_password_request_failed");
    return { error: "Não foi possível concluir agora. Tente novamente em alguns instantes." };
  }
}
async function performPasswordChange(form: FormData): Promise<PasswordState> {
  let password: string;
  try {
    password = newTeacherPassword(form);
  } catch (error) {
    return { error: (error as Error).message };
  }
  const cookieStore = await cookies();
  const oldSetup = readPasswordSetup(cookieStore.get(PASSWORD_SETUP_COOKIE)?.value);
  const link = passwordLinkInput(form.get("token_hash"), form.get("type"));
  const setup = oldSetup && (!link || oldSetup.tokenHash === link.token_hash) ? oldSetup : null;
  if (!setup && !link)
    return {
      error:
        "Abra o link recebido por email. Se ele expirou, solicite o reenvio ao responsável pelo convite.",
    };
  const ip = process.env.VERCEL
    ? (await headers()).get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    : "local";
  const db = createAdminClient();
  const allowed = await db.rpc("allow_student_auth", {
    p_keys: [
      `teacher-password/ip/${fingerprint(ip)}`,
      `teacher-password/link/${fingerprint(setup?.tokenHash ?? link!.token_hash)}`,
    ],
    p_limits: [30, 8],
    p_seconds: [900, 900],
  });
  if (allowed.error || allowed.data !== true)
    return { error: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente." };
  // This client is isolated: redeeming a link never writes a normal teacher session.
  const auth = createAdminClient(ip);
  const verified = setup
    ? await auth.auth.setSession({
        access_token: setup.accessToken,
        refresh_token: setup.refreshToken,
      })
    : await auth.auth.verifyOtp(link!);
  const session = verified.data?.session,
    user = verified.data?.user;
  if (verified.error || !session || !user || (setup && setup.userId !== user.id)) {
    cookieStore.set(PASSWORD_SETUP_COOKIE, "", { path: PASSWORD_SETUP_PATH, maxAge: 0 });
    return { error: "Este link expirou ou já foi utilizado. Solicite um novo convite." };
  }
  const teacher = await db.from("teachers").select("id,email").eq("id", user.id).maybeSingle();
  if (
    teacher.error ||
    !teacher.data ||
    teacher.data.email.toLowerCase() !== user.email?.toLowerCase()
  ) {
    await auth.auth.signOut({ scope: "local" });
    return {
      error: "Não foi possível concluir o acesso de professor. Entre em contato com o suporte.",
    };
  }
  const expiresAt =
    setup?.expiresAt ??
    Math.min(
      (session.expires_at ?? Math.floor(Date.now() / 1000) + 900) * 1000,
      Date.now() + 15 * 60_000,
    );
  try {
    cookieStore.set(
      PASSWORD_SETUP_COOKIE,
      encodePasswordSetup({
        userId: user.id,
        email: user.email!,
        tokenHash: setup?.tokenHash ?? link!.token_hash,
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: PASSWORD_SETUP_PATH,
        maxAge: Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
      },
    );
  } catch {
    return { error: "Não foi possível preparar o acesso. Solicite um novo link." };
  }
  const changed = await auth.auth.updateUser({ password });
  if (changed.error)
    return {
      error:
        changed.error.code === "same_password"
          ? "Escolha uma senha diferente da atual."
          : `A senha não foi aceita. Use uma senha forte com pelo menos ${TEACHER_PASSWORD_MIN_LENGTH} caracteres e tente novamente.`,
    };
  // Only server-owned metadata records completion; it grants no product entitlements.
  const recorded = await db.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, teacher_password_defined_at: new Date().toISOString() },
  });
  if (recorded.error) console.error("teacher_password_completion_metadata_failed");
  await auth.auth.signOut({ scope: "global" });
  cookieStore.set(PASSWORD_SETUP_COOKIE, "", { path: PASSWORD_SETUP_PATH, maxAge: 0 });
  return { done: true };
}
