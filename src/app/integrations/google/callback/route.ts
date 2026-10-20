import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireUser, createAdminClient } from "@/lib/supabase/server";
import { seal, unseal } from "@/lib/mail/crypto";
import { googleRedirectUri } from "@/lib/google/calendar";
export async function GET(request: Request) {
  const { userId } = await requireUser();
  const jar = await cookies();
  const encoded = jar.get("lessonara_google_state")?.value;
  jar.delete("lessonara_google_state");
  const result = (status: string) =>
    NextResponse.redirect(
      new URL("/settings?google=" + status, process.env.APP_URL || "http://localhost:3001"),
    );
  try {
    const url = new URL(request.url);
    if (!encoded || url.searchParams.has("error")) return result("error");
    const state = unseal<{ state: string; verifier: string; userId: string; createdAt: number }>(
      encoded,
      "google-state",
      { allowLegacy: true },
    );
    if (
      state.userId !== userId ||
      Date.now() - state.createdAt > 600000 ||
      state.state !== url.searchParams.get("state") ||
      !url.searchParams.get("code")
    )
      return result("error");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: googleRedirectUri(),
        code: url.searchParams.get("code")!,
        code_verifier: state.verifier,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return result("error");
    const token = await response.json();
    if (
      !token.refresh_token ||
      !token.access_token ||
      !String(token.scope ?? "").includes("calendar.events") ||
      !String(token.scope ?? "").includes("calendar.freebusy")
    )
      return result("error");
    const saved = await createAdminClient()
      .from("google_calendar_connections")
      .upsert({
        teacher_id: userId,
        credentials: seal(
          {
            refreshToken: token.refresh_token,
            accessToken: token.access_token,
            expiresAt: Date.now() + token.expires_in * 1000,
          },
          "google-credentials",
        ),
        connected_at: new Date().toISOString(),
        last_error: null,
      });
    return result(saved.error ? "error" : "connected");
  } catch {
    return result("error");
  }
}
