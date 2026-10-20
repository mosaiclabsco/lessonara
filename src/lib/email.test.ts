import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn(), constructor: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    constructor(key: string) {
      mocks.constructor(key);
    }
    emails = { send: mocks.send };
  },
}));

import { sendEmail } from "./email";

const email = {
  to: "aluno@example.com",
  subject: "Renovação",
  html: "<p>Seu pacote está acabando.</p>",
  replyTo: "professora@example.com",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("EMAIL_FROM", "Lessonara <aulas@example.com>");
});
afterEach(() => vi.unstubAllEnvs());

it("envia com a chave do ambiente e mantém o endereço de resposta da professora", async () => {
  mocks.send.mockResolvedValue({ data: { id: "email-id" }, error: null });
  expect(await sendEmail(email)).toEqual({ id: "email-id" });
  expect(mocks.constructor).toHaveBeenCalledWith("re_test_key");
  expect(mocks.send).toHaveBeenCalledWith({ ...email, from: "Lessonara <aulas@example.com>" });
});

it("propaga a rejeição da API para o cron não registrar um lembrete como enviado", async () => {
  mocks.send.mockResolvedValue({
    data: null,
    error: { name: "validation_error", message: "Remetente não verificado" },
  });
  await expect(sendEmail(email)).rejects.toThrow("validation_error");
});

it("exige a chave antes de tentar enviar", async () => {
  vi.stubEnv("RESEND_API_KEY", "");
  await expect(sendEmail(email)).rejects.toThrow("RESEND_API_KEY não configurada");
  expect(mocks.send).not.toHaveBeenCalled();
});

it("usa o remetente de onboarding quando nenhum remetente foi configurado", async () => {
  vi.stubEnv("EMAIL_FROM", "");
  mocks.send.mockResolvedValue({ data: { id: "email-id" }, error: null });
  await sendEmail(email);
  expect(mocks.send).toHaveBeenCalledWith(
    expect.objectContaining({ from: "Lessonara <onboarding@resend.dev>" }),
  );
});

it("retries usam a chave de idempotência do mesmo trabalho", async () => {
  mocks.send.mockResolvedValue({ data: { id: "email-id" }, error: null });
  await sendEmail(email, "job-1");
  expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: email.to }), {
    idempotencyKey: "job-1",
  });
});
