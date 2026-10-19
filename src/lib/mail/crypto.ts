import {createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes} from "node:crypto";

export type SealPurpose = "otp" | "mail-delivery" | "campaign" | "unsubscribe" | "google-state" | "google-credentials" | "classroom-material";
function key() {
  const value=process.env.EMAIL_ENCRYPTION_KEY;
  if(!value||!/^[a-f\d]{64}$/i.test(value))throw new Error("EMAIL_ENCRYPTION_KEY deve conter 32 bytes em hexadecimal.");
  return Buffer.from(value,"hex");
}
function purposeKey(purpose:SealPurpose|"rate-limit") {
  return Buffer.from(hkdfSync("sha256",key(),"lessonara:v2",purpose,32));
}
export function seal(value:unknown,purpose:SealPurpose):string {
  const version=process.env.SEAL_WRITE_VERSION??"v2";
  if(version!=="v1"&&version!=="v2")throw new Error("Versão de escrita inválida.");
  const legacy=version==="v1";
  const iv=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",legacy?key():purposeKey(purpose),iv,{authTagLength:16});
  if(!legacy)cipher.setAAD(Buffer.from(`lessonara:v2:${purpose}`));
  const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),"utf8"),cipher.final()]);
  const encoded=Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString("base64url");
  return legacy?encoded:`v2.${purpose}.${encoded}`;
}
export function unseal<T>(value:string,purpose:SealPurpose,options:{allowLegacy?:boolean}={}):T {
  const legacy=!value.startsWith("v2.");
  let encoded=value;
  if(legacy){if(!options.allowLegacy)throw new Error("Envelope legado não permitido.");}
  else {
    const parts=value.split(".");
    if(parts.length!==3||parts[1]!==purpose)throw new Error("Finalidade inválida.");
    encoded=parts[2];
  }
  if(!/^[A-Za-z0-9_-]+$/.test(encoded))throw new Error("Envelope inválido.");
  const data=Buffer.from(encoded,"base64url");
  if(data.length<29)throw new Error("Envelope incompleto.");
  const decipher=createDecipheriv("aes-256-gcm",legacy?key():purposeKey(purpose),data.subarray(0,12),{authTagLength:16});
  if(!legacy)decipher.setAAD(Buffer.from(`lessonara:v2:${purpose}`));
  decipher.setAuthTag(data.subarray(12,28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString("utf8")) as T;
}
export function fingerprint(value:string):string {
  return createHmac("sha256",purposeKey("rate-limit")).update(value).digest("hex");
}
export function hashSession(value:string):string {return createHash("sha256").update(value).digest("hex");}
