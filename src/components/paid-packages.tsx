"use client";
import { useId, useRef, useState } from "react";
import { addPackage, deletePackage } from "@/app/(panel)/actions";
import { isFormFailure } from "@/lib/form-validation";
import { formatBRL, formatDate } from "@/lib/dates";
import type { Package } from "@/lib/ledger";
import { useI18n } from "./browser-preferences-provider";
import { ActionForm, SubmitButton } from "./action-form";
import { Button, FormActions } from "./button";
import { ConfirmButton } from "./confirm-button";
import { Dialog } from "./dialog";
import { MoneyField } from "./money-field";
import { ReceiptDownload } from "./receipt-download";
export function PaidPackages({
  studentId,
  packages,
  today,
  lessons,
  amount,
  needsSchedule = false,
}: {
  studentId: string;
  packages: Package[];
  today: string;
  lessons?: number;
  amount?: number;
  needsSchedule?: boolean;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const running = useRef(false),
    id = useId();
  async function save(data: FormData) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const result = await addPackage(studentId, data);
      if (!isFormFailure(result)) setOpen(false);
      return result;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <section id="pagamentos" className="card paid-packages scroll-mt-6">
      <div className="paid-packages-heading">
        <h2 className="h2">{t("Pacotes pagos")}</h2>
        <Button
          icon="plus"
          variant="primary"
          disabled={needsSchedule}
          onClick={() => setOpen(true)}
        >
          {t("Registrar pagamento")}
        </Button>
      </div>
      {needsSchedule && (
        <p className="text-sm text-muted">
          {t(
            "Cadastre um horário fixo na aba Horários antes de registrar o pagamento deste plano.",
          )}
        </p>
      )}
      {packages.length === 0 ? (
        <p className="text-sm text-muted">{t("Nenhum pagamento registrado.")}</p>
      ) : (
        <ul className="paid-package-list">
          {[...packages]
            .sort((a, b) => b.paid_on.localeCompare(a.paid_on))
            .map((pack) => (
              <li key={pack.id} className="paid-package-card">
                <dl className="paid-package-details">
                  <div>
                    <dt>{t("Pago em")}</dt>
                    <dd>{formatDate(pack.paid_on, locale)}</dd>
                  </div>
                  <div>
                    <dt>{t("Aulas")}</dt>
                    <dd>{pack.lessons}</dd>
                  </div>
                  <div>
                    <dt>{t("Valor")}</dt>
                    <dd>{formatBRL(pack.amount, locale)}</dd>
                  </div>
                </dl>
                <div className="paid-package-actions">
                  {pack.paid_on <= today && pack.amount >= 0 && (
                    <ReceiptDownload href={`/payments/${pack.id}/receipt`} />
                  )}
                  <ActionForm action={deletePackage.bind(null, studentId, pack.id)}>
                    <ConfirmButton
                      message={t(
                        "Remover esse pagamento? As aulas do histórico serão preservadas e os créditos serão recalculados.",
                      )}
                    >
                      {t("Remover")}
                    </ConfirmButton>
                  </ActionForm>
                </div>
              </li>
            ))}
        </ul>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("Registrar pagamento")}
        description={t(
          "Registre o pacote recebido. Os créditos serão usados em sequência, sem sobrepor aulas de outros pacotes.",
        )}
        busy={busy}
      >
        <ActionForm action={save}>
          <div className="payment-fields">
            <div>
              <label className="label" htmlFor={`${id}-date`}>
                {t("Pago em")}
              </label>
              <input
                id={`${id}-date`}
                className="input"
                name="paid_on"
                type="date"
                required
                defaultValue={today}
              />
            </div>
            <div>
              <label className="label" htmlFor={`${id}-lessons`}>
                {t("Aulas no pacote")}
              </label>
              <input
                id={`${id}-lessons`}
                className="input"
                name="lessons"
                type="number"
                min={1}
                max={1000}
                required
                defaultValue={lessons}
              />
            </div>
            <div>
              <label className="label" htmlFor={`${id}-amount`}>
                {t("Valor (R$)")}
              </label>
              <MoneyField id={`${id}-amount`} name="amount" required defaultValue={amount} />
            </div>
          </div>
          <label className="payment-retroactive">
            <input type="checkbox" name="reconstruct" />{" "}
            <span>
              {t(
                "Reconstruir aulas anteriores ao cadastro desde a data do pagamento, usando os horários atuais.",
              )}
              <small className="block text-muted">
                {t(
                  "Serão marcadas como retroativas/importadas e presumidas. Corrija-as na aba Histórico. Pagamentos adiantados mantêm os créditos em sequência.",
                )}
              </small>
            </span>
          </label>
          <FormActions>
            <Button icon="close" disabled={busy} onClick={() => setOpen(false)}>
              {t("Cancelar")}
            </Button>
            <SubmitButton>{t("Registrar pagamento")}</SubmitButton>
          </FormActions>
        </ActionForm>
      </Dialog>
    </section>
  );
}
