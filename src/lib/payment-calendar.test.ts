import { expect, it } from "vitest";
import { halfHourTime, lessonTiming } from "./calendar";
import { computeLedger, type Package } from "./ledger";
import { escapeEmailHtml, paymentMessage, paymentStatus } from "./payment-rules";

it("distingue aulas futuras, em andamento e encerradas no limite de 60 minutos", () => {
  const lesson = { date: "2026-10-07", time: "14:30", status: "dada" as const };
  expect(lessonTiming(lesson, lesson.date, "14:29")).toBe("upcoming");
  expect(lessonTiming(lesson, lesson.date, "14:30")).toBe("ongoing");
  expect(lessonTiming(lesson, lesson.date, "15:29")).toBe("ongoing");
  expect(lessonTiming(lesson, lesson.date, "15:30")).toBe("completed");
  expect(lessonTiming({ ...lesson, status: "desmarcada" }, lesson.date, "14:45")).toBe("cancelled");
  expect(lessonTiming({ ...lesson, status: "falta" }, lesson.date, "14:45")).toBe("absent");
});

it("calcula a aula em andamento mesmo quando atravessa a meia-noite", () => {
  expect(
    lessonTiming({ date: "2026-10-07", time: "23:30", status: "reposicao" }, "2026-10-08", "00:10"),
  ).toBe("ongoing");
});

it("aceita somente horas válidas com minutos 00 ou 30 no servidor", () => {
  expect(halfHourTime("00:00")).toBe("00:00");
  expect(halfHourTime("23:30")).toBe("23:30");
  for (const time of [null, "", "24:00", "12:15", "12:45", "12:30:00"])
    expect(() => halfHourTime(time)).toThrow();
});

it("classifica renovações por saldo e preserva o link na mensagem", () => {
  expect(paymentStatus(-1)).toBe("pending");
  expect(paymentStatus(0)).toBe("pending");
  expect(paymentStatus(1)).toBe("soon");
  expect(paymentStatus(2)).toBe("soon");
  expect(paymentStatus(3)).toBe("ok");
  expect(paymentMessage("Ana", 2, "https://example.com/a/link")).toContain(
    "https://example.com/a/link",
  );
  expect(escapeEmailHtml('<img src="x"> &')).toBe("&lt;img src=&quot;x&quot;&gt; &amp;");
});

it("mantém o pacote identificado por UUID e aloca reposição sem cobrar a desmarcada", () => {
  const first: Package = {
    id: "first",
    paid_on: "2026-10-01",
    created_at: "2026-10-01T10:00:00Z",
    lessons: 1,
    amount: 100,
  };
  const second: Package = { ...first, id: "second", created_at: "2026-10-01T11:00:00Z" };
  const ledger = computeLedger({
    schedules: [{ weekday: 1, time: "14:00", starts_on: "2026-10-05", ends_on: "2026-10-12" }],
    packages: [second, first],
    events: [
      { id: "cancelled", date: "2026-10-05", time: "14:00", kind: "desmarcada", note: null },
      { id: "replacement", date: "2026-10-07", time: "14:00", kind: "reposicao", note: null },
    ],
    today: "2026-10-13",
    time: "10:00",
  });
  expect(ledger.lessons[0].packageId).toBeNull();
  expect(ledger.lessons[1].packageId).toBe("first");
  expect(ledger.lessons[2].packageId).toBe("second");
  expect(ledger.remaining).toBe(0);
});

it("usa a duração guardada na aula para determinar o término", () => {
  expect(
    lessonTiming(
      { date: "2026-10-09", time: "14:00", status: "agendada", durationMinutes: 45 },
      "2026-10-09",
      "14:44",
    ),
  ).toBe("ongoing");
  expect(
    lessonTiming(
      { date: "2026-10-09", time: "14:00", status: "agendada", durationMinutes: 45 },
      "2026-10-09",
      "14:45",
    ),
  ).toBe("completed");
});
