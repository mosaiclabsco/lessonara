import { expect, it, vi } from "vitest";
import { calendarEventId, googleAccessToken } from "./calendar";
import { safeMeetUrl } from "../meeting-url";
it("eventos têm ids estáveis, válidos no Google e isolados por professor", () => {
  const id = calendarEventId("schedule", "source", "teacher-a");
  expect(id).toMatch(/^[0-9a-v]{5,1024}$/);
  expect(calendarEventId("schedule", "source", "teacher-a")).toBe(id);
  expect(calendarEventId("schedule", "source", "teacher-b")).not.toBe(id);
});
it.each([
  "javascript:alert(1)",
  "http://meet.google.com/abc-defg-hij",
  "https://evil.example/abc",
  "https://meet.google.com.evil.example/abc",
])("recusa endereço falso de Meet %s", (url) => expect(safeMeetUrl(url)).toBeNull());
it("sem configuração Google não inicia nenhuma conexão", async () => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
  expect(await googleAccessToken("teacher")).toBeNull();
  vi.unstubAllEnvs();
});
