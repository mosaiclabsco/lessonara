import { createAdminClient } from "@/lib/supabase/server";
import { verifyDeliveryEvent } from "@/lib/mail/delivery-events";
const MAX_BYTES = 32 * 1024;
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook indisponível." }, { status: 503 });
  if (Number(request.headers.get("content-length")) > MAX_BYTES)
    return new Response(null, { status: 413 });
  let payload = "";
  let bytes = 0;
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
      payload += decoder.decode(value, { stream: true });
    }
    payload += decoder.decode();
  } catch {
    return new Response(null, { status: 400 });
  }
  let event;
  try {
    event = verifyDeliveryEvent(payload, request.headers, secret);
  } catch {
    return Response.json({ error: "Assinatura ou evento inválido." }, { status: 400 });
  }
  if (!event) return Response.json({ received: true });
  try {
    const { error } = await createAdminClient().rpc("record_email_delivery_event", {
      p_id: event.id,
      p_provider_id: event.providerId,
      p_type: event.type,
      p_occurred_at: event.at,
    });
    if (error) throw error;
    return Response.json({ received: true });
  } catch {
    console.error("email_delivery_event_failed");
    return Response.json({ error: "Tente novamente." }, { status: 503 });
  }
}
