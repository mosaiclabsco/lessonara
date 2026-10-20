import { expect, it } from "vitest";
import { validateWeeklyFrequency } from "./frequency";
it("frequência é quantidade inteira explícita", () => {
  expect(validateWeeklyFrequency("2")).toBe(2);
  expect(validateWeeklyFrequency("7")).toBe(7);
});
it.each(["", "0", "-1", "1.5", "8", "abc"])("rejeita frequência inválida %s", (value) =>
  expect(() => validateWeeklyFrequency(value)).toThrow(),
);
