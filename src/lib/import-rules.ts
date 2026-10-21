import { textValue, isoDate, integerValue } from "./form-validation";
import { normalizeStudentPhone } from "./phone";
import type { Plan } from "./data";
export const IMPORT_MAX_BYTES = 512 * 1024,
  IMPORT_MAX_ROWS = 200;
export const IMPORT_TEMPLATE =
  "nome;email;telefone;pais;plano;valor_diferente;saldo_inicial;inicio;horarios;observacoes\nAluno Exemplo;aluno@example.com;;BR;NOME EXATO DO PLANO;;4;AAAA-MM-DD;seg 18:00|qua 18:00;\n";
export type ImportRow = {
  row_id: string;
  name: string;
  email: string;
  phone: string | null;
  phone_country: string;
  plan_id: string;
  plan_name: string;
  price_override: number | null;
  opening_credits: number;
  starts_on: string;
  schedules: {
    weekday: number | null;
    monthly_day: number | null;
    date: string | null;
    time: string;
  }[];
  notes: string | null;
  error: string | null;
};
export type ImportBatch = {
  id: string;
  mode: "guided" | "assisted";
  status: "waiting" | "review" | "completed" | "cancelled";
  filename: string;
  created_at: string;
  revision: number;
  preview: ImportRow[] | null;
  team_note: string | null;
  result_ids: string[] | null;
  object_path: string | null;
};
export function csvRecords(input: string): string[][] {
  if (new TextEncoder().encode(input).length > IMPORT_MAX_BYTES)
    throw new Error("O arquivo deve ter até 512 KB.");
  input = input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const first = input.slice(0, input.indexOf("\n") < 0 ? input.length : input.indexOf("\n"));
  const delimiter = first.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += c;
    } else if (c === delimiter || c === "\n") {
      row.push(value);
      value = "";
      closed = false;
      if (c === "\n") {
        if (row.some((v) => v.trim())) rows.push(row);
        row = [];
        if (rows.length > IMPORT_MAX_ROWS + 1)
          throw new Error("Importe até 200 alunos por arquivo.");
      }
    } else if (c === '"' && !value && !closed) quoted = true;
    else {
      if (closed || c === '"') throw new Error("Confira as aspas e separadores do CSV.");
      value += c;
    }
  }
  if (quoted) throw new Error("Uma célula do CSV está com aspas abertas.");
  row.push(value);
  if (row.some((v) => v.trim())) rows.push(row);
  if (rows.length < 2 || rows.length > IMPORT_MAX_ROWS + 1)
    throw new Error("O CSV deve ter de 1 a 200 alunos.");
  return rows;
}
export function previewImport(
  csv: string,
  plans: Plan[],
  existing: { name: string; email: string | null }[],
  today: string,
): ImportRow[] {
  const records = csvRecords(csv),
    header = records.shift()!.map((s) => s.trim().toLowerCase());
  const columns = [
    "nome",
    "email",
    "telefone",
    "pais",
    "plano",
    "valor_diferente",
    "saldo_inicial",
    "inicio",
    "horarios",
    "observacoes",
  ];
  if (
    new Set(header).size !== header.length ||
    columns.some((c) => !header.includes(c)) ||
    header.some((c) => !columns.includes(c))
  )
    throw new Error("Use as colunas do modelo, sem acrescentar ou repetir cabeçalhos.");
  const normalize = (s: string) =>
    s
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const names = new Set(existing.map((s) => normalize(s.name))),
    emails = new Set(existing.map((s) => s.email?.trim().toLowerCase()).filter(Boolean));
  const weekdays: Record<string, number> = {
    dom: 0,
    seg: 1,
    ter: 2,
    qua: 3,
    qui: 4,
    sex: 5,
    sab: 6,
  };
  return records.map((cells, index) => {
    const row = {
      row_id: String(index + 2),
      name: cells[header.indexOf("nome")]?.trim() ?? "",
      error: null,
    } as ImportRow;
    try {
      if (cells.length !== header.length)
        throw new Error("Quantidade de colunas diferente do cabeçalho.");
      const get = (key: string) =>
        textValue(
          cells[header.indexOf(key)],
          key,
          key === "observacoes" ? 4000 : key === "horarios" ? 1000 : 254,
          false,
          key === "observacoes",
        );
      row.name = textValue(get("nome"), "nome", 120, true);
      row.email = get("email").toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))
        throw new Error("Informe um email válido.");
      if (names.has(normalize(row.name)) || emails.has(row.email))
        throw new Error(
          "Possível duplicata de nome ou email. Nenhum cadastro existente será sobrescrito.",
        );
      names.add(normalize(row.name));
      emails.add(row.email);
      const matching = plans.filter(
        (p) => p.is_active !== false && normalize(p.name) === normalize(get("plano")),
      );
      if (matching.length !== 1)
        throw new Error(
          "O nome do plano deve identificar exatamente um plano ativo. Revise seus planos.",
        );
      const plan = matching[0];
      row.plan_id = plan.id;
      row.plan_name = plan.name;
      row.opening_credits = Number(get("saldo_inicial") || "0");
      if (
        !/^-?\d+$/.test(get("saldo_inicial") || "0") ||
        !Number.isInteger(row.opening_credits) ||
        Math.abs(row.opening_credits) > 1000
      )
        throw new Error("O saldo inicial deve ser um inteiro entre -1.000 e 1.000.");
      row.price_override = null;
      if (get("valor_diferente")) {
        const raw = get("valor_diferente").replace(",", ".");
        if (!/^\d+(?:\.\d{1,2})?$/.test(raw) || Number(raw) > 99000)
          throw new Error("Use valor_diferente de 0 a 99000,00, sem separador de milhar.");
        row.price_override = Number(raw);
      }
      Object.assign(row, normalizeStudentPhone(get("telefone"), get("pais") || "BR"));
      row.starts_on = isoDate(get("inicio"), "inicio");
      if (row.starts_on < today)
        throw new Error(
          "Use início hoje ou no futuro. O saldo inicial já representa as aulas anteriores.",
        );
      row.notes = get("observacoes") || null;
      const slots = get("horarios")
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
      if (slots.length > 31) throw new Error("Use até 31 horários.");
      row.schedules = slots.map((s) => {
        const match = /^(\S+) (\d{2}:\d{2})$/.exec(s);
        if (!match || !/^([01]\d|2[0-3]):[0-5]\d$/.test(match[2]))
          throw new Error(
            "Horário inválido. Use seg 18:00, 15 18:00 (mensal fixo) ou AAAA-MM-DD 18:00 (avulso).",
          );
        if (plan.scheduling_mode === "flexible") {
          const date = isoDate(match[1]);
          if (date < row.starts_on) throw new Error("A data avulsa é anterior ao início.");
          return { date, weekday: null, monthly_day: null, time: match[2] };
        }
        if (plan.frequency_period === "month") {
          return {
            date: null,
            weekday: null,
            monthly_day: integerValue(match[1], "horarios", 1, 31),
            time: match[2],
          };
        }
        const weekday = weekdays[normalize(match[1])];
        if (weekday === undefined)
          throw new Error("Dia semanal inválido. Use dom, seg, ter, qua, qui, sex ou sab.");
        return { date: null, weekday, monthly_day: null, time: match[2] };
      });
      const keys = row.schedules.map((s) => s.date ?? String(s.monthly_day ?? s.weekday));
      if (new Set(keys).size !== keys.length)
        throw new Error("Há horários repetidos para o mesmo dia.");
      if (
        plan.scheduling_mode !== "flexible" &&
        slots.length > (plan.frequency_count ?? plan.weekly_lessons ?? 1)
      )
        throw new Error("Há mais horários do que a frequência do plano permite.");
    } catch (error) {
      row.error = error instanceof Error ? error.message : "Confira os dados desta linha.";
    }
    return row;
  });
}
