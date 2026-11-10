import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, beforeEach, afterAll, expect, it } from "vitest";
let db: PGlite;
const teacher = "00000000-0000-4000-8000-000000000002",
  student = "00000000-0000-4000-8000-000000000001",
  plan = "00000000-0000-4000-8000-000000000003",
  other = "00000000-0000-4000-8000-000000000004";
async function migration(name: string) {
  return readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8");
}
async function rows<T = Record<string, unknown>>(sql: string) {
  return (await db.query<T>(sql)).rows;
}
async function apply(instances = 1, event = "google1", link: string | null = null) {
  const source = Array.from(
    { length: instances },
    (_, i) =>
      `jsonb_build_object('id','instance${i}','date',current_date+${i + 1},'time','10:00','duration',60,'meet',null)`,
  );
  return (
    await rows<{ id: string }>(
      `select public.apply_google_lesson_link('${teacher}','${student}','${event}','English',true,current_date,current_date+180,jsonb_build_array(${source.join(",")}),${link ? `'${link}'` : "null"}) id`,
    )
  )[0].id;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema auth;create schema private;create role anon;create role authenticated;create role service_role;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function auth.role() returns text language sql as $$select coalesce(nullif(current_setting('test.role',true),''),'service_role')$$;
 create function private.teacher_session_valid() returns boolean language sql as $$select coalesce(nullif(current_setting('test.session',true),'')::boolean,true)$$;
 grant usage on schema auth,private,public to authenticated,anon,service_role;
 grant execute on all functions in schema auth,private to authenticated,anon,service_role;
 create table teachers(id uuid primary key,lesson_minutes integer default 60,platform_plan text default 'pro',access_suspended boolean default false);
 create function private.platform_feature_enabled(tid uuid,feature text) returns boolean language sql stable as $$select exists(select 1 from public.teachers where id=tid and platform_plan in ('plus','pro') and not access_suspended and feature='google')$$;
 create table plans(id uuid primary key,teacher_id uuid,name text,lessons integer,price numeric,scheduling_mode text default 'recurring',frequency_period text default 'week',frequency_count integer default 2);
 create table students(id uuid primary key,teacher_id uuid references teachers on delete cascade,plan_id uuid,name text,email text,active boolean default true,price_override numeric,opening_credits integer default 0);
 create table schedules(id uuid primary key default gen_random_uuid(),student_id uuid,weekday integer,monthly_day integer,time time,starts_on date,ends_on date,duration_minutes integer default 60,meet_url text);
 create table appointments(id uuid primary key default gen_random_uuid(),teacher_id uuid,student_id uuid,date date,time time,duration_minutes integer default 60 check(duration_minutes between 15 and 180 and duration_minutes%15=0),meet_url text,unique(student_id,date));
 create table lesson_events(id uuid primary key default gen_random_uuid(),student_id uuid,date date,time time,kind text,note text,duration_minutes integer default 60,meet_url text,source_event_id uuid,created_at timestamptz default now());
 create table packages(id uuid primary key default gen_random_uuid(),notes text,student_id uuid,paid_on date,lessons integer,amount numeric,created_at timestamptz default now());
 create table holidays(id uuid primary key,teacher_id uuid,date date,name text);create table holiday_settings(teacher_id uuid primary key,enabled boolean,policy text,effective_from date);
 create table classroom_participation(teacher_id uuid,student_id uuid,source_kind text,source_id uuid,lesson_date date,participant_id text,participant_role text,joined_at timestamptz);
 create function schedule_on_day(d date,s date,e date,w integer,m integer) returns boolean language sql immutable as $$select d>=s and (e is null or d<=e) and case when m is not null then extract(day from d)=m else extract(dow from d)=w end$$;
 create table google_calendar_connections(teacher_id uuid primary key);
 `);
  const cal = await migration("0013_google_calendar.sql");
  await db.exec("begin;" + cal.slice(cal.indexOf("create table public.calendar_jobs")));
  const scheduling = await migration("0011_monthly_schedules_and_linked_makeups.sql");
  await db.exec(
    scheduling.slice(
      scheduling.indexOf("create function public.guard_appointment"),
      scheduling.indexOf("create function public.guard_makeup"),
    ),
  );
  const duration = await migration("0014_lesson_duration.sql");
  await db.exec(
    duration.slice(
      duration.indexOf("create function public.snapshot_lesson_duration"),
      duration.indexOf("create or replace function public.ensure_lesson_slot"),
    ),
  );
  await db.exec(
    duration.slice(
      duration.indexOf("create or replace function public.ensure_lesson_slot"),
      duration.lastIndexOf("commit;"),
    ),
  );
  await db.exec(await migration("0029_lesson_history.sql"));
  await db.exec(await migration("0040_payment_schedule_guard.sql"));
  await db.exec(await migration("0042_manual_attendance.sql"));
  await db.exec(await migration("0044_google_lesson_links.sql"));
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(`reset role;set test.role='service_role';set test.uid='';truncate teachers,plans,students,schedules,appointments,packages,lesson_events,google_lesson_links,lesson_occurrences,calendar_jobs,google_calendar_connections cascade;
 insert into teachers(id) values('${teacher}'),('${other}');insert into plans(id,teacher_id,name,lessons,price) values('${plan}','${teacher}','English',8,400);
 insert into students(id,teacher_id,plan_id,name) values('${student}','${teacher}','${plan}','Demo');insert into google_calendar_connections values('${teacher}');`);
});
it("atomically links future occurrences, keeps stable IDs and never queues Google copies", async () => {
  const link = await apply();
  const before = await rows("select id from appointments");
  await apply(1, "google1", link);
  expect(await rows("select id from appointments")).toEqual(before);
  expect(await rows("select * from calendar_jobs")).toHaveLength(0);
  await db.exec(
    `select enqueue_calendar_source('${teacher}','appointment','${before[0].id}','upsert')`,
  );
  expect(await rows("select * from calendar_jobs")).toHaveLength(0);
  expect(await rows("select * from lesson_occurrences")).toHaveLength(0);
  expect(await rows("select * from packages")).toHaveLength(0);
});
it("duplicate event or conflict rolls back the entire new link", async () => {
  await apply();
  await expect(apply()).rejects.toThrow();
  await expect(apply(1, "otherEvent")).rejects.toThrow();
  expect(await rows("select * from google_lesson_links")).toHaveLength(1);
  expect(await rows("select * from appointments")).toHaveLength(1);
});
it("respects plan frequency and conflicts with another student", async () => {
  await db.exec(`update plans set frequency_count=1`);
  await expect(apply(3)).rejects.toThrow("quantidade");
  expect(await rows("select * from appointments")).toHaveLength(0);
  await db.exec(
    `update plans set frequency_count=2;insert into students(id,teacher_id,plan_id,name) values('${other}','${teacher}','${plan}','Other');insert into schedules(student_id,weekday,time,starts_on) values('${other}',extract(dow from current_date+1),'10:30',current_date+1);`,
  );
  await expect(apply()).rejects.toThrow("aula fixa");
});
it.each(["essential", "suspended"])(
  "blocks plan or suspension authoritatively: %s",
  async (mode) => {
    await db.exec(
      mode === "essential"
        ? "update teachers set platform_plan='essential'"
        : "update teachers set access_suspended=true",
    );
    await expect(apply()).rejects.toThrow();
    expect(await rows("select * from appointments")).toHaveLength(0);
  },
);
it("rejects a cross-tenant student even with service-only entrypoint", async () => {
  await db.exec(`update students set teacher_id='${other}'`);
  await expect(apply()).rejects.toThrow();
});
it.each(["authenticated", "anon"])("direct RPC requests are denied: %s", async (role) => {
  await db.exec(`set role ${role};set test.role='${role}'`);
  await expect(apply()).rejects.toMatchObject({ code: "42501" });
});
it("RLS only exposes own links and direct appointment edits are denied", async () => {
  await apply();
  await db.exec(
    `grant select,update,delete on appointments to authenticated;set role authenticated;set test.role='authenticated';set test.uid='${teacher}'`,
  );
  expect(await rows("select * from google_lesson_links")).toHaveLength(1);
  await expect(db.exec("update appointments set time='12:00' ")).rejects.toThrow("Google Calendar");
  await expect(
    db.exec("update appointments set google_link_id=null,google_instance_id=null"),
  ).rejects.toThrow();
  await db.exec(`set test.uid='${other}'`);
  expect(await rows("select * from google_lesson_links")).toHaveLength(0);
});
it("missing instances remove only local future lessons and never enqueue remote deletion", async () => {
  const link = await apply();
  await apply(0, "google1", link);
  expect(await rows("select * from appointments")).toHaveLength(0);
  expect(await rows("select * from calendar_jobs")).toHaveLength(0);
});
it("unlink is tenant-scoped, retains link audit and removes only future local lessons", async () => {
  const link = await apply();
  await expect(
    db.exec(`select unlink_google_lesson('${other}','${student}','${link}')`),
  ).rejects.toThrow();
  await db.exec(`select unlink_google_lesson('${teacher}','${student}','${link}')`);
  expect((await rows("select active from google_lesson_links"))[0].active).toBe(false);
  expect(await rows("select * from appointments")).toHaveLength(0);
  expect(await rows("select * from calendar_jobs")).toHaveLength(0);
  await expect(apply(1, "google1", link)).rejects.toThrow();
});
it("linked lessons satisfy the payment guard without creating historical lessons", async () => {
  await apply();
  await db.exec(
    `insert into packages(student_id,paid_on,lessons,amount) values('${student}',current_date,8,400)`,
  );
  expect(await rows("select * from packages")).toHaveLength(1);
  expect(await rows("select * from lesson_occurrences")).toHaveLength(0);
});
it.each(["manual", "automatic"])(
  "future linked occurrences follow attendance mode %s and unlink preserves history",
  async (mode) => {
    const link = await apply();
    await db.exec(
      `update google_lesson_links set starts_on=current_date-2;update teachers set attendance_mode='${mode}',attendance_effective_at=now()-interval '2 days';update appointments set date=current_date-1;select ensure_lesson_history(array['${student}']::uuid[]);`,
    );
    expect((await rows("select status from lesson_occurrences"))[0].status).toBe(
      mode === "manual" ? "pendente" : "dada",
    );
    await db.exec(`select unlink_google_lesson('${teacher}','${student}','${link}')`);
    expect(await rows("select * from lesson_occurrences")).toHaveLength(1);
  },
);

it("a native schedule added later cannot bypass a linked lesson frequency limit", async () => {
  await apply();
  await db.exec("update plans set frequency_count=1");
  await expect(
    db.exec(
      `insert into schedules(student_id,weekday,time,starts_on,ends_on) values('${student}',extract(dow from current_date+1),'16:00',current_date+1,current_date+1)`,
    ),
  ).rejects.toThrow("quantidade");
  expect(await rows("select * from schedules")).toHaveLength(0);
});

it("disconnect between Google read and confirmation prevents the local write", async () => {
  await db.exec("delete from google_calendar_connections");
  await expect(apply()).rejects.toThrow();
  expect(await rows("select * from google_lesson_links")).toHaveLength(0);
});
