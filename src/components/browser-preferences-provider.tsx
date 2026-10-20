"use client";
import { ToastHost } from "./toast";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { translator, type Locale, type Theme, type Translator } from "@/lib/i18n/core";
type Context = {
  locale: Locale;
  theme: Theme;
  t: Translator;
  save: (locale: Locale, theme: Theme) => Promise<void>;
};
const PreferencesContext = createContext<Context | null>(null);
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme =
    theme === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
}
export function BrowserPreferencesProvider({
  locale: initialLocale,
  theme: initialTheme,
  children,
}: {
  locale: Locale;
  theme: Theme;
  children: ReactNode;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const [theme, setTheme] = useState(initialTheme);
  const router = useRouter();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    applyTheme(theme);
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => applyTheme(theme);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme]);
  const value = useMemo<Context>(
    () => ({
      locale,
      theme,
      t: translator(locale),
      async save(nextLocale, nextTheme) {
        const response = await fetch("/api/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: nextLocale, theme: nextTheme }),
        });
        if (!response.ok) throw new Error("Não foi possível salvar suas preferências.");
        setLocale(nextLocale);
        setTheme(nextTheme);
        applyTheme(nextTheme);
        router.refresh();
      },
    }),
    [locale, theme, router],
  );
  return (
    <PreferencesContext value={value}>
      {children}
      <ToastHost />
    </PreferencesContext>
  );
}
export function useI18n() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("BrowserPreferencesProvider ausente.");
  return value;
}
