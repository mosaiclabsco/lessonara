import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { seal, unseal, fingerprint } from "./crypto";
import { otpEmail, welcomeEmail, reminderEmail } from "./templates";
beforeEach(() => {
  vi.stubEnv("EMAIL_ENCRYPTION_KEY", "01".repeat(32));
  vi.stubEnv("APP_URL", "https://lessonara.example");
});
afterEach(() => vi.unstubAllEnvs());
it("códigos ficam criptografados e adulteração é rejeitada", () => {
  const encoded = seal({ code: "123456" }, "otp");
  expect(encoded).not.toContain("123456");
  expect(unseal(encoded, "otp")).toEqual({ code: "123456" });
  const corrupt = Buffer.from(encoded.split(".")[2], "base64url");
  corrupt[30] ^= 1;
  expect(() => unseal(`v2.otp.${corrupt.toString("base64url")}`, "otp")).toThrow();
});
it("não expõe IP/email nos contadores", () => {
  expect(fingerprint("alice@example.com")).toHaveLength(64);
  expect(fingerprint("alice@example.com")).not.toContain("alice");
});
it("templates escapam nomes e nenhum convite contém segredo do aluno", () => {
  const welcome = welcomeEmail('<img src=x onerror="alert(1)">', "Prof <script>");
  expect(welcome.html).not.toContain("<img src=x");
  expect(welcome.html.match(/<img\b/g)).toHaveLength(1);
  expect(welcome.html).toContain('src="https://lessonara.example/brand/complete-logo.png"');
  expect(welcome.html).toContain("&lt;img");
  expect(welcome.html).toContain("https://lessonara.example/student");
  expect(welcome.html).not.toContain("/a/");
  expect(reminderEmail("Aluno", "Prof", "Fim").html).not.toContain("/a/");
});
it("OTP tem código, prazo e aviso contra compartilhamento", () => {
  const otp = otpEmail("123456");
  expect(otp.text).toContain("123456");
  expect(otp.html).toContain("10 minutos");
});

it("boas-vindas e lembretes usam o link do professor e do aluno, sem segredo de sessão", () => {
  const args = ["Aluno", "Prof", "teacher-id", "random-student"] as const;
  expect(welcomeEmail(...args).html).toContain("https://lessonara.example/a/random-student");
  expect(reminderEmail("Aluno", "Prof", "Renove", "teacher-id", "random-student").text).toContain(
    "/a/random-student",
  );
});

it("emails declare a light presentation independently of the portal theme", () => {
  for (const email of [
    otpEmail("123456"),
    welcomeEmail("Aluno", "Prof"),
    reminderEmail("Aluno", "Prof", "Renovação"),
  ]) {
    expect(email.html).toContain('name="color-scheme" content="light only"');
    expect(email.html).toContain('bgcolor="#ffffff"');
    expect(email.html).not.toContain("complete-logo-dark");
  }
});
