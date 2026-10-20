"use client";
import { Toast } from "./toast";
import { useActionState } from "react";
import { useI18n } from "./browser-preferences-provider";
import { acceptInvite } from "@/app/student/invite/[token]/actions";
import { LogoMark } from "./logo";
import { BusyContent } from "./busy-content";
import { Icon } from "./icon";
export function InviteAcceptance({
  token,
  loginUrl,
  valid,
}: {
  token: string;
  loginUrl: string | null;
  valid: boolean;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(acceptInvite, null);
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="card w-full max-w-md">
        <div className="brand mb-8">
          <LogoMark className="h-9 w-9 text-accent" />
          <span>lessonara.</span>
        </div>
        <h1 className="h2">{t(valid ? "Seu espaço está pronto!" : "Entre no seu espaço")}</h1>
        <p className="mt-4 text-sm text-muted">
          {t(
            valid
              ? "Ative o convite de primeiro acesso. Você continuará conectado por até 30 dias neste navegador."
              : "Este convite já foi usado ou expirou. Solicite um código para entrar novamente.",
          )}
        </p>
        {valid && (
          <form action={action} className="mt-6">
            <input type="hidden" name="token" value={token} />
            <button className="btn w-full" disabled={pending}>
              <BusyContent pending={pending}>
                <Icon name="arrow" className="h-4 w-4" />
                {t("Ativar meu acesso")}
              </BusyContent>
            </button>
          </form>
        )}
        {state?.error && <Toast message={t(state.error)} />}
        {loginUrl && (
          <a className="btn-ghost mt-5 w-full" href={loginUrl}>
            {t("Entrar por código")}
          </a>
        )}
      </section>
    </main>
  );
}
