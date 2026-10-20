import { expect, it } from "vitest";
import {
  downloadLifetime,
  MAX_DOCUMENT_BYTES,
  shareAvailable,
  validDocumentText,
  validExpiry,
  validateDocumentFile,
} from "./document-rules";

it("valida tamanho e extensão sem aceitar caminhos ou formatos executáveis", () => {
  expect(validateDocumentFile("Exercício.PDF", 1_300_000)).toEqual({
    extension: "pdf",
    mimeType: "application/pdf",
  });
  expect(validateDocumentFile("aula.docx", MAX_DOCUMENT_BYTES).mimeType).toContain(
    "wordprocessingml",
  );
  for (const [name, size] of [
    ["../arquivo.pdf", 1],
    ["aula.html", 10],
    ["arquivo.pdf", 0],
    ["arquivo.pdf", MAX_DOCUMENT_BYTES + 1],
    ["arquivo.pdf", 1.5],
  ] as const)
    expect(() => validateDocumentFile(name, size)).toThrow();
});

it("preserva títulos Unicode e controla os tamanhos dos metadados", () => {
  expect(validDocumentText("  Revisão de inglês  ", "  Gramática  ")).toEqual({
    title: "Revisão de inglês",
    subject: "Gramática",
  });
  expect(() => validDocumentText("", "")).toThrow();
  expect(() => validDocumentText("x".repeat(121), "")).toThrow();
});

it("permite validade individual, inclusive o dia inteiro e ausência de prazo", () => {
  expect(validExpiry("", "2026-10-07")).toBeNull();
  expect(validExpiry("2026-10-07", "2026-10-07")).toBe("2026-10-07");
  expect(() => validExpiry("2026-10-06", "2026-10-07")).toThrow();
  expect(() => validExpiry("2026-02-30", "2026-01-01")).toThrow();
  expect(shareAvailable("2026-10-07", "2026-10-07")).toBe(true);
  expect(shareAvailable("2026-10-07", "2026-10-08")).toBe(false);
  expect(shareAvailable(null, "2030-10-07")).toBe(true);
});

it("limita o link de download a um minuto e ao final da validade", () => {
  expect(downloadLifetime(null, "2026-10-07", "23:59", 59)).toBe(60);
  expect(downloadLifetime("2026-10-07", "2026-10-07", "12:00", 0)).toBe(60);
  expect(downloadLifetime("2026-10-07", "2026-10-07", "23:59", 55)).toBe(5);
  expect(downloadLifetime("2026-10-06", "2026-10-07", "12:00", 0)).toBe(0);
});
