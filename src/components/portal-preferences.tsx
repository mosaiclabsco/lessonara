"use client";
import { useTransition, useState } from "react";
import { useI18n } from "./browser-preferences-provider";
import type { Locale, Theme } from "@/lib/i18n/core";
import { Icon } from "./icon";
export function PortalPreferences() {
  const { t, locale, theme, save } = useI18n();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  function update(language: Locale, appearance: Theme) {
    setError(false);
    start(async () => {
      try {
        await save(language, appearance);
      } catch {
        setError(true);
      }
    });
  }
  return (
    <div className="portal-preferences">
      <label className="portal-preference-control">
        <Icon name="language" className="h-4 w-4" />
        <span className="sr-only">{t("Idioma")}</span>
        <select
          aria-label={t("Idioma")}
          disabled={pending}
          value={locale}
          onChange={(e) => update(e.target.value as Locale, theme)}
        >
          <option value="pt-BR">PT</option>
          <option value="en">EN</option>
          <option value="es">ES</option>
          <option value="fr">FR</option>
        </select>
      </label>
      <label className="portal-preference-control">
        <Icon name={theme === "dark" ? "moon" : "sun"} className="h-4 w-4" />
        <span className="sr-only">{t("Aparência")}</span>
        <select
          aria-label={t("Aparência")}
          disabled={pending}
          value={theme}
          onChange={(e) => update(locale, e.target.value as Theme)}
        >
          <option value="light">{t("Claro")}</option>
          <option value="dark">{t("Escuro")}</option>
          <option value="system">{t("Acompanhar o sistema")}</option>
        </select>
      </label>
      {error && <span role="alert">{t("Não foi possível salvar suas preferências.")}</span>}
    </div>
  );
}
