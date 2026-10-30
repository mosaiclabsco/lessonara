"use client";
import { useEffect, useState } from "react";
import { hasPlatformFeature, type PlatformPlan } from "@/lib/platform-plans";
import { useI18n } from "@/components/browser-preferences-provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icon";
const links: {
  href: string;
  label: string;
  icon: IconName;
}[] = [
  { href: "/", label: "Visão geral", icon: "grid" },
  { href: "/students", label: "Alunos", icon: "users" },
  { href: "/pending", label: "Pendências", icon: "check" },
  { href: "/payments", label: "Pagamentos", icon: "book" },
  { href: "/finance", label: "Financeiro", icon: "chart" },
  { href: "/documents", label: "Documentos", icon: "book" },
  { href: "/activities", label: "Atividades", icon: "check" },
  { href: "/emails", label: "Emails", icon: "book" },
  { href: "/settings", label: "Configurações", icon: "settings" },
];
export function PanelNav({
  platformPlan = "essential",
  pendingCount = 0,
}: {
  platformPlan?: PlatformPlan;
  pendingCount?: number;
}) {
  const pathname = usePathname();
  const [live, setLive] = useState({ source: pendingCount, value: pendingCount });
  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    const update = async () => {
      if (document.visibilityState !== "visible" || running) return;
      running = true;
      try {
        const response = await fetch("/api/pending-count", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json"))
          return;
        const data = await response.json();
        if (Number.isSafeInteger(data.count) && data.count >= 0 && !controller.signal.aborted)
          setLive({ source: pendingCount, value: data.count });
      } catch {
      } finally {
        running = false;
      }
    };
    const timer = setInterval(() => void update(), 60000);
    const refresh = () => void update();
    window.addEventListener("focus", refresh);
    window.addEventListener("lessonara:pending-changed", refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("lessonara:pending-changed", refresh);
    };
  }, [pendingCount, pathname]);
  return (
    <NavLinks
      pathname={pathname}
      platformPlan={platformPlan}
      pendingCount={live.source === pendingCount ? live.value : pendingCount}
    />
  );
}
export function PanelNavFallback() {
  return <NavLinks />;
}
function NavLinks({
  pathname,
  pendingCount = 0,
  platformPlan = "essential",
}: {
  platformPlan?: PlatformPlan;
  pendingCount?: number;
  pathname?: string;
}) {
  const { t } = useI18n();
  return (
    <nav className="panel-nav" aria-label={t("Navega\u00E7\u00E3o principal")}>
      {links
        .filter((link) => link.href !== "/emails" || hasPlatformFeature(platformPlan, "emails"))
        .map(({ href, label, icon }) => {
          const active =
            pathname !== undefined &&
            (href === "/students"
              ? pathname === "/students" || pathname.startsWith("/students/")
              : pathname === href);
          return (
            <Link
              key={href}
              href={href}
              title={t(label)}
              aria-label={t(label)}
              aria-current={active ? "page" : undefined}
              className={`nav-link ${active ? "nav-active" : ""}`}
            >
              <Icon name={icon} />
              <span>{t(label)}</span>
              {href === "/emails" && !hasPlatformFeature(platformPlan, "emails") && (
                <span className="count-badge">Pro</span>
              )}
              {href === "/pending" && pendingCount > 0 ? (
                <span
                  className="nav-pending-count"
                  aria-label={t("{value0} pendências", { value0: pendingCount })}
                >
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              ) : (
                active && <span className="nav-dot" />
              )}
            </Link>
          );
        })}
    </nav>
  );
}
