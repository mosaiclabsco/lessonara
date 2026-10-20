import { beforeEach, expect, it, vi } from "vitest";
const { jar } = vi.hoisted(() => ({ jar: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: jar }));
import { getBrowserPreferences } from "./server";
beforeEach(() => jar.mockResolvedValue({ get: () => undefined }));
it("usa português e claro sem uma escolha explícita", async () => {
  expect(await getBrowserPreferences()).toEqual({ locale: "pt-BR", theme: "light" });
});
it("ignora preferências inválidas e continua claro", async () => {
  jar.mockResolvedValue({ get: () => ({ value: "invalid" }) });
  expect(await getBrowserPreferences()).toEqual({ locale: "pt-BR", theme: "light" });
});
it.each(["dark", "system"])("respeita escolha explícita %s", async (theme) => {
  jar.mockResolvedValue({
    get: (key: string) => ({ value: key === "lessonara_theme" ? theme : "en" }),
  });
  expect(await getBrowserPreferences()).toEqual({ locale: "en", theme });
});
