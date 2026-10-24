"use client";
import { useI18n } from "@/components/browser-preferences-provider";
import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "./icon";
const tabs = [
  { id: "aulas", hash: "lessons", label: "Aulas", icon: "calendar" },
  { id: "historico", hash: "history", label: "Histórico", icon: "clock" },
  { id: "reposicoes", hash: "replacements", label: "Reposições", icon: "calendar" },
  { id: "pacotes", hash: "payments", label: "Pacotes pagos", icon: "book" },
  { id: "horarios", hash: "schedule", label: "Horários", icon: "clock" },
  { id: "dados", hash: "details", label: "Dados do aluno", icon: "users" },
  { id: "atividades", hash: "activities", label: "Atividades", icon: "check" },
  { id: "materiais", hash: "materials", label: "Documentos", icon: "book" },
] as const;
type TabId = (typeof tabs)[number]["id"];
const tabEvent = "lessonara-profile-tab";
function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  window.addEventListener(tabEvent, onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(tabEvent, onChange);
  };
}
function selectedTab(): TabId {
  const hash = window.location.hash.slice(1);
  return (
    tabs.find(
      (tab) =>
        tab.hash === hash || tab.id === hash || (hash === "pagamentos" && tab.id === "pacotes"),
    )?.id ?? "aulas"
  );
}
function selectTab(id: TabId) {
  const tab = tabs.find((item) => item.id === id)!;
  window.history.replaceState(window.history.state, "", `#${tab.hash}`);
  window.dispatchEvent(new Event(tabEvent));
}
export function StudentProfileTabs(panels: Record<TabId, ReactNode>) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<TabId>("aulas");
  useEffect(() => {
    const update = () => setSelected(selectedTab());
    update();
    return subscribe(update);
  }, []);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    selectTab(tabs[next].id);
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>("[role=tab]")
      [next]?.focus();
  }
  return (
    <div className="student-profile-tabs">
      <div
        className="portal-tabs profile-tab-bar"
        role="tablist"
        aria-label={t("Gest\u00E3o do aluno")}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`profile-tab-${tab.id}`}
            aria-selected={selected === tab.id}
            aria-controls={`profile-panel-${tab.id}`}
            tabIndex={selected === tab.id ? 0 : -1}
            onClick={() => selectTab(tab.id)}
            onKeyDown={(event) => navigate(event, index)}
          >
            <Icon name={tab.icon} className="h-4 w-4" />
            {t(tab.label)}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`profile-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`profile-tab-${tab.id}`}
          hidden={selected !== tab.id}
          tabIndex={0}
          className="profile-tab-panel"
        >
          {panels[tab.id]}
        </div>
      ))}
    </div>
  );
}
