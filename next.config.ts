import { securityHeaders } from "./src/lib/security-headers";
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        source: "/support/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store, private" },
        ],
      },
      {
        source: "/classroom/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store, private" },
        ],
      },
      { source: "/student/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/p/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      {
        source: "/:path*",
        headers: [
          ...securityHeaders(
            process.env.JITSI_URL,
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NODE_ENV === "development",
          ),
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/alunos/novo", destination: "/students/new", permanent: true },
      { source: "/alunos/:path*", destination: "/students/:path*", permanent: true },
      {
        source: "/aluno/portal/:id/materiais/:shareId",
        destination: "/student/portal/:id/materials/:shareId",
        permanent: true,
      },
      {
        source: "/aluno/portal/:id/atividades/:activityId/arquivo",
        destination: "/student/portal/:id/activities/:activityId/file",
        permanent: true,
      },
      {
        source: "/aluno/portal/:id/atividades/:activityId/entrega",
        destination: "/student/portal/:id/activities/:activityId/submission",
        permanent: true,
      },
      { source: "/aluno/:path*", destination: "/student/:path*", permanent: true },
      { source: "/documentos/:id/arquivo", destination: "/documents/:id/file", permanent: true },
      { source: "/documentos/:path*", destination: "/documents/:path*", permanent: true },
      {
        source: "/atividades/:id/entrega",
        destination: "/activities/:id/submission",
        permanent: true,
      },
      { source: "/atividades/:path*", destination: "/activities/:path*", permanent: true },
      {
        source: "/a/:slug/materiais/:shareId",
        destination: "/a/:slug/materials/:shareId",
        permanent: true,
      },
      {
        source: "/a/:slug/atividades/:id/arquivo",
        destination: "/a/:slug/activities/:id/file",
        permanent: true,
      },
      {
        source: "/a/:slug/atividades/:id/entrega",
        destination: "/a/:slug/activities/:id/submission",
        permanent: true,
      },
      { source: "/config", destination: "/settings", permanent: true },
      { source: "/agenda", destination: "/calendar", permanent: true },
      { source: "/financeiro", destination: "/finance", permanent: true },
      { source: "/pagamentos/:path*", destination: "/payments/:path*", permanent: true },
      { source: "/api/cron/lembretes", destination: "/api/cron/reminders", permanent: true },
    ];
  },
};
export default nextConfig;
