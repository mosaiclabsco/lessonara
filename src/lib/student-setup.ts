export function needsSchedule(
  active: boolean,
  schedules: { ends_on: string | null }[],
  appointments: { date: string }[],
  today: string,
) {
  return (
    active &&
    !schedules.some((s) => !s.ends_on || s.ends_on >= today) &&
    !appointments.some((a) => a.date >= today)
  );
}
