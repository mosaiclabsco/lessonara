import { it, expect } from "vitest";
import { previewImport, csvRecords, IMPORT_TEMPLATE } from "./import-rules";
const plan = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Semanal",
  lessons: 4,
  price: 300,
  frequency_count: 2,
  frequency_period: "week" as const,
  scheduling_mode: "recurring" as const,
  is_active: true,
};
const header = IMPORT_TEMPLATE.split("\n")[0].replace("codigo_plano", "plano");
const csv = (line: string) => header + "\n" + line + "\n";
const line = "Ana;ana@example.com;;BR;Semanal;0;-2;2026-10-21;seg 18:00|qua 18:00;Chegou agora";
it("previews students, zero override, negative opening balance and weekly schedule", () => {
  const [r] = previewImport(csv(line), [plan], [], "2026-10-21");
  expect(r.error).toBeNull();
  expect(r.price_override).toBe(0);
  expect(r.opening_credits).toBe(-2);
  expect(r.schedules).toEqual([
    { weekday: 1, monthly_day: null, date: null, time: "18:00" },
    { weekday: 3, monthly_day: null, date: null, time: "18:00" },
  ]);
});
it("parses quoted separators, escaped quotes, BOM and multiline notes", () => {
  const input = '\ufeffnome;email\r\n"Ana; Silva";"a""b"\r\n';
  expect(csvRecords(input)).toEqual([
    ["nome", "email"],
    ["Ana; Silva", 'a"b'],
  ]);
  expect(() => csvRecords('a;b\n"unfinished')).toThrow();
  expect(() => csvRecords('a;b\n"closed"extra;x')).toThrow();
});
it("blocks existing and intra-file duplicates without overwriting", () => {
  expect(
    previewImport(csv(line), [plan], [{ name: "Other", email: "ANA@example.com" }], "2026-10-21")[0]
      .error,
  ).toMatch(/duplicata/);
  expect(previewImport(csv(line + "\n" + line), [plan], [], "2026-10-21")[1].error).toMatch(
    /duplicata/,
  );
});
it("rejects an ambiguous/missing/inactive plan and invalid dates", () => {
  expect(
    previewImport(csv(line), [plan, { ...plan, id: "another" }], [], "2026-10-21")[0].error,
  ).toMatch(/plano/);
  expect(
    previewImport(csv(line), [{ ...plan, is_active: false }], [], "2026-10-21")[0].error,
  ).toMatch(/plano/);
  expect(
    previewImport(csv(line.replace("2026-10-21", "2026-02-30")), [plan], [], "2026-10-21")[0].error,
  ).toMatch(/data/);
  expect(
    previewImport(csv(line.replace("2026-10-21", "2026-10-20")), [plan], [], "2026-10-21")[0].error,
  ).toMatch(/hoje/);
});
it("checks balance bounds, money, phone and schedule cadence", () => {
  for (const [value, pattern] of [
    [line.replace(";-2;", ";-1001;"), /saldo/],
    [line.replace(";0;", ";1.000,00;"), /valor/],
    [line.replace("seg 18:00", "seg 25:00"), /Horário/],
    [line.replace("qua 18:00", "seg 19:00"), /repetidos/],
  ] as const)
    expect(previewImport(csv(value), [plan], [], "2026-10-21")[0].error).toMatch(pattern);
  expect(
    previewImport(csv(line), [{ ...plan, frequency_count: 1 }], [], "2026-10-21")[0].error,
  ).toMatch(/frequência/);
});
it("supports fixed monthly days and flexible exact dates", () => {
  const monthly = { ...plan, frequency_period: "month" as const };
  expect(
    previewImport(
      csv(line.replace("seg 18:00|qua 18:00", "15 18:00|28 18:00")),
      [monthly],
      [],
      "2026-10-21",
    )[0].schedules[0].monthly_day,
  ).toBe(15);
  const flex = { ...monthly, scheduling_mode: "flexible" as const };
  const r = previewImport(
    csv(line.replace("seg 18:00|qua 18:00", "2026-10-22 18:00")),
    [flex],
    [],
    "2026-10-21",
  )[0];
  expect(r.error).toBeNull();
  expect(r.schedules[0].date).toBe("2026-10-22");
});
it("does not accept headers, columns or files outside the bounded contract", () => {
  expect(() =>
    previewImport(csv(line).replace("nome;email", "nome;nome"), [plan], [], "2026-10-21"),
  ).toThrow(/colunas/);
  expect(previewImport(csv(line + ";extra"), [plan], [], "2026-10-21")[0].error).toMatch(/colunas/);
  expect(() => csvRecords("x".repeat(524289))).toThrow(/512/);
  expect(() =>
    csvRecords(header + "\n" + Array.from({ length: 201 }, () => line).join("\n")),
  ).toThrow(/200/);
});

it("uses stable plan codes despite renamed or duplicate names, with optional hash", () => {
  const coded = { ...plan, code: "ABC1234567", name: "Novo nome" };
  for (const value of ["#abc1234567", "ABC1234567"]) {
    const input = csv(line.replace(";Semanal;", `;${value};`)).replace(";plano;", ";codigo_plano;");
    const [row] = previewImport(
      input,
      [coded, { ...plan, id: "another", code: "DEF1234567", name: "Novo nome" }],
      [],
      "2026-10-21",
    );
    expect(row.error).toBeNull();
    expect(row.plan_id).toBe(plan.id);
    expect(row.plan_name).toBe("Novo nome");
  }
});
it("rejects unknown, inactive and foreign codes without falling back to a name", () => {
  const input = csv(line.replace(";Semanal;", ";#ABC1234567;")).replace(
    ";plano;",
    ";codigo_plano;",
  );
  for (const plans of [
    [],
    [{ ...plan, code: "ABC1234567", is_active: false }],
    [{ ...plan, name: "#ABC1234567", code: "OTHER12345" }],
  ]) {
    expect(previewImport(input, plans, [], "2026-10-21")[0].error).toMatch(/Código de plano/);
  }
  expect(() =>
    previewImport(input.replace(";codigo_plano;", ";plano;codigo_plano;"), [], [], "2026-10-21"),
  ).toThrow(/colunas/);
});
