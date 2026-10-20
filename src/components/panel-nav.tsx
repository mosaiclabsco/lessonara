"use client";
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
  { href: "/payments", label: "Pagamentos", icon: "book" },
  { href: "/finance", label: "Financeiro", icon: "chart" },
  { href: "/documents", label: "Documentos", icon: "book" },
  { href: "/activities", label: "Atividades", icon: "check" },
  { href: "/emails", label: "Emails", icon: "book" },
  { href: "/settings", label: "Configurações", icon: "settings" },
];
export function PanelNav({ platformPlan = "essential" }: { platformPlan?: PlatformPlan }) {
  const pathname = usePathname();
  return <NavLinks pathname={pathname} platformPlan={platformPlan} />;
}
export function PanelNavFallback() {
  return <NavLinks />;
}
function NavLinks({
  pathname,
  platformPlan = "essential",
}: {
  platformPlan?: PlatformPlan;
  pathname?: string;
}) {
  const { t } = useI18n();
  return (
    <nav className="panel-nav" aria-label={t("Navega\u00E7\u00E3o principal")}>
      {links.map(({ href, label, icon }) => {
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
            {active && <span className="nav-dot" />}
          </Link>
        );
      })}
    </nav>
  );
}
