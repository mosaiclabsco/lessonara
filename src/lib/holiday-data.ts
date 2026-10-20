import type { SupabaseClient } from "@supabase/supabase-js";
import type { Holiday, HolidayPolicy } from "./ledger";

export type HolidaySettings = {
  teacher_id: string;
  enabled: boolean;
  policy: HolidayPolicy;
  effective_from: string | null;
  lock_at: string | null;
};
export type HolidayRow = Holiday & { id: string; teacher_id: string };
export async function loadHolidayRules(supabase: SupabaseClient, teacherIds: string[]) {
  if (!teacherIds.length)
    return { ready: true, settings: [] as HolidaySettings[], holidays: [] as HolidayRow[] };
  const [settings, holidays] = await Promise.all([
    supabase
      .from("holiday_settings")
      .select("*")
      .in("teacher_id", teacherIds)
      .returns<HolidaySettings[]>(),
    supabase
      .from("holidays")
      .select("*")
      .in("teacher_id", teacherIds)
      .order("date")
      .returns<HolidayRow[]>(),
  ]);
  for (const result of [settings, holidays]) {
    if (result.error && ["42P01", "PGRST205"].includes(result.error.code))
      return { ready: false, settings: [] as HolidaySettings[], holidays: [] as HolidayRow[] };
    if (result.error) throw result.error;
  }
  return { ready: true, settings: settings.data ?? [], holidays: holidays.data ?? [] };
}
