import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, beforeEach, expect, it } from "vitest";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;
    create table public.teachers(id integer primary key,email text not null);
    create table public.students(id integer primary key,teacher_id integer,email text,active boolean default true);
    create function public.normalize_student_email() returns trigger language plpgsql as $$begin new.email:=lower(btrim(new.email));return new;end;$$;
    create trigger normalize_student_email before insert or update on public.students for each row execute function public.normalize_student_email();`);
  await db.exec(
    await readFile(
      new URL("../migrations/0034_unique_identity_emails.sql", import.meta.url),
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("truncate public.students,public.teachers;");
});
it("emails de professores são únicos mesmo com outra caixa ou espaços", async () => {
  await db.exec("insert into teachers values(1,'  Prof@Example.com  ')");
  expect((await db.query("select email from teachers")).rows).toEqual([
    { email: "prof@example.com" },
  ]);
  await expect(db.exec("insert into teachers values(2,'PROF@example.com')")).rejects.toMatchObject({
    code: "23505",
  });
  await db.exec("insert into teachers values(2,'other@example.com')");
  await expect(
    db.exec("update teachers set email='prof@example.com' where id=2"),
  ).rejects.toMatchObject({ code: "23505" });
});
it("inclui alunos inativos e bloqueia insert e update direto", async () => {
  await db.exec(
    "insert into students values(1,1,'  Student@example.com ',false),(2,1,'other@example.com',true)",
  );
  await expect(
    db.exec("insert into students values(3,1,'STUDENT@example.com',true)"),
  ).rejects.toMatchObject({ code: "23505" });
  await expect(
    db.exec("update students set email='Student@Example.com' where id=2"),
  ).rejects.toMatchObject({ code: "23505" });
});
it("mesmo aluno pode estudar com professores diferentes e editar seu próprio cadastro", async () => {
  await db.exec(
    "insert into students values(1,1,'student@example.com',true),(2,2,'STUDENT@example.com',true);update students set email=' STUDENT@example.com ' where id=1;",
  );
  expect((await db.query("select * from students")).rows).toHaveLength(2);
});
it("duas tentativas concorrentes só gravam um aluno", async () => {
  const results = await Promise.allSettled([
    db.exec("insert into students values(1,1,'student@example.com',true)"),
    db.exec("insert into students values(2,1,'STUDENT@example.com',true)"),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((await db.query("select * from students")).rows).toHaveLength(1);
});
