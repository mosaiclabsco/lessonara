"use server";
import { authorizedStudent } from "@/lib/student-access";
import {
  beginActivitySubmission as begin,
  cancelActivitySubmission as cancel,
  finishActivitySubmission as finish,
} from "@/app/student/actions";
export async function beginActivitySubmission(
  slug: string,
  activityId: string,
  input: { fileName: string; byteSize: number },
) {
  const student = await authorizedStudent(slug, "slug");
  if (!student)
    return { ok: false as const, message: "Entre na sua conta para enviar a atividade." };
  return begin(student.id, activityId, input);
}
export async function cancelActivitySubmission(slug: string, activityId: string) {
  const student = await authorizedStudent(slug, "slug");
  if (!student) return { ok: false as const, message: "Acesso não autorizado." };
  return cancel(student.id, activityId);
}
export async function finishActivitySubmission(
  slug: string,
  activityId: string,
  submissionId: string,
  note: string,
) {
  const student = await authorizedStudent(slug, "slug");
  if (!student) return { ok: false as const, message: "Acesso não autorizado." };
  return finish(student.id, activityId, submissionId, note);
}
