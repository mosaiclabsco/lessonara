"use client";
import { useState, useSyncExternalStore, useEffect, useActionState } from "react";
import { startSupportAccess } from "./actions";
import { Logo } from "@/components/logo";
import { Button } from "@/components/button";
const subscribe = () => () => {};
export default function SupportAccessPage() {
  const [token] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.hash.slice(1)).get("token") ?? ""),
  );
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [state, action, pending] = useActionState(startSupportAccess, null);
  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  return (
    <main className="min-h-screen grid place-items-center p-5">
      <section className="card w-full max-w-lg space-y-6">
        <Logo className="h-8 w-auto" />
        <h1 className="h2">Iniciar acesso de suporte</h1>
        <p className="text-sm text-muted">
          Você entrará temporariamente como o professor escolhido no admin. O acesso é auditado e
          expira em até 15 minutos. A sessão atual do Lessonara neste navegador será substituída.
        </p>
        {ready ? (
          <form action={action} className="space-y-6">
            <input type="hidden" name="token" value={token} />
            {state?.error && (
              <p role="alert" className="text-bad">
                {state.error}
              </p>
            )}
            <div className="flex justify-end">
              <Button
                icon="arrow"
                variant="primary"
                type="submit"
                pending={pending}
                disabled={!token || Boolean(state?.error)}
              >
                Iniciar sessão temporária
              </Button>
            </div>
          </form>
        ) : (
          <p role="status">Preparando acesso…</p>
        )}
      </section>
    </main>
  );
}
