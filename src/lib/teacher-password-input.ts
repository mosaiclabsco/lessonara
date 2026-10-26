export function passwordLinkInput(hash: unknown, type: unknown) {
  if (
    typeof hash !== "string" ||
    !/^[A-Za-z0-9_-]{32,256}$/.test(hash) ||
    (type !== "invite" && type !== "recovery")
  )
    return null;
  return { token_hash: hash, type } as { token_hash: string; type: "invite" | "recovery" };
}
