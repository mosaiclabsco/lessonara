import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, beforeEach, expect, it } from "vitest";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;create role service_role;create role lessonara_backup;
    create function auth.role() returns text language sql as $$select coalesce(nullif(current_setting('test.role',true),''),'service_role')$$;
    create table private.job_runs(id uuid primary key default gen_random_uuid(),job_key text not null constraint job_runs_job_key_check check(job_key in ('emails')),status text default 'running',started_at timestamptz default now(),finished_at timestamptz,metrics jsonb default '{}',error_code text);
    create table auth.users(id uuid primary key,email text,encrypted_password text);
    insert into auth.users values('00000000-0000-4000-8000-000000000001','fixture@example.com','test-hash');
    grant usage on schema private to lessonara_backup,anon,authenticated;
  `);
  await db.exec(
    await readFile(new URL("../migrations/0033_backup_operations.sql", import.meta.url), "utf8"),
  );
  const operation = await readFile(
    new URL("../operations/configure-backup.sql", import.meta.url),
    "utf8",
  );
  await db.exec(
    operation.slice(operation.indexOf("create function private.backup_auth_records()")),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("reset role;set test.role='service_role';truncate private.job_runs;");
});
it("backup mantém lease própria sem relaxar a dos workers", async () => {
  await db.exec(
    "select start_job_run('backup');update private.job_runs set started_at=now()-interval '10 minutes';",
  );
  expect(
    (await db.query<{ id: string | null }>("select start_job_run('backup') as id")).rows[0].id,
  ).toBeNull();
  await db.exec(
    "update private.job_runs set started_at=now()-interval '3 hours';select start_job_run('backup');",
  );
  expect(
    (await db.query("select id from private.job_runs where status='failed'")).rows,
  ).toHaveLength(1);
});
it("sessão comum não inicia backup privilegiado", async () => {
  await db.exec("set test.role='authenticated'");
  await expect(db.query("select start_job_run('backup')")).rejects.toThrow();
});
it("exportação Auth delegada funciona sem conceder leitura direta de auth", async () => {
  await db.exec("set role lessonara_backup");
  await expect(db.query("select * from auth.users")).rejects.toThrow();
  const data = (
    await db.query<{ data: { table: string; rows: unknown[] }[] }>(
      "select private.backup_auth_records() as data",
    )
  ).rows[0].data;
  expect(data.find((t) => t.table === "users")?.rows).toHaveLength(1);
});
it("aluno e professor não executam a exportação de Auth", async () => {
  for (const role of ["anon", "authenticated", "service_role"]) {
    await db.exec(`reset role;set role ${role}`);
    await expect(db.query("select private.backup_auth_records()")).rejects.toThrow();
  }
});
