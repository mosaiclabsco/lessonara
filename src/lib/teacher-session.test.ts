import { expect, it, vi } from "vitest";
import { teacherSessionValid } from "./teacher-session";
const now = Date.parse("2026-10-19T12:00:00Z");
it("expires exactly at the signed absolute deadline without extending it", async () => {
  const rpc = vi.fn();
  const claims = { sub: "teacher", session_id: "session", session_expires_at: now / 1000 };
  expect(await teacherSessionValid({ rpc }, claims, now - 1)).toBe(true);
  expect(await teacherSessionValid({ rpc }, claims, now)).toBe(false);
  expect(await teacherSessionValid({ rpc }, { ...claims, session_expires_at: "future" }, now)).toBe(
    false,
  );
  expect(rpc).not.toHaveBeenCalled();
});
it("uses the database policy for old claims and fails closed", async () => {
  const claims = { sub: "teacher", session_id: "session" };
  for (const [data, error, expected] of [
    [true, null, true],
    [false, null, false],
    [true, {}, false],
    [null, null, false],
  ] as const) {
    const rpc = vi.fn().mockResolvedValue({ data, error });
    expect(await teacherSessionValid({ rpc }, claims, now)).toBe(expected);
    expect(rpc).toHaveBeenCalledWith("teacher_session_valid");
  }
  expect(
    await teacherSessionValid({ rpc: vi.fn().mockRejectedValue(new Error()) }, claims, now),
  ).toBe(false);
  expect(await teacherSessionValid({ rpc: vi.fn() }, undefined, now)).toBe(false);
  expect(await teacherSessionValid({ rpc: vi.fn() }, { sub: "teacher" }, now)).toBe(false);
});

it("checks support revocation in the database even for signed claims", async () => {
  const claims = {
    sub: "teacher",
    session_id: "session",
    session_expires_at: now / 1000 + 900,
    support_actor: "operator@example.test",
  };
  expect(
    await teacherSessionValid(
      { rpc: vi.fn().mockResolvedValue({ data: false, error: null }) },
      claims,
      now,
    ),
  ).toBe(false);
  expect(
    await teacherSessionValid({ rpc: vi.fn().mockRejectedValue(new Error()) }, claims, now),
  ).toBe(false);
  expect(
    await teacherSessionValid(
      { rpc: vi.fn().mockResolvedValue({ data: true, error: null }) },
      claims,
      now,
    ),
  ).toBe(true);
});
