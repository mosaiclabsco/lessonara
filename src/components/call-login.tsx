"use client";
import { AccessChallenge } from "./access-challenge";
import { useActionState } from "react";
import { signIn } from "@/app/login/actions";
import { BusyContent } from "./busy-content";
import { Logo } from "./logo";
export function CallLogin() {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <main className="calls-login">
      <section className="card">
        <Logo />
        <h1>Chamadas</h1>
        <p>Entre com sua conta de professor para acessar suas aulas.</p>
        <form action={action} className="space-y-5 mt-6">
          <input type="hidden" name="destination" value="calls" />
          <div>
            <label className="label" htmlFor="call-email">
              Email
            </label>
            <input
              className="input"
              id="call-email"
              type="email"
              name="email"
              autoComplete="email"
              required
              defaultValue={state?.email}
            />
          </div>
          <div>
            <label className="label" htmlFor="call-password">
              Senha
            </label>
            <input
              className="input"
              id="call-password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </div>
          <AccessChallenge resetKey={state} />
          {state?.error && <p role="alert">{state.error}</p>}
          <button className="btn w-full" disabled={pending}>
            <BusyContent pending={pending}>Entrar nas chamadas</BusyContent>
          </button>
        </form>
      </section>
    </main>
  );
}
