import { expect, it } from "vitest";
import { onboardingState } from "./onboarding";
it("não aceita valores iniciais como confirmação de primeiro acesso", () => {
  expect(onboardingState({ name: "Professor", lesson_minutes: 60 }, 2).ready).toBe(false);
});
it("exige perfil salvo e pelo menos um plano ativo", () => {
  const teacher = { name: "Professor", lesson_minutes: 45, profile_completed_at: "2026-10-09" };
  expect(onboardingState(teacher, 0).ready).toBe(false);
  expect(onboardingState(teacher, 1).ready).toBe(true);
  expect(onboardingState({ ...teacher, name: " " }, 1).ready).toBe(false);
});
it("não considera um identificador desconhecido um plano da plataforma", () => {
  expect(onboardingState({ platform_plan: "admin" }, 0).platformPlan).toBe("essential");
});
