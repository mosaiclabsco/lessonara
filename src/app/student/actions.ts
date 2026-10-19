"use server";
import {randomUUID} from "node:crypto";
import {revalidatePath} from "next/cache";
import {loadTeacherPlan} from "@/lib/platform-plan-server";
import {createAdminClient} from "@/lib/supabase/server";
import {validateDocumentFile} from "@/lib/document-rules";
import {ACTIVITY_BUCKET} from "@/lib/activities";
import {studentActivity} from "@/lib/activity-access";
type Result<T=undefined>={ok:true;data:T}|{ok:false;message:string};
const fail=(message:string):{ok:false;message:string}=>({ok:false,message});
function refresh(studentId:string,slug:string){
  revalidatePath("/activities");revalidatePath(`/students/${studentId}`);revalidatePath("/documents");
  revalidatePath(`/student/portal/${studentId}`);revalidatePath(`/a/${slug}`);
}
export async function beginActivitySubmission(studentId:string,activityId:string,input:{fileName:string;byteSize:number}):Promise<Result<{id:string;path:string;token:string;mimeType:string}>>{
 const supabase=createAdminClient();const activity=await studentActivity(supabase,studentId,activityId);if(!activity||activity.archived_at)return fail("Atividade indisponível para entrega.");
 const plan=await loadTeacherPlan(activity.teacher_id,supabase);let file;try{file=validateDocumentFile(input.fileName,input.byteSize,plan.maxFileBytes);}catch(error){return fail((error as Error).message);}
 const id=randomUUID();const path=`${activity.teacher_id}/${id}/file.${file.extension}`;
 const reserved=await supabase.rpc("reserve_activity_submission",{p_id:id,p_activity_id:activity.id,p_teacher_id:activity.teacher_id,p_student_id:activity.student_id,p_file_name:input.fileName,p_storage_path:path,p_mime_type:file.mimeType,p_byte_size:input.byteSize});
 if(reserved.error)return fail(reserved.error.code==="23505"?"Já existe uma entrega ou envio incompleto nesta atividade.":reserved.error.message.includes("armazenamento")?"O espaço de arquivos da professora está cheio. Avise sua professora.":"Não foi possível preparar a entrega.");
 const signed=await supabase.storage.from(ACTIVITY_BUCKET).createSignedUploadUrl(path);if(signed.error||!signed.data){await supabase.from("activity_submissions").delete().eq("id",id).eq("activity_id",activity.id).eq("status","uploading");return fail("Não foi possível preparar o envio.");}
 return {ok:true,data:{id,path,token:signed.data.token,mimeType:file.mimeType}};
}
export async function finishActivitySubmission(studentId:string,activityId:string,submissionId:string,note:string):Promise<Result>{
 if(note.length>4000)return fail("Use observações de até 4.000 caracteres.");const supabase=createAdminClient();const activity=await studentActivity(supabase,studentId,activityId);if(!activity||activity.archived_at)return fail("Atividade indisponível.");
 const {data:submission,error}=await supabase.from("activity_submissions").select("storage_path,byte_size,mime_type").eq("id",submissionId).eq("activity_id",activity.id).eq("student_id",activity.student_id).eq("teacher_id",activity.teacher_id).eq("status","uploading").maybeSingle();if(error||!submission)return fail("Envio não encontrado ou já concluído.");
 const info=await supabase.storage.from(ACTIVITY_BUCKET).info(submission.storage_path);if(info.error||info.data?.size!==submission.byte_size||info.data.contentType!==submission.mime_type)return fail("Não foi possível confirmar o arquivo enviado.");
 const completed=await supabase.rpc("complete_activity_submission",{p_submission_id:submissionId,p_activity_id:activity.id,p_teacher_id:activity.teacher_id,p_student_id:activity.student_id,p_note:note.trim()});if(completed.error)return fail("Não foi possível concluir a entrega. A atividade pode ter sido arquivada.");refresh(activity.student_id,activity.studentSlug);return {ok:true,data:undefined};
}
export async function cancelActivitySubmission(studentId:string,activityId:string):Promise<Result>{
 const supabase=createAdminClient();const activity=await studentActivity(supabase,studentId,activityId);if(!activity)return fail("Atividade não encontrada.");
 const {data:submission,error}=await supabase.from("activity_submissions").select("id,storage_path,status").eq("activity_id",activity.id).eq("teacher_id",activity.teacher_id).eq("student_id",activity.student_id).in("status",["uploading","deleting"]).is("submitted_at",null).maybeSingle();if(error||!submission)return fail("Nenhum envio incompleto encontrado.");
 const locked=await supabase.from("activity_submissions").update({status:"deleting"}).eq("id",submission.id).eq("status",submission.status).is("submitted_at",null).select("id").maybeSingle();if(locked.error||!locked.data)return fail("O envio mudou. Atualize a página.");
 const removed=await supabase.storage.from(ACTIVITY_BUCKET).remove([submission.storage_path]);if(removed.error)return fail("Não foi possível descartar o envio incompleto.");const deleted=await supabase.from("activity_submissions").delete().eq("id",submission.id).eq("status","deleting").is("submitted_at",null);if(deleted.error)return fail("Tente novamente para concluir a limpeza do envio.");refresh(activity.student_id,activity.studentSlug);return {ok:true,data:undefined};
}
