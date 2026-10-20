"use client";
import { useActionState, useEffect, useState } from "react";
import { useI18n } from "./browser-preferences-provider";
import { BusyContent } from "./busy-content";
import { LogoMark } from "./logo";
import { Icon } from "./icon";
import {
  requestStudentCode,
  verifyStudentCode,
  type StudentLoginState,
} from "@/app/student/login/actions";
export function StudentLogin({
  teacherId,
  slug,
  initialPhase = "email",
  initialEmail = "",
  initialRetryAt = 0,
}: {
  teacherId: string;
  slug: string;
  initialPhase?: "email" | "code";
  initialEmail?: string;
  initialRetryAt?: number;
}) {
  const { t } = useI18n();
  const [email, setEmail] = useState(initialEmail);
  const [now, setNow] = useState(0);
  const [request, send, sending] = useActionState(requestStudentCode, {
    phase: initialPhase,
    retryAt: initialRetryAt,
  } as StudentLoginState);
  const [verify, confirm, checking] = useActionState(verifyStudentCode, {
    phase: "code",
  } as StudentLoginState);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  const retryAt = request.retryAt ?? initialRetryAt;
  const seconds = Math.max(0, Math.ceil((retryAt - (now || retryAt)) / 1000));
  const waiting = seconds > 0 || (!now && retryAt > 0);
  const codePhase = request.phase === "code";
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="card w-full max-w-md">
        <div className="brand mb-8">
          <LogoMark className="h-9 w-9 text-accent" />
          <span>
            lessonara<span className="brand-dot">.</span>
          </span>
        </div>
        <p className="eyebrow">{t("SEU ESPAÇO DE APRENDIZAGEM")}</p>
        <h1 className="text-2xl font-semibold">{t("Entre para acompanhar suas aulas.")}</h1>
        <p className="mt-3 text-sm text-muted">
          {t(
            "Use o email cadastrado pelo seu professor(a). Enviaremos um código de acesso para este aluno.",
          )}
        </p>
        <form action={send} className="mt-7 space-y-4">
          <input type="hidden" name="teacherId" value={teacherId} />
          <input type="hidden" name="slug" value={slug} />
          <label className="label" htmlFor="student-login-email">
            {t("Seu email")}
          </label>
          <input
            suppressHydrationWarning
            className="input"
            id="student-login-email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={sending || checking || (codePhase && waiting)}
            placeholder={t("voce@exemplo.com")}
          />
          <button
            className="btn w-full"
            disabled={sending || checking || waiting || !email.trim()}
            aria-busy={sending}
          >
            <Icon name="mail" className="h-4 w-4" />
            <BusyContent pending={sending}>
              {sending
                ? t("Solicitando…")
                : waiting
                  ? t("Reenviar em {value0}", {
                      value0: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
                    })
                  : codePhase
                    ? t("Enviar outro código")
                    : t("Receber código por email")}
            </BusyContent>
          </button>
          {request.error && (
            <p role="alert" className="text-sm text-bad">
              {t(request.error)}
            </p>
          )}
        </form>
        {codePhase && (
          <>
            <p role="status" className="mt-5 text-sm text-muted">
              {t(
                request.message ??
                  "Se este email estiver cadastrado, você receberá um código. Confira também a pasta de spam.",
              )}
            </p>
            <form action={confirm} className="mt-6 space-y-4">
              <label className="label" htmlFor="student-login-code">
                {t("Código de 6 dígitos")}
              </label>
              <input
                id="student-login-code"
                className="input text-center tracking-[.4em]"
                name="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                required
                autoComplete="one-time-code"
                placeholder="000000"
              />
              <button className="btn w-full" disabled={checking || sending} aria-busy={checking}>
                <BusyContent pending={checking}>
                  {checking ? t("Conferindo…") : t("Entrar na minha área")}
                  <Icon name="arrow" className="h-4 w-4" />
                </BusyContent>
              </button>
              {verify.error && (
                <p role="alert" className="text-sm text-bad">
                  {t(verify.error)}
                </p>
              )}
            </form>
          </>
        )}
        <p className="mt-6 text-xs text-muted">
          {t("O código vale por 10 minutos. Sua sessão dura até 30 dias neste navegador.")}
        </p>
        <p className="mt-4 text-xs text-muted">
          {t(
            "Não recebeu? Confira o spam e confirme com seu professor(a) qual email está cadastrado.",
          )}
        </p>
      </section>
    </main>
  );
}
