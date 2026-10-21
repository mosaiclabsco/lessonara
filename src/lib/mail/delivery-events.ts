import { Resend } from "resend";
export const DELIVERY_EVENTS = [
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.suppressed",
] as const;
export type DeliveryEventType = (typeof DELIVERY_EVENTS)[number];
export function verifyDeliveryEvent(payload: string, headers: Headers, secret: string) {
  const id = headers.get("svix-id") ?? "";
  if (!id || id.length > 200) throw new Error("Invalid event ID");
  const event = new Resend("verification-only").webhooks.verify({
    payload,
    webhookSecret: secret,
    headers: {
      id,
      timestamp: headers.get("svix-timestamp") ?? "",
      signature: headers.get("svix-signature") ?? "",
    },
  });
  if (!event || typeof event !== "object" || typeof event.type !== "string")
    throw new Error("Invalid event");
  if (!DELIVERY_EVENTS.includes(event.type as DeliveryEventType)) return null;
  if (
    !("email_id" in event.data) ||
    typeof event.data.email_id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.data.email_id) ||
    !Number.isFinite(Date.parse(event.created_at))
  )
    throw new Error("Invalid delivery event");
  return {
    id,
    providerId: event.data.email_id,
    type: event.type as DeliveryEventType,
    at: new Date(event.created_at).toISOString(),
  };
}
