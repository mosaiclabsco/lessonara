import { expect, it } from "vitest";
import { parseMoney, positiveLessonCount, moneyInput, maskMoney } from "./money";
it.each([
  ["300,50", 300.5],
  ["1.234,56", 1234.56],
  ["300.50", 300.5],
  ["1.000", 1000],
  ["0,00", 0],
])("interpreta %s sem perder centavos", (value, expected) =>
  expect(parseMoney(value)).toBe(expected),
);
it.each(["-1", "NaN", "1,234", "1.2.3", "R$ 20", "Infinity"])(
  "rejeita moeda inválida %s",
  (value) => expect(() => parseMoney(value)).toThrow(),
);
it.each(["-1", "0", "1.5", "", "NaN", "1001"])("rejeita quantidade inválida de aulas %s", (value) =>
  expect(() => positiveLessonCount(value)).toThrow(),
);
it("campo opcional vazio herda o preço, e a apresentação usa duas casas", () => {
  expect(parseMoney("", true)).toBeNull();
  expect(moneyInput(300)).toBe("300,00");
  expect(moneyInput(1234.5)).toBe("1.234,50");
});

it("formata durante a digitação com milhares, centavos e teto de 99 mil", () => {
  expect(maskMoney("1")).toBe("0,01");
  expect(maskMoney("123456")).toBe("1.234,56");
  expect(maskMoney("99999999")).toBe("99.000,00");
  expect(maskMoney("")).toBe("");
  expect(() => parseMoney("99.000,01")).toThrow();
  expect(parseMoney("99.000,00")).toBe(99000);
});
