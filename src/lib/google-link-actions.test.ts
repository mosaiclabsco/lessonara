import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireFeature: vi.fn(),
  requireUser: vi.fn(),
  admin: vi.fn(),
  list: vi.fn(),
  read: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/platform-plan-server", () => ({ requirePlatformFeature: mocks.requireFeature }));
vi.mock("@/lib/supabase/server", () => ({
  requireUser: mocks.requireUser,
  createAdminClient: mocks.admin,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/google/lesson-links", () => ({
  listGoogleLessonChoices: mocks.list,
  readGoogleLessonPreview: mocks.read,
  validGoogleEventId: (id: string) => id === "google1",
}));
import {
  listGoogleLessons,
  linkGoogleLesson,
  previewGoogleLesson,
  unlinkGoogleLesson,
} from "@/app/(panel)/students/google-link-actions";
function chain(data: unknown, error: unknown = null) {
  const result = { data, error };
  const q = {
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => result),
  };
  q.select.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  return q;
}
beforeEach(() => {
  vi.resetAllMocks();
});
it("denies unsupported plan before reading Google or using service credentials", async () => {
  mocks.requireFeature.mockRejectedValue(
    new Error("Este recurso está disponível nos planos Plus e Pro."),
  );
  expect((await listGoogleLessons("student", "2030-01-01")).ok).toBe(false);
  expect((await previewGoogleLesson("student", "google1", "2030-01-01")).ok).toBe(false);
  expect((await linkGoogleLesson("student", "google1", "2030-01-01")).ok).toBe(false);
  expect(mocks.list).not.toHaveBeenCalled();
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.admin).not.toHaveBeenCalled();
});
it("denies cross-tenant targets and scopes student lookup", async () => {
  const q = chain(null);
  mocks.requireFeature.mockResolvedValue({ userId: "teacher", supabase: { from: () => q } });
  expect((await linkGoogleLesson("otherStudent", "google1", "2030-01-01")).ok).toBe(false);
  expect(q.eq).toHaveBeenCalledWith("teacher_id", "teacher");
  expect(mocks.read).not.toHaveBeenCalled();
});
it("confirmation re-reads the provider and submits only authoritative times to the atomic RPC", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2030-01-01T12:00:00Z"));
  try {
    mocks.requireFeature.mockResolvedValue({
      userId: "teacher",
      supabase: { from: () => chain({ id: "student" }) },
    });
    const preview = {
      title: "From Google",
      recurring: true,
      until: "2030-06-30",
      instances: [{ id: "instance", date: "2030-01-02", time: "10:00", duration: 60, meet: null }],
    };
    mocks.read.mockResolvedValue(preview);
    const rpc = vi.fn().mockResolvedValue({ data: "link", error: null });
    mocks.admin.mockReturnValue({ rpc });
    expect((await linkGoogleLesson("student", "google1", "2030-01-01")).ok).toBe(true);
    expect(mocks.read).toHaveBeenCalledWith("teacher", "google1", "2030-01-01");
    expect(rpc).toHaveBeenCalledWith(
      "apply_google_lesson_link",
      expect.objectContaining({
        p_teacher: "teacher",
        p_student: "student",
        p_title: "From Google",
        p_instances: preview.instances,
      }),
    );
  } finally {
    vi.useRealTimers();
  }
});
it("unlink retains tenant checks even after downgrade", async () => {
  const q = chain(null);
  mocks.requireUser.mockResolvedValue({ userId: "teacher", supabase: { from: () => q } });
  expect((await unlinkGoogleLesson("student", "otherLink")).ok).toBe(false);
  expect(mocks.admin).not.toHaveBeenCalled();
  expect(q.eq).toHaveBeenCalledWith("teacher_id", "teacher");
});
