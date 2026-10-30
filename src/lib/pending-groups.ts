import { cache } from "react";
import { requireUser } from "./supabase/server";
import { platformPlan } from "./platform-plans";
import { loadTeacherOverview } from "./teacher-overview";
export const loadPendingGroups = cache(async () => {
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
      title: "Presenças para confirmar",
      description: "Aulas cujo horário já chegou e aguardam Compareceu ou Faltou.",
      count: overview.rows.reduce((n, s) => n + (s.awaitingAttendance ?? 0), 0),
      href: "/students",
      icon: "check" as const,
    },
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
  return groups;
});
