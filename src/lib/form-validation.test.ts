import { expect, it } from "vitest";
import {
  fieldValue,
  formText,
  integerValue,
  isoDate,
  validatedAction,
  textValue,
} from "./form-validation";
import { firstPlannedDate, validatePlanFrequency } from "./plan-frequency";
it.each([
  "2026-02-29",
  "2026-04-31",
  "2026-13-01",
  "2026-00-10",
  "2026-10-00",
  "2026-99-99",
  "0000-01-01",
  "2026-1-01",
])("recusa uma data inexistente: %s", (value) => expect(() => isoDate(value)).toThrow());
it("aceita dias bissextos e datas históricas sem impor regra nova de negócio", () => {
  expect(isoDate("2024-02-29")).toBe("2024-02-29");
});
it.each(["1.5", "NaN", "1e2", "", null, [1], new Blob(["x"]), -1, Infinity])(
  "recusa coerção para inteiro: %s",
  (value) => expect(() => integerValue(value, "weekday", 0, 6)).toThrow(),
);
it("não inventa nomes nem aceita upload como campo textual", () => {
  const form = new FormData();
  form.set("name", "   ");
  expect(() => formText(form, "name", 120, true)).toThrow();
  form.set("name", new Blob(["hello"]), "name.txt");
  expect(() => formText(form, "name", 120, true)).toThrow();
  expect(() => textValue("a".repeat(121), "name", 120, true)).toThrow();
  expect(() => textValue("a\nb", "name", 120, true)).toThrow();
  expect(textValue("Primeira linha\nSegunda linha", "notes", 4000, false, true)).toContain("\n");
});
it("serializa apenas erros esperados e preserva falhas internas e redirecionamentos", async () => {
  expect(
    await validatedAction(async () => {
      isoDate("2026-02-30", "paid_on");
    }),
  ).toMatchObject({ validation: { field: "paid_on" } });
  expect(
    await validatedAction(async () => {
      fieldValue("price", () => {
        throw new Error("Valor inválido.");
      });
    }),
  ).toEqual({ validation: { field: "price", message: "Valor inválido." } });
  await expect(
    validatedAction(async () => {
      throw new Error("database unavailable");
    }),
  ).rejects.toThrow("database unavailable");
});
it("rejeita frequência semanal avulsa e dia fracionado antes de calcular a agenda", () => {
  expect(() => validatePlanFrequency("week", 1, "flexible")).toThrow();
  expect(() => validatePlanFrequency("week", [1], "recurring")).toThrow();
  expect(() => firstPlannedDate("2026-10-20", "week", 1.5)).toThrow();
  expect(() => firstPlannedDate("2026-02-30", "month", 1)).toThrow();
});
