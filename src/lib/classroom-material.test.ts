import { expect, it } from "vitest";
import { emptyMaterial, grantMatches, validateMaterial } from "./classroom-material";
const ref = {
  studentId: "11111111-1111-4111-8111-111111111111",
  sourceKind: "appointment" as const,
  sourceId: "22222222-2222-4222-8222-222222222222",
  date: "2026-10-10",
};
it("valida a página e coordenadas e mantém somente campos conhecidos", () => {
  const state = validateMaterial({
    ...emptyMaterial(),
    board: true,
    strokes: [
      { id: "stroke-1", page: 1, kind: "pen", at: 1, points: [[0.12345678, 1]], role: "teacher" },
    ],
  });
  expect(state.strokes[0].points).toEqual([[0.12346, 1]]);
  expect(state.strokes[0]).not.toHaveProperty("role");
});
it.each([-1, 1.1, NaN, Infinity])("recusa ponto fora do PDF %s", (x) =>
  expect(() =>
    validateMaterial({
      ...emptyMaterial(),
      strokes: [{ id: "a", page: 1, kind: "pen", at: 1, points: [[x, 0]] }],
    }),
  ).toThrow(),
);
it("limita texto, página e tamanho de anotação", () => {
  expect(() => validateMaterial({ ...emptyMaterial(), page: 0 })).toThrow();
  expect(() =>
    validateMaterial({
      ...emptyMaterial(),
      texts: [{ id: "a", page: 1, x: 0, y: 0, text: "x".repeat(201) }],
    }),
  ).toThrow();
  expect(() =>
    validateMaterial({
      ...emptyMaterial(),
      strokes: Array.from({ length: 9 }, (_, i) => ({
        id: String(i),
        page: 1,
        kind: "pen",
        at: 1,
        points: Array.from({ length: 900 }, () => [0, 0]),
      })),
    }),
  ).toThrow();
});
it("uma autorização de material não vale para outra aula ou depois de expirar", () => {
  const grant = {
    ref,
    teacherId: "teacher",
    state: emptyMaterial(),
    issuedAt: 100,
    expiresAt: 1000,
  };
  expect(grantMatches(grant, ref, 500)).toBe(true);
  expect(grantMatches(grant, { ...ref, date: "2026-10-11" }, 500)).toBe(false);
  expect(grantMatches(grant, { ...ref, studentId: "other" }, 500)).toBe(false);
  expect(grantMatches(grant, ref, 1000)).toBe(false);
});
it("preserva cores permitidas e tempos individuais do laser sem aceitar estilos arbitrários", () => {
  const state = {
    ...emptyMaterial(),
    board: true,
    strokes: [
      {
        id: "laser",
        page: 1,
        kind: "laser",
        points: [
          [0, 0],
          [1, 1],
        ],
        at: 20,
        times: [10, 20],
        color: "#1971c2",
      },
    ],
    texts: [{ id: "text", page: 1, x: 0.1, y: 0.2, text: "Editar", color: "#2f9e44" }],
  };
  expect(validateMaterial(state).strokes[0]).toMatchObject({ color: "#1971c2", times: [10, 20] });
  expect(validateMaterial(state).texts[0].color).toBe("#2f9e44");
  expect(() =>
    validateMaterial({
      ...state,
      strokes: [{ ...state.strokes[0], color: "url(javascript:bad)" }],
    }),
  ).toThrow("Cor inválida");
  expect(() =>
    validateMaterial({ ...state, strokes: [{ ...state.strokes[0], times: [10] }] }),
  ).toThrow("Tempos de traço inválidos");
});

it("validates and preserves text font sizes within the shared board", () => {
  const text = { id: "text", page: 1, x: 0.2, y: 0.3, text: "Hello", fontSize: 40 };
  expect(validateMaterial({ ...emptyMaterial(), texts: [text] }).texts[0].fontSize).toBe(40);
  for (const fontSize of [0, 11, 73, Infinity, 24.5])
    expect(() =>
      validateMaterial({ ...emptyMaterial(), texts: [{ ...text, fontSize }] }),
    ).toThrow();
});
