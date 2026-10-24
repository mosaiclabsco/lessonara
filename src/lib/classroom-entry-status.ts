import "server-only";
import { createAdminClient } from "./supabase/server";
import { type Lesson } from "./ledger";
export async function hasClassroomParticipation(
  teacherId: string,
  studentId: string,
  participantId: string,
  role: "teacher" | "student",
  lesson: Lesson,
) {
  const result = await createAdminClient()
    .from("classroom_participation")
    .select("joined_at")
    .match({
      teacher_id: teacherId,
      student_id: studentId,
      participant_id: participantId,
      participant_role: role,
      source_kind: lesson.sourceKind,
      source_id: lesson.sourceId,
      lesson_date: lesson.date,
    })
    .not("joined_at", "is", null)
    .maybeSingle();
  if (result.error) throw new Error("Não foi possível consultar a participação na sala.");
  return Boolean(result.data);
}
