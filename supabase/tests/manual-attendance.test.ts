import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";
let db: PGlite;
const student = "00000000-0000-4000-8000-000000000001";
const teacher = "00000000-0000-4000-8000-000000000002";
const plan = "00000000-0000-4000-8000-000000000003";
const schedule = "00000000-0000-4000-8000-000000000004";
const pkg = "00000000-0000-4000-8000-000000000005";
async function query<T>(sql: string) {
  return (await db.query<T>(sql)).rows;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
 create schema auth; create schema private;
 create role anon;create role authenticated;create role service_role;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function auth.role() returns text language sql as $$select coalesce(nullif(current_setting('test.role',true),''),'service_role')$$;
 create function private.teacher_session_valid() returns boolean language sql as $$select coalesce(nullif(current_setting('test.session',true),'')::boolean,true)$$;
 grant usage on schema auth,private,public to authenticated,anon,service_role;
 grant execute on all functions in schema auth,private to authenticated,anon,service_role;
 create table public.teachers(id uuid primary key,lesson_minutes integer default 60);
 create table public.plans(id uuid primary key,teacher_id uuid,name text,lessons integer,price numeric,scheduling_mode text default 'recurring');
 create table public.students(id uuid primary key,teacher_id uuid,plan_id uuid,name text,price_override numeric,opening_credits integer default 0);
 create table public.schedules(id uuid primary key,student_id uuid,weekday integer,monthly_day integer,time time,starts_on date,ends_on date,duration_minutes integer default 60,meet_url text);
 create table public.appointments(id uuid primary key,student_id uuid,date date,time time,duration_minutes integer default 60,meet_url text);
 create table public.lesson_events(id uuid primary key default gen_random_uuid(),student_id uuid,date date,time time,kind text,note text,duration_minutes integer default 60,meet_url text,source_event_id uuid,created_at timestamptz default now());
 create table public.packages(id uuid primary key default gen_random_uuid(),notes text,student_id uuid,paid_on date,lessons integer,amount numeric,created_at timestamptz default now());
 create table public.holidays(id uuid primary key,teacher_id uuid,date date,name text);
 create table public.holiday_settings(teacher_id uuid primary key,enabled boolean,policy text,effective_from date);
 create table public.classroom_participation(teacher_id uuid,student_id uuid,source_kind text,source_id uuid,lesson_date date,participant_id text,participant_role text,joined_at timestamptz);
 create function public.schedule_on_day(d date,s date,e date,w integer,m integer) returns boolean language sql immutable as $$ select d>=s and (e is null or d<=e) and case when m is not null then extract(day from d)=m else extract(dow from d)=w end $$;
 `);
  await db.exec(
    await readFile(new URL("../migrations/0029_lesson_history.sql", import.meta.url), "utf8"),
  );
  await db.exec(
    `insert into teachers(id) values('${teacher}');insert into plans(id,teacher_id,name,lessons,price) values('${plan}','${teacher}','Original',4,300);insert into students(id,teacher_id,plan_id,name) values('${student}','${teacher}','${plan}','Fixture');insert into packages(id,student_id,paid_on,lessons,amount) values('${pkg}','${student}',current_date-30,4,300);insert into schedules(id,student_id,weekday,time,starts_on,ends_on) values('${schedule}','${student}',extract(dow from current_date-7),'09:00',current_date-7,current_date-1);`,
  );
  await db.exec(
    await readFile(new URL("../migrations/0038_retroactive_history.sql", import.meta.url), "utf8"),
  );
  await db.exec(
    await readFile(
      new URL("../migrations/0040_payment_schedule_guard.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL("../migrations/0041_history_reconstruction_guards.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    `set test.uid='${teacher}';set test.role='authenticated';update schedules set ends_on=null where id='${schedule}';`,
  );
  await db.exec(
    await readFile(new URL("../migrations/0042_manual_attendance.sql", import.meta.url), "utf8"),
  );
}, 30000);

afterAll(async () => {
  await db?.close();
});

it("defaults to manual, preserves old history and persists pending lessons without confirming attendance", async () => {
  const old = await query<{ status: string }>(
    `select status from lesson_occurrences order by lesson_date limit 1`,
  );
  expect(old[0].status).toBe("dada");
  await db.exec(
    `update teachers set attendance_effective_at=now()-interval '2 days' where id='${teacher}';insert into appointments values(gen_random_uuid(),'${student}',((now()-interval '1 hour') at time zone 'America/Sao_Paulo')::date,((now()-interval '1 hour') at time zone 'America/Sao_Paulo')::time,60,null);select ensure_lesson_history(array['${student}']::uuid[]);`,
  );
  const pending = await query<{ id: string; status: string }>(
    `select id,status from lesson_occurrences where source_kind='appointment'`,
  );
  expect(pending[0].status).toBe("pendente");
  await db.exec(`set test.uid='00000000-0000-4000-8000-000000000099'`);
  await expect(
    db.exec(`select set_lesson_attendance('${student}','${pending[0].id}','dada')`),
  ).rejects.toThrow();
  await db.exec(`set test.uid='${teacher}';set test.session='false'`);
  await expect(
    db.exec(`select set_lesson_attendance('${student}','${pending[0].id}','dada')`),
  ).rejects.toThrow();
  await db.exec(
    `set test.session='true';select set_lesson_attendance('${student}','${pending[0].id}','dada');select set_lesson_attendance('${student}','${pending[0].id}','dada');`,
  );
  expect(
    (
      await query<{ status: string }>(
        `select status from lesson_occurrences where id='${pending[0].id}'`,
      )
    )[0].status,
  ).toBe("dada");
  expect(
    (
      await query<{ n: number }>(
        `select count(*)::integer n from lesson_occurrence_changes where occurrence_id='${pending[0].id}'`,
      )
    )[0].n,
  ).toBe(1);
});
it("rejects direct preference edits and invalid values, while allowing an authorized explicit mode change", async () => {
  await db.exec(`grant select,update on public.teachers to authenticated;set role authenticated`);
  await expect(
    db.exec(`update teachers set attendance_mode='automatic' where id='${teacher}'`),
  ).rejects.toThrow("Use a configuração de presença.");
  await db.exec(`reset role`);
  await expect(db.exec(`select set_attendance_mode('invalid')`)).rejects.toThrow();
  await db.exec(`select set_attendance_mode('automatic')`);
  expect(
    (
      await query<{ attendance_mode: string }>(
        `select attendance_mode from teachers where id='${teacher}'`,
      )
    )[0].attendance_mode,
  ).toBe("automatic");
});
