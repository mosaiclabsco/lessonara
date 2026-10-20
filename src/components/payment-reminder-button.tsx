"use client";
import { Toast } from "./toast";
import { Icon } from "./icon";
import { BusyContent } from "@/components/busy-content";
import { useI18n } from "@/components/browser-preferences-provider";
import { useActionState } from "react";
import { sendPaymentReminder } from "@/app/(panel)/payments/actions";
export function PaymentReminderButton({
  studentId,
  hasEmail,
}: {
  studentId: string;
  hasEmail: boolean;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(sendPaymentReminder.bind(null, studentId), null);
  return (
    <form action={action} className="payment-email">
      <button
        type="submit"
        className="btn-xs"
        disabled={!hasEmail || pending || state?.ok}
        title={!hasEmail ? t("Cadastre um email no perfil do aluno") : undefined}
      >
        <BusyContent pending={pending}>
          <Icon name={state?.ok ? "check" : "mail"} className="h-4 w-4" />
          {pending
            ? t("Enviando\u2026")
            : state?.ok
              ? t(state.status === "queued" ? "Na fila" : "Email enviado")
              : t("Enviar email")}
        </BusyContent>
      </button>
      {state && !state.ok && <Toast message={t(state.message)} />}
    </form>
  );
}
