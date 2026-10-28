type Claims = {
  sub?: unknown;
  session_id?: unknown;
  support_actor?: unknown;
  session_expires_at?: unknown;
};
type Client = {
  rpc: (name: "teacher_session_valid") => PromiseLike<{ data: unknown; error: unknown }>;
};

// New signed claims avoid an extra database request; older JWTs use the same database policy.
export async function teacherSessionValid(
  client: Client,
  claims: Claims | undefined,
  now = Date.now(),
) {
  if (!claims?.sub || !claims.session_id) return false;
  if (claims.support_actor !== undefined) {
    try {
      const result = await client.rpc("teacher_session_valid");
      if (result.error || result.data !== true) return false;
    } catch {
      return false;
    }
  }
  if (claims.session_expires_at !== undefined) {
    return (
      typeof claims.session_expires_at === "number" &&
      Number.isFinite(claims.session_expires_at) &&
      claims.session_expires_at * 1000 > now
    );
  }
  try {
    const { data, error } = await client.rpc("teacher_session_valid");
    return !error && data === true;
  } catch {
    return false;
  }
}
