import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ admin: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: mock.admin }));
vi.mock("./lesson-links", () => ({ readGoogleLessonPreview: mock.read }));
import { processGoogleLessonLinks } from "./lesson-link-worker";
const link = {
  id: "link",
  teacher_id: "teacher",
  student_id: "student",
  event_id: "google1",
  title: "English",
  recurring: true,
  starts_on: "2030-01-01",
  active: true,
};
beforeEach(() => {
  vi.resetAllMocks();
});
function fixture() {
  const rpc = vi
    .fn()
    .mockResolvedValueOnce({ data: [link], error: null })
    .mockResolvedValue({ error: null });
  const q = {
    update: vi.fn(),
    eq: vi.fn(),
    then: (resolve: (value: { error: null }) => unknown) =>
      Promise.resolve({ error: null }).then(resolve),
  };
  q.update.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  mock.admin.mockReturnValue({ rpc, from: () => q });
  return { rpc, q };
}
it("a read failure preserves local lessons and records a recoverable error", async () => {
  const { rpc, q } = fixture();
  mock.read.mockRejectedValue(new Error("503"));
  expect(await processGoogleLessonLinks()).toEqual({ linked: 0, linkFailed: 1 });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(q.update).toHaveBeenCalledWith({ last_error: expect.any(String) });
  expect(q.eq).toHaveBeenCalledWith("teacher_id", "teacher");
});
it("refresh passes the source tenant and immutable cutoff to the atomic RPC", async () => {
  const { rpc } = fixture();
  const preview = {
    title: "Updated in Google",
    recurring: true,
    until: "2030-06-30",
    instances: [],
  };
  mock.read.mockResolvedValue(preview);
  expect(await processGoogleLessonLinks()).toEqual({ linked: 1, linkFailed: 0 });
  expect(mock.read).toHaveBeenCalledWith("teacher", "google1", "2030-01-01", true);
  expect(rpc).toHaveBeenCalledWith(
    "apply_google_lesson_link",
    expect.objectContaining({
      p_teacher: "teacher",
      p_student: "student",
      p_link: "link",
      p_starts: "2030-01-01",
      p_instances: [],
    }),
  );
});
it("a conflict in a refreshed series becomes a visible failure", async () => {
  const { rpc } = fixture();
  rpc.mockResolvedValueOnce({ error: { message: "conflict" } });
  mock.read.mockResolvedValue({
    title: "English",
    recurring: true,
    until: "2030-06-30",
    instances: [],
  });
  expect((await processGoogleLessonLinks()).linkFailed).toBe(1);
});
