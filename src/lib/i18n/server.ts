import { cache } from "react";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, THEME_COOKIE, translator, validLocale, validTheme } from "./core";
export const getBrowserPreferences = cache(async () => {
  const jar = await cookies();
  const locale = jar.get(LOCALE_COOKIE)?.value;
  const theme = jar.get(THEME_COOKIE)?.value;
  return {
    locale: validLocale(locale) ? locale : ("pt-BR" as const),
    theme: validTheme(theme) ? theme : ("light" as const),
  };
});
export async function getTranslator() {
  const { locale } = await getBrowserPreferences();
  return { t: translator(locale), locale };
}
