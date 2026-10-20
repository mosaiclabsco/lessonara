import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  cookies: vi.fn(),
  verify: vi.fn(),
  signout: vi.fn(),
  start: vi.fn(),
  attempt: vi.fn(),
  redirect: vi.fn(),
  after: vi.fn(),
  set: vi.fn(),
  create: vi.fn(),
  profiles: vi.fn(),
  authOptions: vi.fn(),
  headers: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies, headers: mocks.headers }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: mocks.admin }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => {
    mocks.authOptions(...args);
    return { auth: { verifyOtp: mocks.verify, signOut: mocks.signout } };
  },
}));
vi.mock("@/lib/student-access", () => ({
  CHALLENGE_COOKIE: "challenge",
  STUDENT_COOKIE: "session",
  studentCookieOptions: {},
  startStudentSession: mocks.start,
}));
vi.mock("@/lib/mail/outbox", () => ({ enqueueOtp: vi.fn(), processEmails: vi.fn() }));
import { verifyStudentCode, requestStudentCode } from "@/app/student/login/actions";
const form = () => {
  const f = new FormData();
  f.set("code", "123456");
  return f;
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.cookies.mockResolvedValue({
    get: () => ({ value: "11111111-1111-4111-8111-111111111111" }),
  });
  mocks.profiles.mockReturnValue([{ id: "student-a", name: "Alice", teachers: { name: "Prof" } }]);
  mocks.admin.mockReturnValue({
    rpc: mocks.attempt,
    from() {
      const q = {
        select() {
          return q;
        },
        eq() {
          return q;
        },
        is() {
          return q;
        },
        not() {
          return q;
        },
        gt() {
          return q;
        },
        update() {
          return q;
        },
        order() {
          return q;
        },
        async maybeSingle() {
          return { data: { id: "challenge", auth_user_id: "alice-auth" }, error: null };
        },
        then(resolve: (v: unknown) => unknown) {
          return Promise.resolve({ data: mocks.profiles(), error: null }).then(resolve);
        },
      };
      return q;
    },
  });
  mocks.attempt.mockResolvedValue({
    data: [{ student_id: "student-a", email: "alice@example.com", auth_user_id: "alice-auth" }],
    error: null,
  });
  mocks.verify.mockResolvedValue({
    data: {
      user: { id: "alice-auth", email: "alice@example.com", email_confirmed_at: "2026-10-08" },
    },
    error: null,
  });
  mocks.start.mockResolvedValue(true);
  mocks.signout.mockResolvedValue({ error: null });
  mocks.redirect.mockImplementation(() => {
    throw new Error("REDIRECT");
  });
});
afterEach(() => vi.unstubAllEnvs());
it("sem desafio não consulta Auth e não cria sessão", async () => {
  mocks.cookies.mockResolvedValue({ get: () => undefined });
  expect((await verifyStudentCode({ phase: "code" }, form())).error).toContain("inválido");
  expect(mocks.verify).not.toHaveBeenCalled();
  expect(mocks.start).not.toHaveBeenCalled();
});
it("limite esgotado ou desafio vencido impede consultar Auth", async () => {
  mocks.attempt.mockResolvedValue({ data: [], error: null });
  await verifyStudentCode({ phase: "code" }, form());
  expect(mocks.verify).not.toHaveBeenCalled();
  expect(mocks.start).not.toHaveBeenCalled();
});
it.each([
  { id: "other-auth", email: "alice@example.com", email_confirmed_at: "2026" },
  { id: "alice-auth", email: "bob@example.com", email_confirmed_at: "2026" },
  { id: "alice-auth", email: "alice@example.com", email_confirmed_at: null },
])("identidade diferente/não verificada nunca abre sessão", async (user) => {
  mocks.verify.mockResolvedValue({ data: { user }, error: null });
  await verifyStudentCode({ phase: "code" }, form());
  expect(mocks.start).not.toHaveBeenCalled();
});
it("confirma OTP pelo Auth, abre sessão separada e descarta o token temporário", async () => {
  await expect(verifyStudentCode({ phase: "code" }, form())).rejects.toThrow("REDIRECT");
  expect(mocks.verify).toHaveBeenCalledWith({
    email: "alice@example.com",
    token: "123456",
    type: "email",
  });
  expect(mocks.start).toHaveBeenCalledWith(
    "11111111-1111-4111-8111-111111111111",
    "alice-auth",
    "student-a",
  );
  expect(mocks.signout).toHaveBeenCalledWith({ scope: "local" });
  expect(mocks.redirect).toHaveBeenCalledWith("/student");
});

it("pedido de código responde igual para email existente e desconhecido, sem esperar o provedor", async () => {
  vi.stubEnv("EMAIL_ENCRYPTION_KEY", "01".repeat(32));
  vi.stubEnv("VERCEL", "");
  mocks.cookies.mockResolvedValue({ get: () => undefined, set: mocks.set });
  function database(known: boolean) {
    return {
      rpc: async () => ({ data: true, error: null }),
      auth: { admin: { createUser: mocks.create } },
      from() {
        const query = {
          select() {
            return query;
          },
          eq() {
            return query;
          },
          is() {
            return query;
          },
          update() {
            return query;
          },
          async insert() {
            return { error: null };
          },
          async maybeSingle() {
            return {
              data: known ? { id: "alice", email: "alice@example.com" } : null,
              error: null,
            };
          },
          then(resolve: (v: unknown) => unknown) {
            return Promise.resolve({ error: null }).then(resolve);
          },
        };
        return query;
      },
    };
  }
  const input = new FormData();
  input.set("email", "ALICE@example.com");
  input.set("teacherId", "11111111-1111-4111-8111-111111111111");
  input.set("slug", "random-slug");
  mocks.admin.mockReturnValue(database(true));
  const known = await requestStudentCode({ phase: "email" }, input);
  expect(mocks.after).toHaveBeenCalledTimes(1);
  expect(mocks.create).not.toHaveBeenCalled();
  mocks.admin.mockReturnValue(database(false));
  const unknown = await requestStudentCode({ phase: "email" }, input);
  expect(unknown.phase).toEqual(known.phase);
  expect(unknown.message).toEqual(known.message);
  expect(unknown.phase).toBe("code");
  expect(mocks.after).toHaveBeenCalledTimes(1);
});

it("um campo de perfil forjado não altera o aluno vinculado ao desafio", async () => {
  const f = form();
  f.set("studentId", "student-b");
  await expect(verifyStudentCode({ phase: "code" }, f)).rejects.toThrow("REDIRECT");
  expect(mocks.start).toHaveBeenCalledWith(
    "11111111-1111-4111-8111-111111111111",
    "alice-auth",
    "student-a",
  );
  expect(mocks.profiles).not.toHaveBeenCalled();
});
it.each(["12345", "12345678", "123456789", "abcdef", "1234 5678"])(
  "rejeita formato inválido %s antes do provedor",
  async (code) => {
    const f = form();
    f.set("code", code);
    expect((await verifyStudentCode({ phase: "code" }, f)).error).toContain("inválido");
    expect(mocks.verify).not.toHaveBeenCalled();
  },
);
it("pedidos sem link de professor e aluno não consultam o banco", async () => {
  const f = new FormData();
  f.set("email", "alice@example.com");
  expect((await requestStudentCode({ phase: "email" }, f)).phase).toBe("email");
  expect(mocks.attempt).not.toHaveBeenCalled();
});

it("um desafio sem aluno específico nunca consulta o provedor", async () => {
  mocks.attempt.mockResolvedValue({
    data: [{ email: "alice@example.com", auth_user_id: "alice-auth", student_id: null }],
    error: null,
  });
  expect((await verifyStudentCode({ phase: "code" }, form())).error).toContain("inválido");
  expect(mocks.verify).not.toHaveBeenCalled();
  expect(mocks.start).not.toHaveBeenCalled();
});

it.each(["error", "throw"])(
  "não cria sessão do aluno se o logout temporário falhar: %s",
  async (mode) => {
    if (mode === "throw") mocks.signout.mockRejectedValue(new Error("offline"));
    else mocks.signout.mockResolvedValue({ error: { message: "offline" } });
    expect((await verifyStudentCode({ phase: "code" }, form())).error).toContain("inválido");
    expect(mocks.start).not.toHaveBeenCalled();
  },
);
it("encerra a sessão temporária mesmo quando a identidade do OTP não corresponde", async () => {
  mocks.verify.mockResolvedValue({
    data: { user: { id: "other", email: "other@example.com", email_confirmed_at: "2026-10-08" } },
    error: null,
  });
  await verifyStudentCode({ phase: "code" }, form());
  expect(mocks.signout).toHaveBeenCalledWith({ scope: "local" });
  expect(mocks.start).not.toHaveBeenCalled();
});

it("only forwards the Vercel-supplied end-user IP through the backend secret Auth client", async () => {
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "server-test-key");
  mocks.headers.mockResolvedValue({
    get: (name: string) =>
      name === "x-vercel-forwarded-for" ? "203.0.113.8, 10.0.0.1" : "198.51.100.5",
  });
  await expect(verifyStudentCode({ phase: "code" }, form())).rejects.toThrow();
  expect(mocks.authOptions).toHaveBeenCalledWith(
    expect.anything(),
    "server-test-key",
    expect.objectContaining({ global: { headers: { "sb-forwarded-for": "203.0.113.8" } } }),
  );
});
