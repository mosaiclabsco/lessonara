export const settingsTabs = [
  { id: "general", label: "Geral", icon: "settings" },
  { id: "integrations", label: "Integrações", icon: "calendar" },
  { id: "holidays", label: "Feriados", icon: "calendar" },
  { id: "receivables", label: "Recebimentos", icon: "check" },
  { id: "plans", label: "Planos", icon: "book" },
  { id: "subscription", label: "Plano da empresa", icon: "book" },
  { id: "support", label: "Ajuda e contato", icon: "chat" },
] as const;
export type SettingsTab = (typeof settingsTabs)[number]["id"];
export function settingsTab(value: unknown): SettingsTab {
  return settingsTabs.some((tab) => tab.id === value) ? (value as SettingsTab) : "general";
}
export function settingsHref(tab: SettingsTab) {
  return `/settings?tab=${tab}#${tab}`;
}
