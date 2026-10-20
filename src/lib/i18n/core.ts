import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
export const LOCALES = ["pt-BR", "en", "es", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export type Theme = "light" | "dark" | "system";
export const LOCALE_COOKIE = "lessonara_locale";
export const THEME_COOKIE = "lessonara_theme";
export function validLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}
export function validTheme(value: unknown): value is Theme {
  return ["light", "dark", "system"].includes(value as Theme);
}
export type Translator = (
  message: string | number | null | undefined,
  values?: Record<string, string | number>,
) => string;
const dictionaries: Record<string, Record<string, string>> = { en, es, fr };
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
const patternCache = new Map<Locale, { key: string; regex: RegExp; names: string[] }[]>();
function patterns(locale: Locale) {
  if (patternCache.has(locale)) return patternCache.get(locale)!;
  const result = Object.keys(dictionaries[locale] ?? {})
    .filter((key) => /\{value\d+\}/.test(key))
    .map((key) => {
      const names: string[] = [];
      let expression = "";
      let last = 0;
      for (const match of key.matchAll(/\{(value\d+)\}/g)) {
        expression += key.slice(last, match.index).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(.+?)";
        names.push(match[1]);
        last = match.index! + match[0].length;
      }
      expression += key.slice(last).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return { key, regex: new RegExp(`^${expression}$`), names };
    })
    .sort((a, b) => b.key.length - a.key.length);
  patternCache.set(locale, result);
  return result;
}
export function translator(locale: Locale): Translator {
  return (message, values = {}) => {
    if (message == null) return "";
    if (typeof message !== "string") return String(message);
    const key = normalize(message);
    const table = dictionaries[locale] ?? {};
    let result = table[key] ?? key;
    let params = values;
    if (locale !== "pt-BR" && !table[key])
      for (const pattern of patterns(locale)) {
        const match = pattern.regex.exec(key);
        if (match) {
          result = table[pattern.key];
          params = {
            ...values,
            ...Object.fromEntries(pattern.names.map((name, index) => [name, match[index + 1]])),
          };
          break;
        }
      }
    result = result.replace(/\{(\w+)\}/g, (match, name) =>
      Object.hasOwn(params, name) ? String(params[name]) : match,
    );
    return `${/^\s/.test(message) ? " " : ""}${result}${/\s$/.test(message) ? " " : ""}`;
  };
}
export const localeTag = (locale: Locale) =>
  locale === "en" ? "en-US" : locale === "es" ? "es-ES" : locale === "fr" ? "fr-FR" : "pt-BR";
