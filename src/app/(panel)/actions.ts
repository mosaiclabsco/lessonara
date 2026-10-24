"use server";

import {
  FormValidationError,
  validatedAction,
  formText,
  integerValue,
  isoDate,
  fieldValue,
  uuidValue,
} from "@/lib/form-validation";
import { requireConfiguredTeacher } from "@/lib/onboarding";
import { processCalendarJobs } from "@/lib/google/worker";
import { googleBusy } from "@/lib/google/calendar";
import { parseMoney } from "@/lib/money";
import { after } from "next/server";
import { processEmails } from "@/lib/mail/outbox";
import { normalizeStudentPhone } from "@/lib/phone";
import { validatePlanFrequency, planFrequency, firstPlannedDate } from "@/lib/plan-frequency";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { halfHourTime } from "@/lib/calendar";

const str = (f: FormData, k: string) => formText(f, k) || null;

function check<T extends { error: unknown }>(r: T): T {
  if (r.error) {
    const error = r.error as { code?: string; message?: string };
    const messages: Record<string, string> = {
      "23505": "Este registro já existe. Atualize a página.",
      "23503": "Este registro está vinculado a outro dado. Confira antes de remover.",
      "23514": "Confira os valores e a frequência informados.",
      "42501": "Você não tem acesso a essa informação.",
    };
    if (error.code && (messages[error.code] || error.code === "P0001")) {
      throw new FormValidationError(
        "",
        messages[error.code] || error.message || "Confira os valores informados.",
      );
    }
    throw new Error("Não foi possível salvar agora. Tente novamente.");
  }
  return r;
}

function studentFields(f: FormData) {
  const email = str(f, "email")?.toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new FormValidationError("email", "Informe um email válido para o aluno.");
  const phone = formText(f, "phone", 40);
  const contact = fieldValue("phone", () =>
    normalizeStudentPhone(phone ?? "", formText(f, "phone_country", 2) || "BR"),
  );
  return {
    ...contact,
    name: formText(f, "name", 120, true),
    email,
    plan_id: uuidValue(formText(f, "plan_id", 36, true), "plan_id"),
    price_override: fieldValue("price_override", () =>
      parseMoney(formText(f, "price_override", 24), true),
    ),
    notes: formText(f, "notes", 4000, false, true) || null,
  };
}

export async function createStudent(f: FormData) {
  return validatedAction(async () => {
    const { supabase, userId } = await requireConfiguredTeacher();
    const fields = studentFields(f);
    const planId = fields.plan_id;
    const plan = check(
      await supabase
        .from("plans")
        .select("id")
        .eq("teacher_id", userId)
        .eq("id", planId ?? "")
        .eq("is_active", true)
        .maybeSingle(),
    ).data;
    if (!plan) throw new FormValidationError("plan_id", "Escolha um plano ativo para o aluno.");
    const { data } = check(
      await supabase
        .from("students")
        .insert({
          ...fields,
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
  });
}

export async function updateStudent(id: string, f: FormData) {
  return validatedAction(async () => {
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
  });
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
  const time = fieldValue("time", () => halfHourTime(formText(f, "time", 5, true)));
  const dateField = frequency.mode === "flexible" ? "date" : "starts_on";
  const date = isoDate(formText(f, dateField, 10, true), dateField);
  const weekday =
    frequency.mode === "recurring" && frequency.period === "week"
      ? integerValue(f.get("weekday"), "weekday", 0, 6)
      : null;
  const monthly_day =
    frequency.mode === "recurring" && frequency.period === "month"
      ? integerValue(f.get("monthly_day"), "monthly_day", 1, 31)
      : null;
  const actualDate =
    frequency.mode === "flexible"
      ? date
      : firstPlannedDate(date, frequency.period, (weekday ?? monthly_day)!);
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
  if (frequency.mode === "flexible") {
    check(
      await supabase
        .from("appointments")
        .insert({ student_id: studentId, teacher_id: userId, date, time }),
    );
  } else {
    check(
      await supabase
        .from("schedules")
        .insert({ student_id: studentId, weekday, monthly_day, time, starts_on: date }),
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
  return validatedAction(async () => {
    const { supabase, userId } = await requireUser();
    const endsOn = isoDate(formText(f, "ends_on", 10, true), "ends_on");
    const existing = check(
      await supabase
        .from("schedules")
        .select("starts_on")
        .eq("id", scheduleId)
        .eq("student_id", studentId)
        .maybeSingle(),
    ).data;
    if (!existing)
      throw new FormValidationError("ends_on", "Horário não encontrado. Atualize a página.");
    if (endsOn < existing.starts_on)
      throw new FormValidationError(
        "ends_on",
        "O encerramento não pode ser anterior ao início do horário.",
      );
    check(
      await supabase
        .from("schedules")
        .update({ ends_on: endsOn })
        .eq("id", scheduleId)
        .eq("student_id", studentId),
    );
    let calendarPending = false;
    try {
      const sync = await processCalendarJobs(userId);
      calendarPending = Boolean(sync?.failed);
    } catch {
      calendarPending = true;
      console.error("calendar_queue_failed");
    }
    revalidatePath(`/students/${studentId}`);
    revalidatePath("/", "layout");
    if (calendarPending)
      throw new FormValidationError(
        "",
        "Horário encerrado no Lessonara. Há pendências de sincronização com o Google; confira Integrações antes de reutilizar o horário.",
      );
  });
}

export async function deleteSchedule(studentId: string, scheduleId: string) {
  const { supabase, userId } = await requireUser();
  check(await supabase.from("schedules").delete().eq("id", scheduleId).eq("student_id", studentId));
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
  return validatedAction(async () => {
    const { supabase } = await requireUser();
    check(
      await supabase.from("packages").insert({
        student_id: studentId,
        paid_on: isoDate(formText(f, "paid_on", 10, true), "paid_on"),
        lessons: integerValue(f.get("lessons"), "lessons", 1, 1000),
        amount: fieldValue("amount", () => parseMoney(formText(f, "amount", 24, true))),
        notes: formText(f, "notes", 4000, false, true) || null,
      }),
    );
    revalidatePath(`/students/${studentId}`);
    revalidatePath("/", "layout");
  });
}

export async function deletePackage(studentId: string, packageId: string) {
  const { supabase } = await requireUser();
  check(await supabase.from("packages").delete().eq("id", packageId).eq("student_id", studentId));
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
  isoDate(date);
  halfHourTime(time);
  if (kind !== "falta" && kind !== "desmarcada")
    throw new FormValidationError("kind", "Escolha falta ou desmarcada.");
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
  return validatedAction(async () => {
    const { supabase, userId } = await requireUser();
    check(
      await supabase.from("lesson_events").insert({
        student_id: studentId,
        date: isoDate(formText(f, "date", 10, true)),
        time: fieldValue("time", () => halfHourTime(formText(f, "time", 5, true))),
        kind: "reposicao",
        note: formText(f, "note", 4000, false, true) || null,
        source_event_id: uuidValue(formText(f, "source_event_id", 36, true), "source_event_id"),
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
  });
}

export async function deleteEvent(studentId: string, eventId: string) {
  const { supabase, userId } = await requireUser();
  const removed = await supabase
    .from("lesson_events")
    .delete()
    .eq("id", eventId)
    .eq("student_id", studentId);
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
  return validatedAction(async () => {
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
  });
}

function teacherName(value: FormDataEntryValue | null) {
  const form = new FormData();
  if (value !== null) form.set("name", value);
  return formText(form, "name", 120, true);
}
function lessonMinutes(value: FormDataEntryValue | null) {
  const minutes = integerValue(value, "lesson_minutes", 15, 180);
  if (minutes % 15)
    throw new FormValidationError(
      "lesson_minutes",
      "Escolha uma duração em intervalos de 15 minutos.",
    );
  return minutes;
}

function planFields(f: FormData) {
  return {
    is_active: true,
    name: formText(f, "name", 120, true),
    lessons: integerValue(f.get("lessons"), "lessons", 1, 1000),
    price: fieldValue("price", () => parseMoney(formText(f, "price", 24, true))),
    ...fieldValue("frequency_count", () =>
      validatePlanFrequency(
        f.get("frequency_period"),
        f.get("frequency_count"),
        f.get("scheduling_mode"),
      ),
    ),
  };
}

export async function createPlan(f: FormData) {
  return validatedAction(async () => {
    const { supabase, userId } = await requireUser();
    const fields = planFields(f);
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
        ...fields,
        teacher_id: userId,
        sort_order: (last.data?.[0]?.sort_order ?? -1) + 1,
      }),
    );
    revalidatePath("/settings");
  });
}

export async function updatePlan(id: string, f: FormData) {
  return validatedAction(async () => {
    const { supabase } = await requireUser();
    check(await supabase.from("plans").update(planFields(f)).eq("id", id));
    revalidatePath("/settings");
  });
}

export async function deletePlan(id: string) {
  const { supabase } = await requireUser();
  check(await supabase.from("plans").delete().eq("id", id));
  revalidatePath("/settings");
}

export async function cancelLesson(studentId: string, date: string, time: string) {
  isoDate(date);
  halfHourTime(time);
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
