import {platformPlan} from "./platform-plans";
import {measure} from "./performance";
import {getJitsiConfig} from "./classroom-server";
import {classroomHref} from "./classroom";
import {needsSchedule} from "./student-setup";
import { getOrigin } from "./origin";
import { loadLedgers, studentPrice, type Student, type Plan } from "./data";
import { nowInTZ } from "./dates";
import { calendarRange, type CalendarLesson } from "./calendar";
import { requireUser } from "./supabase/server";

type OverviewStudent = Omit<Student,"notes"> & {plans:Plan|null};
type OverviewView = "directory" | "payments" | "calendar";
export async function loadTeacherOverview(view: OverviewView = "directory") {
 return measure(`overview.${view}`,async()=>{
  const includeCalendar=view==="calendar";
  const { supabase, userId, teacher } = await requireUser();
  const classroomsEnabled=includeCalendar&&Boolean(getJitsiConfig())&&platformPlan(teacher.platform_plan).classroom;
  const students:OverviewStudent[]=[];
  await measure("overview.students",async()=>{for(let page=0;;page+=1000){const result=await supabase.from("students").select("id,teacher_id,slug,name,email,phone,phone_country,plan_id,price_override,active,plans(id,name,lessons,price)").eq("teacher_id",userId).order("name").order("id").range(page,page+999).returns<OverviewStudent[]>();if(result.error)throw result.error;students.push(...(result.data??[]));if((result.data?.length??0)<1000)break;}});
  const [ledgers,origin] = await Promise.all([loadLedgers(supabase, students.map((student) => student.id), students),getOrigin()]);
  const { today, time } = nowInTZ();
  const range = calendarRange(today);
  const rows = view!=="payments" ? students.map((student) => {
    const { ledger,schedules,appointments } = ledgers.get(student.id)!;const pending=needsSchedule(student.active,schedules,(appointments??[]).filter(a=>!ledger.lessons.some(l=>l.date===a.date&&l.time===a.time&&l.status==="desmarcada")),today);
    const next = ledger.lessons.find((lesson) => !lesson.past && lesson.counts && lesson.status !== "feriado");
    return { id: student.id, name: student.name, active: student.active,pending, plan: student.plans?.name ?? "Sem plano", remaining: ledger.remaining, credits: ledger.credits, used: ledger.used, link: `${origin}/p/${student.teacher_id}/s/${encodeURIComponent(student.slug)}`, next: next ? { date: next.date, time: next.time } : null };
  }).sort((a, b) => Number(b.active) - Number(a.active) || a.remaining - b.remaining) : [];
  const upcoming: {studentId:string;name:string;date:string;time:string;status:string}[] = [];
  const calendarLessons: CalendarLesson[] = includeCalendar ? students.flatMap((student) => ledgers.get(student.id)!.ledger.lessons.filter((lesson) => (student.active || lesson.past) && lesson.date >= range.startDate && lesson.date <= range.endDate).map((lesson, index) => ({ id: `${student.id}-${index}`, date: lesson.date, time: lesson.time, durationMinutes:lesson.durationMinutes,status: lesson.status, name: student.name, href: `/students/${student.id}`, classroomHref:classroomsEnabled?classroomHref(student.id,lesson)??undefined:undefined, note: lesson.holidayName ? `${lesson.holidayName} · ${lesson.counts ? "conta no pacote" : "crédito mantido"}` : lesson.event?.note }))) : [];
  const paymentRows = view!=="directory" ? students.filter((student) => student.active).map((student) => {
    const { ledger, packages } = ledgers.get(student.id)!;
    return { id: student.id, name: student.name, remaining: ledger.remaining, link: `${origin}/p/${student.teacher_id}/s/${encodeURIComponent(student.slug)}`, hasEmail: Boolean(student.email), phone: student.phone ?? null, phoneCountry: student.phone_country ?? null, coveredUntil: ledger.coveredUntil, lastPaidOn: packages.map((pack) => pack.paid_on).sort().at(-1) ?? null, plan: student.plans?.name ?? "Sem plano", price: studentPrice(student, student.plans ?? undefined) ?? null };
  }).sort((a, b) => a.remaining - b.remaining || a.name.localeCompare(b.name)) : [];
  return { rows, upcoming, paymentRows, time, teacherName: teacher.name ?? "", today, calendarLessons, range };
 });
}
