"use client";
import { useActionState } from "react";
import { unsubscribePromotions } from "@/app/emails/unsubscribe/actions";
export function EmailUnsubscribe({ token }: { token: string }) {
  const [state, action, pending] = useActionState(unsubscribePromotions, null);
  return (
    <section className="card">
      <h1>Comunicações promocionais</h1>
      {state ? (
        <p role="status" className="mt-5">
          {state.message}
        </p>
      ) : (
        <>
          <p className="mt-5">
            Confirme para deixar de receber campanhas e promoções deste professor.
          </p>
          <form action={action}>
            <input type="hidden" name="token" value={token} />
            <button className="btn mt-5" disabled={pending}>
              Cancelar comunicações promocionais
            </button>
          </form>
        </>
      )}
    </section>
  );
}
