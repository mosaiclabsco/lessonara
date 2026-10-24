import { getJitsiConfig, loadClassroomAccess } from "@/lib/classroom-server";
import { createAdminClient } from "@/lib/supabase/server";
import { lessonWindow } from "@/lib/classroom";
import { authorizeClassroom } from "@/lib/classroom-token";
import { classroomRefValid, type ClassroomParams } from "@/lib/classroom";

export async function POST(request: Request, { params }: { params: Promise<ClassroomParams> }) {
  const json = (body: unknown, status: number) =>
    Response.json(body, {
      status,
      headers: { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" },
    });
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    return json({ error: "Solicitação não permitida." }, 403);
  const ref = await params;
  if (!classroomRefValid(ref)) return json({ error: "Aula não encontrada." }, 404);
  try {
    const config = getJitsiConfig();
    if (!config) return json({ error: "Sala de aula indisponível." }, 503);
    const access = await loadClassroomAccess(ref);
    if (!access) return json({ error: "Entre no seu espaço para acessar esta aula." }, 403);
    if (!access.roomAllowed)
      return json({ error: "A sala de aula está disponível no plano Pro." }, 403);
    const db = createAdminClient();
    const owner = await db.from("students").select("teacher_id").eq("id", ref.studentId).single();
    if (owner.error) throw owner.error;
    const key = {
      teacher_id: owner.data.teacher_id,
      student_id: ref.studentId,
      source_kind: ref.sourceKind,
      source_id: ref.sourceId,
      lesson_date: ref.date,
      participant_id: access.participant.id,
      participant_role: access.participant.role,
    };
    let query = db.from("classroom_participation").select("admitted_at,joined_at");
    for (const [field, value] of Object.entries(key)) query = query.eq(field, value);
    const previous = await query.maybeSingle();
    if (previous.error) throw previous.error;
    const now = Date.now();
    const timing = lessonWindow(access.lesson);
    const raw = await request.text();
    if (raw.length > 200) return json({ error: "Solicitação inválida." }, 400);
    const input = raw ? JSON.parse(raw) : {};
    if (input.op !== undefined && input.op !== "joined")
      return json({ error: "Solicitação inválida." }, 400);
    if (input.op === "joined") {
      // A callback can arrive after the scheduled end only with a prior server admission.
      if (
        !previous.data ||
        Date.parse(previous.data.admitted_at) >= timing.endsAt ||
        now < timing.opensAt ||
        now >= timing.closesAt
      )
        return json({ error: "Entrada anterior não encontrada." }, 423);
      let update = db
        .from("classroom_participation")
        .update({ joined_at: previous.data.joined_at ?? new Date(now).toISOString() });
      for (const [field, value] of Object.entries(key)) update = update.eq(field, value);
      const saved = await update;
      if (saved.error) throw saved.error;
      return json({ ok: true }, 200);
    }
    const result = authorizeClassroom({
      ...access,
      ref,
      config,
      now,
      hasJoined: Boolean(previous.data?.joined_at),
    });
    if (result.status === 200 && !previous.data) {
      const saved = await db.from("classroom_participation").upsert(
        { ...key, admitted_at: new Date(now).toISOString() },
        {
          onConflict:
            "teacher_id,student_id,source_kind,source_id,lesson_date,participant_id,participant_role",
          ignoreDuplicates: true,
        },
      );
      if (saved.error) throw saved.error;
    }
    return json(result.body, result.status);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Solicitação inválida." }, 400);
    return json({ error: "Não foi possível preparar a sala. Tente novamente." }, 503);
  }
}

export async function GET(_request: Request, { params }: { params: Promise<ClassroomParams> }) {
  const headers = { "Cache-Control": "no-store, private" };
  const ref = await params;
  if (!classroomRefValid(ref)) return Response.json({ canRejoin: false }, { status: 404, headers });
  try {
    const access = await loadClassroomAccess(ref);
    if (!access || !access.roomAllowed)
      return Response.json({ canRejoin: false }, { status: 403, headers });
    const owner = await createAdminClient()
      .from("students")
      .select("teacher_id")
      .eq("id", ref.studentId)
      .single();
    if (owner.error) throw owner.error;
    const { hasClassroomParticipation } = await import("@/lib/classroom-entry-status");
    const joined = await hasClassroomParticipation(
      owner.data.teacher_id,
      ref.studentId,
      access.participant.id,
      access.participant.role,
      access.lesson,
    );
    return Response.json(
      { canRejoin: joined && Date.now() < lessonWindow(access.lesson).closesAt },
      { headers },
    );
  } catch {
    return Response.json({ canRejoin: false }, { status: 503, headers });
  }
}
