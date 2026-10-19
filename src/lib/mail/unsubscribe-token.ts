import {seal,unseal} from "./crypto";
type Subscription={studentId:string;teacherId:string;email:string};
export const UNSUBSCRIBE_SECONDS=365*24*3600;
export function createUnsubscribeToken(value:Subscription,now=Date.now()) {
  return seal({...value,expiresAt:now+UNSUBSCRIBE_SECONDS*1000},"unsubscribe");
}
export function readUnsubscribeToken(token:string,now=Date.now()):Subscription {
  if(token.length>5000)throw new Error("Link inválido.");
  const value=unseal<Subscription&{expiresAt?:number}>(token,"unsubscribe",{allowLegacy:true});
  const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
  if(!value||!uuid.test(value.studentId)||!uuid.test(value.teacherId)||typeof value.email!=="string"||value.email.length>254||!/^\S+@\S+\.\S+$/.test(value.email))throw new Error("Link inválido.");
  if((token.startsWith("v2.")||value.expiresAt!==undefined)&&(!Number.isFinite(value.expiresAt)||value.expiresAt!<=now))throw new Error("Link expirado.");
  return value;
}
