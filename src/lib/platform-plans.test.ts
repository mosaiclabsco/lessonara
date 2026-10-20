import { expect, it } from "vitest";
import { platformPlan, hasPlatformFeature, resolvePlatformPlan } from "./platform-plans";
import { validateDocumentFile, formatFileSize } from "./document-rules";
it("emails e sala de aula são exclusivos do Pro", () => {
  for (const plan of ["essential", "plus", "unknown", null]) {
    expect(hasPlatformFeature(plan, "emails")).toBe(false);
    expect(hasPlatformFeature(plan, "classroom")).toBe(false);
  }
  expect(hasPlatformFeature("pro", "emails")).toBe(true);
  expect(hasPlatformFeature("pro", "classroom")).toBe(true);
});
it("cada empresa tem seu limite de arquivo e cota, sem inferir do pacote do aluno", () => {
  expect(platformPlan("essential").storageBytes).toBe(1024 ** 3);
  expect(platformPlan("plus").storageBytes).toBe(5 * 1024 ** 3);
  expect(platformPlan("pro").storageBytes).toBe(20 * 1024 ** 3);
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
