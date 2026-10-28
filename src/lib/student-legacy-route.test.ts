import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ resolve: vi.fn(), db: {} }));
vi.mock("./supabase/server", () => ({ createAdminClient: () => m.db }));
vi.mock("./student-target", () => ({ resolveStudentTarget: m.resolve }));
import { GET } from "@/app/p/[teacherId]/s/[slug]/route";
const teacherId = "00000000-0000-4000-8000-000000000001",
  slug = "student-link";
beforeEach(() => vi.clearAllMocks());
it("redirects legacy bookmarks at the HTTP level after verifying teacher and slug", async () => {
  m.resolve.mockResolvedValue({ slug });
  const response = await GET(new Request(`https://lessonara.example/p/${teacherId}/s/${slug}`), {
    params: Promise.resolve({ teacherId, slug }),
  });
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe("https://lessonara.example/a/student-link");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(m.resolve).toHaveBeenCalledWith(m.db, slug, teacherId);
});
it("never redirects an invalid or mismatched teacher link to another teacher", async () => {
  m.resolve.mockResolvedValue(null);
  const response = await GET(new Request("https://lessonara.example/p/other/s/student-link"), {
    params: Promise.resolve({ teacherId: "other", slug }),
  });
  expect(response.status).toBe(404);
  expect(response.headers.has("location")).toBe(false);
});
