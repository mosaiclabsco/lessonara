import { expect, it } from "vitest";
import { readDownload, retryAfterSeconds } from "./client-download";
it("accepts CSV/XLSX/PDF attachments and preserves their filename", async () => {
  for (const [kind, type] of [
    ["csv", "text/csv; charset=utf-8"],
    ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["pdf", "application/pdf"],
  ] as const) {
    const result = await readDownload(
      new Response("fixture", {
        headers: {
          "Content-Type": type,
          "Content-Disposition": `attachment; filename="report.${kind}"`,
        },
      }),
      kind,
      `fallback.${kind}`,
    );
    expect(result.filename).toBe(`report.${kind}`);
    expect(result.blob.size).toBe(7);
  }
});
it("returns the actual wait on throttling and never saves a login page as a spreadsheet", async () => {
  await expect(
    readDownload(
      new Response("Aguarde", { status: 429, headers: { "Retry-After": "37" } }),
      "csv",
      "file.csv",
    ),
  ).rejects.toMatchObject({ retryAfter: 37 });
  await expect(
    readDownload(
      new Response("<html>login</html>", { headers: { "Content-Type": "text/html" } }),
      "xlsx",
      "file.xlsx",
    ),
  ).rejects.toThrow(/expirado/);
});
it("supports Retry-After dates and bounds malformed or excessive waits", () => {
  const now = Date.parse("2026-10-28T12:00:00Z");
  expect(retryAfterSeconds("Wed, 28 Oct 2026 12:00:21 GMT", now)).toBe(21);
  expect(retryAfterSeconds("unknown", now)).toBe(10);
  expect(retryAfterSeconds("999999")).toBe(3600);
  expect(retryAfterSeconds("0")).toBe(1);
});
