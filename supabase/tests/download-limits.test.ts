import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role;
 create function auth.role() returns text language sql as $$select current_setting('test.role',true)$$;
 create table student_auth_limits(key text primary key,count integer,window_start timestamptz);
 `);
  const sql = await readFile(
    new URL("../migrations/0007_student_access_email.sql", import.meta.url),
    "utf8",
  );
  await db.exec(
    sql.slice(
      sql.indexOf("create function public.allow_student_auth"),
      sql.indexOf("create function public.attempt_student_code"),
    ),
  );
  await db.exec(
    await readFile(new URL("../migrations/0037_download_rate_limits.sql", import.meta.url), "utf8"),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("reset role;set test.role='service_role';truncate student_auth_limits");
});
async function take() {
  return (
    await db.query<{ result: { allowed: boolean; retry_after: number } }>(
      "select check_download_limit(array['resource','actor'],array[1,2],array[10,60]) as result",
    )
  ).rows[0].result;
}
it("limita requisições repetidas e retorna o tempo real da janela que bloqueou", async () => {
  await db.exec("set role service_role");
  expect((await take()).allowed).toBe(true);
  const blocked = await take();
  expect(blocked.allowed).toBe(false);
  expect(blocked.retry_after).toBeGreaterThan(0);
  expect(blocked.retry_after).toBeLessThanOrEqual(10);
  await db.exec(
    "reset role;update student_auth_limits set window_start=now()-interval '11 seconds' where key='resource';set role service_role",
  );
  const actorBlocked = await take();
  expect(actorBlocked.allowed).toBe(false);
  expect(actorBlocked.retry_after).toBeGreaterThan(10);
  await db.exec(
    "reset role;update student_auth_limits set window_start=now()-interval '61 seconds';set role service_role",
  );
  expect((await take()).allowed).toBe(true);
});
it("bloqueia chamadas diretas de navegador e tipos de limites inválidos", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec("reset role;set role " + role);
    await expect(take()).rejects.toThrow(/permission denied/);
  }
  await db.exec("reset role;set test.role='authenticated'");
  await expect(take()).rejects.toThrow(/insufficient_privilege/);
  await db.exec("set test.role='service_role'");
  await expect(
    db.exec("select check_download_limit(array['key'],array[0],array[10])"),
  ).rejects.toThrow(/Invalid limits/);
});
