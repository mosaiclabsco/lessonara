import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  send: vi.fn(),
  updates: vi.fn(),
  student: vi.fn(),
  challenge: vi.fn(),
  claim: vi.fn(),
  plan: vi.fn(),
  ledger: vi.fn(),
}));
vi.mock("../data", () => ({ loadLedgers: mocks.ledger }));
vi.mock("./welcome-invite", () => ({
  createWelcomeInvite: vi
    .fn()
    .mockResolvedValue("https://lessonara.example/student/invite/test-invite"),
}));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/email", async (original) => {
  const emailModule = await original<typeof import("@/lib/email")>();
  return { ...emailModule, sendEmail: mocks.send };
});
vi.mock("../platform-plan-server", () => ({ loadTeacherPlan: mocks.plan }));
import { processEmails } from "./outbox";
import { seal } from "./crypto";
import { EmailSendError } from "../email";
const base = {
  id: "job",
  event_key: "welcome/student/1",
  lease_id: "lease",
  student_id: "student",
  recipient: "alice@example.com",
  template: "welcome",
  payload: {},
  attempts: 1,
  delivery: null,
  expires_at: "2026-10-09T12:00:00Z",
};
function db() {
  return {
    rpc: mocks.claim,
    from(table: string) {
      let values: unknown;
      const query = {
        select() {
          return query;
        },
        eq() {
          return query;
        },
        is() {
          return query;
        },
        gt() {
          return query;
        },
        update(value: unknown) {
          values = value;
          return query;
        },
        async maybeSingle() {
          return table === "students" ? mocks.student() : mocks.challenge();
        },
        then(resolve: (value: unknown) => unknown) {
          mocks.updates(values);
          return Promise.resolve({ error: null }).then(resolve);
        },
      };
      return query;
    },
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.plan.mockResolvedValue({ id: "pro", emails: true });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
  vi.stubEnv("EMAIL_ENCRYPTION_KEY", "01".repeat(32));
  vi.stubEnv("EMAIL_FROM", "Lessonara <aulas@example.com>");
  vi.stubEnv("APP_URL", "https://lessonara.example");
  mocks.admin.mockReturnValue(db());
  mocks.claim.mockResolvedValue({ data: [base], error: null });
  mocks.student.mockResolvedValue({
    data: {
      teacher_id: "teacher",
      name: "Alice",
      email: "alice@example.com",
      active: true,
      teachers: { name: "Prof", email: "teacher@example.com" },
    },
    error: null,
  });
  mocks.challenge.mockResolvedValue({ data: { id: "challenge" }, error: null });
  mocks.send.mockResolvedValue({ id: "provider" });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
it("revalida aluno e envia com idempotência, registrando aceitação sem guardar conteúdo", async () => {
  expect(await processEmails()).toEqual({ sent: 1, failed: 0, pending: 0, cancelled: 0 });
  expect(mocks.send).toHaveBeenCalledWith(
    expect.objectContaining({ to: "alice@example.com" }),
    "lessonara/job",
  );
  expect(mocks.updates).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "sent",
      provider_id: "provider",
      payload: {},
      delivery: null,
    }),
  );
});
it("erro temporário mantém corpo criptografado para retry com backoff", async () => {
  mocks.send.mockRejectedValue(new EmailSendError("rate_limit_exceeded", true));
  expect((await processEmails()).pending).toBe(1);
  expect(mocks.updates).toHaveBeenCalledWith(
    expect.objectContaining({ status: "pending", available_at: "2026-10-08T12:00:30.000Z" }),
  );
});
it("falha permanente não é reenviada automaticamente", async () => {
  mocks.send.mockRejectedValue(new EmailSendError("validation_error", false));
  expect((await processEmails()).failed).toBe(1);
  expect(mocks.updates).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "failed",
      last_error: "validation_error",
      delivery: null,
      payload: {},
    }),
  );
});
it("retry preserva o remetente e conteúdo originais", async () => {
  const body = {
    to: "alice@example.com",
    from: "Lessonara <old@example.com>",
    subject: "Original",
    html: "Texto",
    text: "Texto",
  };
  mocks.claim.mockResolvedValue({
    data: [{ ...base, delivery: { sealed: seal(body, "mail-delivery") } }],
    error: null,
  });
  await processEmails();
  expect(mocks.send).toHaveBeenCalledWith(body, "lessonara/job");
});
it.each([
  { email: "changed@example.com", active: true },
  { email: "alice@example.com", active: false },
])("não envia convite obsoleto ao mudar cadastro", async (student) => {
  mocks.student.mockResolvedValue({ data: student, error: null });
  expect((await processEmails()).cancelled).toBe(1);
  expect(mocks.send).not.toHaveBeenCalled();
});
it("código consumido/substituído não sai da fila mesmo que exista um corpo pronto", async () => {
  mocks.claim.mockResolvedValue({
    data: [
      {
        ...base,
        student_id: null,
        template: "otp",
        event_key: "otp/challenge",
        payload: { sealed: seal({ code: "123456" }, "otp") },
      },
    ],
    error: null,
  });
  mocks.challenge.mockResolvedValue({ data: null, error: null });
  expect((await processEmails()).cancelled).toBe(1);
  expect(mocks.send).not.toHaveBeenCalled();
});
it("não envia OTP se o prazo terminar durante o processamento", async () => {
  mocks.claim.mockResolvedValue({
    data: [
      {
        ...base,
        student_id: null,
        template: "otp",
        event_key: "otp/challenge",
        expires_at: "2026-10-08T11:59:59Z",
        payload: { sealed: seal({ code: "123456" }, "otp") },
      },
    ],
    error: null,
  });
  expect((await processEmails()).failed).toBe(1);
  expect(mocks.send).not.toHaveBeenCalled();
});

it("mudança para plano sem emails cancela lembrete pendente, mantendo convites de acesso", async () => {
  mocks.plan.mockResolvedValue({ id: "essential", emails: false });
  mocks.claim.mockResolvedValue({
    data: [{ ...base, template: "reminder", payload: { message: "Renovação" } }],
    error: null,
  });
  expect((await processEmails()).cancelled).toBe(1);
  expect(mocks.send).not.toHaveBeenCalled();
});

it("cancela campanha se o aluno tiver cancelado promoções, inclusive em retry", async () => {
  mocks.claim.mockResolvedValue({
    data: [
      {
        ...base,
        template: "campaign",
        payload: { sealed: seal({ subject: "Promo", message: "Mensagem" }, "campaign") },
      },
    ],
    error: null,
  });
  mocks.student.mockResolvedValue({
    data: {
      teacher_id: "teacher",
      name: "Alice",
      email: "alice@example.com",
      active: true,
      promotional_email_opt_out: true,
      teachers: { name: "Prof", email: "teacher@example.com" },
    },
    error: null,
  });
  expect((await processEmails()).cancelled).toBe(1);
  expect(mocks.send).not.toHaveBeenCalled();
});
it("campanha monta assunto, conteúdo escapado e cancelamento usando a fila existente", async () => {
  mocks.claim.mockResolvedValue({
    data: [
      {
        ...base,
        template: "campaign",
        payload: { sealed: seal({ subject: "Promoção", message: "Mensagem <x>" }, "campaign") },
      },
    ],
    error: null,
  });
  expect((await processEmails()).sent).toBe(1);
  expect(mocks.send).toHaveBeenCalledWith(
    expect.objectContaining({ subject: "Promoção", html: expect.stringContaining("unsubscribe?") }),
    "lessonara/job",
  );
});
it("não envia mensagens para destinatário suprimido, incluindo OTP", async () => {
  mocks.claim.mockImplementation(async (name: string) =>
    name === "email_recipient_blocked"
      ? { data: true, error: null }
      : { data: [{ ...base, template: "otp" }], error: null },
  );
  expect(await processEmails()).toMatchObject({ failed: 1, sent: 0 });
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.updates).toHaveBeenCalledWith(
    expect.objectContaining({ last_error: "recipient_suppressed", status: "failed" }),
  );
});

it("encerra na quinta tentativa mesmo quando a falha é recuperável", async () => {
  mocks.claim.mockResolvedValue({ data: [{ ...base, attempts: 5 }], error: null });
  mocks.send.mockRejectedValue(new EmailSendError("rate_limit_exceeded", true));
  expect(await processEmails()).toMatchObject({ failed: 1, pending: 0 });
  expect(mocks.updates).toHaveBeenCalledWith(
    expect.objectContaining({ status: "failed", payload: {}, delivery: null }),
  );
});
it("convite de acesso continua disponível no Essencial", async () => {
  mocks.plan.mockResolvedValue({ id: "essential", emails: false });
  expect((await processEmails()).sent).toBe(1);
});

it("preferência de renovação cancela renovação antes do envio", async () => {
  mocks.claim.mockResolvedValue({
    data: [{ ...base, template: "reminder", payload: { message: "Renovação" } }],
    error: null,
  });
  const student = await mocks.student();
  mocks.student.mockResolvedValue({
    data: { ...student.data, renewal_email_opt_out: true },
    error: null,
  });
  expect((await processEmails()).cancelled).toBe(1);
  expect(mocks.send).not.toHaveBeenCalled();
});
it("Plus não envia lembrete Pro mesmo se já estiver na fila", async () => {
  mocks.plan.mockResolvedValue({ id: "plus", emails: true, lessonReminders: false });
  mocks.claim.mockResolvedValue({ data: [{ ...base, template: "lesson_notice" }], error: null });
  expect((await processEmails()).cancelled).toBe(1);
  expect(mocks.send).not.toHaveBeenCalled();
});
it("aula remarcada cancela lembrete já preparado, inclusive em retry", async () => {
  mocks.plan.mockResolvedValue({ id: "pro", emails: true, lessonReminders: true });
  mocks.ledger.mockResolvedValue(new Map([["student", { ledger: { lessons: [] } }]]));
  mocks.claim.mockResolvedValue({
    data: [
      {
        ...base,
        template: "lesson_notice",
        payload: { date: "2026-10-08", time: "10:00", source_kind: "schedule", source_id: "old" },
      },
    ],
    error: null,
  });
  expect((await processEmails()).cancelled).toBe(1);
  expect(mocks.send).not.toHaveBeenCalled();
});

it("Pro envia lembrete elegível com horário e chave de idempotência", async () => {
  mocks.plan.mockResolvedValue({ id: "pro", emails: true, lessonReminders: true });
  mocks.ledger.mockResolvedValue(
    new Map([
      [
        "student",
        {
          ledger: {
            lessons: [
              {
                sourceKind: "schedule",
                sourceId: "slot",
                date: "2026-10-08",
                time: "09:30",
                past: false,
                counts: true,
                packageId: "paid",
              },
            ],
          },
        },
      ],
    ]),
  );
  mocks.claim.mockResolvedValue({
    data: [
      {
        ...base,
        template: "lesson_notice",
        payload: { date: "2026-10-08", time: "09:30", source_kind: "schedule", source_id: "slot" },
      },
    ],
    error: null,
  });
  expect((await processEmails()).sent).toBe(1);
  expect(mocks.send).toHaveBeenCalledWith(
    expect.objectContaining({ subject: "Sua aula começa às 09:30" }),
    "lessonara/job",
  );
});

it("recusa lembrete de aula quando somente esse tipo foi desativado, inclusive em retry", async () => {
  mocks.plan.mockResolvedValue({ id: "pro", emails: true, lessonReminders: true });
  mocks.claim.mockResolvedValue({ data: [{ ...base, template: "lesson_notice" }], error: null });
  const student = await mocks.student();
  mocks.student.mockResolvedValue({
    data: { ...student.data, lesson_email_opt_out: true, renewal_email_opt_out: false },
    error: null,
  });
  expect((await processEmails()).cancelled).toBe(1);
  expect(mocks.send).not.toHaveBeenCalled();
});
it("desativar lembretes de aula não bloqueia aviso de renovação", async () => {
  mocks.claim.mockResolvedValue({
    data: [{ ...base, template: "reminder", payload: { message: "Renovação" } }],
    error: null,
  });
  const student = await mocks.student();
  mocks.student.mockResolvedValue({
    data: { ...student.data, lesson_email_opt_out: true, renewal_email_opt_out: false },
    error: null,
  });
  expect((await processEmails()).sent).toBe(1);
});
