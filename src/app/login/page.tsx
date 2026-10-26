"use client";
import { AccessChallenge } from "@/components/access-challenge";
import { BusyContent } from "@/components/busy-content";
import { useI18n } from "@/components/browser-preferences-provider";
import { useActionState } from "react";
import { Logo } from "@/components/logo";
import { Icon } from "@/components/icon";
import { signIn } from "./actions";
export default function LoginPage() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <main className="login-screen grid lg:grid-cols-2">
      <section className="login-art max-lg:hidden">
        <div className="brand">
          <Logo />
        </div>
        <div className="login-story">
          <p className="eyebrow">{t("SEU ESPA\u00C7O PARA ENSINAR")}</p>
          <h1>
            {t("Voc\u00EA cuida do ensino.")}
            <br />
            {t("A gente cuida da ")}
            <em>{t("organiza\u00E7\u00E3o.")}</em>
          </h1>
          <p>
            {t(
              "Uma rotina mais leve para quem ensina. Re\u00FAna seus alunos, acompanhe as aulas e mantenha os pacotes em dia.",
            )}
          </p>
          <div className="login-preview" aria-hidden="true">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold">{t("Tudo no seu lugar")}</span>
              <span className="rounded-full bg-accent/10 px-2 py-1 text-[9px] text-accent">
                {t("Seu dia, mais leve")}
              </span>
            </div>
            {[
              {
                icon: "users" as const,
                label: "Cada aluno, uma jornada",
                text: "Acompanhe a evolução de cada pacote",
              },
              {
                icon: "calendar" as const,
                label: "Sua agenda organizada",
                text: "Horários fixos e reposições no mesmo lugar",
              },
              {
                icon: "book" as const,
                label: "Sem perder a conta",
                text: "Aulas e pagamentos sempre à mão",
              },
            ].map((item) => (
              <div key={item.label} className="login-preview-row">
                <span className="stat-icon">
                  <Icon name={item.icon} className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-medium">{t(item.label)}</p>
                  <p className="mt-1 text-[10px] text-muted">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="login-form-side">
        <div className="login-form-wrap">
          <div className="brand mb-12 lg:hidden">
            <Logo />
          </div>
          <p className="eyebrow">{t("BEM-VINDA AO SEU ESPA\u00C7O")}</p>
          <h2>{t("Que bom ter voc\u00EA aqui.")}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {t("Entre para organizar o seu pr\u00F3ximo encontro.")}
          </p>
          <form action={action} className="mt-9 space-y-5">
            <div>
              <label className="label" htmlFor="email">
                {t("Seu email")}
              </label>
              {/* Extensões de email podem inserir atributos neste campo antes da hidratação. */}
              <input
                suppressHydrationWarning
                className="input"
                id="email"
                name="email"
                type="email"
                placeholder={t("voce@exemplo.com")}
                required
                autoComplete="email"
                defaultValue={state?.email}
                key={state?.email}
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                {t("Senha")}
              </label>
              <input
                className="input"
                id="password"
                name="password"
                type="password"
                placeholder={t("Sua senha")}
                required
                autoComplete="current-password"
              />
            </div>
            <AccessChallenge resetKey={state} />
            {state?.error && (
              <p
                role="alert"
                className="rounded-xl border border-bad/30 bg-bad/5 px-3 py-3 text-sm text-bad"
              >
                {t(state.error)}
              </p>
            )}
            <button className="btn w-full" disabled={pending}>
              <BusyContent pending={pending}>
                {pending ? t("Entrando\u2026") : t("Entrar no meu espa\u00E7o")}
                <Icon name="arrow" className="h-4 w-4" />
              </BusyContent>
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
