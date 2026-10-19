"use server";
import {createAdminClient} from "@/lib/supabase/server";
import {readUnsubscribeToken} from "@/lib/mail/unsubscribe-token";
export async function unsubscribePromotions(_prev:{message:string}|null,form:FormData) {
  try {
    const value=readUnsubscribeToken(String(form.get("token")??""));
    const db=createAdminClient();
    const match=await db.from("students").select("id").eq("id",value.studentId).eq("teacher_id",value.teacherId).eq("email",value.email).maybeSingle();
    if(match.error||!match.data)throw new Error("Link inválido.");
    const result=await db.from("students").update({promotional_email_opt_out:true}).eq("teacher_id",value.teacherId).eq("email",value.email).select("id");
    if(result.error||!result.data?.length)throw new Error("Não foi possível atualizar.");
    return {message:"Você não receberá novas comunicações promocionais deste professor. Emails de acesso e avisos sobre suas aulas continuam disponíveis."};
  } catch {return {message:"Este link não está disponível. Entre em contato com seu professor."};}
}
