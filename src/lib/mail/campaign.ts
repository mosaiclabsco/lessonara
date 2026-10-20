const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export function validateCampaign(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("Campanha inválida.");
  const value = input as Record<string, unknown>;
  if (
    typeof value.id !== "string" ||
    !uuid.test(value.id) ||
    typeof value.subject !== "string" ||
    typeof value.message !== "string" ||
    !Array.isArray(value.students) ||
    value.students.length < 1 ||
    value.students.length > 100 ||
    value.students.some((s) => typeof s !== "string" || !uuid.test(s))
  )
    throw new Error("Preencha o assunto, a mensagem e selecione de 1 a 100 alunos.");
  const subject = value.subject.trim(),
    message = value.message.trim();
  if (
    !subject ||
    subject.length > 120 ||
    /[\x00-\x1f\x7f]/.test(subject) ||
    !message ||
    message.length > 10000 ||
    message.includes("\x00")
  )
    throw new Error(
      "Use um assunto de até 120 caracteres e uma mensagem de até 10.000 caracteres.",
    );
  return { id: value.id, subject, message, students: [...new Set(value.students as string[])] };
}
