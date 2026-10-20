"use server";

import { requireConfiguredTeacher } from "@/lib/onboarding";
import { processCalendarJobs } from "@/lib/google/worker";
import { googleBusy } from "@/lib/google/calendar";
import { parseMoney, positiveLessonCount } from "@/lib/money";
import { after } from "next/server";
import { processEmails } from "@/lib/mail/outbox";
import { normalizeStudentPhone } from "@/lib/phone";
import { validatePlanFrequency, planFrequency, firstPlannedDate } from "@/lib/plan-frequency";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { halfHourTime } from "@/lib/calendar";

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const int = (f: FormData, k: string) => {
  const v = str(f, k);
  return v === null ? null : Math.round(Number(v.replace(",", ".")));
};

function check<T extends { error: unknown }>(r: T): T {
  if (r.error) {
    const error = r.error as { code?: string; message?: string };
    const messages: Record<string, string> = {
      "23505": "Este registro já existe. Atualize a página.",
      "23503": "Este registro está vinculado a outro dado. Confira antes de remover.",
      "23514": "Confira os valores e a frequência informados.",
      "42501": "Você não tem acesso a essa informação.",
    };
    throw new Error(
      error.code && messages[error.code]
        ? messages[error.code]
        : error.code === "P0001"
          ? error.message
          : "Não foi possível salvar agora. Tente novamente.",
    );
  }
  return r;
}

function studentFields(f: FormData) {
  const email = str(f, "email")?.toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new Error("Informe um email válido para o aluno.");
  const phone = str(f, "phone");
  const contact = normalizeStudentPhone(phone ?? "", str(f, "phone_country") ?? "BR");
  return {
    ...contact,
    name: str(f, "name") ?? "Sem nome",
    email,
    plan_id: str(f, "plan_id"),
    price_override: parseMoney(String(f.get("price_override") ?? ""), true),
    notes: str(f, "notes"),
  };
}

export async function createStudent(f: FormData) {
  const { supabase, userId } = await requireConfiguredTeacher();
  const planId = str(f, "plan_id");
  const plan = check(
    await supabase
      .from("plans")
      .select("id")
      .eq("teacher_id", userId)
      .eq("id", planId ?? "")
      .eq("is_active", true)
      .maybeSingle(),
  ).data;
  if (!plan) throw new Error("Escolha um plano ativo para o aluno.");
  const { data } = check(
    await supabase
      .from("students")
      .insert({
        ...studentFields(f),
        teacher_id: userId,
        slug: randomBytes(9).toString("base64url"),
      })
      .select("id")
      .single(),
  );
  after(async () => {
    try {
      await processEmails();
    } catch {
      console.error("email_queue_processing_failed");
    }
  });
  redirect(`/students/${data!.id}`);
}

export async function updateStudent(id: string, f: FormData) {
  const { supabase } = await requireUser();
  check(
    await supabase
      .from("students")
      .update({ ...studentFields(f), active: f.get("active") === "on" })
      .eq("id", id),
  );
  after(async () => {
    try {
      await processEmails();
    } catch {
      console.error("email_queue_processing_failed");
    }
  });
  revalidatePath(`/students/${id}`);
  revalidatePath("/", "layout");
}

export async function deleteStudent(id: string) {
  const { supabase } = await requireUser();
  check(await supabase.from("students").delete().eq("id", id));
  redirect("/students");
}

export async function regenerateLink(id: string) {
  const { supabase } = await requireUser();
  check(
    await supabase
      .from("students")
      .update({ slug: randomBytes(9).toString("base64url") })
      .eq("id", id),
  );
  revalidatePath(`/students/${id}`);
  revalidatePath("/", "layout");
}

async function saveSchedule(studentId: string, f: FormData) {
  const { supabase, userId } = await requireUser();
  const student = check(
    await supabase
      .from("students")
      .select("id,plan_id")
      .eq("id", studentId)
      .eq("teacher_id", userId)
      .maybeSingle(),
  ).data;
  if (!student?.plan_id) throw new Error("Escolha o plano do aluno antes de agendar.");
  const plan = check(
    await supabase
      .from("plans")
      .select("*")
      .eq("id", student.plan_id)
      .eq("teacher_id", userId)
      .single(),
  ).data;
  const frequency = planFrequency(plan);
  const time = halfHourTime(str(f, "time"));
  const checkDate = str(f, frequency.mode === "flexible" ? "date" : "starts_on");
  if (checkDate) {
    const actualDate =
      frequency.mode === "flexible"
        ? checkDate
        : firstPlannedDate(
            checkDate,
            frequency.period,
            Number(f.get(frequency.period === "week" ? "weekday" : "monthly_day")),
          );
    const teacher = check(
      await supabase.from("teachers").select("lesson_minutes").eq("id", userId).single(),
    ).data;
    const first = Date.parse(`${actualDate}T${time}:00-03:00`);
    const busy = await googleBusy(
      userId,
      new Date(first).toISOString(),
      new Date(first + (teacher?.lesson_minutes ?? 60) * 60000).toISOString(),
    );
    if (busy?.length) throw new Error("Este horário está ocupado na sua agenda Google.");
  }
  if (frequency.mode === "flexible") {
    const date = str(f, "date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Escolha uma data válida.");
    check(
      await supabase
        .from("appointments")
        .insert({ student_id: studentId, teacher_id: userId, date, time }),
    );
  } else {
    const startsOn = str(f, "starts_on");
    if (!startsOn || !/^\d{4}-\d{2}-\d{2}$/.test(startsOn))
      throw new Error("Escolha uma data válida.");
    const weekday = frequency.period === "week" ? int(f, "weekday") : null;
    const monthly_day = frequency.period === "month" ? int(f, "monthly_day") : null;
    if (
      (frequency.period === "week" && (weekday === null || weekday < 0 || weekday > 6)) ||
      (frequency.period === "month" &&
        (monthly_day === null || monthly_day < 1 || monthly_day > 31))
    )
      throw new Error("Confira o dia do agendamento.");
    check(
      await supabase
        .from("schedules")
        .insert({ student_id: studentId, weekday, monthly_day, time, starts_on: startsOn }),
    );
  }
  after(async () => {
    try {
      await processCalendarJobs(userId);
    } catch {
      console.error("calendar_queue_failed");
    }
  });
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/", "layout");
}

export async function addSchedule(studentId: string, f: FormData) {
  try {
    await saveSchedule(studentId, f);
    return { ok: true as const };
  } catch (cause) {
    return {
      ok: false as const,
      message: cause instanceof Error ? cause.message : "Não foi possível agendar.",
    };
  }
}

export async function endSchedule(studentId: string, scheduleId: string, f: FormData) {
  const { supabase, userId } = await requireUser();
  check(
    await supabase
      .from("schedules")
      .update({ ends_on: str(f, "ends_on") })
      .eq("id", scheduleId),
  );
  after(async () => {
    try {
      await processCalendarJobs(userId);
    } catch {
      console.error("calendar_queue_failed");
    }
  });
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/", "layout");
}

export async function deleteSchedule(studentId: string, scheduleId: string) {
  const { supabase, userId } = await requireUser();
  check(await supabase.from("schedules").delete().eq("id", scheduleId));
  after(async () => {
    try {
      await processCalendarJobs(userId);
    } catch {
      console.error("calendar_queue_failed");
    }
  });
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/", "layout");
}

export async function addPackage(studentId: string, f: FormData) {
  const { supabase } = await requireUser();
  check(
    await supabase.from("packages").insert({
      student_id: studentId,
      paid_on: str(f, "paid_on"),
      lessons: positiveLessonCount(f.get("lessons")),
      amount: parseMoney(String(f.get("amount") ?? "")),
      notes: str(f, "notes"),
    }),
  );
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/", "layout");
}

export async function deletePackage(studentId: string, packageId: string) {
  const { supabase } = await requireUser();
  check(await supabase.from("packages").delete().eq("id", packageId));
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/", "layout");
}

/** Marca falta/desmarcada numa aula da agenda fixa. */
export async function markLesson(
  studentId: string,
  date: string,
  time: string,
  kind: "falta" | "desmarcada",
) {
  const { supabase, userId } = await requireUser();
  check(await supabase.from("lesson_events").insert({ student_id: studentId, date, time, kind }));
  after(async () => {
    try {
      await processCalendarJobs(userId);
    } catch {
      console.error("calendar_queue_failed");
    }
  });
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/", "layout");
}

export async function addReposicao(studentId: string, f: FormData) {
  const { supabase, userId } = await requireUser();
  check(
    await supabase.from("lesson_events").insert({
      student_id: studentId,
      date: str(f, "date"),
      time: halfHourTime(str(f, "time")),
      kind: "reposicao",
      note: str(f, "note"),
      source_event_id: str(f, "source_event_id"),
    }),
  );
  after(async () => {
    try {
      await processCalendarJobs(userId);
    } catch {
      console.error("calendar_queue_failed");
    }
  });
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/", "layout");
}

export async function deleteEvent(studentId: string, eventId: string) {
  const { supabase, userId } = await requireUser();
  const removed = await supabase.from("lesson_events").delete().eq("id", eventId);
  if (removed.error?.code === "23503")
    throw new Error("Remova a reposição vinculada antes de desfazer esta desmarcação.");
  check(removed);
  after(async () => {
    try {
      await processCalendarJobs(userId);
    } catch {
      console.error("calendar_queue_failed");
    }
  });
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/", "layout");
}

export async function updateTeacher(f: FormData) {
  const { supabase, userId } = await requireUser();
  check(
    await supabase
      .from("teachers")
      .update({
        name: teacherName(f.get("name")),
        lesson_minutes: lessonMinutes(f.get("lesson_minutes")),
        profile_completed_at: new Date().toISOString(),
      })
      .eq("id", userId),
  );
  revalidatePath("/", "layout");
}

function teacherName(value: FormDataEntryValue | null) {
  const name = String(value ?? "").trim();
  if (!name || name.length > 120) throw new Error("Informe seu nome, com até 120 caracteres.");
  return name;
}
function lessonMinutes(value: FormDataEntryValue | null) {
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 180 || minutes % 15)
    throw new Error("Escolha uma duração de 15 a 180 minutos.");
  return minutes;
}

function planFields(f: FormData) {
  return {
    is_active: true,
    name: str(f, "name") ?? "Plano",
    lessons: positiveLessonCount(f.get("lessons")),
    price: parseMoney(String(f.get("price") ?? "")),
    ...validatePlanFrequency(
      f.get("frequency_period"),
      f.get("frequency_count"),
      f.get("scheduling_mode"),
    ),
  };
}

export async function createPlan(f: FormData) {
  const { supabase, userId } = await requireUser();
  const last = check(
    await supabase
      .from("plans")
      .select("sort_order")
      .eq("teacher_id", userId)
      .order("sort_order", { ascending: false })
      .limit(1),
  );
  check(
    await supabase.from("plans").insert({
      ...planFields(f),
      teacher_id: userId,
      sort_order: (last.data?.[0]?.sort_order ?? -1) + 1,
    }),
  );
  revalidatePath("/settings");
}

export async function updatePlan(id: string, f: FormData) {
  const { supabase } = await requireUser();
  check(await supabase.from("plans").update(planFields(f)).eq("id", id));
  revalidatePath("/settings");
}

export async function deletePlan(id: string) {
  const { supabase } = await requireUser();
  check(await supabase.from("plans").delete().eq("id", id));
  revalidatePath("/settings");
}

export async function cancelLesson(studentId: string, date: string, time: string) {
  const { supabase, userId } = await requireUser();
  const student = check(
    await supabase
      .from("students")
      .select("id")
      .eq("id", studentId)
      .eq("teacher_id", userId)
      .maybeSingle(),
  ).data;
  if (!student) throw new Error("Aluno não encontrado.");
  const { data } = check(
    await supabase
      .from("lesson_events")
      .insert({ student_id: studentId, date, time, kind: "desmarcada" })
      .select("id")
      .single(),
  );
  after(async () => {
    try {
      await processCalendarJobs(userId);
    } catch {
      console.error("calendar_queue_failed");
    }
  });
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/", "layout");
  return data!.id as string;
}

export async function reorderPlans(ids: string[]) {
  const { supabase } = await requireUser();
  if (
    !Array.isArray(ids) ||
    ids.length > 1000 ||
    ids.some((id) => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) ||
    new Set(ids).size !== ids.length
  )
    throw new Error("Ordem de planos inválida.");
  check(await supabase.rpc("reorder_teacher_plans", { plan_ids: ids }));
  revalidatePath("/", "layout");
}
