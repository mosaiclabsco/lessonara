export function validateWeeklyFrequency(value: string) {
  const count = Number(value);
  if (!value.trim() || !Number.isInteger(count) || count < 1 || count > 7)
    throw new Error("Informe entre 1 e 7 aulas por semana.");
  return count;
}
