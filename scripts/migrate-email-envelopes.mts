import { createClient } from "@supabase/supabase-js";
import { seal, unseal, type SealPurpose } from "../src/lib/mail/crypto.ts";

// Re-running is safe: writes compare the encrypted value originally read.
if (process.env.SEAL_WRITE_VERSION !== "v3" || !process.env.EMAIL_ENCRYPTION_KEY_NEXT)
  throw new Error("Configure the new root and SEAL_WRITE_VERSION=v3 first.");
process.env.EMAIL_ACCEPT_PREVIOUS_ENVELOPES = "true";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const stats = { google: 0, outbox: 0, conflicts: 0 };
function migrate(value: string, purpose: SealPurpose) {
  return value.startsWith("v3.")
    ? value
    : seal(unseal(value, purpose, { allowLegacy: true }), purpose);
}
for (const table of ["google_calendar_connections", "email_outbox"] as const) {
  const key = table === "google_calendar_connections" ? "teacher_id" : "id";
  let cursor: string | undefined;
  for (;;) {
    let q = db
      .from(table)
      .select(
        table === "google_calendar_connections"
          ? "teacher_id,credentials"
          : "id,template,payload,delivery",
      )
      .order(key)
      .limit(100);
    if (cursor) q = q.gt(key, cursor);
    const r = await q;
    if (r.error) throw new Error(`Could not read ${table}: ${r.error.code}`);
    const rows = r.data as unknown as Record<string, unknown>[];
    for (const row of rows) {
      if (table === "google_calendar_connections") {
        const original = row.credentials as string;
        const next = migrate(original, "google-credentials");
        if (next === original) continue;
        const saved = await db
          .from(table)
          .update({ credentials: next })
          .eq(key, row[key])
          .eq("credentials", original)
          .select(key);
        if (saved.error) throw new Error(`Could not migrate credentials: ${saved.error.code}`);
        if (saved.data?.length) stats.google++;
        else stats.conflicts++;
      } else {
        const payload = row.payload as Record<string, unknown>;
        const delivery = row.delivery as { sealed: string } | null;
        const purpose =
          row.template === "otp" ? "otp" : row.template === "campaign" ? "campaign" : null;
        const nextPayload =
          purpose && typeof payload?.sealed === "string"
            ? { ...payload, sealed: migrate(payload.sealed, purpose) }
            : payload;
        const nextDelivery = delivery
          ? { ...delivery, sealed: migrate(delivery.sealed, "mail-delivery") }
          : null;
        if (
          JSON.stringify(nextPayload) === JSON.stringify(payload) &&
          JSON.stringify(nextDelivery) === JSON.stringify(delivery)
        )
          continue;
        let save = db
          .from(table)
          .update({ payload: nextPayload, delivery: nextDelivery })
          .eq(key, row[key])
          .eq("payload", JSON.stringify(payload));
        save = delivery ? save.eq("delivery", JSON.stringify(delivery)) : save.is("delivery", null);
        const saved = await save.select(key);
        if (saved.error) throw new Error(`Could not migrate email: ${saved.error.code}`);
        if (saved.data?.length) stats.outbox++;
        else stats.conflicts++;
      }
    }
    if (rows.length < 100) break;
    cursor = String(rows.at(-1)![key]);
  }
}
console.log(JSON.stringify(stats));
if (stats.conflicts) process.exitCode = 2;
