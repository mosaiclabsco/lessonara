export function parseMoney(value: string | number, optional = false): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0 || value > 99000)
      throw new Error("Informe um valor entre R$ 0,00 e R$ 99.000,00.");
    return Math.round(value * 100) / 100;
  }
  const text = value.trim();
  if (!text && optional) return null;
  if (!text) throw new Error("Informe o valor.");
  let normalized = text;
  if (text.includes(",")) {
    if (!/^\d+(?:\.\d{3})*,\d{0,2}$/.test(text))
      throw new Error("Use um valor com até duas casas decimais.");
    normalized = text.replaceAll(".", "").replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) normalized = text.replaceAll(".", "");
  else if (!/^\d+(?:\.\d{0,2})?$/.test(text))
    throw new Error("Use um valor com até duas casas decimais.");
  return parseMoney(Number(normalized));
}
export function positiveLessonCount(value: unknown) {
  const text = String(value ?? "").trim();
  const n = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(n) || n < 1 || n > 1000)
    throw new Error("Informe de 1 a 1.000 aulas no pacote.");
  return n;
}
export function moneyInput(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function maskMoney(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return moneyInput(Math.min(Number(digits) / 100, 99000));
}
