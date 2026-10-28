import { expect, it } from "vitest";
import { lessonAvailability } from "./lesson-availability";
it("distinguishes today, tomorrow and explicit dates in Sao Paulo across midnight UTC", () => {
  const now = Date.parse("2026-10-28T02:00:00Z");
  expect(lessonAvailability(Date.parse("2026-10-27T23:55:00Z"), now)).toMatchObject({
    day: "today",
    date: "2026-10-27",
    time: "20:55",
  });
  expect(lessonAvailability(Date.parse("2026-10-28T19:55:00Z"), now)).toMatchObject({
    day: "tomorrow",
    time: "16:55",
  });
  expect(lessonAvailability(Date.parse("2026-11-01T19:55:00Z"), now).day).toBe("date");
});
