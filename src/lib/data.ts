import {measure} from "./performance";
import { loadHolidayRules } from "./holiday-data";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nowInTZ } from "./dates";
import { computeLedger, type Ledger, type LessonEvent, type Package, type Schedule } from "./ledger";

export type Student = {
  id: string;
  teacher_id: string;
  slug: string;
  name: string;
  email: string | null;
  phone?: string | null;
  phone_country?: string | null;
  weekly_lessons?: number | null;
  plan_id: string | null;
  price_override: number | null;
  active: boolean;
  notes: string | null;
};

export type Teacher = {
  lesson_minutes?:number;profile_completed_at?:string|null;platform_plan?:string;
  id: string;
  name: string;
  email: string;
};

export type Plan = {
  is_active?:boolean;
  frequency_period?:"week"|"month";frequency_count?:number;scheduling_mode?:"recurring"|"flexible";
  weekly_lessons?: number;
  id: string;
  name: string;
  lessons: number;
  price: number;
};

export type ScheduleRow = Schedule & { id: string };

export function studentPrice(student: Pick<Student,"price_override">, plan: Plan | undefined): number | undefined {
  return student.price_override ?? plan?.price;
}

const trimTime = (t: string | null) => (t ? t.slice(0, 5) : t);

/** Carrega agenda, pacotes e exceções de vários alunos e calcula o saldo de cada um. */
export type StudentLedger = {
  ledger: Ledger;
  schedules: ScheduleRow[];appointments?:{id:string;date:string;time:string;meet_url?:string|null}[];
  packages: Package[];
  today: string;
};

export async function loadLedgers(supabase: SupabaseClient, studentIds: string[], knownStudents?: Pick<Student,"id"|"teacher_id">[]): Promise<Map<string, StudentLedger>> {
  const result = new Map<string, StudentLedger>();
  if (studentIds.length === 0) return result;
  async function rows<T>(table:string,columns:string,key="student_id"):Promise<{data:T[];error:null}>{const collected:T[]=[];for(let offset=0;offset<studentIds.length;offset+=200){const batch=studentIds.slice(offset,offset+200);for(let page=0;;page+=1000){const result=await supabase.from(table).select(columns).in(key,batch).order("id").range(page,page+999).returns<T[]>();if(result.error)throw result.error;collected.push(...(result.data??[]));if((result.data?.length??0)<1000)break;}}return {data:collected,error:null};}
  const studentsPromise=knownStudents
    ? Promise.resolve({data:knownStudents.filter(student=>studentIds.includes(student.id)),error:null})
    : rows<{id:string;teacher_id:string}>("students","id,teacher_id","id");
  const rulesPromise=studentsPromise.then(students=>loadHolidayRules(supabase,[...new Set(students.data.map(student=>student.teacher_id))]));
  const [students,schedules,packages,events,appointments,rules]=await measure("ledger.reads",()=>Promise.all([
   studentsPromise,
   rows<ScheduleRow&{student_id:string}>("schedules","id,student_id,weekday,monthly_day,time,starts_on,ends_on,meet_url,duration_minutes"),
   rows<Package&{student_id:string}>("packages","id,student_id,paid_on,lessons,amount,created_at"),
   rows<LessonEvent&{student_id:string}>("lesson_events","id,student_id,date,time,kind,note,source_event_id,meet_url,duration_minutes"),
   rows<{id:string;student_id:string;date:string;time:string;meet_url:string|null}>("appointments","id,student_id,date,time,meet_url,duration_minutes"),
   rulesPromise
  ]));
  return measure("ledger.compute",async()=>{
  const { today, time } = nowInTZ();
  const group=<T extends {student_id:string}>(rows:T[])=>{const map=new Map<string,T[]>();for(const row of rows){const existing=map.get(row.student_id);if(existing)existing.push(row);else map.set(row.student_id,[row]);}return map;};
  const scheduleGroups=group(schedules.data??[]),packageGroups=group(packages.data??[]),eventGroups=group(events.data??[]),appointmentGroups=group(appointments.data??[]);const teacherByStudent=new Map((students.data??[]).map(student=>[student.id,student.teacher_id]));

  for (const id of studentIds) {
    const s = (scheduleGroups.get(id)??[]).map((r) => ({ ...r, time: trimTime(r.time)! })) as ScheduleRow[];
    const p = (packageGroups.get(id)??[]) as Package[];
    const e = (eventGroups.get(id)??[]).map((r) => ({ ...r, time: trimTime(r.time) })) as LessonEvent[];
    const teacherId = teacherByStudent.get(id);
    const settings = rules.settings.find(rule => rule.teacher_id === teacherId);
    const holidays = settings?.enabled ? rules.holidays.filter(holiday => holiday.teacher_id === teacherId && holiday.date >= settings.effective_from!) : [];
    result.set(id, { ledger: computeLedger({ schedules: s, events: e, appointments:(appointmentGroups.get(id)??[]).map(a=>({...a,time:trimTime(a.time)!})),packages: p, holidays, holidayPolicy: settings?.policy, today, time }), schedules: s,appointments:(appointmentGroups.get(id)??[]).map(a=>({...a,time:trimTime(a.time)!})), packages: p, today });
  }
  return result;
  });
}
