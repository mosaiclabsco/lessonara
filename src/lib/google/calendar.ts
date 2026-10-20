import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { seal, unseal } from "@/lib/mail/crypto";
export type GoogleCredentials = { refreshToken: string; accessToken: string; expiresAt: number };
export type BusyInterval = { start: string; end: string };
export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
export function googleRedirectUri() {
  return new URL("/integrations/google/callback", process.env.APP_URL || "http://localhost:3001")
    .href;
}
export function calendarEventId(kind: string, id: string, teacherId = "") {
  return (
    "lessonara" +
    createHash("sha256")
      .update(teacherId + "/" + kind + "/" + id)
      .digest("hex")
  );
}
export { safeMeetUrl } from "../meeting-url";
export async function googleAccessToken(teacherId: string) {
  if (!googleConfigured()) return null;
  const db = createAdminClient();
  const row = await db
    .from("google_calendar_connections")
    .select("credentials")
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (row.error) throw new Error("Não foi possível consultar a integração Google.");
  if (!row.data) return null;
  let credentials = unseal<GoogleCredentials>(row.data.credentials, "google-credentials", {
    allowLegacy: true,
  });
  if (credentials.expiresAt > Date.now() + 60_000) return credentials.accessToken;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: credentials.refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    await db
      .from("google_calendar_connections")
      .update({ last_error: "Conecte sua conta Google novamente." })
      .eq("teacher_id", teacherId);
    throw new Error("Conecte sua conta Google novamente.");
  }
  const token = await response.json();
  credentials = {
    ...credentials,
    accessToken: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  };
  const saved = await db
    .from("google_calendar_connections")
    .update({ credentials: seal(credentials, "google-credentials"), last_error: null })
    .eq("teacher_id", teacherId);
  if (saved.error) throw new Error("Não foi possível atualizar a conexão Google.");
  return credentials.accessToken;
}
export async function googleRequest(teacherId: string, path: string, init: RequestInit = {}) {
  const access = await googleAccessToken(teacherId);
  if (!access) return null;
  const response = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(15000),
  });
  return response;
}
export async function googleBusy(
  teacherId: string,
  start: string,
  end: string,
): Promise<BusyInterval[] | null> {
  const response = await googleRequest(teacherId, "freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin: start,
      timeMax: end,
      timeZone: "America/Sao_Paulo",
      items: [{ id: "primary" }],
    }),
  });
  if (!response) return null;
  if (!response.ok) throw new Error("Não foi possível consultar a agenda Google.");
  const data = await response.json();
  if (data.calendars?.primary?.errors?.length)
    throw new Error("Não foi possível consultar a agenda Google.");
  return data.calendars?.primary?.busy ?? [];
}
