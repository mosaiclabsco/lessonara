import { createHmac } from "node:crypto";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: mocks.admin }));
import { POST } from "@/app/api/webhooks/resend/route";
import { verifyDeliveryEvent } from "./delivery-events";
import { emailDisplayStatus } from "./delivery-status";
const key = Buffer.alloc(32, 17);
const secret = `whsec_${key.toString("base64")}`;
// Schema from Resend's documented email event contract; no real recipient or provider call.
function signed(
  type = "email.delivered",
  createdAt = new Date().toISOString(),
  id = "msg_test_delivery",
) {
  const payload = JSON.stringify({
    type,
    created_at: createdAt,
    data: {
      created_at: createdAt,
      email_id: "00000000-0000-4000-8000-000000000001",
      from: "Lessonara <mail@example.com>",
      to: ["student@example.com"],
      subject: "Exemplo",
    },
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64");
  const headers = new Headers({
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": `v1,${signature}`,
  });
  return { payload, headers };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RESEND_WEBHOOK_SECRET", secret);
  mocks.admin.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ error: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
it.each([
  "email.delivered",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.delivery_delayed",
  "email.suppressed",
])("autentica e persiste %s sem payload pessoal", async (type) => {
  const { payload, headers } = signed(type);
  const result = await POST(
    new Request("https://lessonara.example/api/webhooks/resend", {
      method: "POST",
      body: payload,
      headers,
    }),
  );
  expect(result.status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith(
    "record_email_delivery_event",
    expect.objectContaining({ p_type: type, p_id: "msg_test_delivery" }),
  );
  expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain("student@example.com");
});
it("recusa adulteração do corpo, segredo errado e replay fora da janela de assinatura", () => {
  const { payload, headers } = signed();
  expect(() =>
    verifyDeliveryEvent(payload.replace("Exemplo", "Alterado"), headers, secret),
  ).toThrow();
  expect(() =>
    verifyDeliveryEvent(payload, headers, `whsec_${Buffer.alloc(32, 19).toString("base64")}`),
  ).toThrow();
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 10 * 60_000);
  expect(() => verifyDeliveryEvent(payload, headers, secret)).toThrow();
});
it("não toca no banco para assinatura inválida e confirma eventos ignorados autenticados", async () => {
  const { payload, headers } = signed("email.opened");
  expect(
    (
      await POST(
        new Request("https://lessonara.example/api/webhooks/resend", {
          method: "POST",
          body: payload,
          headers,
        }),
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await POST(
        new Request("https://lessonara.example/api/webhooks/resend", {
          method: "POST",
          body: payload,
        }),
      )
    ).status,
  ).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("solicita retry do provedor se o banco falhar e falha fechado se não houver segredo", async () => {
  const { payload, headers } = signed();
  mocks.rpc.mockResolvedValue({ error: { message: "offline" } });
  expect(
    (
      await POST(
        new Request("https://lessonara.example/api/webhooks/resend", {
          method: "POST",
          body: payload,
          headers,
        }),
      )
    ).status,
  ).toBe(503);
  vi.stubEnv("RESEND_WEBHOOK_SECRET", "");
  expect(
    (
      await POST(
        new Request("https://lessonara.example/api/webhooks/resend", {
          method: "POST",
          body: payload,
          headers,
        }),
      )
    ).status,
  ).toBe(503);
});
it("limita o corpo mesmo quando Content-Length não foi informado", async () => {
  expect(
    (
      await POST(
        new Request("https://lessonara.example/api/webhooks/resend", {
          method: "POST",
          body: "x".repeat(32769),
        }),
      )
    ).status,
  ).toBe(413);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("separa aceite, entrega e rejeição sem reescrever o estado do worker", () => {
  expect(emailDisplayStatus({ status: "sent" })).toBe("sent");
  expect(emailDisplayStatus({ status: "sent", delivery_status: "delivered" })).toBe("delivered");
  expect(emailDisplayStatus({ status: "sent", delivery_status: "bounced" })).toBe("failed");
  expect(emailDisplayStatus({ status: "sent", delivery_status: "delivery_delayed" })).toBe(
    "delayed",
  );
});
