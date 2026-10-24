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
 create table public.teachers(id uuid primary key);
 create table public.plans(id uuid primary key,teacher_id uuid,name text,lessons integer,price numeric);
 create table public.students(id uuid primary key,teacher_id uuid,plan_id uuid,name text,price_override numeric,opening_credits integer default 0);
 create table public.schedules(id uuid primary key,student_id uuid,weekday integer,monthly_day integer,time time,starts_on date,ends_on date,duration_minutes integer default 60,meet_url text);
 create table public.appointments(id uuid primary key,student_id uuid,date date,time time,duration_minutes integer default 60,meet_url text);
 create table public.lesson_events(id uuid primary key default gen_random_uuid(),student_id uuid,date date,time time,kind text,note text,duration_minutes integer default 60,meet_url text,source_event_id uuid,created_at timestamptz default now());
 create table public.packages(id uuid primary key,student_id uuid,paid_on date,lessons integer,amount numeric,created_at timestamptz default now());
 create table public.holidays(id uuid primary key,teacher_id uuid,date date,name text);
 create table public.holiday_settings(teacher_id uuid primary key,enabled boolean,policy text,effective_from date);
 create table public.classroom_participation(teacher_id uuid,student_id uuid,source_kind text,source_id uuid,lesson_date date,participant_id text,participant_role text,joined_at timestamptz);
 create function public.schedule_on_day(d date,s date,e date,w integer,m integer) returns boolean language sql immutable as $$ select d>=s and (e is null or d<=e) and case when m is not null then extract(day from d)=m else extract(dow from d)=w end $$;
 `);
  await db.exec(
    await readFile(new URL("../migrations/0029_lesson_history.sql", import.meta.url), "utf8"),
  );
  await db.exec(
    `insert into teachers values('${teacher}');insert into plans values('${plan}','${teacher}','Original',4,300);insert into students(id,teacher_id,plan_id,name) values('${student}','${teacher}','${plan}','Fixture');insert into packages(id,student_id,paid_on,lessons,amount) values('${pkg}','${student}',current_date-30,4,300);insert into schedules(id,student_id,weekday,time,starts_on,ends_on) values('${schedule}','${student}',extract(dow from current_date-7),'09:00',current_date-7,current_date-1);`,
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
it("persists stable identity, date, plan and credit before schedule deletion or plan changes", async () => {
  await db.exec(`select public.ensure_lesson_history(array['${student}'::uuid]);`);
  const before = await query<{
    id: string;
    lesson_date: string;
    package_ref: string;
    package_position: number;
    plan_snapshot: { name: string };
  }>(`select * from lesson_occurrences where student_id='${student}'`);
  expect(before).toHaveLength(1);
  expect(before[0].package_ref).toBe(pkg);
  expect(before[0].package_position).toBe(1);
  await db.exec(
    `update plans set name='Changed',price=999 where id='${plan}';delete from schedules where id='${schedule}';select public.ensure_lesson_history(array['${student}'::uuid]);`,
  );
  const after = await query<(typeof before)[number]>(
    `select * from lesson_occurrences where student_id='${student}'`,
  );
  expect(after[0].id).toBe(before[0].id);
  expect(after[0].lesson_date).toEqual(before[0].lesson_date);
  expect(after[0].plan_snapshot.name).toBe("Original");
  expect(after[0].package_ref).toBe(pkg);
});
it("keeps manual corrections auditable after the original schedule is gone", async () => {
  await db.exec(
    `insert into lesson_events(student_id,date,time,kind) select student_id,lesson_date,lesson_time,'desmarcada' from lesson_occurrences where student_id='${student}';`,
  );
  expect(
    (
      await query<{ counts: boolean }>(
        `select counts from lesson_occurrences where student_id='${student}'`,
      )
    )[0].counts,
  ).toBe(false);
  expect((await query(`select * from lesson_occurrence_changes`)).length).toBeGreaterThan(0);
  await db.exec(`delete from lesson_events where student_id='${student}';`);
  expect(
    (
      await query<{ status: string; counts: boolean }>(
        `select status,counts from lesson_occurrences where student_id='${student}'`,
      )
    )[0],
  ).toEqual({ status: "dada", counts: true });
});
it("does not allow rewriting or deleting payment metadata used by history", async () => {
  await expect(db.exec(`delete from packages where id='${pkg}'`)).rejects.toThrow(/histórico/);
  await expect(db.exec(`update packages set lessons=1 where id='${pkg}'`)).rejects.toThrow(
    /histórico/,
  );
});
it("denies history capture across tenants and with expired sessions", async () => {
  await db.exec(
    `set test.role='authenticated';set test.uid='00000000-0000-4000-8000-000000000099';`,
  );
  await expect(
    db.exec(`select public.ensure_lesson_history(array['${student}'::uuid])`),
  ).rejects.toThrow();
  await db.exec(`set test.uid='${teacher}';set test.session='false'`);
  await expect(
    db.exec(`select public.ensure_lesson_history(array['${student}'::uuid])`),
  ).rejects.toThrow();
  await db.exec(`set test.session='true';set test.role='service_role'`);
});
it("freezes an early conference callback once and survives reconnects and schedule removal", async () => {
  const id = "00000000-0000-4000-8000-000000000006";
  await db.exec(
    `insert into appointments(id,student_id,date,time) values('${id}','${student}',current_date+1,'18:00');insert into classroom_participation values('${teacher}','${student}','appointment','${id}',current_date+1,'actor','teacher',now());`,
  );
  const before = await query<{ id: string; first_joined_at: string; package_position: number }>(
    `select * from lesson_occurrences where source_id='${id}'`,
  );
  expect(before).toHaveLength(1);
  expect(before[0].package_position).toBe(2);
  await db.exec(
    `update classroom_participation set joined_at=now()+interval '1 minute' where source_id='${id}';delete from appointments where id='${id}';`,
  );
  const after = await query<(typeof before)[number]>(
    `select * from lesson_occurrences where source_id='${id}'`,
  );
  expect(after).toHaveLength(1);
  expect(after[0].id).toBe(before[0].id);
  expect(after[0].first_joined_at).toEqual(before[0].first_joined_at);
  expect(after[0].package_position).toBe(2);
});

it("does not duplicate a past lesson when the same time is recreated under a new schedule", async () => {
  const id = "00000000-0000-4000-8000-000000000007";
  await db.exec(
    `insert into schedules(id,student_id,weekday,time,starts_on,ends_on) values('${id}','${student}',extract(dow from current_date-7),'09:00',current_date-7,current_date-1);select public.ensure_lesson_history(array['${student}'::uuid]);`,
  );
  expect(
    await query(
      `select id from lesson_occurrences where student_id='${student}' and lesson_time='09:00'`,
    ),
  ).toHaveLength(1);
});
it("preserves holiday consumption on cancel and undo, and allocates a late payment to uncovered lessons", async () => {
  const sid = "00000000-0000-4000-8000-000000000008",
    aid = "00000000-0000-4000-8000-000000000009";
  await db.exec(
    `insert into students(id,teacher_id,plan_id) values('${sid}','${teacher}','${plan}');insert into holiday_settings values('${teacher}',true,'consume',current_date-30);insert into holidays values(gen_random_uuid(),'${teacher}',current_date-2,'Holiday');insert into appointments(id,student_id,date,time) values('${aid}','${sid}',current_date-2,'14:00');select public.ensure_lesson_history(array['${sid}'::uuid]);`,
  );
  expect(
    (
      await query<{ package_ref: string | null }>(
        `select package_ref from lesson_occurrences where student_id='${sid}'`,
      )
    )[0].package_ref,
  ).toBeNull();
  await db.exec(
    `insert into lesson_events(student_id,date,time,kind) values('${sid}',current_date-2,'14:00','desmarcada');delete from lesson_events where student_id='${sid}';`,
  );
  expect(
    (
      await query<{ counts: boolean; status: string }>(
        `select counts,status from lesson_occurrences where student_id='${sid}'`,
      )
    )[0],
  ).toEqual({ counts: true, status: "feriado" });
  await db.exec(
    `insert into packages(id,student_id,paid_on,lessons,amount) values(gen_random_uuid(),'${sid}',current_date,4,400);select public.ensure_lesson_history(array['${sid}'::uuid]);`,
  );
  expect(
    (
      await query<{ package_ref: string | null; package_position: number }>(
        `select package_ref,package_position from lesson_occurrences where student_id='${sid}'`,
      )
    )[0].package_position,
  ).toBe(1);
});
it("blocks direct edits to snapshots and hides them from a different teacher", async () => {
  await db.exec(
    `set test.uid='00000000-0000-4000-8000-000000000099';set test.role='authenticated';set role authenticated`,
  );
  expect(await query(`select id from lesson_occurrences`)).toHaveLength(0);
  await expect(db.exec(`update lesson_occurrences set counts=false`)).rejects.toThrow(
    /permission denied/,
  );
  await db.exec(`reset role;set test.role='service_role'`);
});
