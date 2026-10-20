import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "./supabase/server";
import { hashSession } from "./mail/crypto";

export const STUDENT_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-lessonara_student" : "lessonara_student";
export const CHALLENGE_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-lessonara_code" : "lessonara_code";
export const SESSION_SECONDS = 30 * 24 * 60 * 60;
export const studentCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

type Session = { id: string; email: string; expires_at: string };
export async function getStudentSession(): Promise<Session | null> {
  const token = (await cookies()).get(STUDENT_COOKIE)?.value;
  if (!token || !/^[A-Za-z\d_-]{43}$/.test(token)) return null;
  const { data, error } = await createAdminClient()
    .from("student_sessions")
    .select("id,email,expires_at")
    .eq("token_hash", hashSession(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<Session>();
  if (error) throw new Error("Não foi possível verificar sua sessão. Tente novamente.");
  return data;
}

/** A URL identifica o cadastro, mas nunca autoriza acesso sozinha. */
export async function authorizedStudent(identifier: string, kind: "id" | "slug" = "id") {
  const session = await getStudentSession();
  if (!session) return null;
  const db = createAdminClient();
  const student = await db
    .from("students")
    .select("id,teacher_id,slug,email,access_version")
    .eq(kind, identifier)
    .eq("active", true)
    .maybeSingle();
  if (student.error) throw new Error("Não foi possível verificar o aluno.");
  if (!student.data || student.data.email?.trim().toLowerCase() !== session.email) return null;
  const link = await db
    .from("student_session_links")
    .select("student_id")
    .eq("session_id", session.id)
    .eq("student_id", student.data.id)
    .eq("access_version", student.data.access_version)
    .maybeSingle();
  if (link.error) throw new Error("Não foi possível verificar o vínculo do aluno.");
  return link.data ? student.data : null;
}

export async function startStudentSession(
  challengeId: string,
  authUserId: string,
  studentId: string,
) {
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await createAdminClient().rpc("open_student_session", {
    p_challenge: challengeId,
    p_auth_user: authUserId,
    p_token_hash: hashSession(token),
    p_student: studentId,
  });
  if (error || !data) return false;
  const jar = await cookies();
  const previous = jar.get(STUDENT_COOKIE)?.value;
  if (previous)
    await createAdminClient()
      .from("student_sessions")
      .delete()
      .eq("token_hash", hashSession(previous));
  jar.set(STUDENT_COOKIE, token, { ...studentCookieOptions, maxAge: SESSION_SECONDS });
  jar.delete(CHALLENGE_COOKIE);
  return true;
}
