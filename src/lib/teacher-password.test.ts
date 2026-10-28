import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { encodePasswordSetup, readPasswordSetup, newTeacherPassword } from "./teacher-password";
import { passwordLinkInput } from "./teacher-password-input";
beforeEach(() => {
  vi.stubEnv("EMAIL_ENCRYPTION_KEY", "1".repeat(64));
  vi.stubEnv("SEAL_WRITE_VERSION", "v2");
  vi.stubEnv("EMAIL_ACCEPT_PREVIOUS_ENVELOPES", "true");
});
afterAll(() => vi.unstubAllEnvs());
const setup = () => ({
  userId: "teacher",
  email: "teacher@example.test",
  tokenHash: "a".repeat(64),
  accessToken: "access",
  refreshToken: "refresh",
  expiresAt: Date.now() + 600000,
});
it("aceita somente tipos de convite/recuperação, sem destino fornecido pelo cliente", () => {
  expect(passwordLinkInput("a".repeat(64), "invite")).toBeTruthy();
  expect(passwordLinkInput("a".repeat(64), "recovery")).toBeTruthy();
  for (const type of ["magiclink", "email", "signup", "https://evil.test"])
    expect(passwordLinkInput("a".repeat(64), type)).toBeNull();
  expect(passwordLinkInput("https://evil.test", "invite")).toBeNull();
});
it("exige tamanho e confirmação sem modificar a senha escolhida", () => {
  const f = new FormData();
  f.set("password", "curta");
  f.set("confirmation", "curta");
  expect(() => newTeacherPassword(f)).toThrow();
  f.set("password", " frase longa e exclusiva ");
  f.set("confirmation", " frase longa e exclusiva ");
  expect(newTeacherPassword(f)).toBe(" frase longa e exclusiva ");
  f.set("confirmation", "outra senha longa");
  expect(() => newTeacherPassword(f)).toThrow();
});
it("contexto temporário é autenticado e expira, inclusive após adulteração", () => {
  const data = setup(),
    value = encodePasswordSetup(data);
  expect(value).not.toContain(data.accessToken);
  expect(readPasswordSetup(value)?.userId).toBe("teacher");
  expect(readPasswordSetup(value, data.expiresAt + 1)).toBeNull();
  expect(readPasswordSetup(value.slice(0, -8) + "alterado")).toBeNull();
});
it("recusa contexto maior que um cookie seguro", () => {
  expect(() => encodePasswordSetup({ ...setup(), accessToken: "x".repeat(6000) })).toThrow();
});

it("aceita 8 caracteres e recusa 7 ou confirmação divergente", () => {
  const f = new FormData();
  f.set("password", "Teste#83");
  f.set("confirmation", "Teste#83");
  expect(newTeacherPassword(f)).toBe("Teste#83");
  f.set("password", "Teste#8");
  f.set("confirmation", "Teste#8");
  expect(() => newTeacherPassword(f)).toThrow(/8 caracteres/);
  f.set("password", "Teste#83");
  expect(() => newTeacherPassword(f)).toThrow(/não conferem/);
});
