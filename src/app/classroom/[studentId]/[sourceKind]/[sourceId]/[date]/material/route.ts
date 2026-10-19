import { loadClassroomAccess } from "@/lib/classroom-server";
import { classroomRefValid, lessonCanJoin, type ClassroomParams } from "@/lib/classroom";
import { createAdminClient } from "@/lib/supabase/server";
import { seal, unseal } from "@/lib/mail/crypto";
import { grantMatches, validateMaterial, type MaterialGrant } from "@/lib/classroom-material";
import { DOCUMENT_BUCKET } from "@/lib/document-rules";

export async function POST(request: Request, { params }: { params: Promise<ClassroomParams> }) {
  const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer"}});
  if(request.headers.get("origin")!==new URL(request.url).origin)return json({error:"Solicitação não permitida."},403);
  const ref=await params;if(!classroomRefValid(ref))return json({error:"Aula não encontrada."},404);
  try {
    const access=await loadClassroomAccess(ref);if(!access||!access.roomAllowed||!lessonCanJoin(access.lesson))return json({error:"Acesso não permitido."},403);
    const text=await request.text();if(text.length>150000)return json({error:"Material muito grande."},413);
    const input=JSON.parse(text);const db=createAdminClient();
    const owner=await db.from("students").select("teacher_id").eq("id",ref.studentId).single();if(owner.error)throw owner.error;
    const teacherId=owner.data.teacher_id;
    if(access.participant.role==="teacher"&&access.participant.id!==teacherId)return json({error:"Acesso não permitido."},403);
    if(input.op==="library") {
      if(access.participant.role!=="teacher")return json({error:"Somente o professor pode escolher o material."},403);
      const result=await db.from("documents").select("id,title,file_name").eq("teacher_id",teacherId).eq("status","ready").eq("mime_type","application/pdf").order("created_at",{ascending:false}).limit(200);
      if(result.error)throw result.error;return json({documents:result.data});
    }
    let grant:MaterialGrant;
    if(input.op==="publish") {
      if(access.participant.role!=="teacher")return json({error:"Somente o professor pode apresentar e anotar."},403);
      grant={ref,teacherId,state:validateMaterial(input.state),issuedAt:Date.now(),expiresAt:Date.now()+12*60*60*1000};
    } else {
      if(!["read","file"].includes(input.op)||typeof input.token!=="string"||input.token.length>140000)return json({error:"Material inválido."},400);
      grant=unseal<MaterialGrant>(input.token,"classroom-material",{allowLegacy:true});
      if(!grantMatches(grant,ref)||grant.teacherId!==teacherId)return json({error:"Material expirado ou de outra aula."},403);
      grant.state=validateMaterial(grant.state);
    }
    const document=grant.state.documentId?await db.from("documents").select("id,title,file_name,storage_path,byte_size").eq("id",grant.state.documentId).eq("teacher_id",teacherId).eq("status","ready").eq("mime_type","application/pdf").maybeSingle():null;
    if(document?.error)throw document.error;if(grant.state.documentId&&!document?.data)return json({error:"PDF não encontrado nesta conta."},404);
    if(input.op==="file") {
      if(!document?.data)return json({error:"PDF não encontrado."},404);
      const file=await db.storage.from(DOCUMENT_BUCKET).createSignedUrl(document.data.storage_path,60);if(file.error||!file.data)throw new Error("file_unavailable");
      return json({url:file.data.signedUrl});
    }
    return json({token:input.op==="publish"?seal(grant,"classroom-material"):input.token,state:grant.state,issuedAt:grant.issuedAt,title:document?.data?.title??(grant.state.board?"Quadro":"")});
  } catch {return json({error:"Não foi possível preparar o material. Tente novamente."},400);}
}
