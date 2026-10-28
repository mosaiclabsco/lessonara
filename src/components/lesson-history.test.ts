import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { Lesson } from "@/lib/ledger";
vi.mock("./browser-preferences-provider", () => ({
  useI18n: () => ({ t: (text: string) => text, locale: "pt-BR" }),
}));
import { LessonHistory } from "./lesson-history";
const lesson = (date: string, time = "19:00"): Lesson => ({
  date,
  time,
  status: "agendada",
  counts: false,
  past: false,
  packageIndex: 0,
  packageId: "pack",
  event: null,
  planName: "Pacote 8 aulas",
  packagePosition: 7,
  packageLessons: 8,
});
it("shows the student months, dates and times newest first without grouping controls", () => {
  const html = renderToStaticMarkup(
    createElement(LessonHistory, {
      studentView: true,
      today: "2026-10-28",
      packages: [],
      lessons: [
        lesson("2026-10-29", "09:00"),
        lesson("2026-11-03"),
        lesson("2026-10-29", "20:00"),
        lesson("2026-10-20"),
      ],
    }),
  );
  expect(html.indexOf("nov/2026")).toBeLessThan(html.indexOf("out/2026"));
  expect(html.indexOf("29/10")).toBeLessThan(html.indexOf("20/10"));
  expect(html.indexOf("20:00")).toBeLessThan(html.indexOf("09:00"));
  expect(html).toContain("Pacote 8 aulas");
  expect(html).not.toContain("Organizar histórico por");
  expect(html).not.toContain("Próximas aulas");
});
it("retains the teacher grouping controls", () => {
  const html = renderToStaticMarkup(
    createElement(LessonHistory, {
      today: "2026-10-28",
      packages: [],
      lessons: [lesson("2026-10-29")],
    }),
  );
  expect(html).toContain("Por mês");
  expect(html).toContain("Por pacote");
  expect(html).toContain("Próximas aulas");
});
