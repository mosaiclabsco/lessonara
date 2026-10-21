export const NAME_LIMIT = 120;
export const NOTES_LIMIT = 4000;
export class FormValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
  }
}
export type FormFailure = { validation: { field: string; message: string } };
export function isFormFailure(value: unknown): value is FormFailure {
  if (!value || typeof value !== "object" || !("validation" in value)) return false;
  const validation = value.validation;
  return Boolean(
    validation &&
    typeof validation === "object" &&
    "field" in validation &&
    "message" in validation &&
    typeof validation.field === "string" &&
    typeof validation.message === "string",
  );
}
export async function validatedAction(action: () => Promise<void>): Promise<void | FormFailure> {
  try {
    await action();
  } catch (error) {
    if (error instanceof FormValidationError)
      return { validation: { field: error.field, message: error.message } };
    throw error;
  }
}
export function textValue(
  value: unknown,
  field: string,
  max: number,
  required = false,
  multiline = false,
): string {
  if (value === null || value === undefined) value = "";
  if (typeof value !== "string") throw new FormValidationError(field, "Informe um texto válido.");
  const text = value.trim();
  if (
    (required && !text) ||
    text.length > max ||
    (multiline ? /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/ : /[\x00-\x1f\x7f]/).test(text)
  )
    throw new FormValidationError(
      field,
      `Preencha este campo${required ? " obrigatório" : ""} com até ${max} caracteres válidos.`,
    );
  return text;
}
export function formText(
  form: FormData,
  field: string,
  max = NOTES_LIMIT,
  required = false,
  multiline = false,
) {
  return textValue(form.get(field), field, max, required, multiline);
}
export function integerValue(value: unknown, field: string, min: number, max: number) {
  if ((typeof value !== "string" && typeof value !== "number") || !/^\d+$/.test(String(value)))
    throw new FormValidationError(field, `Informe um número inteiro de ${min} a ${max}.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max)
    throw new FormValidationError(field, `Informe um número inteiro de ${min} a ${max}.`);
  return number;
}
export function isoDate(value: unknown, field = "date") {
  if (typeof value !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value))
    throw new FormValidationError(field, "Escolha uma data válida.");
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new FormValidationError(field, "Escolha uma data válida.");
  return value;
}
export function fieldValue<T>(field: string, read: () => T): T {
  try {
    return read();
  } catch (error) {
    if (error instanceof FormValidationError) throw error;
    throw new FormValidationError(
      field,
      error instanceof Error ? error.message : "Confira este campo.",
    );
  }
}
export function uuidValue(value: string, field: string, optional = false) {
  if (optional && !value) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
    throw new FormValidationError(field, "Escolha um registro válido.");
  return value;
}
