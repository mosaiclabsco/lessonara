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
}, 30000);

afterAll(async () => {
  await db?.close();
});
it("reconstructs once, reallocates chronologically, corrects imported lessons, and removes payments without deleting history", async () => {
  await db.exec(`select public.reconstruct_lesson_history('${student}',current_date-28);`);
  const rows = await query<{
    id: string;
    provenance: string;
    counts: boolean;
    package_ref: string;
    package_position: number;
  }>(
    `select * from lesson_occurrences where student_id='${student}' order by lesson_date,lesson_time`,
  );
  expect(rows.filter((r) => r.provenance === "retroactive").length).toBe(3);
  expect(rows[0].package_ref).toBe(pkg);
  expect(rows[0].package_position).toBe(1);
  const auditsBefore = (await query(`select id from lesson_occurrence_changes`)).length;
  const again = await query<{ n: number }>(
    `select public.reconstruct_lesson_history('${student}',current_date-28) n`,
  );
  expect(again[0].n).toBe(0);
  expect((await query(`select id from lesson_occurrence_changes`)).length).toBe(auditsBefore);
  await db.exec(`select public.register_paid_package('${student}',current_date,4,300,null,false);`);
  const duplicates = await query(
    `select package_ref,package_position from lesson_occurrences where counts and package_ref is not null group by 1,2 having count(*)>1`,
  );
  expect(duplicates).toHaveLength(0);
  await db.exec(
    `select public.correct_imported_lesson('${student}','${rows[0].id}','desmarcada');`,
  );
  expect(
    (
      await query<{ counts: boolean }>(
        `select counts from lesson_occurrences where id='${rows[0].id}'`,
      )
    )[0].counts,
  ).toBe(false);
  await db.exec(`select public.reconstruct_lesson_history('${student}',current_date-28);`);
  expect(
    (
      await query<{ counts: boolean }>(
        `select counts from lesson_occurrences where id='${rows[0].id}'`,
      )
    )[0].counts,
  ).toBe(false);
  const count = (await query(`select id from lesson_occurrences`)).length;
  await db.exec(`select public.remove_paid_package('${student}','${pkg}');`);
  expect(await query(`select * from packages where id='${pkg}'`)).toHaveLength(0);
  expect(await query(`select * from lesson_occurrences where package_ref='${pkg}'`)).toHaveLength(
    0,
  );
  expect(await query(`select id from lesson_occurrences`)).toHaveLength(count);
  expect((await query(`select * from lesson_occurrence_changes`)).length).toBeGreaterThan(0);
  expect(
    await query(`select * from private.payment_removals where package_id='${pkg}'`),
  ).toHaveLength(1);
});
it("rejects other tenants, expired sessions, anonymous calls and invalid history dates", async () => {
  await db.exec(`set test.uid='00000000-0000-4000-8000-000000000099'`);
  for (const sql of [
    `select public.reconstruct_lesson_history('${student}',current_date-20)`,
    `select public.remove_paid_package('${student}','${pkg}')`,
    `select public.add_imported_lesson('${student}',current_date-2,'14:00')`,
    `select public.register_paid_package('${student}',current_date,4,300,null,false)`,
  ])
    await expect(db.exec(sql)).rejects.toThrow();
  await db.exec(`set test.uid='${teacher}';set test.session='false'`);
  await expect(
    db.exec(`select public.reconstruct_lesson_history('${student}',current_date-20)`),
  ).rejects.toThrow();
  await db.exec(`set test.session='true'`);
  await expect(
    db.exec(`select public.reconstruct_lesson_history('${student}',current_date-731)`),
  ).rejects.toThrow(/dois anos/);
  await db.exec(`set role anon`);
  await expect(
    db.exec(`select public.reconstruct_lesson_history('${student}',current_date-20)`),
  ).rejects.toThrow();
  await db.exec(`reset role`);
});
it("launches manual history and rolls back a payment if reconstruction is invalid", async () => {
  await db.exec(`select public.add_imported_lesson('${student}',current_date-3,'14:30');`);
  expect(await query(`select id from lesson_occurrences where provenance='manual'`)).toHaveLength(
    1,
  );
  await expect(
    db.exec(`select public.add_imported_lesson('${student}',current_date-3,'14:30')`),
  ).rejects.toThrow(/Já existe/);
  const before = (await query(`select id from packages`)).length;
  await expect(
    db.exec(`select public.register_paid_package('${student}',current_date-731,4,300,null,true)`),
  ).rejects.toThrow();
  expect((await query(`select id from packages`)).length).toBe(before);
});

it("requires a current schedule for recurring payments, including direct inserts, while flexible plans permit advance credit", async () => {
  await db.exec(`update schedules set ends_on=current_date-1 where student_id='${student}'`);
  await expect(
    db.exec(`select public.register_paid_package('${student}',current_date,4,300,null,false)`),
  ).rejects.toThrow(/horário fixo/);
  await expect(
    db.exec(
      `insert into packages(student_id,paid_on,lessons,amount) values('${student}',current_date,4,300)`,
    ),
  ).rejects.toThrow(/horário fixo/);
  await db.exec(
    `update plans set scheduling_mode='flexible' where id='${plan}';select public.register_paid_package('${student}',current_date,4,300,null,false);`,
  );
  expect(
    (await query(`select id from packages where student_id='${student}'`)).length,
  ).toBeGreaterThan(0);
});
