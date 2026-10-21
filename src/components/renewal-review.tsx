"use client";
import { useState } from "react";
import type { RenewalQuote } from "@/lib/pix";
import { resolveRenewal } from "@/app/renewal-actions";
import { isFormFailure } from "@/lib/form-validation";
import { formatBRL, formatDate } from "@/lib/dates";
import { ActionForm, SubmitButton } from "./action-form";
import { Button, FormActions } from "./button";
import { Dialog } from "./dialog";
export type RenewalReviewRow = RenewalQuote & { studentName: string; changed: boolean };
export function RenewalReview({ rows, today }: { rows: RenewalReviewRow[]; today: string }) {
  const [selected, setSelected] = useState<RenewalReviewRow | null>(null),
    [busy, setBusy] = useState(false);
  const [reject, setReject] = useState(false);
  if (!rows.length) return null;
  return (
    <section className="card mb-6 space-y-5">
      <div>
        <h2 className="h2">Pagamentos informados pelos alunos</h2>
        <p className="page-description">
          Confira o extrato antes de confirmar. Nenhum crédito foi liberado ainda.
        </p>
      </div>
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4"
        >
          <div>
            <strong>{row.studentName}</strong>
            <p className="mt-1 text-sm text-muted">
              {row.plan_name} · {row.lessons} aulas · {formatBRL(Number(row.amount))} · Informado em{" "}
              {formatDate(row.reported_at!.slice(0, 10))}
            </p>
          </div>
          <Button
            icon="check"
            onClick={() => {
              setReject(false);
              setSelected(row);
            }}
          >
            Conferir pagamento
          </Button>
        </div>
      ))}
      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        busy={busy}
        title="Conferir pagamento"
        description="Confirme somente após localizar o pagamento no banco. Use esta confirmação em vez de registrar o mesmo pagamento manualmente."
      >
        {selected && (
          <ActionForm
            action={async (form) => {
              setBusy(true);
              try {
                const result = await resolveRenewal(selected.id, reject, form);
                if (!isFormFailure(result)) setSelected(null);
                return result;
              } finally {
                setBusy(false);
              }
            }}
            className="space-y-5"
          >
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="label">Aluno</dt>
                <dd>{selected.studentName}</dd>
              </div>
              <div>
                <dt className="label">Pacote</dt>
                <dd>
                  {selected.plan_name} · {selected.lessons} aulas
                </dd>
              </div>
              <div>
                <dt className="label">Valor informado</dt>
                <dd className="text-xl font-semibold">{formatBRL(Number(selected.amount))}</dd>
              </div>
              <div>
                <dt className="label">Recebedor no Pix</dt>
                <dd>{selected.pix.receiver_name}</dd>
                <dd className="text-sm text-muted break-all">{selected.pix.pix_key}</dd>
              </div>
            </dl>
            {selected.changed && (
              <p role="status" className="balance-warning rounded-xl p-4 text-sm leading-relaxed">
                O preço, as aulas ou o Pix atual mudaram. Esta solicitação preserva os dados
                exibidos ao aluno. Se não corresponder ao extrato, não confirme.
              </p>
            )}
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={reject}
                onChange={(e) => setReject(e.target.checked)}
              />
              Não reconheço este pagamento — devolver para o aluno revisar
            </label>
            {!reject && (
              <div>
                <label className="label" htmlFor="renewal-paid-on">
                  Data do recebimento
                </label>
                <input
                  className="input"
                  type="date"
                  name="paid_on"
                  id="renewal-paid-on"
                  required
                  min="2000-01-01"
                  max={today}
                  defaultValue={today}
                />
              </div>
            )}
            <div>
              <label className="label" htmlFor="renewal-note">
                Observação {reject ? "para o aluno" : "(opcional)"}
              </label>
              <textarea className="input" id="renewal-note" name="note" maxLength={400} rows={3} />
            </div>
            <FormActions>
              <Button icon="back" disabled={busy} onClick={() => setSelected(null)}>
                Voltar
              </Button>
              <SubmitButton icon={reject ? "undo" : "check"}>
                {reject ? "Devolver para revisão" : "Confirmar e liberar aulas"}
              </SubmitButton>
            </FormActions>
          </ActionForm>
        )}
      </Dialog>
    </section>
  );
}
