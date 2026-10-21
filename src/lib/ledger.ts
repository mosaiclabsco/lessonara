import { safeMeetUrl } from "./meeting-url";
import { addDays, weekday } from "./dates";

export type Schedule = {
  id?: string;
  meet_url?: string | null;
  duration_minutes?: number;
  monthly_day?: number | null;
  weekday: number; // 0 = domingo
  time: string; // "HH:MM"
  starts_on: string;
  ends_on: string | null;
};

export type EventKind = "falta" | "desmarcada" | "reposicao";

export type LessonEvent = {
  id: string;
  date: string;
  kind: EventKind;
  time: string | null;
  note: string | null;
  meet_url?: string | null;
  duration_minutes?: number;
  source_event_id?: string | null;
};

export type Package = {
  id: string;
  paid_on: string;
  lessons: number;
  amount: number;
  created_at?: string;
};

export type Holiday = { date: string; name: string };
export type HolidayPolicy = "consume" | "preserve";
export type LessonStatus = "agendada" | "dada" | "falta" | "desmarcada" | "reposicao" | "feriado";

export type Lesson = {
  sourceKind?: "schedule" | "appointment" | "makeup";
  sourceId?: string;
  date: string;
  time: string;
  status: LessonStatus;
  /** Consome uma aula do pacote. */
  counts: boolean;
  past: boolean;
  /** Índice do pacote (ordem de pagamento) que cobre a aula; null = sem pacote. */
  packageIndex: number | null;
  /** ID do pacote calculado; não é um vínculo persistido no banco. */
  packageId: string | null;
  event: LessonEvent | null;
  durationMinutes?: number;
  meetUrl?: string | null;
  holidayName?: string | null;
};

export type Ledger = {
  openingCredits?: number;
  lessons: Lesson[];
  credits: number;
  used: number;
  /** Aulas pagas ainda não usadas. Negativo = aulas dadas sem pagamento. */
  remaining: number;
  /** Data da última aula coberta pelos pacotes pagos. */
  coveredUntil: string | null;
};

export function sortPackages(packages: Package[]) {
  return [...packages].sort(
    (a, b) =>
      a.paid_on.localeCompare(b.paid_on) ||
      (a.created_at ?? "").localeCompare(b.created_at ?? "") ||
      a.id.localeCompare(b.id),
  );
}

const MAX_WEEKS = 104;

export function computeLedger(input: {
  openingCredits?: number;
  schedules: Schedule[];
  appointments?: {
    id: string;
    date: string;
    time: string;
    meet_url?: string | null;
    duration_minutes?: number;
  }[];
  holidays?: Holiday[];
  holidayPolicy?: HolidayPolicy;
  events: LessonEvent[];
  packages: Package[];
  today: string;
  time: string;
}): Ledger {
  const { schedules, events, today, time } = input;
  const holidays = new Map((input.holidays ?? []).map((holiday) => [holiday.date, holiday.name]));
  const packages = sortPackages(input.packages);
  const opening = input.openingCredits ?? 0;
  const credits = packages.reduce((sum, p) => sum + p.lessons, opening);
  const limit = addDays(today, MAX_WEEKS * 7);

  const byDate = new Map<string, LessonEvent[]>();
  for (const e of events) {
    if (e.kind === "reposicao") continue;
    byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  }

  const isPast = (date: string, t: string) => date < today || (date === today && t <= time);

  const lessons: Lesson[] = [];
  for (const s of schedules) {
    const end = s.ends_on && s.ends_on < limit ? s.ends_on : limit;
    const dates: string[] = [];
    if (s.monthly_day) {
      let month = s.starts_on.slice(0, 7);
      while (`${month}-01` <= end) {
        const day = String(s.monthly_day).padStart(2, "0");
        const candidate = `${month}-${day}`;
        const valid = new Date(`${candidate}T12:00:00Z`).toISOString().slice(0, 10) === candidate;
        if (valid && candidate >= s.starts_on && candidate <= end) dates.push(candidate);
        const d = new Date(`${month}-01T12:00:00Z`);
        d.setUTCMonth(d.getUTCMonth() + 1);
        month = d.toISOString().slice(0, 7);
      }
    } else {
      for (
        let date = addDays(s.starts_on, (s.weekday - weekday(s.starts_on) + 7) % 7);
        date <= end;
        date = addDays(date, 7)
      )
        dates.push(date);
    }
    for (const date of dates) {
      const event = (byDate.get(date) ?? []).find((e) => !e.time || e.time === s.time) ?? null;
      const past = isPast(date, s.time);
      const holidayName = holidays.get(date) ?? null;
      const status: LessonStatus = event
        ? event.kind
        : holidayName
          ? "feriado"
          : past
            ? "dada"
            : "agendada";
      const counts =
        status !== "desmarcada" && (status !== "feriado" || input.holidayPolicy === "consume");
      lessons.push({
        sourceKind: "schedule",
        sourceId: s.id,
        date,
        time: s.time,
        status,
        counts,
        past,
        packageIndex: null,
        packageId: null,
        event,
        holidayName,
        durationMinutes: s.duration_minutes ?? 60,
        meetUrl: safeMeetUrl(s.meet_url),
      });
    }
  }
  for (const a of input.appointments ?? []) {
    if (a.date > limit) continue;
    const event = (byDate.get(a.date) ?? []).find((e) => !e.time || e.time === a.time) ?? null;
    const past = isPast(a.date, a.time);
    const holidayName = holidays.get(a.date) ?? null;
    const status: LessonStatus = event
      ? event.kind
      : holidayName
        ? "feriado"
        : past
          ? "dada"
          : "agendada";
    lessons.push({
      sourceKind: "appointment",
      sourceId: a.id,
      date: a.date,
      time: a.time,
      status,
      counts:
        status !== "desmarcada" && (status !== "feriado" || input.holidayPolicy === "consume"),
      past,
      packageIndex: null,
      packageId: null,
      event,
      holidayName,
      durationMinutes: a.duration_minutes ?? 60,
      meetUrl: safeMeetUrl(a.meet_url),
    });
  }
  for (const e of events) {
    if (e.kind !== "reposicao") continue;
    const t = e.time ?? "00:00";
    lessons.push({
      sourceKind: "makeup",
      sourceId: e.id,
      date: e.date,
      time: t,
      status: "reposicao",
      counts: true,
      past: isPast(e.date, t),
      packageIndex: null,
      packageId: null,
      event: e,
      durationMinutes: e.duration_minutes ?? 60,
      meetUrl: safeMeetUrl(e.meet_url),
    });
  }

  lessons.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  let pkg = 0;
  let usedInPkg = Math.max(0, -opening);
  let openingLeft = Math.max(0, opening);
  while (pkg < packages.length && usedInPkg >= packages[pkg].lessons) {
    usedInPkg -= packages[pkg].lessons;
    pkg++;
  }
  let used = 0;
  let coveredUntil: string | null = null;
  for (const l of lessons) {
    if (!l.counts) continue;
    if (l.past) used++;
    if (openingLeft > 0) {
      l.packageIndex = -1;
      l.packageId = "opening";
      openingLeft--;
      coveredUntil = l.date;
      continue;
    }
    if (pkg < packages.length) {
      l.packageIndex = pkg;
      l.packageId = packages[pkg].id;
      coveredUntil = l.date;
      if (++usedInPkg === packages[pkg].lessons) {
        pkg++;
        usedInPkg = 0;
      }
    }
  }

  return {
    lessons,
    credits,
    used,
    remaining: credits - used,
    coveredUntil,
    ...(opening ? { openingCredits: opening } : {}),
  };
}

/** Aulas para exibir: todas as passadas e as futuras até 8 semanas ou até a primeira sem pacote. */
export function visibleLessons(ledger: Ledger, today: string): Lesson[] {
  const horizon = addDays(today, 8 * 7);
  let shownUncovered = false;
  return ledger.lessons.filter((l) => {
    if (l.past) return true;
    if (l.date <= horizon) return true;
    if (l.counts && l.packageIndex === null && !shownUncovered) {
      shownUncovered = true;
      return true;
    }
    return l.packageIndex !== null;
  });
}
