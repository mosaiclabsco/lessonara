import { expect, it } from "vitest";
import { translator, validLocale, validTheme } from "./core";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
it("keeps complete translations and interpolation slots for every language", () => {
  for (const table of [es, fr]) {
    expect(Object.keys(table).sort()).toEqual(Object.keys(en).sort());
  }
  for (const table of [en, es, fr])
    for (const [source, target] of Object.entries(table)) {
      expect(target.match(/\{value\d+\}/g)?.sort() ?? []).toEqual(
        source.match(/\{value\d+\}/g)?.sort() ?? [],
      );
    }
});
it("translates controls while keeping user text intact", () => {
  expect(translator("en")("Dia")).toBe("Day");
  expect(translator("fr")("Dia")).toBe("Jour");
  expect(translator("es")("Dia")).toBe("Día");
  expect(translator("pt-BR")("Dia")).toBe("Dia");
  expect(translator("en")("Gabriel 123")).toBe("Gabriel 123");
});
it("accepts only supported preferences", () => {
  for (const value of ["pt-BR", "en", "es", "fr"]) expect(validLocale(value)).toBe(true);
  for (const value of ["light", "dark", "system"]) expect(validTheme(value)).toBe(true);
  for (const value of [null, "de", "EN", {}, "../en"]) expect(validLocale(value)).toBe(false);
  for (const value of [null, "auto", {}, "Dark"]) expect(validTheme(value)).toBe(false);
});
