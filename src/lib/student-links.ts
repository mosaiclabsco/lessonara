/** Permanent portal addresses contain no authentication credential. */
export function studentPortalPath(slug: string) {
  return `/a/${encodeURIComponent(slug)}`;
}
export function studentInvitePath(token: string) {
  return `/i/${encodeURIComponent(token)}`;
}
