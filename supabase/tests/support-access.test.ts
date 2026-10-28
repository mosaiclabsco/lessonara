import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
const teacher = "00000000-0000-4000-8000-000000000001",
  challenge = "00000000-0000-4000-8000-000000000002",
  session = "00000000-0000-4000-8000-000000000003",
  adminSession = "00000000-0000-4000-8000-000000000004";
const actor = "operator@example.test",
  hash = "a".repeat(64),
  token = "b".repeat(64);
async function rows<T>(sql: string) {
  return (await db.query<T>(sql)).rows;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema auth;create schema private;create role anon;create role authenticated;create role service_role;
create function auth.role() returns text language sql as $$select coalesce(nullif(current_setting('test.role',true),''),'service_role')$$;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('session_id',nullif(current_setting('test.session_id',true),''))$$;
create table public.teachers(id uuid primary key,email text,access_suspended boolean default false);
create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),not_after timestamptz);
create table private.platform_operators(email text primary key,enabled boolean default true);
insert into private.platform_operators values('${actor}',true);insert into teachers values('${teacher}','teacher@example.test',false);
grant usage on schema public,auth,private to authenticated,anon,service_role;`);
  await db.exec(
    await readFile(new URL("../migrations/0039_support_access.sql", import.meta.url), "utf8"),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
it("requires enabled operator and exact target/session; commits failed attempts and permits only one grant", async () => {
  await expect(
    db.exec(
      `select public.request_support_challenge('${challenge}','other@example.test','${adminSession}','${teacher}','${hash}')`,
    ),
  ).rejects.toThrow();
  await db.exec(
    `select public.request_support_challenge('${challenge}','${actor}','${adminSession}','${teacher}','${hash}')`,
  );
  await expect(
    db.exec(
      `select public.request_support_challenge(gen_random_uuid(),'${actor}','${adminSession}','${teacher}','${hash}')`,
    ),
  ).rejects.toThrow(/Aguarde/);
  for (const [id, who, sid, code] of [
    [challenge, actor, session, hash],
    [challenge, actor, adminSession, "c".repeat(64)],
  ]) {
    expect(
      (
        await rows<{ v: boolean }>(
          `select public.verify_support_challenge('${id}','${who}','${sid}','${teacher}','${code}','${token}') v`,
        )
      )[0].v,
    ).toBe(false);
  }
  expect(
    (
      await rows<{ attempts: number }>(
        `select attempts from private.support_challenges where id='${challenge}'`,
      )
    )[0].attempts,
  ).toBe(1);
  expect(
    (
      await rows<{ v: boolean }>(
        `select public.verify_support_challenge('${challenge}','${actor}','${adminSession}','${teacher}','${hash}','${token}') v`,
      )
    )[0].v,
  ).toBe(true);
  expect(
    (
      await rows<{ v: boolean }>(
        `select public.verify_support_challenge('${challenge}','${actor}','${adminSession}','${teacher}','${hash}','${token}') v`,
      )
    )[0].v,
  ).toBe(false);
});
it("consumes the link once, binds to the same teacher, caps token refresh and rejects revoked/expired support sessions", async () => {
  const grant = (
    await rows<{ g: { id: string; teacher_id: string } }>(
      `select public.consume_support_grant('${token}') g`,
    )
  )[0].g;
  expect(grant.teacher_id).toBe(teacher);
  expect(
    (await rows<{ g: null }>(`select public.consume_support_grant('${token}') g`))[0].g,
  ).toBeNull();
  await db.exec(`insert into auth.sessions values('${session}','${teacher}',now(),null);`);
  await expect(
    db.exec(`select public.bind_support_session('${grant.id}','${adminSession}')`),
  ).rejects.toThrow();
  await db.exec(
    `select public.bind_support_session('${grant.id}','${session}');set test.uid='${teacher}';set test.session_id='${session}';`,
  );
  expect((await rows<{ v: boolean }>(`select private.teacher_session_valid() v`))[0].v).toBe(true);
  const event = JSON.stringify({
    user_id: teacher,
    claims: { session_id: session, exp: Math.floor(Date.now() / 1000) + 3600 },
  });
  const hook = (
    await rows<{
      v: { claims: { support_actor: string; exp: number; session_expires_at: number } };
    }>(`select public.teacher_access_token_hook('${event}') v`)
  )[0].v;
  expect(hook.claims.support_actor).toBe(actor);
  expect(hook.claims.exp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 901);
  await db.exec(`select public.end_support_session();`);
  expect((await rows<{ v: boolean }>(`select private.teacher_session_valid() v`))[0].v).toBe(false);
  expect(
    (
      await rows<{ v: { error: unknown } }>(`select public.teacher_access_token_hook('${event}') v`)
    )[0].v.error,
  ).toBeTruthy();
  await db.exec(
    `update private.support_grants set ended_at=null,session_expires_at=now()-interval '1 second' where id='${grant.id}'`,
  );
  expect((await rows<{ v: boolean }>(`select private.teacher_session_valid() v`))[0].v).toBe(false);
});
it("locks a code after five failures, expires challenges and denies ordinary browser roles", async () => {
  await db.exec(`update private.support_challenges set created_at=now()-interval '2 minutes';`);
  const id = "00000000-0000-4000-8000-000000000005";
  await db.exec(
    `select public.request_support_challenge('${id}','${actor}','${adminSession}','${teacher}','${hash}')`,
  );
  for (let n = 0; n < 5; n++)
    expect(
      (
        await rows<{ v: boolean }>(
          `select public.verify_support_challenge('${id}','${actor}','${adminSession}','${teacher}','${token}','${hash}') v`,
        )
      )[0].v,
    ).toBe(false);
  expect(
    (
      await rows<{ v: boolean }>(
        `select public.verify_support_challenge('${id}','${actor}','${adminSession}','${teacher}','${hash}','${token}') v`,
      )
    )[0].v,
  ).toBe(false);
  await db.exec(
    `update private.support_challenges set attempts=0,expires_at=now()-interval '1 second' where id='${id}'`,
  );
  expect(
    (
      await rows<{ v: boolean }>(
        `select public.verify_support_challenge('${id}','${actor}','${adminSession}','${teacher}','${hash}','${token}') v`,
      )
    )[0].v,
  ).toBe(false);
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    await expect(db.exec(`select public.consume_support_grant('${token}')`)).rejects.toThrow();
    await expect(db.exec(`select * from private.support_grants`)).rejects.toThrow();
    await db.exec(`reset role`);
  }
});
