import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { hashSession } from "./crypto";
import { studentLoginUrl } from "./templates";
export async function createWelcomeInvite(student: {
  id: string;
  teacher_id: string;
  email: string;
  access_version: number;
}) {
  const db = createAdminClient();
  const existing = await db.rpc("find_student_auth_user", { p_email: student.email });
  if (existing.error) throw new Error("Não foi possível preparar o convite.");
  let authId = existing.data as string | null;
  if (!authId) {
    const created = await db.auth.admin.createUser({
      email: student.email,
      app_metadata: { role: "student" },
      email_confirm: false,
    });
    if (created.error) {
      const retry = await db.rpc("find_student_auth_user", { p_email: student.email });
      if (retry.error || !retry.data) throw new Error("Não foi possível preparar o convite.");
      authId = retry.data;
    } else authId = created.data.user.id;
  }
  const token = randomBytes(32).toString("base64url");
  const inserted = await db.from("student_invites").insert({
    token_hash: hashSession(token),
    student_id: student.id,
    teacher_id: student.teacher_id,
    auth_user_id: authId,
    email: student.email,
    access_version: student.access_version,
  });
  if (inserted.error) throw new Error("Não foi possível guardar o convite.");
  const origin = new URL(studentLoginUrl()).origin;
  return `${origin}/student/invite/${token}`;
}
