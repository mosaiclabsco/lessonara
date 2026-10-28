import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { studentPortalPath, studentInvitePath } from "./student-links";
import { resolveStudentTarget } from "./student-target";
it("uses permanent short portal routes and a separate single-use invitation address", () => {
  expect(studentPortalPath("Cnusx5cz-7qZ")).toBe("/a/Cnusx5cz-7qZ");
  expect(studentInvitePath("a".repeat(43))).toBe(`/i/${"a".repeat(43)}`);
  expect(studentPortalPath("x/y?z")).toBe("/a/x%2Fy%3Fz");
});
it("resolves only active students and verifies the teacher on legacy links", async () => {
  const filters: unknown[] = [];
  const student = { id: "student", teacher_id: "teacher", slug: "student-link" };
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn((...args: unknown[]) => {
      filters.push(args);
      return chain;
    }),
    maybeSingle: vi.fn().mockResolvedValue({ data: student, error: null }),
  };
  const db = { from: vi.fn(() => chain) } as unknown as SupabaseClient;
  expect(await resolveStudentTarget(db, "student-link")).toEqual(student);
  expect(filters).toContainEqual(["active", true]);
  expect(filters).not.toContainEqual(["teacher_id", expect.anything()]);
  const teacher = "00000000-0000-4000-8000-000000000001";
  await resolveStudentTarget(db, "student-link", teacher);
  expect(filters).toContainEqual(["teacher_id", teacher]);
  chain.maybeSingle.mockResolvedValue({ data: null, error: null });
  expect(await resolveStudentTarget(db, "student-link", teacher)).toBeNull();
});
it("rejects malformed identifiers before queries and fails closed on database errors", async () => {
  const from = vi.fn();
  const db = { from } as unknown as SupabaseClient;
  expect(await resolveStudentTarget(db, "x")).toBeNull();
  expect(await resolveStudentTarget(db, "valid-link", "bad-teacher")).toBeNull();
  expect(from).not.toHaveBeenCalled();
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: null, error: { code: "unavailable" } }),
  };
  from.mockReturnValue(chain);
  await expect(resolveStudentTarget(db, "valid-link")).rejects.toThrow(/preparar/);
});
