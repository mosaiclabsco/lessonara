import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
let db: PGlite;
const teacher = "00000000-0000-4000-8000-000000000001",
  student = "00000000-0000-4000-8000-000000000002";
async function rows<T = Record<string, unknown>>(sql: string) {
  return (await db.query<T>(sql)).rows;
}
async function scalar<T = unknown>(sql: string) {
  return Object.values((await rows(sql))[0])[0] as T;
}
const item = () =>
  JSON.stringify([
    {
      student_id: student,
      teacher_id: teacher,
      email: "fixture@example.com",
      credits: 4,
      message: "Renovação",
    },
  ]);
async function claim() {
  return scalar<{ scheduledFor: string; leaseId: string; cursor: string | null }>(
    "select claim_renewal_run()",
  );
}
async function finish(run: { scheduledFor: string; leaseId: string }, complete = true) {
  return scalar(
    `select finish_renewal_batch('${run.scheduledFor}','${run.leaseId}','${student}',${complete},'${item()}',1)`,
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema auth;create schema private;create role anon;create role authenticated;create role service_role;
 create function auth.role() returns text language sql as $$select coalesce(nullif(current_setting('test.role',true),''),'service_role')$$;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function private.teacher_session_valid() returns boolean language sql as $$select true$$;
 create table teachers(id uuid primary key,platform_plan text);
 create table students(id uuid primary key,teacher_id uuid,email text,active boolean default true,promotional_email_opt_out boolean default false);
 create table reminders(student_id uuid,credits integer,primary key(student_id,credits));
 create table email_campaigns(id uuid primary key,teacher_id uuid,subject text,recipients integer,created_at timestamptz default now());
 create table email_outbox(id uuid primary key default gen_random_uuid(),event_key text unique,teacher_id uuid,student_id uuid,recipient text,template text,payload jsonb default '{}',status text default 'pending',attempts integer default 0,expires_at timestamptz default now()+interval '1 day',first_attempt_at timestamptz,locked_at timestamptz,available_at timestamptz default now(),created_at timestamptz default now(),lease_id uuid,last_error text,delivery jsonb,delivery_status text);
 create table calendar_jobs(id uuid primary key default gen_random_uuid(),teacher_id uuid,status text,attempts integer,created_at timestamptz default now(),available_at timestamptz default now(),lease_id uuid,locked_at timestamptz,last_error text);
 `);
  await db.exec(
    await readFile(new URL("../migrations/0030_worker_operations.sql", import.meta.url), "utf8"),
  );
  await db.exec(`create schema cron;create schema vault;create schema net;
 create table vault.decrypted_secrets(name text,decrypted_secret text);insert into vault.decrypted_secrets values('lessonara_cron_secret','test-only-secret');
 create table net.calls(id bigserial primary key,url text,headers jsonb);
 create function net.http_get(url text,headers jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$declare result bigint;begin insert into net.calls(url,headers) values(url,headers) returning id into result;return result;end;$$;
 create table cron.job(jobid bigserial primary key,jobname text unique,schedule text,command text,active boolean default true);
 create table cron.job_run_details(jobid bigint,start_time timestamptz,end_time timestamptz,status text);
 create function cron.schedule(name text,spec text,sql text) returns bigint language plpgsql as $$declare result bigint;begin insert into cron.job(jobname,schedule,command) values(name,spec,sql) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command returning jobid into result;return result;end;$$;
 `);
  await db.exec(
    await readFile(new URL("../operations/schedule-workers.sql", import.meta.url), "utf8"),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    `reset role;set test.role='service_role';set test.uid='${teacher}';truncate net.calls,private.job_runs,private.renewal_runs,email_outbox,reminders,email_campaigns,calendar_jobs,students,teachers;insert into teachers values('${teacher}','plus');insert into students(id,teacher_id,email) values('${student}','${teacher}','fixture@example.com');`,
  );
});
it("leases bloqueiam duplicação e snapshot não expõe mensagens ou endereços", async () => {
  const run = await scalar<string>("select start_job_run('emails')");
  expect(await scalar("select start_job_run('emails')")).toBeNull();
  await db.exec(`select finish_job_run('${run}','succeeded','{"sent":2}')`);
  expect(await scalar("select start_job_run('emails')")).not.toBeNull();
  await db.exec(
    `insert into email_outbox(event_key,recipient,payload) values('sensitive','fixture@example.com','{"secret":"never expose"}')`,
  );
  const snapshot = JSON.stringify(await scalar("select worker_operations_snapshot()"));
  expect(snapshot).not.toContain("fixture@example.com");
  expect(snapshot).not.toContain("never expose");
});
it("recusa dados pessoais como métricas e chamadas de usuários", async () => {
  const run = await scalar<string>("select start_job_run('emails')");
  await expect(
    db.exec(`select finish_job_run('${run}','succeeded','{"token":"secret"}')`),
  ).rejects.toThrow();
  for (const role of ["anon", "authenticated"]) {
    expect(
      await scalar(
        `select has_function_privilege('${role}','public.worker_operations_snapshot()','execute')`,
      ),
    ).toBe(false);
    await db.exec(`set test.role='${role}'`);
    await expect(db.exec("select start_job_run('emails')")).rejects.toThrow();
  }
});
it("retoma cursor e deduplica avisos entre as duas janelas, permitindo aluno novo", async () => {
  await db.exec(
    `insert into private.renewal_runs(scheduled_for) values(now()-interval '10 hours')`,
  );
  const first = await claim();
  expect(await scalar("select claim_renewal_run()")).toEqual({ busy: true });
  expect(await finish(first, false)).toBe(1);
  const next = await claim();
  expect(next.cursor).toBe(student);
  expect(await finish(next)).toBe(0);
  await db.exec(`insert into private.renewal_runs(scheduled_for) values(now()-interval '1 hour')`);
  const second = await claim(),
    newStudent = "00000000-0000-4000-8000-000000000003";
  await db.exec(
    `insert into students(id,teacher_id,email) values('${newStudent}','${teacher}','new@example.com')`,
  );
  const batch = [
    ...JSON.parse(item()),
    {
      student_id: newStudent,
      teacher_id: teacher,
      email: "new@example.com",
      credits: 4,
      message: "Renovação",
    },
  ];
  expect(
    await scalar(
      `select finish_renewal_batch('${second.scheduledFor}','${second.leaseId}','${newStudent}',true,'${JSON.stringify(batch)}',2)`,
    ),
  ).toBe(1);
  expect(await scalar("select count(*)::int from email_outbox")).toBe(2);
  await db.exec(
    `delete from reminders;delete from email_outbox;insert into private.renewal_runs(scheduled_for) values(now()-interval '30 minutes')`,
  );
  expect(await finish(await claim())).toBe(1);
});
it("encerra após cinco falhas de lote sem perder cursor", async () => {
  await db.exec(
    `insert into private.renewal_runs(scheduled_for,cursor) values(now()-interval '1 hour','${student}')`,
  );
  for (let i = 0; i < 5; i++) {
    const run = await claim();
    expect(run.cursor).toBe(student);
    await db.exec(`select fail_renewal_run('${run.scheduledFor}','${run.leaseId}')`);
  }
  expect(await scalar("select status from private.renewal_runs")).toBe("failed");
  expect(await scalar("select claim_renewal_run()")).toEqual({ done: true });
});
it("nega Essencial na fila de renovação e campanhas no banco; aceita Plus", async () => {
  await db.exec(
    `update teachers set platform_plan='essential';insert into private.renewal_runs(scheduled_for) values(now()-interval '1 hour')`,
  );
  expect(await finish(await claim())).toBe(0);
  await expect(
    db.exec(
      `select queue_email_campaign(gen_random_uuid(),'Renovação','sealed',array['${student}'::uuid])`,
    ),
  ).rejects.toThrow(/Plus/);
  await db.exec(`update teachers set platform_plan='plus'`);
  expect(
    await scalar(
      `select queue_email_campaign(gen_random_uuid(),'Renovação','sealed',array['${student}'::uuid])`,
    ),
  ).toBe(1);
});
it("tentativas esgotadas ficam terminais, mantendo lease atual até expirar", async () => {
  await db.exec(
    `insert into email_outbox(event_key,attempts) values('exhausted',5);insert into email_outbox(event_key,status,attempts,locked_at) values('active','sending',5,now());insert into email_outbox(event_key,status,attempts,locked_at) values('recover','sending',1,now()-interval '3 minutes')`,
  );
  const jobs = await rows<{ event_key: string; attempts: number }>(
    "select * from claim_email_jobs()",
  );
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({ event_key: "recover", attempts: 2 });
  expect(await scalar("select status from email_outbox where event_key='exhausted'")).toBe(
    "failed",
  );
  expect(await scalar("select status from email_outbox where event_key='active'")).toBe("sending");
  await db.exec(
    `update email_outbox set locked_at=now()-interval '3 minutes' where event_key='active';select claim_email_jobs()`,
  );
  expect(await scalar("select status from email_outbox where event_key='active'")).toBe("failed");
});
it("lease de execução interrompida é registrado como falha antes da retomada", async () => {
  await db.exec(
    `insert into private.job_runs(job_key,started_at) values('calendar',now()-interval '3 minutes');select start_job_run('calendar')`,
  );
  expect(await scalar("select error_code from private.job_runs where status='failed'")).toBe(
    "lease_expired",
  );
});

it("histórico mantém execuções de renovação mesmo com muitos envios frequentes", async () => {
  await db.exec(
    `insert into private.job_runs(job_key,status,started_at,finished_at) values('renewals','succeeded',now()-interval '10 hours',now()-interval '10 hours');insert into private.job_runs(job_key,status,started_at,finished_at) select 'emails','succeeded',now()-n*interval '5 minutes',now()-n*interval '5 minutes' from generate_series(0,100) n`,
  );
  const snapshot = await scalar<{ runs: { job_key: string }[] }>(
    "select worker_operations_snapshot()",
  );
  expect(snapshot.runs.filter((r) => r.job_key === "renewals")).toHaveLength(1);
  expect(snapshot.runs.filter((r) => r.job_key === "emails")).toHaveLength(15);
});
it("Calendar também encerra jobs interrompidos após esgotar cinco tentativas", async () => {
  await db.exec(
    `insert into calendar_jobs(status,attempts,locked_at) values('sending',5,now()-interval '3 minutes');select claim_calendar_jobs()`,
  );
  expect(await scalar("select status from calendar_jobs")).toBe("failed");
});
it("campanha rejeita quebra de linha no assunto", async () => {
  await expect(
    db.exec(
      `select queue_email_campaign(gen_random_uuid(),E'Hello\\nWorld','sealed',array['${student}'::uuid])`,
    ),
  ).rejects.toThrow();
});

it("cadastro separa horários e a retomada vazia não faz chamada HTTP", async () => {
  expect(await scalar("select schedule from cron.job where jobname='lessonara-reminders'")).toBe(
    "0 11,21 * * *",
  );
  expect(await scalar("select schedule from cron.job where jobname='lessonara-cleanup'")).toBe(
    "0 6 * * *",
  );
  await db.exec("select private.request_renewal_worker(false)");
  expect(await scalar("select count(*)::int from net.calls")).toBe(0);
  await db.exec(
    `insert into private.renewal_runs(scheduled_for) values(now()-interval '1 hour');select private.request_renewal_worker(false);select private.request_renewal_worker(false)`,
  );
  expect(await scalar("select count(*)::int from net.calls")).toBe(1);
  const snapshot = JSON.stringify(await scalar("select worker_operations_snapshot()"));
  expect(snapshot).not.toContain("test-only-secret");
  expect(snapshot).not.toContain("http_get");
});
it("para de despachar janela que falha repetidamente sem progresso", async () => {
  await db.exec(
    `insert into private.renewal_runs(scheduled_for,dispatches,requested_at) values(now()-interval '1 hour',12,now()-interval '6 minutes');select private.request_renewal_worker(false)`,
  );
  expect(await scalar("select status from private.renewal_runs")).toBe("failed");
  expect(await scalar("select count(*)::int from net.calls")).toBe(0);
});
