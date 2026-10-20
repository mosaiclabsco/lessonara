"use client";
import { useEffect, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "./browser-preferences-provider";
import { Icon } from "./icon";
import {
  settingsTabs,
  settingsTab,
  settingsHref,
  type SettingsTab,
} from "@/lib/settings-navigation";

export function SettingsTabs({ active, children }: { active: SettingsTab; children: ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Preserve bookmarked links from before tabs had their own server navigation.
  useEffect(() => {
    const read = () => {
      const hash = location.hash.slice(1);
      if (hash && settingsTab(hash) === hash && hash !== active)
        router.replace(settingsHref(settingsTab(hash)), { scroll: false });
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [active, router]);
  const navigate = (tab: SettingsTab) =>
    startTransition(() => router.push(settingsHref(tab), { scroll: false }));
  return (
    <>
      <div className="portal-tabs profile-tab-bar" role="tablist" aria-label={t("Configurações")}>
        {settingsTabs.map((tab, index) => (
          <button
            type="button"
            role="tab"
            key={tab.id}
            id={`settings-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            aria-selected={active === tab.id}
            aria-controls={active === tab.id ? `settings-panel-${active}` : undefined}
            onClick={() => navigate(tab.id)}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % settingsTabs.length
                  : event.key === "ArrowLeft"
                    ? (index + settingsTabs.length - 1) % settingsTabs.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? settingsTabs.length - 1
                        : null;
              if (next === null) return;
              event.preventDefault();
              navigate(settingsTabs[next].id);
              document.getElementById(`settings-${settingsTabs[next].id}`)?.focus();
            }}
          >
            <Icon name={tab.icon} className="h-4 w-4" />
            {t(tab.label)}
          </button>
        ))}
      </div>
      <section
        id={`settings-panel-${active}`}
        role="tabpanel"
        aria-labelledby={`settings-${active}`}
        aria-busy={pending}
        className="space-y-6"
      >
        {pending ? (
          <p role="status" className="text-sm text-muted flex items-center gap-2">
            <Icon name="clock" className="h-4 w-4" />
            {t("Carregando…")}
          </p>
        ) : (
          children
        )}
      </section>
    </>
  );
}
