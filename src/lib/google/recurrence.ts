export function calendarExclusions(
  start: string,
  end: string | null,
  time: string,
  cancellations: { date: string; time: string | null }[],
  holidays: { date: string }[],
) {
  const dates = [
    ...cancellations
      .filter((e) => !e.time || e.time.slice(0, 5) === time.slice(0, 5))
      .map((e) => e.date),
    ...holidays.map((e) => e.date),
  ];
  return [...new Set(dates.filter((date) => date >= start && (!end || date <= end)))]
    .sort()
    .map((date) => date.replaceAll("-", "") + "T" + time.slice(0, 5).replace(":", "") + "00");
}
