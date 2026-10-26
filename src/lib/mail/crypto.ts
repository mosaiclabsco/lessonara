import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
} from "node:crypto";

export type SealPurpose =
  | "teacher-password"
  | "otp"
  | "mail-delivery"
  | "campaign"
  | "unsubscribe"
  | "google-state"
  | "google-credentials"
  | "classroom-material";
function key(name = "EMAIL_ENCRYPTION_KEY") {
  const value = process.env[name];
  if (!value || !/^[a-f\d]{64}$/i.test(value))
    throw new Error("EMAIL_ENCRYPTION_KEY deve conter 32 bytes em hexadecimal.");
  return Buffer.from(value, "hex");
}
function purposeKey(purpose: SealPurpose | "rate-limit", version = "v2") {
  return Buffer.from(
    hkdfSync(
      "sha256",
      key(version === "v3" ? "EMAIL_ENCRYPTION_KEY_NEXT" : "EMAIL_ENCRYPTION_KEY"),
      `lessonara:${version}`,
      purpose,
      32,
    ),
  );
}
export function seal(value: unknown, purpose: SealPurpose): string {
  const version = process.env.SEAL_WRITE_VERSION ?? "v2";
  if (version !== "v1" && version !== "v2" && version !== "v3")
    throw new Error("Versão de escrita inválida.");
  const legacy = version === "v1";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", legacy ? key() : purposeKey(purpose, version), iv, {
    authTagLength: 16,
  });
  if (!legacy) cipher.setAAD(Buffer.from(`lessonara:${version}:${purpose}`));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const encoded = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
  return legacy ? encoded : `${version}.${purpose}.${encoded}`;
}
export function unseal<T>(
  value: string,
  purpose: SealPurpose,
  options: { allowLegacy?: boolean } = {},
): T {
  const version = value.startsWith("v3.") ? "v3" : value.startsWith("v2.") ? "v2" : "v1";
  const legacy = version === "v1";
  if (version !== "v3" && process.env.EMAIL_ACCEPT_PREVIOUS_ENVELOPES === "false")
    throw new Error("Formato anterior não permitido.");
  let encoded = value;
  if (legacy) {
    if (!options.allowLegacy) throw new Error("Envelope legado não permitido.");
  } else {
    const parts = value.split(".");
    if (parts.length !== 3 || parts[1] !== purpose) throw new Error("Finalidade inválida.");
    encoded = parts[2];
  }
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error("Envelope inválido.");
  const data = Buffer.from(encoded, "base64url");
  if (data.length < 29) throw new Error("Envelope incompleto.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    legacy ? key() : purposeKey(purpose, version),
    data.subarray(0, 12),
    { authTagLength: 16 },
  );
  if (!legacy) decipher.setAAD(Buffer.from(`lessonara:${version}:${purpose}`));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8"),
  ) as T;
}
export function fingerprint(value: string): string {
  return createHmac(
    "sha256",
    purposeKey("rate-limit", process.env.SEAL_WRITE_VERSION === "v3" ? "v3" : "v2"),
  )
    .update(value)
    .digest("hex");
}
export function hashSession(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
