"use server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { hashSession } from "@/lib/mail/crypto";
import {
  STUDENT_COOKIE,
  CHALLENGE_COOKIE,
  SESSION_SECONDS,
  studentCookieOptions,
} from "@/lib/student-access";
export async function acceptInvite(_previous: { error?: string } | null, form: FormData) {
  const invite = String(form.get("token") ?? "");
  if (!/^[A-Za-z\d_-]{43}$/.test(invite))
    return { error: "Convite inválido ou expirado. Entre pelo código enviado ao seu email." };
  const token = randomBytes(32).toString("base64url");
  const db = createAdminClient();
  const opened = await db.rpc("open_student_invite", {
    p_invite_hash: hashSession(invite),
    p_session_hash: hashSession(token),
  });
  if (opened.error || !opened.data)
    return { error: "Convite inválido ou expirado. Entre pelo código enviado ao seu email." };
  const jar = await cookies();
  const old = jar.get(STUDENT_COOKIE)?.value;
  if (old) await db.from("student_sessions").delete().eq("token_hash", hashSession(old));
  jar.set(STUDENT_COOKIE, token, { ...studentCookieOptions, maxAge: SESSION_SECONDS });
  jar.delete(CHALLENGE_COOKIE);
  redirect(`/p/${opened.data.teacher_id}/s/${encodeURIComponent(opened.data.slug)}`);
}
