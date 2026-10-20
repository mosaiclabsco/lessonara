import { Resend } from "resend";

export class EmailSendError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(`Falha no envio: ${code}.`);
  }
}
export type EmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  from?: string;
};

/** Único ponto de contato com o provedor. A outbox controla a persistência e o retry. */
export async function sendEmail(input: EmailInput, idempotencyKey?: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new EmailSendError("RESEND_API_KEY não configurada", false);
  const resend = new Resend(apiKey);
  let result;
  try {
    const body = {
      ...input,
      replyTo: input.replyTo || process.env.EMAIL_REPLY_TO,
      from: input.from || process.env.EMAIL_FROM || "Lessonara <onboarding@resend.dev>",
    };
    result = idempotencyKey
      ? await resend.emails.send(body, { idempotencyKey })
      : await resend.emails.send(body);
  } catch {
    throw new EmailSendError("network_error", true);
  }
  if (result.error) {
    const code = result.error.name;
    throw new EmailSendError(
      code,
      [
        "rate_limit_exceeded",
        "application_error",
        "internal_server_error",
        "service_unavailable",
        "concurrent_idempotent_requests",
      ].includes(code),
    );
  }
  if (!result.data?.id) throw new EmailSendError("missing_confirmation", true);
  return result.data;
}
