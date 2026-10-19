"use server";
import {requirePlatformFeature} from "@/lib/platform-plan-server";
import {after} from "next/server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient, requireUser } from "@/lib/supabase/server";
import { processEmails } from "@/lib/mail/outbox";

export async function resendWelcome(form: FormData) {
  const { supabase, userId } = await requireUser();
  const id = String(form.get("studentId") ?? "");
  const student = await supabase.from("students").select("id,email,active").eq("id", id).eq("teacher_id", userId).maybeSingle();
  if (student.error || !student.data?.active || !student.data.email) throw new Error("Confira o email do aluno antes de enviar o convite.");
  const db = createAdminClient();
  const rate = await db.rpc("allow_student_auth", { p_keys: [`welcome/${id}`, `welcome/teacher/${userId}`], p_limits: [1, 20], p_seconds: [60, 3600] });
  if (rate.error || !rate.data) throw new Error("Aguarde antes de enviar outro convite.");
  const jobId = randomUUID();
  const { error } = await db.from("email_outbox").insert({ id: jobId, event_key: `welcome/${id}/${jobId}`, teacher_id: userId, student_id: id, recipient: student.data.email, template: "welcome", payload: {} });
  if (error) throw new Error("Não foi possível registrar o convite.");
  await processEmails(jobId);
  revalidatePath("/emails");
}
export async function retryPendingEmails() {
  const { userId } = await requirePlatformFeature("emails");
  const db = createAdminClient();
  const { data, error } = await db.from("email_outbox").select("id").eq("teacher_id", userId).eq("status", "pending").lte("available_at", new Date().toISOString()).limit(10);
  if (error) throw new Error("Não foi possível consultar os envios pendentes.");
  for (const job of data ?? []) await processEmails(job.id);
  revalidatePath("/emails");
}

export async function sendCampaign(input:unknown):Promise<{ok:true;count:number}|{ok:false;message:string}>{
 const {supabase,userId}=await requirePlatformFeature('emails');
 try{const {validateCampaign}=await import('@/lib/mail/campaign');const {seal}=await import('@/lib/mail/crypto');const value=validateCampaign(input);const result=await supabase.rpc('queue_email_campaign',{p_id:value.id,p_subject:value.subject,p_content:seal({subject:value.subject,message:value.message},"campaign"),p_students:value.students});if(result.error)throw new Error(result.error.code==='P0001'?result.error.message:'Não foi possível registrar a campanha.');after(async()=>{const db=createAdminClient();const jobs=await db.from('email_outbox').select('id').eq('teacher_id',userId).like('event_key',`campaign/${value.id}/%`).eq('status','pending').limit(100);for(const job of jobs.data??[]){try{await processEmails(job.id);}catch{}await new Promise(resolve=>setTimeout(resolve,550));}});revalidatePath('/emails');return {ok:true,count:Number(result.data)};}catch(error){return {ok:false,message:error instanceof Error?error.message:'Não foi possível registrar a campanha.'};}
}
