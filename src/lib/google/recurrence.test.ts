import { expect, it } from "vitest";
import { calendarExclusions } from "./recurrence";
it("cancels only the selected occurrence instead of removing a weekly series", () => {
  expect(
    calendarExclusions("2026-10-01", null, "18:00:00", [{ date: "2026-10-28", time: "18:00" }], []),
  ).toEqual(["20261028T180000"]);
  expect(
    calendarExclusions("2026-10-01", null, "19:00", [{ date: "2026-10-28", time: "18:00" }], []),
  ).toEqual([]);
});
it("preserves other weeks and ignores exceptions outside the series interval", () => {
  expect(
    calendarExclusions(
      "2026-10-20",
      "2026-10-30",
      "18:00",
      [
        { date: "2026-10-14", time: null },
        { date: "2026-10-28", time: null },
        { date: "2026-11-04", time: null },
      ],
      [{ date: "2026-10-28" }],
    ),
  ).toEqual(["20261028T180000"]);
});
