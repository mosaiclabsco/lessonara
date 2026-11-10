import { afterEach, beforeEach, expect, it, vi } from "vitest";
const request = vi.hoisted(() => vi.fn());
vi.mock("./calendar", async () => ({
  googleRequest: request,
  safeMeetUrl: (await import("../meeting-url")).safeMeetUrl,
}));
import {
  googleLessonInstance,
  listGoogleLessonChoices,
  readGoogleLessonPreview,
  validGoogleEventId,
} from "./lesson-links";
const event = {
  id: "event1",
  summary: "English",
  start: { dateTime: "2030-01-10T10:00:00-03:00" },
  end: { dateTime: "2030-01-10T11:00:00-03:00" },
  hangoutLink: "https://meet.google.com/abc-defg-hij",
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2030-01-01T12:00:00Z"));
  request.mockReset();
});
afterEach(() => vi.useRealTimers());
it("normalizes dates in São Paulo without inferring attendance or rounding", () => {
  expect(googleLessonInstance(event)).toEqual({
    id: "event1",
    date: "2030-01-10",
    time: "10:00",
    duration: 60,
    meet: event.hangoutLink,
  });
  expect(googleLessonInstance({ ...event, status: "cancelled" })).toBeNull();
  expect(
    googleLessonInstance({ ...event, start: { dateTime: "2029-01-01T10:00:00Z" } }),
  ).toBeNull();
  expect(() =>
    googleLessonInstance({ ...event, end: { dateTime: "2030-01-10T11:01:00-03:00" } }),
  ).toThrow();
  expect(googleLessonInstance({ ...event, hangoutLink: "https://evil.example" })?.meet).toBeNull();
});
it.each(["../events", "x?sendUpdates=all", "lessonara123", ""])(
  "rejects invalid or Lessonara-managed event IDs: %s",
  (id) => expect(validGoogleEventId(id)).toBe(false),
);
it("lists series once, follows pagination and excludes all-day or exported events", async () => {
  request
    .mockResolvedValueOnce(
      Response.json({
        items: [
          { ...event, id: "instance1", recurringEventId: "series1" },
          { ...event, id: "lessonara123" },
        ],
        nextPageToken: "next",
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        items: [
          { ...event, id: "instance2", recurringEventId: "series1" },
          { id: "allday", start: { date: "2030-01-05" } },
        ],
      }),
    );
  expect(await listGoogleLessonChoices("teacher", "2030-01-01")).toEqual([
    { id: "series1", title: "English", recurring: true, date: "2030-01-10", time: "10:00" },
  ]);
  expect(request.mock.calls[1][1]).toContain("pageToken=next");
});
it("uses exact future Google instances, excludes cancellations and never writes Google", async () => {
  request
    .mockResolvedValueOnce(
      Response.json({ ...event, id: "series1", recurrence: ["RRULE:FREQ=WEEKLY"] }),
    )
    .mockResolvedValueOnce(
      Response.json({ items: [event, { ...event, id: "cancel", status: "cancelled" }] }),
    );
  const result = await readGoogleLessonPreview("teacher", "series1", "2030-01-01");
  expect(result.instances).toHaveLength(1);
  expect(result.recurring).toBe(true);
  expect(request.mock.calls.every((c) => c.length === 2 && c[0] === "teacher")).toBe(true);
  expect(request.mock.calls[1][1]).toContain("series1/instances");
});
it("failure or incomplete pagination cannot be treated as an empty calendar", async () => {
  request.mockResolvedValue(new Response("", { status: 503 }));
  await expect(readGoogleLessonPreview("teacher", "event1", "2030-01-01", true)).rejects.toThrow();
  request
    .mockReset()
    .mockImplementation(() => Promise.resolve(Response.json({ items: [], nextPageToken: "more" })));
  await expect(listGoogleLessonChoices("teacher", "2030-01-01")).rejects.toThrow("muitos eventos");
});
it("only 404/410 or explicit cancellation can remove future occurrences", async () => {
  request.mockResolvedValueOnce(new Response("", { status: 410 }));
  expect(
    (await readGoogleLessonPreview("teacher", "event1", "2030-01-01", true)).instances,
  ).toEqual([]);
  request.mockResolvedValueOnce(new Response("", { status: 410 }));
  await expect(readGoogleLessonPreview("teacher", "event1", "2030-01-01")).rejects.toThrow();
});
