import { TEACHER_PASSWORD_MIN_LENGTH, TEACHER_PASSWORD_MAX_LENGTH } from "./password-policy";
export { passwordLinkInput } from "./teacher-password-input";
import { seal, unseal } from "./mail/crypto";
export const PASSWORD_SETUP_COOKIE = "lessonara-password-setup";
export const PASSWORD_SETUP_PATH = "/login/password";
export type PasswordSetup = {
  userId: string;
  email: string;
  tokenHash: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};
export function newTeacherPassword(form: FormData) {
  const password = form.get("password"),
    confirmation = form.get("confirmation");
  if (
    typeof password !== "string" ||
    Array.from(password).length < TEACHER_PASSWORD_MIN_LENGTH ||
    password.length > TEACHER_PASSWORD_MAX_LENGTH
  )
    throw new Error(
      `Use uma senha com pelo menos ${TEACHER_PASSWORD_MIN_LENGTH} caracteres e no máximo ${TEACHER_PASSWORD_MAX_LENGTH}.`,
    );
  if (password !== confirmation) throw new Error("As senhas não conferem.");
  return password;
}
export function readPasswordSetup(
  value: string | undefined,
  now = Date.now(),
): PasswordSetup | null {
  if (!value) return null;
  try {
    const data = unseal<PasswordSetup>(value, "teacher-password");
    if (
      !data ||
      typeof data.userId !== "string" ||
      typeof data.email !== "string" ||
      typeof data.tokenHash !== "string" ||
      typeof data.accessToken !== "string" ||
      typeof data.refreshToken !== "string" ||
      !Number.isFinite(data.expiresAt) ||
      data.expiresAt <= now ||
      data.expiresAt > now + 15 * 60_000
    )
      return null;
    return data;
  } catch {
    return null;
  }
}
export function encodePasswordSetup(data: PasswordSetup) {
  const encoded = seal(data, "teacher-password");
  if (encoded.length > 3800)
    throw new Error("Não foi possível preparar o acesso. Solicite um novo link.");
  return encoded;
}
