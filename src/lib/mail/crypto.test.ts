import {createCipheriv,randomBytes} from "node:crypto";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {seal,unseal} from "./crypto";
import {createUnsubscribeToken,readUnsubscribeToken,UNSUBSCRIBE_SECONDS} from "./unsubscribe-token";
beforeEach(()=>{vi.stubEnv("EMAIL_ENCRYPTION_KEY","01".repeat(32));vi.stubEnv("SEAL_WRITE_VERSION","v2");});
afterEach(()=>vi.unstubAllEnvs());
function legacy(value:unknown) {
  const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",Buffer.from("01".repeat(32),"hex"),iv,{authTagLength:16});
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),ciphertext]).toString("base64url");
}
it("rejeita troca de contexto, inclusive alterando o rótulo externo",()=>{
  const token=seal({accessToken:"secret"},"google-credentials");
  expect(()=>unseal(token,"otp",{allowLegacy:true})).toThrow();
  expect(()=>unseal(token.replace("google-credentials","otp"),"otp")).toThrow();
  expect(unseal(token,"google-credentials")).toEqual({accessToken:"secret"});
});
it("legados exigem opt-in e continuam legíveis sem mudar a chave raiz",()=>{
  const token=legacy({refreshToken:"kept"});
  expect(()=>unseal(token,"google-credentials")).toThrow();
  expect(unseal(token,"google-credentials",{allowLegacy:true})).toEqual({refreshToken:"kept"});
});
it("rejeita envelopes curtos, base64 inválida e tags adulteradas",()=>{
  for(let n=0;n<29;n++)expect(()=>unseal(`v2.otp.${Buffer.alloc(n).toString("base64url")}`,"otp")).toThrow();
  expect(()=>unseal("v2.otp.not+base64","otp")).toThrow();
  const token=seal({code:"123456"},"otp"),data=Buffer.from(token.split(".")[2],"base64url");
  data[12]^=1;
  expect(()=>unseal(`v2.otp.${data.toString("base64url")}`,"otp")).toThrow();
});
const subscription={studentId:"11111111-1111-4111-8111-111111111111",teacherId:"22222222-2222-4222-8222-222222222222",email:"a@example.com"};
it("novos links expiram no limite e links antigos continuam válidos",()=>{
  const now=1_800_000_000_000,expires=now+UNSUBSCRIBE_SECONDS*1000;
  const token=createUnsubscribeToken(subscription,now);
  expect(readUnsubscribeToken(token,expires-1)).toMatchObject(subscription);
  expect(()=>readUnsubscribeToken(token,expires)).toThrow("expirado");
  expect(readUnsubscribeToken(legacy(subscription),expires)).toEqual(subscription);
  expect(()=>readUnsubscribeToken(legacy({...subscription,expiresAt:expires}),expires)).toThrow("expirado");
  expect(()=>readUnsubscribeToken(seal(subscription,"unsubscribe"),now)).toThrow("expirado");
  expect(()=>readUnsubscribeToken(seal({...subscription,expiresAt:expires},"campaign"),now)).toThrow();
});

it("permite publicar leitores compatíveis antes de ativar escritores v2",()=>{
 vi.stubEnv("SEAL_WRITE_VERSION","v1");const token=seal({code:"123456"},"otp");expect(token).not.toContain(".");
 expect(unseal(token,"otp",{allowLegacy:true})).toEqual({code:"123456"});
 vi.stubEnv("SEAL_WRITE_VERSION","v2");expect(seal({code:"123456"},"otp")).toMatch(/^v2\.otp\./);
 vi.stubEnv("SEAL_WRITE_VERSION","typo");expect(()=>seal({},"otp")).toThrow("Versão");
});
