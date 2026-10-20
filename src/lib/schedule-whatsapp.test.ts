import { expect, it } from "vitest";
import {
  canAddWeeklySchedule,
  canConfigureNewSchedule,
  weeklyScheduleLimit,
} from "./schedule-rules";
import { DEFAULT_WHATSAPP_MESSAGE, paymentWhatsAppUrl } from "./whatsapp";

const friday = { weekday: 5, time: "20:00", starts_on: "2026-06-19", ends_on: null };

it("usa frequência explícita e não tamanho de pacote", () => {
  expect(weeklyScheduleLimit(4)).toBe(4);
  expect(weeklyScheduleLimit(undefined, 2)).toBe(2);
  expect(canAddWeeklySchedule([friday], 1, "2026-10-07", 1)).toBe(false);
  expect(canAddWeeklySchedule([friday], 2, "2026-10-07", 1)).toBe(true);
  expect(canAddWeeklySchedule([friday, { ...friday, weekday: 2 }], 2, "2026-10-07", 1)).toBe(false);
});

it("libera troca de horário após a última aula efetiva do antigo", () => {
  expect(canAddWeeklySchedule([{ ...friday, ends_on: "2026-10-09" }], 1, "2026-10-07", 1)).toBe(
    true,
  );
  expect(canAddWeeklySchedule([{ ...friday, ends_on: "2026-10-16" }], 1, "2026-10-07", 1)).toBe(
    false,
  );
});

it("conta horários futuros que vão sobrepor o novo", () => {
  expect(canAddWeeklySchedule([{ ...friday, starts_on: "2026-11-01" }], 1, "2026-10-07", 1)).toBe(
    false,
  );
});

it("monta a mensagem exata e abre conversa pelo telefone com DDD", () => {
  const url = new URL(paymentWhatsAppUrl("(11) 99999-9999")!);
  expect(url.pathname).toBe("/5511999999999");
  expect(url.searchParams.get("text")).toBe(DEFAULT_WHATSAPP_MESSAGE);
  expect(new URL(paymentWhatsAppUrl("")!).pathname).toBe("/");
  expect(paymentWhatsAppUrl("123")).toBeNull();
  expect(new URL(paymentWhatsAppUrl("+1 202 555 0100")!).pathname).toBe("/12025550100");
});

it("frequência do aluno prevalece sobre plano, sem inferência de pagamento", () => {
  expect(weeklyScheduleLimit(3, 2)).toBe(3);
  expect(weeklyScheduleLimit(null, 2)).toBe(2);
  expect(weeklyScheduleLimit(8, 2)).toBe(0);
  expect(weeklyScheduleLimit()).toBe(0);
});

it("permite mensagem personalizada sem Pix hardcoded", () => {
  expect(DEFAULT_WHATSAPP_MESSAGE).not.toContain("CPF");
  expect(DEFAULT_WHATSAPP_MESSAGE).not.toContain("amore");
  expect(
    new URL(paymentWhatsAppUrl("+5511999999999", "BR", "Olá, vamos renovar?")!).searchParams.get(
      "text",
    ),
  ).toBe("Olá, vamos renovar?");
});

it("libera o formulário após encerrar no domingo horários que começariam segunda e quarta", () => {
  const ended = [
    { ...friday, weekday: 1, starts_on: "2026-10-11", ends_on: "2026-10-11" },
    { ...friday, weekday: 3, starts_on: "2026-10-11", ends_on: "2026-10-11" },
  ];
  expect(canConfigureNewSchedule(ended, 2)).toBe(true);
  expect(canAddWeeklySchedule(ended, 2, "2026-10-11", 1)).toBe(true);
  expect(
    canConfigureNewSchedule(
      ended.map((schedule) => ({ ...schedule, ends_on: null })),
      2,
    ),
  ).toBe(false);
});
it("permite preparar sucessor de horário com fim futuro sem liberar sobreposição", () => {
  const ending = [{ ...friday, ends_on: "2026-10-16" }];
  expect(canConfigureNewSchedule(ending, 1)).toBe(true);
  expect(canAddWeeklySchedule(ending, 1, "2026-10-11", 1)).toBe(false);
  expect(canAddWeeklySchedule(ending, 1, "2026-10-17", 1)).toBe(true);
  expect(canConfigureNewSchedule(ending, 0)).toBe(false);
});
it("libera substituição de horário mensal encerrado e mantém o limite dos abertos", () => {
  const monthly = { ...friday, monthly_day: 15, starts_on: "2026-10-11", ends_on: "2026-10-11" };
  expect(canConfigureNewSchedule([monthly], 1)).toBe(true);
  expect(canConfigureNewSchedule([{ ...monthly, ends_on: null }], 1)).toBe(false);
});
