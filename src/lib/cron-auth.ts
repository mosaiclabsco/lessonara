import { createHash, timingSafeEqual } from "node:crypto";
export function validCronAuthorization(header: string | null, secret: string | undefined) {
  if (!secret || !header || header.length > 4096) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}
