"use client";
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
export function SiteAnalytics() {
  const path = usePathname();
  if (
    path.startsWith("/i/") ||
    path.startsWith("/support/") ||
    path.startsWith("/classroom/") ||
    path.startsWith("/p/") ||
    path.startsWith("/student") ||
    path.startsWith("/a/")
  )
    return null;
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
