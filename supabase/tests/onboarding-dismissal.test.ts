import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, beforeEach, expect, it } from "vitest";
let db: PGlite;
const teacher = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema auth;create schema private;create role anon;create role authenticated;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function private.teacher_session_valid() returns boolean language sql as $$select coalesce(nullif(current_setting('test.valid',true),'')::boolean,true)$$;
 create table teachers(id uuid primary key,name text,lesson_minutes int,profile_completed_at timestamptz,platform_plan text,reviewed_settings text[]);
 create table plans(id uuid default gen_random_uuid(),teacher_id uuid,is_active boolean);
 `);
  await db.exec(
    await readFile(new URL("../migrations/0035_onboarding_dismissal.sql", import.meta.url), "utf8"),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    `reset role;set test.uid='${teacher}';set test.valid='true';truncate teachers,plans;insert into teachers values('${teacher}','Teacher',60,now(),'essential',array['holidays','receivables','support'],null),('${other}','Other',60,null,'essential','{}',null);insert into plans(teacher_id,is_active) values('${teacher}',true);`,
  );
});
it("fecha apenas o guia do professor autenticado sem exigir assinatura", async () => {
  await db.exec("set role authenticated;select dismiss_onboarding();reset role");
  expect(
    (
      await db.query<{ id: string }>(
        "select id from teachers where onboarding_dismissed_at is not null",
      )
    ).rows,
  ).toEqual([{ id: teacher }]);
});
it("recusa chamada direta incompleta, sessão expirada e usuário sem professor", async () => {
  await db.exec(`set test.uid='${other}'`);
  await expect(db.exec("select dismiss_onboarding()")).rejects.toThrow();
  await db.exec(`set test.uid='${teacher}';set test.valid='false'`);
  await expect(db.exec("select dismiss_onboarding()")).rejects.toThrow();
  await db.exec("set test.uid='';set test.valid='true'");
  await expect(db.exec("select dismiss_onboarding()")).rejects.toThrow();
});
it("usa o plano real e exige a revisão de integrações apenas no Plus/Pro", async () => {
  await db.exec("update teachers set platform_plan='pro' where id='" + teacher + "'");
  await expect(db.exec("select dismiss_onboarding()")).rejects.toThrow();
  await db.exec(
    "update teachers set reviewed_settings=array_append(reviewed_settings,'integrations') where id='" +
      teacher +
      "';select dismiss_onboarding();",
  );
});

it("nega execução anônima no banco", async () => {
  await db.exec("set role anon");
  await expect(db.exec("select public.dismiss_onboarding()")).rejects.toThrow(/permission denied/);
  await db.exec("reset role");
});
