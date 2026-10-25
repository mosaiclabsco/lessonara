import { ButtonLink } from "@/components/button";
import { Suspense } from "react";
import { requireUser } from "@/lib/supabase/server";
import { platformPlan } from "@/lib/platform-plans";
import { loadTeacherOverview } from "@/lib/teacher-overview";
import PanelLoading from "../loading";
export default function PendingPage() {
  return (
    <Suspense fallback={<PanelLoading />}>
      <PendingData />
    </Suspense>
  );
}
async function PendingData() {
  const { supabase, userId, teacher } = await requireUser(),
    plan = platformPlan(teacher.platform_plan);
  const [overview, renewals, emails, calendar] = await Promise.all([
    loadTeacherOverview(),
    supabase
      .from("renewal_requests")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", userId)
      .eq("status", "pending"),
    plan.emails
      ? supabase
          .from("email_outbox")
          .select("id", { count: "exact", head: true })
          .eq("teacher_id", userId)
          .or("status.eq.failed,delivery_status.in.(bounced,complained,failed,suppressed)")
      : Promise.resolve({ count: 0, error: null }),
    plan.google
      ? supabase
          .from("calendar_jobs")
          .select("id", { count: "exact", head: true })
          .eq("teacher_id", userId)
          .eq("status", "failed")
      : Promise.resolve({ count: 0, error: null }),
  ]);
  if (renewals.error || emails.error || calendar.error)
    throw new Error("Não foi possível consultar as pendências.");
  const groups = [
    {
      title: "Pagamentos para conferir",
      description: "Alunos que informaram “Já paguei”. Os créditos dependem da sua confirmação.",
      count: renewals.count ?? 0,
      href: "/payments",
      icon: "book" as const,
    },
    {
      title: "Alunos sem agenda",
      description: "Alunos ativos que ainda precisam de horários para começar.",
      count: overview.rows.filter((s) => s.active && s.pending).length,
      href: "/students?filter=pending",
      icon: "calendar" as const,
    },
    {
      title: "Pacotes para renovar",
      description: "Alunos ativos com uma aula ou menos de saldo em um pacote registrado.",
      count: overview.rows.filter((s) => s.active && s.credits > 0 && s.remaining <= 1).length,
      href: "/payments",
      icon: "users" as const,
    },
    ...(plan.emails
      ? [
          {
            title: "Emails com falha",
            description:
              "Envios que precisam de revisão. Aceite do provedor e entrega são estados diferentes.",
            count: emails.count ?? 0,
            href: "/emails",
            icon: "mail" as const,
          },
        ]
      : []),
    ...(plan.google
      ? [
          {
            title: "Agenda Google com falha",
            description: "Sincronizações que não foram concluídas após as tentativas automáticas.",
            count: calendar.count ?? 0,
            href: "/settings?tab=integrations&integration=google",
            icon: "calendar" as const,
          },
        ]
      : []),
  ];
  const total = groups.reduce((n, g) => n + g.count, 0);
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">O que preciso resolver</h1>
        <p className="page-description">
          Próximas ações para manter suas aulas e recebimentos em dia.
        </p>
      </div>
      {total === 0 && (
        <section className="card">
          <h2 className="h2">Tudo em dia por aqui</h2>
          <p className="mt-2 text-sm text-muted">
            Nenhuma pendência encontrada nas áreas disponíveis no seu plano.
          </p>
        </section>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        {groups.map((g) => (
          <section key={g.title} className="card flex flex-col items-start">
            <div className="flex w-full items-center justify-between gap-4">
              <h2 className="h2 mb-0">{g.title}</h2>
              <span className="count-badge">{g.count}</span>
            </div>
            <p className="mt-3 text-sm text-muted">{g.description}</p>
            <div className="mt-auto pt-6">
              <ButtonLink href={g.href} icon={g.icon}>
                Revisar
              </ButtonLink>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
