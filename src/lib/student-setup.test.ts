import { it, expect } from "vitest";
import { needsSchedule } from "./student-setup";
it("mantém o aluno pendente até existir horário ou data avulsa futura", () => {
  expect(needsSchedule(true, [], [], "2026-10-09")).toBe(true);
  expect(needsSchedule(true, [{ ends_on: null }], [], "2026-10-09")).toBe(false);
  expect(needsSchedule(true, [], [{ date: "2026-10-10" }], "2026-10-09")).toBe(false);
  expect(needsSchedule(true, [{ ends_on: "2026-10-08" }], [], "2026-10-09")).toBe(true);
  expect(needsSchedule(false, [], [], "2026-10-09")).toBe(false);
});
