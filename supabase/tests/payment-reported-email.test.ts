import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, beforeEach, expect, it } from "vitest";
let db: PGlite;
const teacher = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const student = "00000000-0000-4000-8000-000000000003";
const request = "00000000-0000-4000-8000-000000000004";
const report = `select public.report_student_renewal('${student}','${request}',false)`;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;
 create table teachers(id uuid primary key,email text,platform_plan text,access_suspended boolean default false);
 create table students(id uuid primary key,teacher_id uuid,active boolean default true);
 create table renewal_requests(id uuid primary key,student_id uuid,teacher_id uuid,status text,reported_at timestamptz,resolved_at timestamptz);
 create table email_outbox(event_key text unique,teacher_id uuid,student_id uuid,recipient text,template text,payload jsonb,expires_at timestamptz,
 constraint email_outbox_template_check check(template in ('welcome','otp','reminder','campaign','lesson_notice')));
 create function private.platform_feature_enabled(tid uuid,feature text) returns boolean language sql stable as $$select exists(select 1 from public.teachers where id=tid and platform_plan in ('plus','pro') and not access_suspended and feature='emails')$$;`);
  const sql = await readFile(
    new URL("../migrations/0025_request_option_guards.sql", import.meta.url),
    "utf8",
  );
  await db.exec(
    sql.slice(
      sql.indexOf("create or replace function public.report_student_renewal"),
      sql.indexOf("create or replace function public.confirm_student_import"),
    ),
  );
  await db.exec(
    `revoke all on function public.report_student_renewal(uuid,uuid,boolean) from public,anon,authenticated;grant execute on function public.report_student_renewal(uuid,uuid,boolean) to service_role;`,
  );
  await db.exec(
    await readFile(
      new URL("../migrations/0043_payment_reported_email.sql", import.meta.url),
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(`reset role;truncate email_outbox,renewal_requests,students,teachers;
 insert into teachers(id,email,platform_plan) values('${teacher}','teacher@example.com','pro'),('${other}','other@example.com','pro');
 insert into students(id,teacher_id) values('${student}','${teacher}');
 insert into renewal_requests values('${request}','${student}','${teacher}','ready',null,null);`);
});
it("registra aviso na mesma transação, para a professora responsável, uma vez mesmo repetindo Já paguei", async () => {
  await Promise.all([db.exec(report), db.exec(report)]);
  expect(
    (await db.query("select recipient,teacher_id,student_id,payload from email_outbox")).rows,
  ).toEqual([
    {
      recipient: "teacher@example.com",
      teacher_id: teacher,
      student_id: student,
      payload: { request_id: request },
    },
  ]);
  expect((await db.query("select status from renewal_requests")).rows).toEqual([
    { status: "pending" },
  ]);
});
it("rollback do pagamento também desfaz o aviso", async () => {
  await db.exec(`begin;${report};rollback;`);
  expect((await db.query("select * from email_outbox")).rows).toHaveLength(0);
  expect((await db.query("select status from renewal_requests")).rows).toEqual([
    { status: "ready" },
  ]);
});
it.each(["essential", "suspended"])("não enfileira sem direito: %s", async (mode) => {
  await db.exec(
    mode === "essential"
      ? `update teachers set platform_plan='essential' where id='${teacher}'`
      : `update teachers set access_suspended=true where id='${teacher}'`,
  );
  await db.exec(report);
  expect((await db.query("select * from email_outbox")).rows).toHaveLength(0);
});
it("Plus também recebe o aviso operacional", async () => {
  await db.exec(`update teachers set platform_plan='plus' where id='${teacher}';${report};`);
  expect((await db.query("select * from email_outbox")).rows).toHaveLength(1);
});
it("solicitação com vínculo de outro tenant não expõe aluno à outra professora", async () => {
  await db.exec(
    `update renewal_requests set teacher_id='${other}' where id='${request}';${report};`,
  );
  expect((await db.query("select * from email_outbox")).rows).toHaveLength(0);
});
it("não aceita o id de outro aluno para reportar uma solicitação", async () => {
  await db.exec(`insert into students values('${other}','${other}',true)`);
  await expect(
    db.exec(`select public.report_student_renewal('${other}','${request}',false)`),
  ).rejects.toThrow();
  expect((await db.query("select * from email_outbox")).rows).toHaveLength(0);
});
it.each(["anon", "authenticated"])(
  "acesso direto sem a action autenticada é negado: %s",
  async (role) => {
    await db.exec(`set role ${role}`);
    try {
      await expect(db.exec(report)).rejects.toMatchObject({ code: "42501" });
    } finally {
      await db.exec("reset role");
    }
    expect((await db.query("select * from email_outbox")).rows).toHaveLength(0);
  },
);
it("falha ao gravar o aviso também desfaz o registro do pagamento", async () => {
  await db.exec(
    "alter table email_outbox add constraint reject_test_notice check (template <> 'payment_reported')",
  );
  try {
    await expect(db.exec(report)).rejects.toMatchObject({ code: "23514" });
    expect((await db.query("select status from renewal_requests")).rows).toEqual([
      { status: "ready" },
    ]);
    expect((await db.query("select * from email_outbox")).rows).toHaveLength(0);
  } finally {
    await db.exec("alter table email_outbox drop constraint reject_test_notice");
  }
});
it("aluno inativo não pode informar pagamento nem gerar aviso", async () => {
  await db.exec(`update students set active=false where id='${student}'`);
  await expect(db.exec(report)).rejects.toThrow();
  expect((await db.query("select * from email_outbox")).rows).toHaveLength(0);
});
