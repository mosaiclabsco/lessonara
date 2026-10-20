import { NextResponse } from "next/server";
import { LOCALE_COOKIE, THEME_COOKIE, validLocale, validTheme } from "@/lib/i18n/core";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    return new Response("Forbidden", { status: 403 });
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return new Response("Invalid request", { status: 400 });
  }
  if (
    !input ||
    typeof input !== "object" ||
    !("locale" in input) ||
    !("theme" in input) ||
    !validLocale(input.locale) ||
    !validTheme(input.theme)
  )
    return new Response("Invalid preferences", { status: 400 });
  const response = NextResponse.json({ ok: true });
  const options = {
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 365 * 86400,
  };
  response.cookies.set(LOCALE_COOKIE, input.locale, options);
  response.cookies.set(THEME_COOKIE, input.theme, options);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
