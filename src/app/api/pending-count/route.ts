import { requireUser, createAdminClient } from "@/lib/supabase/server";
import { fingerprint } from "@/lib/mail/crypto";
import { loadPendingGroups } from "@/lib/pending-groups";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  const { userId } = await requireUser();
  const limit = await createAdminClient().rpc("allow_student_auth", {
    p_keys: [`pending-count/${fingerprint(userId)}`],
    p_limits: [30],
    p_seconds: [60],
  });
  if (limit.error || typeof limit.data !== "boolean")
    return new Response(null, { status: 503, headers });
  if (!limit.data)
    return new Response(null, { status: 429, headers: { ...headers, "Retry-After": "60" } });
  const groups = await loadPendingGroups();
  return Response.json({ count: groups.reduce((sum, g) => sum + g.count, 0) }, { headers });
}
