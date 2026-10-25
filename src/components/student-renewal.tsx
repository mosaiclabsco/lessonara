"use client";
import { useState } from "react";
import { Dialog } from "./dialog";
import { studentRenewal } from "@/app/renewal-actions";
import type { StudentRenewal as Renewal } from "@/lib/renewals";
import { formatBRL } from "@/lib/dates";
import { ActionForm, ActionGroup, SubmitButton, useActionGroup } from "./action-form";
import { Button, FormActions } from "./button";
import { CopyButton } from "./copy-button";
import { Icon } from "./icon";
export function StudentRenewalCard({ studentId, data }: { studentId: string; data: Renewal }) {
  const [open, setOpen] = useState(false);
  const { quote } = data;
  if (!quote && !data.available && !data.lastResolved) return null;
  return (
    <section className="card space-y-5">
      <div className="section-heading">
        <div>
          <h2 className="h2">Renovar pacote</h2>
          <p className="mt-2 text-sm text-muted">
            {quote?.plan_name ?? data.planName} · {quote?.lessons ?? data.lessons} aulas ·{" "}
            {formatBRL(Number(quote?.amount ?? data.amount))}
          </p>
        </div>
        <Icon name="refresh" className="h-6 w-6 text-accent" />
      </div>
      {!quote && data.lastResolved && (
        <p role="status" className="text-sm text-muted">
          {data.lastResolved.status === "confirmed"
            ? "Último pagamento confirmado pelo professor. Seu saldo já foi atualizado."
            : "O professor devolveu o último aviso para revisão. Confira o pagamento antes de tentar novamente."}
          {data.lastResolved.resolution_note && ` ${data.lastResolved.resolution_note}`}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {quote?.status === "pending"
            ? "Aguardando confirmação do professor."
            : "Você pode antecipar a renovação. Os créditos são liberados após a confirmação do professor."}
        </p>
        {(quote || data.available) && (
          <Button icon="refresh" variant="primary" onClick={() => setOpen(true)}>
            {quote?.status === "pending"
              ? "Ver solicitação"
              : quote
                ? "Ver Pix"
                : "Renovar por Pix"}
          </Button>
        )}
      </div>
      <ActionGroup>
        <RenewalDialog
          studentId={studentId}
          data={data}
          open={open}
          onClose={() => setOpen(false)}
        />
      </ActionGroup>
    </section>
  );
}

function RenewalDialog({
  studentId,
  data,
  open,
  onClose,
}: {
  studentId: string;
  data: Renewal;
  open: boolean;
  onClose: () => void;
}) {
  const { quote, payload, qr } = data;
  const group = useActionGroup();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Renovar pacote por Pix"
      description={`${quote?.plan_name ?? data.planName} · ${quote?.lessons ?? data.lessons} aulas · ${formatBRL(Number(quote?.amount ?? data.amount))}`}
      busy={Boolean(group?.active)}
    >
      <div className="space-y-6">
        {quote?.status === "pending" ? (
          <p
            role="status"
            className="flex items-center gap-2 rounded-xl border border-line p-4 text-sm"
          >
            <Icon name="clock" className="h-4 w-4" /> Aguardando confirmação do professor
          </p>
        ) : quote ? (
          <>
            <div className="flex flex-col items-center gap-5 text-center">
              <div
                role="img"
                aria-label="QR Code Pix para renovar o pacote"
                className="min-w-0 w-full max-w-[248px] rounded-xl bg-white p-2 [&>svg]:h-auto [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: qr! }}
              />
              <div className="space-y-3">
                <p>
                  <strong>{quote.pix.receiver_name}</strong>
                </p>
                <p className="text-sm text-muted">
                  Confira o recebedor e o valor no banco antes de pagar.
                </p>
                <CopyButton text={payload!} label="Copiar código Pix" />
              </div>
            </div>
            <p className="text-sm text-muted">
              Depois de pagar, avise abaixo. As aulas serão liberadas após o professor conferir o
              recebimento.
            </p>
            <FormActions>
              <ActionForm action={studentRenewal.bind(null, studentId, "cancel")}>
                <input type="hidden" name="request_id" value={quote.id} />
                <SubmitButton icon="back" className="btn-ghost">
                  Cancelar este Pix
                </SubmitButton>
              </ActionForm>
              <ActionForm action={studentRenewal.bind(null, studentId, "report")}>
                <input type="hidden" name="request_id" value={quote.id} />
                <SubmitButton icon="check">Já paguei</SubmitButton>
              </ActionForm>
            </FormActions>
          </>
        ) : data.available ? (
          <>
            <p className="text-sm text-muted">
              Prepare o Pix com o valor do seu plano. Seu saldo só muda após a confirmação do
              professor.
            </p>
            <ActionForm action={studentRenewal.bind(null, studentId, "prepare")}>
              <FormActions>
                <SubmitButton icon="arrow">Preparar Pix</SubmitButton>
              </FormActions>
            </ActionForm>
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
