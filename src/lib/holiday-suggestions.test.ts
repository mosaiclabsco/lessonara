import { expect, it } from "vitest";
import { suggestedHolidays } from "./holiday-suggestions";
it("oferece apenas datas futuras e mantém sugestões de 2027", () => {
  expect(suggestedHolidays(2026, "2026-10-09").map((h) => h.date)).toEqual([
    "2026-10-12",
    "2026-11-02",
    "2026-11-15",
    "2026-11-20",
    "2026-12-25",
  ]);
  expect(suggestedHolidays(2027, "2026-10-09")).toHaveLength(9);
  expect(suggestedHolidays(2025, "2026-10-09")).toEqual([]);
});
