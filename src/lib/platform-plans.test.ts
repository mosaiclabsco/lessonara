import { expect, it } from "vitest";
import { platformPlan, hasPlatformFeature, resolvePlatformPlan } from "./platform-plans";
import { validateDocumentFile, formatFileSize } from "./document-rules";
it("emails permitem Plus e Pro, sala permanece exclusiva do Pro", () => {
  for (const plan of ["essential", "plus", "unknown", null]) {
    expect(hasPlatformFeature(plan, "emails")).toBe(plan === "plus");
    expect(hasPlatformFeature(plan, "classroom")).toBe(false);
  }
  expect(hasPlatformFeature("pro", "emails")).toBe(true);
  expect(hasPlatformFeature("pro", "classroom")).toBe(true);
});
it("cada empresa tem seu limite de arquivo e cota, sem inferir do pacote do aluno", () => {
  expect(platformPlan("essential").storageBytes).toBe(1024 ** 3);
  expect(platformPlan("plus").storageBytes).toBe(5 * 1024 ** 3);
  expect(platformPlan("pro").storageBytes).toBe(10 * 1024 ** 3);
  for (const tier of ["essential", "plus", "pro"]) {
    const limit = platformPlan(tier).maxFileBytes;
    expect(() => validateDocumentFile("a.pdf", limit, limit)).not.toThrow();
    expect(() => validateDocumentFile("a.pdf", limit + 1, limit)).toThrow();
  }
});
it("migra identificadores antigos e formata GB", () => {
  expect(resolvePlatformPlan("professional")).toBe("plus");
  expect(resolvePlatformPlan("studio")).toBe("pro");
  expect(formatFileSize(1024 ** 3)).toBe("1 GB");
});

it("limits imports to Plus and Pro", () => {
  expect(hasPlatformFeature("essential", "imports")).toBe(false);
  expect(hasPlatformFeature("plus", "imports")).toBe(true);
  expect(hasPlatformFeature("pro", "imports")).toBe(true);
});

it("separa integração, relatórios e lembretes Pro, negando planos desconhecidos", () => {
  for (const plan of ["essential", "plus", "pro", "unknown"]) {
    expect(hasPlatformFeature(plan, "google")).toBe(plan === "plus" || plan === "pro");
    expect(hasPlatformFeature(plan, "exports")).toBe(plan === "plus" || plan === "pro");
    expect(hasPlatformFeature(plan, "lessonReminders")).toBe(plan === "pro");
  }
  expect(platformPlan("essential").maxFileBytes).toBe(20 * 1024 ** 2);
  expect(platformPlan("plus").maxFileBytes).toBe(50 * 1024 ** 2);
  expect(platformPlan("pro").maxFileBytes).toBe(50 * 1024 ** 2);
});
