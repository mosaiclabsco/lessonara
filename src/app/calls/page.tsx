import { teacherSessionValid } from "@/lib/teacher-session";
import { addDays } from "@/lib/dates";
import { lessonWindow } from "@/lib/classroom";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { loadTeacherOverview } from "@/lib/teacher-overview";
import { loadTeacherPlan } from "@/lib/platform-plan-server";
import { CallLogin } from "@/components/call-login";
import { CallsHome } from "@/components/calls-home";

export const metadata = { title: "Chamadas · Lessonara" };

async function Calls() {
  const db = await createClient();
  const { data } = await db.auth.getClaims();
  if (!data?.claims || !(await teacherSessionValid(db, data.claims))) return <CallLogin />;
  const owner = await db.from("teachers").select("id").eq("id", data.claims.sub).maybeSingle();
  if (!owner.data) return <CallLogin />;
  const plan = await loadTeacherPlan(owner.data.id, db);
  const overview = await loadTeacherOverview("calendar");
  const endDate = addDays(overview.today, 30);
  const lessons = overview.calendarLessons
    .filter(
      (lesson) =>
        lesson.date >= overview.today &&
        lesson.date <= endDate &&
        lesson.classroomHref &&
        !["desmarcada", "falta", "feriado"].includes(lesson.status),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.time.localeCompare(b.time) ||
        a.name.localeCompare(b.name),
    )
    .map((lesson) => ({
      id: lesson.id,
      date: lesson.date,
      time: lesson.time,
      name: lesson.name,
      href: lesson.classroomHref!,
      ...lessonWindow(lesson),
    }));
  return (
    <CallsHome
      name={overview.teacherName}
      enabled={plan.classroom}
      today={overview.today}
      now={Date.parse(`${overview.today}T${overview.time}:00-03:00`)}
      lessons={lessons}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="classroom-state">Carregando chamadas…</main>}>
      <Calls />
    </Suspense>
  );
}
