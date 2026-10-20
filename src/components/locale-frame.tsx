import { getBrowserPreferences } from "@/lib/i18n/server";
import { BrowserPreferencesProvider } from "./browser-preferences-provider";
import type { ReactNode } from "react";
export async function LocaleFrame({ children }: { children: ReactNode }) {
  const preferences = await getBrowserPreferences();
  return <BrowserPreferencesProvider {...preferences}>{children}</BrowserPreferencesProvider>;
}
