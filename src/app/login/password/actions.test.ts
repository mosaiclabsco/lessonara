import { afterAll, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  teacher: vi.fn(),
  verify: vi.fn(),
  session: vi.fn(),
  password: vi.fn(),
  metadata: vi.fn(),
  signOut: vi.fn(),
  cookies: new Map<string, string>(),
  setCookie: vi.fn(),
  factory: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: (key: string) => ({ value: m.cookies.get(key) }),
    set: (key: string, value: string, options: unknown) => {
      m.cookies.set(key, value);
      m.setCookie(key, value, options);
    },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => m.factory() }));
import { defineTeacherPassword } from "./actions";
const user = {
  id: "teacher-id",
  email: "teacher@example.test",
  app_metadata: { provider: "email" },
};
const session = () => ({
  access_token: "fake-access",
  refresh_token: "fake-refresh",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
});
const form = () => {
  const f = new FormData();
  f.set("password", "Senha exclusiva de teste 123!");
  f.set("confirmation", "Senha exclusiva de teste 123!");
  f.set("token_hash", "a".repeat(64));
  f.set("type", "recovery");
  return f;
};
beforeEach(() => {
  vi.clearAllMocks();
  m.cookies.clear();
  vi.stubEnv("EMAIL_ENCRYPTION_KEY", "1".repeat(64));
  vi.stubEnv("SEAL_WRITE_VERSION", "v2");
  vi.stubEnv("EMAIL_ACCEPT_PREVIOUS_ENVELOPES", "true");
  m.rpc.mockResolvedValue({ data: true, error: null });
  m.teacher.mockResolvedValue({ data: { id: user.id, email: user.email }, error: null });
  m.verify.mockResolvedValue({ data: { user, session: session() }, error: null });
  m.session.mockResolvedValue({ data: { user, session: session() }, error: null });
  m.password.mockResolvedValue({ error: null });
  m.metadata.mockResolvedValue({ error: null });
  m.signOut.mockResolvedValue({ error: null });
  const chain = { select: () => chain, eq: () => chain, maybeSingle: m.teacher };
  m.factory.mockReturnValue({
    rpc: m.rpc,
    from: () => chain,
    auth: {
      verifyOtp: m.verify,
      setSession: m.session,
      updateUser: m.password,
      signOut: m.signOut,
      admin: { updateUserById: m.metadata },
    },
  });
});
afterAll(() => vi.unstubAllEnvs());
it("sem prova válida não altera senha mesmo com id/email forjados", async () => {
  const f = form();
  f.delete("token_hash");
  f.set("user_id", user.id);
  f.set("email", user.email);
  expect(await defineTeacherPassword(null, f)).toHaveProperty("error");
  expect(m.verify).not.toHaveBeenCalled();
  expect(m.password).not.toHaveBeenCalled();
});
it("valida senha antes de consumir o link", async () => {
  const f = form();
  f.set("password", "curta");
  expect(await defineTeacherPassword(null, f)).toHaveProperty("error");
  expect(m.verify).not.toHaveBeenCalled();
});
it("limite indisponível recusa verificação", async () => {
  m.rpc.mockResolvedValue({ data: null, error: {} });
  expect(await defineTeacherPassword(null, form())).toHaveProperty("error");
  expect(m.verify).not.toHaveBeenCalled();
});
it("token expirado/usado não gera alteração", async () => {
  m.verify.mockResolvedValue({
    data: { user: null, session: null },
    error: { code: "otp_expired" },
  });
  expect(await defineTeacherPassword(null, form())).toHaveProperty("error");
  expect(m.password).not.toHaveBeenCalled();
});
it("recusa conta sem professor mesmo com token válido", async () => {
  m.teacher.mockResolvedValue({ data: null, error: null });
  expect(await defineTeacherPassword(null, form())).toHaveProperty("error");
  expect(m.password).not.toHaveBeenCalled();
  expect(m.signOut).toHaveBeenCalledWith({ scope: "local" });
});
it("vincula a senha ao usuário verificado e nunca usa admin para definir senha", async () => {
  const f = form();
  f.set("user_id", "other-id");
  f.set("plan", "pro");
  expect(await defineTeacherPassword(null, f)).toEqual({ done: true });
  expect(m.password).toHaveBeenCalledWith({ password: "Senha exclusiva de teste 123!" });
  expect(m.metadata).toHaveBeenCalledWith(user.id, {
    app_metadata: expect.objectContaining({ teacher_password_defined_at: expect.any(String) }),
  });
  expect(m.signOut).toHaveBeenCalledWith({ scope: "global" });
  expect(m.cookies.get("lessonara-password-setup")).toBe("");
});
it("cookie temporário permite corrigir a senha sem consumir o link novamente", async () => {
  m.password
    .mockResolvedValueOnce({ error: { code: "weak_password" } })
    .mockResolvedValueOnce({ error: null });
  expect(await defineTeacherPassword(null, form())).toHaveProperty("error");
  expect(m.setCookie).toHaveBeenCalledWith(
    "lessonara-password-setup",
    expect.any(String),
    expect.objectContaining({ httpOnly: true, sameSite: "strict", path: "/login/password" }),
  );
  expect(await defineTeacherPassword(null, form())).toEqual({ done: true });
  expect(m.verify).toHaveBeenCalledTimes(1);
  expect(m.session).toHaveBeenCalledTimes(1);
});
it("replay depois de concluir exige nova prova do provedor", async () => {
  expect(await defineTeacherPassword(null, form())).toEqual({ done: true });
  m.verify.mockResolvedValue({
    data: { user: null, session: null },
    error: { code: "otp_expired" },
  });
  expect(await defineTeacherPassword(null, form())).toHaveProperty("error");
  expect(m.password).toHaveBeenCalledTimes(1);
});
