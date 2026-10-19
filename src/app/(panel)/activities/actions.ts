"use server";
import {requireConfiguredTeacher} from "@/lib/onboarding";
import { revalidatePath } from "next/cache";
import { requireUser,createAdminClient } from "@/lib/supabase/server";
import { validExpiry,validDocumentText } from "@/lib/document-rules";
import { nowInTZ } from "@/lib/dates";
import { ACTIVITY_BUCKET } from "@/lib/activities";
type Result<T=undefined>={ok:true;data:T}|{ok:false;message:string};
const fail=(message:string):{ok:false;message:string}=>({ok:false,message});
function refresh(studentId:string,slug?:string){revalidatePath("/activities");revalidatePath(`/students/${studentId}`);revalidatePath("/documents");revalidatePath(`/student/portal/${studentId}`);if(slug)revalidatePath(`/a/${slug}`);}
export async function assignActivity(input:{studentId:string;documentId:string;title:string;instructions:string;dueOn:string}):Promise<Result>{
 const {supabase,userId}=await requireConfiguredTeacher();let dueOn:string|null;
 try{validDocumentText(input.title,"");dueOn=validExpiry(input.dueOn,nowInTZ().today);if(input.instructions.length>4000)throw new Error("Use instruções de até 4.000 caracteres.");}catch(error){return fail((error as Error).message);}
 const student=await supabase.from("students").select("id,slug").eq("id",input.studentId).eq("teacher_id",userId).maybeSingle();if(student.error||!student.data)return fail("Aluno não encontrado.");
 if(input.documentId){const document=await supabase.from("documents").select("id").eq("id",input.documentId).eq("teacher_id",userId).eq("status","ready").maybeSingle();if(document.error||!document.data)return fail("Documento não encontrado na sua área de Documentos.");}
 const {error}=await supabase.from("activities").insert({teacher_id:userId,student_id:input.studentId,document_id:input.documentId||null,title:input.title.trim(),instructions:input.instructions.trim(),due_on:dueOn});if(error)return fail("Não foi possível enviar a atividade.");refresh(input.studentId,student.data.slug);return {ok:true,data:undefined};
}
export async function reviewActivity(id:string,feedback:string,documentId=""):Promise<Result>{
 const {supabase,userId}=await requireUser();if(feedback.length>4000)return fail("Use um comentário de até 4.000 caracteres.");
 const activity=await supabase.from("activities").select("student_id,students(slug),activity_submissions(submitted_at)").eq("id",id).eq("teacher_id",userId).maybeSingle<{student_id:string;students:{slug:string};activity_submissions:{submitted_at:string|null}|{submitted_at:string|null}[]|null}>();
 if(activity.error||!activity.data)return fail("Atividade não encontrada.");
 const deliveries=activity.data.activity_submissions;const delivery=Array.isArray(deliveries)?deliveries[0]:deliveries;
 if(!delivery?.submitted_at)return fail("A atividade ainda não foi entregue.");
 const {error}=await supabase.rpc("review_activity",{p_id:id,p_feedback:feedback.trim(),p_document:documentId||null});if(error)return fail("Não foi possível registrar a conferência.");refresh(activity.data.student_id,activity.data.students.slug);return {ok:true,data:undefined};
}
export async function archiveActivity(id:string,archive:boolean):Promise<Result>{
 const {supabase,userId}=await requireUser();const {data,error}=await supabase.from("activities").update({archived_at:archive?new Date().toISOString():null}).eq("id",id).eq("teacher_id",userId).select("student_id,students(slug)").maybeSingle<{student_id:string;students:{slug:string}}>();if(error||!data)return fail("Não foi possível atualizar a atividade.");refresh(data.student_id,data.students.slug);return {ok:true,data:undefined};
}
export async function removeSubmissionFile(id:string):Promise<Result>{
 const {supabase,userId}=await requireUser();const {data:submission,error}=await supabase.from("activity_submissions").select("id,activity_id,student_id,status,storage_path,submitted_at").eq("id",id).eq("teacher_id",userId).maybeSingle();if(error||!submission||submission.status==="deleted")return fail("Arquivo não encontrado.");
 const admin=createAdminClient();const locked=await admin.from("activity_submissions").update({status:"deleting"}).eq("id",id).eq("teacher_id",userId).eq("status",submission.status).select("id").maybeSingle();if(locked.error||!locked.data)return fail("O arquivo mudou. Atualize a página.");
 const removed=await admin.storage.from(ACTIVITY_BUCKET).remove([submission.storage_path]);if(removed.error){await admin.from("activity_submissions").update({status:submission.status}).eq("id",id).eq("teacher_id",userId);return fail("Não foi possível remover o arquivo.");}
 const result=!submission.submitted_at?await admin.from("activity_submissions").delete().eq("id",id).eq("teacher_id",userId):await admin.from("activity_submissions").update({status:"deleted"}).eq("id",id).eq("teacher_id",userId);
 const student=await supabase.from("students").select("slug").eq("id",submission.student_id).eq("teacher_id",userId).maybeSingle();refresh(submission.student_id,student.data?.slug);if(result.error)return fail("O arquivo foi removido. Tente novamente para concluir o registro.");return {ok:true,data:undefined};
}
