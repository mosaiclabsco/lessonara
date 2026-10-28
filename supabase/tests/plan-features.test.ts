import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, beforeEach, afterAll, expect, it } from "vitest";
import { PLATFORM_PLANS, platformPlan } from "../../src/lib/platform-plans";
let db: PGlite;
let previousChoicesPreserved = false;
const teacher = "00000000-0000-4000-8000-000000000001",
  student = "00000000-0000-4000-8000-000000000002";
async function scalar<T = unknown>(sql: string) {
  return Object.values((await db.query<Record<string, T>>(sql)).rows[0])[0];
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema auth;create schema private;create role anon;create role authenticated;create role service_role;
 create function auth.role() returns text language sql as $$select coalesce(nullif(current_setting('test.role',true),''),'service_role')$$;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function private.teacher_session_valid() returns boolean language sql as $$select true$$;
 create table teachers(id uuid primary key,platform_plan text,access_suspended boolean default false,profile_completed_at timestamptz default now());
 create table students(id uuid primary key,teacher_id uuid,email text,active boolean default true,promotional_email_opt_out boolean default false);
 create table reminders(student_id uuid,credits integer,primary key(student_id,credits));
 create table email_campaigns(id uuid primary key,teacher_id uuid,subject text,recipients integer,created_at timestamptz default now());
 create table email_outbox(id uuid primary key default gen_random_uuid(),event_key text unique,teacher_id uuid,student_id uuid,recipient text,template text,payload jsonb default '{}',status text default 'pending',attempts integer default 0,expires_at timestamptz default now()+interval '1 day',first_attempt_at timestamptz,locked_at timestamptz,available_at timestamptz default now(),created_at timestamptz default now(),lease_id uuid,last_error text,delivery jsonb,delivery_status text);
 create table calendar_jobs(id uuid primary key default gen_random_uuid(),teacher_id uuid,status text,attempts integer,created_at timestamptz default now(),available_at timestamptz default now(),lease_id uuid,locked_at timestamptz,last_error text);

 alter table email_outbox add constraint email_outbox_template_check check(template in ('welcome','otp','reminder','campaign'));
 alter table email_outbox enable row level security;alter table email_campaigns enable row level security;alter table calendar_jobs enable row level security;
 grant usage on schema public,auth,private to authenticated;grant select on teachers,students,email_outbox,email_campaigns,calendar_jobs to authenticated;
 create policy "own emails" on email_outbox for select to authenticated using(teacher_id=auth.uid());create policy "own campaigns" on email_campaigns for select to authenticated using(teacher_id=auth.uid());create policy "own calendar" on calendar_jobs for select to authenticated using(teacher_id=auth.uid());
 `);
  await db.exec(
    await readFile(new URL("../migrations/0030_worker_operations.sql", import.meta.url), "utf8"),
  );
  await db.exec(`create schema storage;create table storage.buckets(id text primary key,file_size_limit bigint);insert into storage.buckets values('lessonara-documents',null),('lessonara-activities',null);
 create table documents(id uuid primary key,teacher_id uuid,byte_size bigint,storage_path text,mime_type text,status text);create table activity_submissions(id uuid primary key,teacher_id uuid,byte_size bigint,storage_path text,mime_type text,status text);`);
  await db.exec(
    await readFile(
      new URL("../migrations/0031_plan_features_notifications.sql", import.meta.url),
      "utf8",
    ),
  );

  await db.exec(
    await readFile(
      new URL("../migrations/0032_storage_provider_ceiling.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(`insert into students(id,operational_email_opt_out) values('${student}',true)`);
  await db.exec(
    await readFile(
      new URL("../migrations/0036_split_email_preferences.sql", import.meta.url),
      "utf8",
    ),
  );
  previousChoicesPreserved = await scalar<boolean>(
    "select lesson_email_opt_out and renewal_email_opt_out from students",
  );
  await db.exec("delete from students");
  const entitlementSql = await readFile(
    new URL("../migrations/0016_platform_entitlements.sql", import.meta.url),
    "utf8",
  );
  const quotaFunction = entitlementSql.slice(
    entitlementSql.indexOf("create function public.enforce_platform_storage()"),
    entitlementSql.indexOf("create or replace function public.reserve_document_upload"),
  );
  await db.exec(quotaFunction);
  await db.exec(
    `create trigger protect_platform_plan before insert or update on teachers for each row execute function protect_platform_plan();`,
  );
}, 30000);
afterAll(async () => await db?.close());
beforeEach(async () => {
  await db.exec(
    `reset role;set test.role='service_role';set test.uid='${teacher}';truncate teachers,students,email_outbox,email_campaigns,calendar_jobs;update private.lesson_notice_state set cursor=null;insert into teachers(id,platform_plan) values('${teacher}','pro');insert into students(id,teacher_id,email) values('${student}','${teacher}','fixture@example.com');`,
  );
});
it("matriz SQL coincide com todas as permissões e cotas da aplicação", async () => {
  for (const plan of Object.values(PLATFORM_PLANS)) {
    await db.exec(`update teachers set platform_plan='${plan.id}'`);
    for (const feature of [
      "emails",
      "google",
      "exports",
      "imports",
      "classroom",
      "lessonReminders",
    ] as const)
      expect(
        await scalar(`select private.platform_feature_enabled('${teacher}','${feature}')`),
      ).toBe(plan[feature]);
    const limits = await scalar<{ max_file_bytes: number; storage_bytes: number }>(
      `select row_to_json(l) from platform_storage_limits('${teacher}') l`,
    );
    expect(Number(limits.max_file_bytes)).toBe(platformPlan(plan.id).maxFileBytes);
    expect(Number(limits.storage_bytes)).toBe(plan.storageBytes);
  }
});
it("professor não altera o próprio plano, mesmo sem sub, mas administração conserva o fluxo", async () => {
  await db.exec(`set test.role='authenticated'`);
  await expect(db.exec(`update teachers set platform_plan='essential'`)).rejects.toThrow(
    /administração/,
  );
  await db.exec(`set test.uid=''`);
  await expect(db.exec(`update teachers set platform_plan='plus'`)).rejects.toThrow();
  await db.exec(`set test.role='service_role';update teachers set platform_plan='plus'`);
  expect(await scalar("select platform_plan from teachers")).toBe("plus");
});
it("consulta direta de emails e Calendar é bloqueada no Essencial", async () => {
  await db.exec(
    `insert into email_outbox(event_key,teacher_id) values('fixture','${teacher}');insert into email_campaigns(id,teacher_id,subject,recipients) values(gen_random_uuid(),'${teacher}','Title',1);insert into calendar_jobs(teacher_id,status,attempts) values('${teacher}','failed',5);update teachers set platform_plan='essential';set test.role='authenticated';set role authenticated`,
  );
  for (const table of ["email_outbox", "email_campaigns", "calendar_jobs"])
    expect(await scalar(`select count(*)::int from ${table}`)).toBe(0);
  await db.exec(
    `reset role;set test.role='service_role';update teachers set platform_plan='plus';set test.role='authenticated';set role authenticated`,
  );
  for (const table of ["email_outbox", "email_campaigns", "calendar_jobs"])
    expect(await scalar(`select count(*)::int from ${table}`)).toBe(1);
});
it("SQL deduplica lembrete e revalida Pro e preferência do aluno", async () => {
  const date = String(
      await scalar(
        `select to_char(now() at time zone 'America/Sao_Paulo'+interval '30 minutes','YYYY-MM-DD')`,
      ),
    ),
    time = String(
      await scalar(
        `select to_char(now() at time zone 'America/Sao_Paulo'+interval '30 minutes','HH24:MI')`,
      ),
    );
  const payload = JSON.stringify([
    {
      student_id: student,
      teacher_id: teacher,
      date,
      time,
      source_kind: "schedule",
      source_id: "00000000-0000-4000-8000-000000000003",
    },
  ]);
  const queue = () => scalar(`select queue_lesson_notices(null,'${payload}')`);
  expect(await queue()).toBe(1);
  expect(await queue()).toBe(0);
  await db.exec(`delete from email_outbox;update teachers set platform_plan='plus'`);
  expect(await queue()).toBe(0);
  await db.exec(
    `update teachers set platform_plan='pro';update students set lesson_email_opt_out=true`,
  );
  expect(await queue()).toBe(0);
});
it("jobs de calendário deixam de executar após downgrade e RPCs de lembrete são privadas", async () => {
  await db.exec(
    `update teachers set platform_plan='essential';insert into calendar_jobs(teacher_id,status,attempts) values('${teacher}','pending',0)`,
  );
  expect(await scalar("select status from calendar_jobs")).toBe("cancelled");
  for (const role of ["anon", "authenticated"]) {
    expect(
      await scalar(
        `select has_function_privilege('${role}','public.queue_lesson_notices(uuid,jsonb)','execute')`,
      ),
    ).toBe(false);
  }
});

it("reserva não pode ser reduzida depois para contornar cota e envios incompletos têm limite", async () => {
  await db.exec(
    `truncate documents,activity_submissions;insert into documents values(gen_random_uuid(),'${teacher}',100,'owner/file.pdf','application/pdf','uploading')`,
  );
  await expect(db.exec("update documents set byte_size=1")).rejects.toThrow(/reserva/);
  await db.exec(
    `insert into activity_submissions values(gen_random_uuid(),'${teacher}',100,'owner/a.pdf','application/pdf','uploading'),(gen_random_uuid(),'${teacher}',100,'owner/b.pdf','application/pdf','uploading')`,
  );
  await expect(
    db.exec(
      `insert into documents values(gen_random_uuid(),'${teacher}',100,'owner/c.pdf','application/pdf','uploading')`,
    ),
  ).rejects.toThrow(/incompletos/);
  expect(
    await scalar("select file_size_limit from storage.buckets where id='lessonara-documents'"),
  ).toSatisfy((value: unknown) => Number(value) === 104857600);
});

it("suspensão administrativa retira permissões dos jobs e da importação", async () => {
  await db.exec("update teachers set access_suspended=true");
  expect(await scalar(`select private.platform_feature_enabled('${teacher}','emails')`)).toBe(
    false,
  );
  expect(await scalar(`select private.platform_feature_enabled('${teacher}','google')`)).toBe(
    false,
  );
  await expect(db.exec("select private.import_teacher()")).rejects.toThrow(/Plus/);
});
it("outra conta não lê filas mesmo tendo plano Pro", async () => {
  await db.exec(
    `insert into email_outbox(event_key,teacher_id) values('private','${teacher}');set test.uid='00000000-0000-4000-8000-000000000099';set test.role='authenticated';set role authenticated`,
  );
  expect(await scalar("select count(*)::int from email_outbox")).toBe(0);
});

it("gatilho real bloqueia arquivo acima do plano e cota combinada entre documentos e entregas", async () => {
  await db.exec(
    `truncate documents,activity_submissions;update teachers set platform_plan='essential'`,
  );
  await expect(
    db.exec(
      `insert into documents values(gen_random_uuid(),'${teacher}',20971521,'owner/too-large.pdf','application/pdf','ready')`,
    ),
  ).rejects.toThrow(/limite do plano/);
  await db.exec(
    `insert into documents select gen_random_uuid(),'${teacher}',20971520,'owner/'||n||'.pdf','application/pdf','ready' from generate_series(1,51) n`,
  );
  await db.exec(
    `insert into activity_submissions values(gen_random_uuid(),'${teacher}',4194304,'owner/delivery.pdf','application/pdf','ready')`,
  );
  await expect(
    db.exec(
      `insert into documents values(gen_random_uuid(),'${teacher}',1,'owner/overflow.pdf','application/pdf','ready')`,
    ),
  ).rejects.toThrow(/armazenamento/);
});

it("a migração preserva a escolha anterior nos dois tipos de aviso", () => {
  expect(previousChoicesPreserved).toBe(true);
});
it("SQL de renovação usa somente a preferência de renovação e mantém o controle por plano", async () => {
  await db.exec(
    "truncate private.renewal_runs,reminders;update students set lesson_email_opt_out=true,renewal_email_opt_out=false",
  );
  const queue = async () => {
    await db.exec(
      "truncate private.renewal_runs;insert into private.renewal_runs(scheduled_for,status,lease_id,locked_until) values(now(),'running','00000000-0000-4000-8000-000000000005',now()+interval '2 minutes')",
    );
    return scalar(
      `select finish_renewal_batch((select scheduled_for from private.renewal_runs),'00000000-0000-4000-8000-000000000005',null,true,'[{"student_id":"${student}","teacher_id":"${teacher}","email":"fixture@example.com","credits":8,"message":"Última aula"}]',1)`,
    );
  };
  expect(await queue()).toBe(1);
  await db.exec(
    "delete from email_outbox;delete from reminders;update students set renewal_email_opt_out=true,lesson_email_opt_out=false",
  );
  expect(await queue()).toBe(0);
  await db.exec(
    "update students set renewal_email_opt_out=false;update teachers set platform_plan='essential'",
  );
  expect(await queue()).toBe(0);
});
