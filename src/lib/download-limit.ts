import { createAdminClient } from "./supabase/server";
import { fingerprint } from "./mail/crypto";
import { downloadHeaders } from "./financial-download";
// Limits are shared by every serverless instance; canonical identity comes from authorized server data.
export async function downloadLimit(
  actor: string,
  resource: string,
  kind: "receipt" | "export" | "file",
) {
  const seconds = kind === "file" ? 3 : 10;
  const minute = kind === "export" ? 6 : kind === "file" ? 30 : 10;
  const hour = kind === "export" ? 30 : kind === "file" ? 300 : 60;
  try {
    const result = await createAdminClient().rpc("check_download_limit", {
      p_keys: [
        `download/${kind}/resource/${fingerprint(actor + "/" + resource.toLowerCase())}`,
        `download/${kind}/minute/${fingerprint(actor)}`,
        `download/${kind}/hour/${fingerprint(actor)}`,
      ],
      p_limits: [1, minute, hour],
      p_seconds: [seconds, 60, 3600],
    });
    if (result.error || !result.data || typeof result.data.allowed !== "boolean")
      throw new Error("unavailable");
    if (result.data.allowed) return null;
    const retry = Math.min(
      3600,
      Math.max(1, Math.ceil(Number(result.data.retry_after) || seconds)),
    );
    return new Response(
      `Muitos downloads em sequência. Aguarde ${retry} segundos e tente novamente.`,
      { status: 429, headers: { ...downloadHeaders, "Retry-After": String(retry) } },
    );
  } catch {
    return new Response(
      "Não foi possível preparar o download agora. Tente novamente em instantes.",
      { status: 503, headers: { ...downloadHeaders, "Retry-After": "30" } },
    );
  }
}
