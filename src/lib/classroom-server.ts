import { teacherSessionValid } from "./teacher-session";
import "server-only";
import { loadTeacherPlan } from "./platform-plan-server";
import { authorizedStudent } from "./student-access";
import { createAdminClient, createClient } from "./supabase/server";
import { loadLedgers } from "./data";
import { classroomRefValid, type ClassroomRef } from "./classroom";
import type { ClassroomParticipant, JitsiConfig } from "./classroom-token";

export function getJitsiConfig(): JitsiConfig | null {
  const { JITSI_URL, JITSI_APP_ID, JITSI_APP_SECRET } = process.env;
  if (!JITSI_URL || !JITSI_APP_ID || !JITSI_APP_SECRET || JITSI_APP_SECRET.length < 32) return null;
  try {
    const url = new URL(JITSI_URL);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      return null;
    return { url: url.origin, appId: JITSI_APP_ID, appSecret: JITSI_APP_SECRET };
  } catch {
    return null;
  }
}

/** O cliente nunca fornece o papel, a duração ou o nome da sala. */
export async function loadClassroomAccess(ref: ClassroomRef) {
  if (!classroomRefValid(ref)) return null;
  const db = createAdminClient();
  const sessionClient = await createClient();
  const { data, error } = await sessionClient.auth.getClaims();
  if (error) throw new Error("Não foi possível verificar seu acesso.");
  const teacher =
    data?.claims?.sub && (await teacherSessionValid(sessionClient, data.claims))
      ? await sessionClient
          .from("teachers")
          .select("id,name")
          .eq("id", data.claims.sub)
          .maybeSingle()
      : null;
  if (teacher?.error) throw new Error("Não foi possível verificar seu acesso.");
  const findTarget = (teacherId: string) =>
    db
      .from("students")
      .select("id,name,slug,teacher_id")
      .eq("id", ref.studentId)
      .eq("teacher_id", teacherId)
      .eq("active", true)
      .maybeSingle();
  // Se ambas as sessões estiverem abertas neste navegador, o dono da turma entra
  // como professor. Uma sessão de aluno nunca promove seu titular a moderador.
  let target = teacher?.data ? await findTarget(teacher.data.id) : null;
  if (target?.error) throw new Error("Não foi possível verificar a aula.");
  let participant: ClassroomParticipant | null = target?.data
    ? { id: teacher!.data!.id, name: teacher!.data!.name, role: "teacher" }
    : null;
  if (!participant) {
    const access = await authorizedStudent(ref.studentId);
    if (!access) return null;
    target = await findTarget(access.teacher_id);
    if (target.error) throw new Error("Não foi possível verificar a aula.");
    if (!target.data) return null;
    participant = { id: access.id, name: target.data.name, role: "student" };
  }
  if (!target?.data) return null;
  const { ledger } = (await loadLedgers(db, [target.data.id])).get(target.data.id)!;
  const lesson = ledger.lessons.find(
    (l) => l.sourceKind === ref.sourceKind && l.sourceId === ref.sourceId && l.date === ref.date,
  );
  if (!lesson) return null;
  const backHref =
    participant.role === "teacher"
      ? `/students/${target.data.id}`
      : `/p/${target.data.teacher_id}/s/${encodeURIComponent(target.data.slug)}`;
  const plan = await loadTeacherPlan(target.data.teacher_id, db);
  return { participant, lesson, backHref, platformPlan: plan.id, roomAllowed: plan.classroom };
}
