"use server";
import { revalidatePath } from "next/cache";
import { requirePlatformFeature } from "@/lib/platform-plan-server";
import { createAdminClient, requireUser } from "@/lib/supabase/server";
import { isoDate } from "@/lib/form-validation";
import { nowInTZ, addDays } from "@/lib/dates";
import {
  listGoogleLessonChoices,
  readGoogleLessonPreview,
  validGoogleEventId,
} from "@/lib/google/lesson-links";
async function ownedStudent(studentId: string) {
  const account = await requirePlatformFeature("google");
  const student = await account.supabase
    .from("students")
    .select("id")
    .eq("id", studentId)
    .eq("teacher_id", account.userId)
    .eq("active", true)
    .maybeSingle();
  if (student.error || !student.data) throw new Error("Aluno não encontrado nesta conta.");
  return account;
}
function initialDate(value: string) {
  const date = isoDate(value, "starts_on"),
    today = nowInTZ().today;
  if (date < today || date > addDays(today, 365))
    throw new Error("Escolha uma data inicial a partir de hoje.");
  return date;
}
async function listGoogleLessonsImpl(studentId: string, from: string) {
  const { userId, supabase } = await ownedStudent(studentId);
  const choices = await listGoogleLessonChoices(userId, initialDate(from));
  const links = await supabase
    .from("google_lesson_links")
    .select("event_id")
    .eq("teacher_id", userId)
    .eq("active", true);
  if (links.error) throw new Error("Não foi possível consultar os vínculos Google.");
  const used = new Set((links.data ?? []).map((l) => l.event_id));
  return choices.filter((c) => !used.has(c.id));
}
async function previewGoogleLessonImpl(studentId: string, eventId: string, from: string) {
  const { userId } = await ownedStudent(studentId);
  if (!validGoogleEventId(eventId)) throw new Error("Escolha um evento Google válido.");
  return readGoogleLessonPreview(userId, eventId, initialDate(from));
}
async function linkGoogleLessonImpl(studentId: string, eventId: string, from: string) {
  const { userId } = await ownedStudent(studentId);
  const startsOn = initialDate(from);
  // Re-read Google at confirmation: titles, times and attendees never come from the client.
  const preview = await readGoogleLessonPreview(userId, eventId, startsOn);
  if (!preview.instances.length) throw new Error("Não há aulas futuras neste intervalo.");
  const result = await createAdminClient().rpc("apply_google_lesson_link", {
    p_teacher: userId,
    p_student: studentId,
    p_event: eventId,
    p_title: preview.title,
    p_recurring: preview.recurring,
    p_starts: startsOn,
    p_until: preview.until,
    p_instances: preview.instances,
  });
  if (result.error)
    throw new Error(
      result.error.code === "23505"
        ? "Este evento já está vinculado ou conflita com uma aula do aluno."
        : [
              "O vínculo excede a quantidade de aulas do plano neste período.",
              "Já existe uma aula nesse horário.",
              "Já existe uma aula fixa nesse horário.",
              "Já existe uma reposição nesse horário.",
              "Escolha o plano do aluno antes de agendar.",
            ].includes(result.error.message)
          ? result.error.message
          : "Não foi possível vincular a aula. Atualize a prévia e tente novamente.",
    );
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/", "layout");
}
async function unlinkGoogleLessonImpl(studentId: string, linkId: string) {
  // Downgraded teachers retain the right to remove their own local links.
  const { userId, supabase } = await requireUser();
  const link = await supabase
    .from("google_lesson_links")
    .select("id")
    .eq("id", linkId)
    .eq("student_id", studentId)
    .eq("teacher_id", userId)
    .maybeSingle();
  if (link.error || !link.data) throw new Error("Vínculo não encontrado nesta conta.");
  const result = await createAdminClient().rpc("unlink_google_lesson", {
    p_teacher: userId,
    p_student: studentId,
    p_link: linkId,
  });
  if (result.error) throw new Error("Não foi possível desvincular a aula.");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/", "layout");
}

export async function listGoogleLessons(studentId: string, from: string) {
  return actionResult(() => listGoogleLessonsImpl(studentId, from));
}

export async function previewGoogleLesson(studentId: string, eventId: string, from: string) {
  return actionResult(() => previewGoogleLessonImpl(studentId, eventId, from));
}

export async function linkGoogleLesson(studentId: string, eventId: string, from: string) {
  return actionResult(() => linkGoogleLessonImpl(studentId, eventId, from));
}

export async function unlinkGoogleLesson(studentId: string, linkId: string) {
  return actionResult(() => unlinkGoogleLessonImpl(studentId, linkId));
}

async function actionResult<T>(
  work: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível consultar os eventos Google. Tente novamente.",
    };
  }
}
