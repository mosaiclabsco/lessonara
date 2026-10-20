import { fingerprint } from "./mail/crypto";
type Limiter = {
  rpc: (
    name: "allow_student_auth",
    args: { p_keys: string[]; p_limits: number[]; p_seconds: number[] },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};
export async function allowTeacherLogin(db: Limiter, email: string, ip: string) {
  const result = await db.rpc("allow_student_auth", {
    p_keys: [
      `teacher-login/ip/${fingerprint(ip)}`,
      `teacher-login/account/${fingerprint(email)}`,
      `teacher-login/pair/${fingerprint(`${ip}/${email}`)}`,
    ],
    p_limits: [60, 20, 10],
    p_seconds: [900, 900, 900],
  });
  return !result.error && result.data === true;
}
