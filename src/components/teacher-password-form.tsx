"use client";
import { useActionState, useEffect, useState, useSyncExternalStore } from "react";
import { defineTeacherPassword } from "@/app/login/password/actions";
import { passwordLinkInput } from "@/lib/teacher-password-input";
import { ButtonLink } from "./button";
import { BusyContent } from "./busy-content";
import { Icon } from "./icon";
const subscribe = () => () => {};
export function TeacherPasswordForm({ hasSetup, email }: { hasSetup: boolean; email?: string }) {
  const [link] = useState(() => {
    if (typeof window === "undefined") return null;
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    return passwordLinkInput(parameters.get("token_hash"), parameters.get("type"));
  });
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [state, action, pending] = useActionState(defineTeacherPassword, null);
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
  }, []);
  if (state?.done)
    return (
      <div className="space-y-6">
        <p role="status">Sua senha foi salva. Entre com seu email e a nova senha para continuar.</p>
        <ButtonLink icon="arrow" variant="primary" href="/login">
          Entrar no Lessonara
        </ButtonLink>
      </div>
    );
  if (!ready)
    return (
      <p role="status" className="text-sm text-muted">
        Preparando seu acesso…
      </p>
    );
  if (!hasSetup && !link)
    return (
      <div className="space-y-6">
        <p role="alert" className="text-sm text-muted">
          Abra o link recebido por email. Se ele expirou ou já foi utilizado, peça o reenvio ao
          responsável pelo convite.
        </p>
        <ButtonLink icon="back" href="/login">
          Voltar para entrar
        </ButtonLink>
      </div>
    );
  return (
    <form action={action} className="space-y-5">
      {email && <p className="text-sm text-muted">{email}</p>}
      <input type="hidden" name="token_hash" value={link?.token_hash ?? ""} />
      <input type="hidden" name="type" value={link?.type ?? ""} />
      <div>
        <label className="label" htmlFor="password">
          Sua nova senha *
        </label>
        <input
          className="input"
          id="password"
          name="password"
          type="password"
          minLength={12}
          maxLength={128}
          required
          autoComplete="new-password"
          disabled={pending}
        />
        <p className="mt-2 text-xs text-muted">
          Use pelo menos 12 caracteres. Prefira uma frase longa e exclusiva.
        </p>
      </div>
      <div>
        <label className="label" htmlFor="confirmation">
          Confirme sua senha *
        </label>
        <input
          className="input"
          id="confirmation"
          name="confirmation"
          type="password"
          minLength={12}
          maxLength={128}
          required
          autoComplete="new-password"
          disabled={pending}
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn w-full" disabled={pending}>
        <BusyContent pending={pending}>
          <Icon name="save" className="h-4 w-4" />
          Salvar minha senha
        </BusyContent>
      </button>
    </form>
  );
}
