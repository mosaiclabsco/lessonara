import { expect, it } from "vitest";
import { desktopClassroomHref } from "./desktop-links";
const path =
  "/classroom/33333333-3333-4333-8333-333333333333/appointment/44444444-4444-4444-8444-444444444444/2026-10-11";
it("envia só a ocorrência no link, sem token ou senha", () =>
  expect(desktopClassroomHref(path)).toBe("lessonara://" + path.slice(1)));
it.each([
  "/login",
  "https://evil.test" + path,
  path + "?jwt=token",
  path + "#secret",
  path.replace("2026-10-11", "2026-02-30"),
])("recusa link inesperado %s", (value) => expect(desktopClassroomHref(value)).toBeNull());
