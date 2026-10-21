"use server";
import { after } from "next/server";
import { processCalendarJobs } from "@/lib/google/worker";
import { suggestedHolidays } from "@/lib/holiday-suggestions";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { nowInTZ, addDays } from "@/lib/dates";
type Result = { ok: true } | { ok: false; message: string };
export async function saveHolidayRule(enabled: boolean, policy: string): Promise<Result> {
  const { supabase } = await requireUser();
  if (typeof enabled !== "boolean" || !["consume", "preserve"].includes(policy))
    return { ok: false, message: "Escolha uma regra válida." };
  const { error } = await supabase.rpc("save_holiday_settings", {
    p_enabled: enabled,
    p_policy: policy,
  });
  if (error)
    return {
      ok: false,
      message: error.message.includes("travada")
        ? "A regra está travada porque uma aula já foi afetada. Atualize a página."
        : "Não foi possível salvar a regra de feriados.",
    };
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function addHoliday(date: string, name: string): Promise<Result> {
  const { supabase, userId } = await requireUser();
  const tomorrow = addDays(nowInTZ().today, 1);
  if (
    typeof date !== "string" ||
    typeof name !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(new Date(`${date}T12:00:00Z`).getTime()) ||
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date ||
    date < tomorrow ||
    !name.trim() ||
    name.trim().length > 120
  )
    return { ok: false, message: "Informe um nome e uma data válida a partir de amanhã." };
  const { error } = await supabase
    .from("holidays")
    .insert({ teacher_id: userId, date, name: name.trim() });
  if (error)
    return {
      ok: false,
      message:
        error.code === "23505"
          ? "Já existe um feriado nessa data."
          : "Não foi possível cadastrar o feriado.",
    };
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function removeHoliday(id: string): Promise<Result> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("holidays")
    .delete()
    .eq("id", id)
    .eq("teacher_id", userId)
    .gt("date", nowInTZ().today)
    .select("id")
    .maybeSingle();
  if (error || !data)
    return {
      ok: false,
      message: "Não foi possível remover. Feriados de hoje ou anteriores são preservados.",
    };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveSuggestedHolidays(year: number, dates: string[]): Promise<Result> {
  const { supabase, userId } = await requireUser();
  if (!Number.isInteger(year) || year < 1900 || year > 2200)
    return { ok: false, message: "Escolha um ano válido." };
  const choices = suggestedHolidays(year, nowInTZ().today);
  if (
    !Array.isArray(dates) ||
    dates.length > 9 ||
    !dates.length ||
    dates.some((date) => !choices.some((item) => item.date === date))
  )
    return { ok: false, message: "Confira os feriados selecionados." };
  const rows = choices
    .filter((item) => dates.includes(item.date))
    .map((item) => ({ ...item, teacher_id: userId }));
  const saved = await supabase
    .from("holidays")
    .upsert(rows, { onConflict: "teacher_id,date", ignoreDuplicates: true });
  if (saved.error) return { ok: false, message: "Não foi possível salvar as sugestões." };
  after(async () => {
    try {
      await processCalendarJobs(userId);
    } catch {
      console.error("calendar_queue_failed");
    }
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
