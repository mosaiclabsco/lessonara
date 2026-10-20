import { expect, it } from "vitest";
import { isPublicPath } from "./public-routes";
it("encaminha a sala à sua autorização própria sem tornar o painel público", () => {
  expect(isPublicPath("/classroom/student/schedule/id/2026-10-12/join")).toBe(true);
  expect(isPublicPath("/classroom-admin")).toBe(false);
});
it.each(["/about", "/privacy", "/terms"])("permite informações públicas sem login %s", (path) =>
  expect(isPublicPath(path)).toBe(true),
);
it.each(["/about-admin", "/privacy/private", "/terms-admin"])(
  "mantém páginas fora da lista protegidas %s",
  (path) => expect(isPublicPath(path)).toBe(false),
);
it.each([
  "/login",
  "/a/link",
  "/student",
  "/student/login",
  "/p/teacher/s/student",
  "/api/cron/emails",
  "/api/preferences",
])("reconhece rota pública %s", (path) => expect(isPublicPath(path)).toBe(true));
it.each([
  "/",
  "/students",
  "/students/new",
  "/students/student",
  "/aluno-admin",
  "/emails",
  "/settings",
])("não confunde o painel com o prefixo aluno %s", (path) =>
  expect(isPublicPath(path)).toBe(false),
);
