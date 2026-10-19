import {validCronAuthorization} from "@/lib/cron-auth";
import {hasPlatformFeature} from "@/lib/platform-plans";
import {processCalendarJobs} from "@/lib/google/worker";
import { loadLedgers, type Student } from "@/lib/data";
import { formatDate } from "@/lib/dates";
import { enqueueReminder, processEmails } from "@/lib/mail/outbox";
import { createAdminClient } from "@/lib/supabase/server";
// Roda 1x por dia (vercel.json). Também mantém o projeto do Supabase ativo no plano free.
export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET;
    if (!validCronAuthorization(request.headers.get("authorization"),secret)) {
        return new Response("Unauthorized", { status: 401 });
    }
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("students")
        .select("*, teachers(name, email,platform_plan)")
        .eq("active", true)
        .not("email", "is", null);
    if (error)
        throw error;
    const students = data as (Student & {
        teachers: {
            name: string;
            email: string;platform_plan:string;
        };
    })[];
    const { data: sent } = await supabase.from("reminders").select("student_id, credits");
    const alreadySent = new Set((sent ?? []).map((r) => `${r.student_id}:${r.credits}`));
    const ledgers = await loadLedgers(supabase, students.map((s) => s.id));
    const results: string[] = [];
    for (const s of students) {
        if(!hasPlatformFeature(s.teachers?.platform_plan,"emails"))continue;
        const { ledger } = ledgers.get(s.id)!;
        const hasUpcoming = ledger.lessons.some((l) => !l.past && l.counts);
        if (ledger.credits === 0 || ledger.remaining > 1 || !hasUpcoming)
            continue;
        if (alreadySent.has(`${s.id}:${ledger.credits}`))
            continue;
        const msg = ledger.remaining <= 0
            ? "Seu pacote de aulas acabou."
            : `Falta 1 aula para acabar seu pacote${ledger.coveredUntil ? ` (última em ${formatDate(ledger.coveredUntil)})` : ""}.`;
        try {
            await enqueueReminder({ studentId: s.id, teacherId: s.teacher_id, email: s.email!, credits: ledger.credits, message: msg });
            await supabase.from("reminders").insert({ student_id: s.id, credits: ledger.credits });
            results.push(`ok ${s.id}`);
        }
        catch (e) {
            void e;
            results.push(`erro ${s.id}: falha ao preparar o lembrete`);
        }
    }
    const emails = await processEmails();
    const now = new Date().toISOString();
    await supabase.from("student_sessions").delete().lt("expires_at", now);
    await supabase.from("student_auth_challenges").delete().lt("expires_at", now);
    await supabase.from("student_auth_limits").delete().lt("window_start", new Date(Date.now() - 86400000).toISOString());
    await processCalendarJobs();return Response.json({ checked: students.length, results, emails });
}
