export function movePlan<T extends { id: string }>(plans: T[], id: string, direction: -1 | 1): T[] {
  const index = plans.findIndex((plan) => plan.id === id),
    next = index + direction;
  if (index < 0 || next < 0 || next >= plans.length) return plans;
  const ordered = [...plans];
  [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
  return ordered;
}
export function placePlan<T extends { id: string }>(plans: T[], id: string, targetId: string): T[] {
  const from = plans.findIndex((item) => item.id === id),
    to = plans.findIndex((item) => item.id === targetId);
  if (from < 0 || to < 0 || from === to) return plans;
  const result = [...plans],
    [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}
