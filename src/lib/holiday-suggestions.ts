const FIXED = [
  ["01-01", "Confraternização Universal"],
  ["04-21", "Tiradentes"],
  ["05-01", "Dia do Trabalho"],
  ["09-07", "Independência do Brasil"],
  ["10-12", "Nossa Senhora Aparecida"],
  ["11-02", "Finados"],
  ["11-15", "Proclamação da República"],
  ["11-20", "Dia Nacional de Zumbi e da Consciência Negra"],
  ["12-25", "Natal"],
] as const;
export function suggestedHolidays(year: number, today: string) {
  if (
    !Number.isInteger(year) ||
    year < Number(today.slice(0, 4)) ||
    year > Number(today.slice(0, 4)) + 2
  )
    return [];
  return FIXED.map(([day, name]) => ({ date: `${year}-${day}`, name })).filter(
    (item) => item.date > today,
  );
}
