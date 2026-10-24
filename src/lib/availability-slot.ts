export type BusySlotInterval = { start: string; end: string; label: string };
export function slotOccupancy(intervals: BusySlotInterval[], start: number, duration: number) {
  const busy = intervals.filter(
    (item) => Date.parse(item.start) < start + duration * 60000 && Date.parse(item.end) > start,
  );
  const names = [
    ...new Set(busy.filter((item) => item.label !== "Ocupado no Google").map((item) => item.label)),
  ];
  return {
    blocked: busy.length > 0,
    names,
    groups: [...new Set(busy.map((item) => `${item.start}/${item.end}/${item.label}`).sort())],
    reason: busy.some((item) => item.label !== "Ocupado no Google")
      ? ("lesson" as const)
      : ("google" as const),
  };
}
