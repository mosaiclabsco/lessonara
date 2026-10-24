import { createHmac } from "node:crypto";
import { classroomRefValid, lessonCanJoin, lessonAccess, type ClassroomRef } from "./classroom";
import type { Lesson } from "./ledger";

export type ClassroomParticipant = { id: string; name: string; role: "teacher" | "student" };
export type JitsiConfig = { url: string; appId: string; appSecret: string };

export function classroomRoom(ref: ClassroomRef, secret: string) {
  if (!classroomRefValid(ref) || secret.length < 32)
    throw new Error("Invalid classroom configuration");
  // Cada ocorrência tem uma sala estável, opaca e distinta, sem criar outra tabela de agenda.
  const key = JSON.stringify([
    "lessonara-v1",
    ref.studentId,
    ref.sourceKind,
    ref.sourceId,
    ref.date,
  ]);
  return "lessonara-" + createHmac("sha256", secret).update(key).digest("hex");
}

export function authorizeClassroom({
  participant,
  lesson,
  ref,
  config,
  now = Date.now(),
  hasJoined = false,
}: {
  participant: ClassroomParticipant;
  lesson: Lesson;
  ref: ClassroomRef;
  config: JitsiConfig;
  now?: number;
  hasJoined?: boolean;
}) {
  if (
    !classroomRefValid(ref) ||
    ref.date !== lesson.date ||
    ref.sourceKind !== lesson.sourceKind ||
    ref.sourceId !== lesson.sourceId ||
    !lessonCanJoin(lesson)
  ) {
    return { status: 404, body: { error: "Aula não disponível." } };
  }
  const window = lessonAccess(lesson, now);
  if (window.state !== "open" || (now >= window.endsAt && !hasJoined)) {
    return {
      status: 423,
      body: {
        error:
          now >= window.endsAt && !hasJoined
            ? "A primeira entrada nesta aula já encerrou. O retorno está disponível apenas para quem já participou."
            : "A sala está fora do horário de acesso.",
        opensAt: new Date(window.opensAt).toISOString(),
        closesAt: new Date(hasJoined ? window.closesAt : window.endsAt).toISOString(),
      },
    };
  }
  const roomName = classroomRoom(ref, config.appSecret);
  const iat = Math.floor(now / 1000);
  // Válido apenas para esta aula e até o fechamento da sala. Evita exigir novo token
  // numa reconexão depois de 15 minutos, durante uma aula de uma hora ou mais.
  const exp = Math.floor(window.closesAt / 1000);
  const teacher = participant.role === "teacher";
  const payload = {
    aud: "jitsi",
    iss: config.appId,
    sub: "*",
    room: roomName,
    iat,
    nbf: iat - 10,
    exp,
    context: {
      user: {
        id: participant.id,
        name: participant.name,
        moderator: teacher,
        affiliation: teacher ? "owner" : "member",
      },
      features: {
        "screen-sharing": true,
        recording: false,
        livestreaming: false,
        transcription: false,
      },
    },
  };
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}`;
  const jwt =
    unsigned + "." + createHmac("sha256", config.appSecret).update(unsigned).digest("base64url");
  return {
    status: 200,
    body: {
      jitsiUrl: config.url,
      roomName,
      jwt,
      expiresAt: new Date(exp * 1000).toISOString(),
      displayName: participant.name,
      role: participant.role,
      lesson: {
        title: "Sala de aula · Lessonara",
        startsAt: new Date(window.startsAt).toISOString(),
        durationMinutes: lesson.durationMinutes ?? 60,
      },
    },
  };
}
