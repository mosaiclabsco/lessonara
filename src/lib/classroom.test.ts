import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  classroomHref,
  classroomRefValid,
  lessonAccess,
  lessonWindow,
  nextJoinableLesson,
  type ClassroomRef,
} from "./classroom";
import { authorizeClassroom, classroomRoom, type ClassroomParticipant } from "./classroom-token";
import { computeLedger, type Lesson } from "./ledger";

const ref: ClassroomRef = {
  studentId: "11111111-1111-4111-8111-111111111111",
  sourceKind: "schedule",
  sourceId: "22222222-2222-4222-8222-222222222222",
  date: "2026-10-12",
};
const lesson: Lesson = {
  sourceKind: ref.sourceKind,
  sourceId: ref.sourceId,
  date: ref.date,
  time: "11:00",
  durationMinutes: 60,
  status: "agendada",
  counts: true,
  past: false,
  packageIndex: null,
  packageId: null,
  event: null,
};
const config = {
  url: "https://meet.example.test",
  appId: "lessonara-test",
  appSecret: "test-key-".repeat(8),
};
const teacher = { id: "teacher", name: "Professora", role: "teacher" as const };
const student = { id: ref.studentId, name: "Aluno", role: "student" as const };
const now = Date.parse("2026-10-12T11:15:00-03:00");
const join = (participant: ClassroomParticipant = teacher) =>
  authorizeClassroom({ participant, lesson, ref, config, now });

describe("autorização da sala", () => {
  it("assina a sala exata, com professor owner e aluno member", () => {
    for (const participant of [teacher, student]) {
      const result = join(participant);
      expect(result.status).toBe(200);
      const body = result.body as { jwt: string; roomName: string };
      const [header, payload, signature] = body.jwt.split(".");
      expect(signature).toBe(
        createHmac("sha256", config.appSecret).update(`${header}.${payload}`).digest("base64url"),
      );
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
      expect(claims.room).toBe(body.roomName);
      expect(claims.context.user.affiliation).toBe(
        participant.role === "teacher" ? "owner" : "member",
      );
      expect(claims.context.user.moderator).toBe(participant.role === "teacher");
      expect(claims.exp * 1000).toBe(Date.parse("2026-10-12T12:30:00-03:00"));
      expect(claims.context.user.email).toBeUndefined();
    }
  });
  it("professor e aluno usam a mesma sala; outra data, origem ou aluno muda a sala", () => {
    expect((join(teacher).body as { roomName: string }).roomName).toBe(
      (join(student).body as { roomName: string }).roomName,
    );
    const room = classroomRoom(ref, config.appSecret);
    expect(classroomRoom(ref, config.appSecret)).toBe(room);
    expect(classroomRoom({ ...ref, date: "2026-10-19" }, config.appSecret)).not.toBe(room);
    expect(classroomRoom({ ...ref, sourceKind: "appointment" }, config.appSecret)).not.toBe(room);
    expect(
      classroomRoom(
        { ...ref, studentId: "33333333-3333-4333-8333-333333333333" },
        config.appSecret,
      ),
    ).not.toBe(room);
  });
  it("aplica duração da aula, fuso e limites exatos da janela", () => {
    const shorter = { ...lesson, durationMinutes: 30 };
    const window = lessonWindow(shorter);
    expect(window.opensAt).toBe(Date.parse("2026-10-12T10:55:00-03:00"));
    expect(window.closesAt).toBe(Date.parse("2026-10-12T12:00:00-03:00"));
    for (const [offset, status] of [
      [-1, 423],
      [0, 200],
    ] as const)
      expect(
        authorizeClassroom({
          participant: teacher,
          lesson: shorter,
          ref,
          config,
          now: window.opensAt + offset,
        }).status,
      ).toBe(status);
    expect(
      authorizeClassroom({
        participant: teacher,
        lesson: shorter,
        ref,
        config,
        now: window.closesAt,
      }).status,
    ).toBe(423);
  });
  it.each(["teacher", "student"] as const)(
    "aplica os mesmos limites no servidor para %s",
    (role) => {
      const participant = { id: role, name: "Teste", role };
      const cases = [
        ["2026-10-12T10:54:59.999-03:00", "before", 423],
        ["2026-10-12T10:55:00.000-03:00", "open", 200],
        ["2026-10-12T12:29:59.999-03:00", "open", 200],
        ["2026-10-12T12:30:00.000-03:00", "closed", 423],
      ] as const;
      for (const [instant, state, status] of cases) {
        const now = Date.parse(instant);
        expect(lessonAccess(lesson, now).state).toBe(state);
        expect(authorizeClassroom({ participant, lesson, ref, config, now }).status).toBe(status);
      }
    },
  );
  it("mantém o próximo card antes da abertura e durante a tolerância; depois mostra o seguinte", () => {
    const next = { ...lesson, date: "2026-10-19" };
    for (const instant of ["2026-10-12T09:00:00-03:00", "2026-10-12T12:29:59.999-03:00"])
      expect(nextJoinableLesson([lesson, next], Date.parse(instant))).toBe(lesson);
    expect(nextJoinableLesson([lesson, next], Date.parse("2026-10-12T12:30:00-03:00"))).toBe(next);
  });
  it("calcula a abertura no dia anterior para uma aula à meia-noite", () => {
    expect(new Date(lessonAccess({ ...lesson, time: "00:00" }, 0).opensAt).toISOString()).toBe(
      "2026-10-12T02:55:00.000Z",
    );
  });
  it.each(["desmarcada", "feriado", "falta"] as const)("não libera aula %s", (status) => {
    expect(
      authorizeClassroom({ participant: teacher, lesson: { ...lesson, status }, ref, config, now })
        .status,
    ).toBe(404);
    expect(classroomHref(ref.studentId, { ...lesson, status })).toBeNull();
  });
  it("não permite falsificar a ocorrência ou a origem", () => {
    expect(
      authorizeClassroom({
        participant: teacher,
        lesson,
        ref: { ...ref, date: "2026-10-19" },
        config,
        now,
      }).status,
    ).toBe(404);
    expect(classroomRefValid({ ...ref, date: "2026-02-30" })).toBe(false);
    expect(classroomRefValid({ ...ref, sourceId: "../../another" })).toBe(false);
  });
  it("mantém a aula atual no resumo até fechar, sem alterar sua identidade", () => {
    const next = { ...lesson, date: "2026-10-19" };
    expect(nextJoinableLesson([lesson, next], now)).toBe(lesson);
    expect(nextJoinableLesson([lesson, next], lessonWindow(lesson).closesAt)).toBe(next);
  });
  it("prioriza a aula em andamento quando a anterior ainda está na tolerância de saída", () => {
    const consecutive = {
      ...lesson,
      time: "12:00",
      sourceId: "33333333-3333-4333-8333-333333333333",
    };
    expect(nextJoinableLesson([lesson, consecutive], Date.parse("2026-10-12T12:10:00-03:00"))).toBe(
      consecutive,
    );
  });
  it("preserva origem de recorrência, avulsa e reposição no saldo", () => {
    const ledger = computeLedger({
      schedules: [
        { id: ref.sourceId, weekday: 1, time: "11:00", starts_on: ref.date, ends_on: ref.date },
      ],
      appointments: [{ id: "appointment", date: "2026-10-13", time: "12:00" }],
      events: [{ id: "makeup", kind: "reposicao", date: "2026-10-14", time: "13:00", note: null }],
      packages: [],
      today: ref.date,
      time: "10:00",
    });
    expect(ledger.lessons.map((l) => [l.sourceKind, l.sourceId])).toEqual([
      ["schedule", ref.sourceId],
      ["appointment", "appointment"],
      ["makeup", "makeup"],
    ]);
  });
});
