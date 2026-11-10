import { googleRequest, safeMeetUrl } from "./calendar";
import { addDays, nowInTZ } from "../dates";
export type GoogleEvent = {
  id: string;
  summary?: string;
  status?: string;
  recurringEventId?: string;
  recurrence?: string[];
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  hangoutLink?: string;
};
export type GoogleLessonChoice = {
  id: string;
  title: string;
  recurring: boolean;
  date: string;
  time: string;
};
export type GoogleLessonInstance = {
  id: string;
  date: string;
  time: string;
  duration: number;
  meet: string | null;
};
export type GoogleLessonLink = {
  id: string;
  teacher_id: string;
  student_id: string;
  event_id: string;
  title: string;
  recurring: boolean;
  starts_on: string;
  active: boolean;
  last_error: string | null;
};
const failure = "Não foi possível consultar os eventos Google. Tente novamente.";
export function validGoogleEventId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-zA-Z0-9_-]{1,1024}$/.test(value) &&
    !value.startsWith("lessonara")
  );
}
export function googleLessonInstance(
  event: GoogleEvent,
  now = Date.now(),
): GoogleLessonInstance | null {
  if (event.status === "cancelled") return null;
  const start = Date.parse(event.start?.dateTime ?? ""),
    end = Date.parse(event.end?.dateTime ?? "");
  if (!Number.isFinite(start) || start <= now) return null;
  const duration = (end - start) / 60000;
  if (!Number.isInteger(duration) || duration < 15 || duration > 180 || duration % 15)
    throw new Error(
      "A aula Google precisa durar entre 15 e 180 minutos, em intervalos de 15 minutos.",
    );
  const local = nowInTZ(new Date(start));
  // Local lesson records have minute precision; never silently round external events.
  if (new Date(start).getUTCSeconds() !== 0)
    throw new Error("O evento Google precisa começar em um minuto exato.");
  return {
    id: event.id,
    date: local.today,
    time: local.time,
    duration,
    meet: safeMeetUrl(event.hangoutLink),
  };
}
async function getEvent(teacherId: string, eventId: string) {
  if (!validGoogleEventId(eventId)) throw new Error("Escolha um evento Google válido.");
  const response = await googleRequest(
    teacherId,
    `calendars/primary/events/${encodeURIComponent(eventId)}`,
  );
  if (!response) throw new Error("Conecte sua conta Google nas configurações.");
  if ([404, 410].includes(response.status)) return null;
  if (!response.ok) throw new Error(failure);
  return (await response.json()) as GoogleEvent;
}
async function readPages(teacherId: string, path: string, params: URLSearchParams) {
  const all: GoogleEvent[] = [];
  for (let page = 0; page < 10; page++) {
    const response = await googleRequest(teacherId, `${path}?${params}`);
    if (!response) throw new Error("Conecte sua conta Google nas configurações.");
    if (!response.ok) throw new Error(failure);
    const data = await response.json();
    all.push(...(data.items ?? []));
    if (!data.nextPageToken) return all;
    params.set("pageToken", data.nextPageToken);
  }
  // Incomplete pages must never be interpreted as cancellations.
  throw new Error("Há muitos eventos neste intervalo. Escolha um período menor.");
}
export async function listGoogleLessonChoices(teacherId: string, from: string) {
  const events = await readPages(
    teacherId,
    "calendars/primary/events",
    new URLSearchParams({
      eventTypes: "default",
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: `${from}T00:00:00-03:00`,
      timeMax: `${addDays(from, 90)}T00:00:00-03:00`,
      maxResults: "250",
      timeZone: "America/Sao_Paulo",
    }),
  );
  const choices = new Map<string, GoogleLessonChoice>();
  for (const event of events) {
    const id = event.recurringEventId || event.id;
    if (
      !validGoogleEventId(id) ||
      !event.start?.dateTime ||
      event.status === "cancelled" ||
      Date.parse(event.start.dateTime) <= Date.now()
    )
      continue;
    const local = nowInTZ(new Date(event.start.dateTime));
    if (!choices.has(id))
      choices.set(id, {
        id,
        title: event.summary?.slice(0, 300) || "Evento sem título",
        recurring: Boolean(event.recurringEventId),
        date: local.today,
        time: local.time,
      });
  }
  return [...choices.values()];
}
export async function readGoogleLessonPreview(
  teacherId: string,
  eventId: string,
  startsOn: string,
  allowMissing = false,
) {
  const event = await getEvent(teacherId, eventId);
  const from = startsOn > nowInTZ().today ? startsOn : nowInTZ().today;
  const until = addDays(from, 180);
  if (!event || event.status === "cancelled") {
    if (!allowMissing) throw new Error("O evento não está mais disponível no Google.");
    return {
      title: "Evento removido do Google",
      recurring: false,
      until,
      instances: [] as GoogleLessonInstance[],
    };
  }
  const recurring = Boolean(event.recurrence?.length);
  const events = recurring
    ? await readPages(
        teacherId,
        `calendars/primary/events/${encodeURIComponent(eventId)}/instances`,
        new URLSearchParams({
          timeMin: `${from}T00:00:00-03:00`,
          timeMax: `${addDays(until, 1)}T00:00:00-03:00`,
          maxResults: "250",
          timeZone: "America/Sao_Paulo",
          showDeleted: "false",
        }),
      )
    : [event];
  const instances = events
    .map((e) => googleLessonInstance(e))
    .filter((e): e is GoogleLessonInstance => Boolean(e && e.date >= from && e.date <= until));
  if (instances.length > 500)
    throw new Error("Há muitos eventos neste intervalo. Escolha um período menor.");
  return {
    title: event.summary?.slice(0, 300) || "Evento sem título",
    recurring,
    until,
    instances,
  };
}
