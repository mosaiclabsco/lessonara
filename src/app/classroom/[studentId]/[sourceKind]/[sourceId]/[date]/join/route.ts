import { getJitsiConfig, loadClassroomAccess } from "@/lib/classroom-server";
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
    const result = authorizeClassroom({ ...access, ref, config });
    return json(result.body, result.status);
  } catch {
    return json({ error: "Não foi possível preparar a sala. Tente novamente." }, 503);
  }
}
