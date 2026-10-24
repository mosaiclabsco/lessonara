"use client";
import { useState, type ReactNode } from "react";
import { addReposicao } from "@/app/(panel)/actions";
import { isFormFailure } from "@/lib/form-validation";
import { formatDate } from "@/lib/dates";
import { useI18n } from "./browser-preferences-provider";
import { Dialog } from "./dialog";
import { Button, FormActions } from "./button";
import { ActionForm, SubmitButton } from "./action-form";
import { TimeField } from "./time-field";
export function ReplacementManager({
  studentId,
  today,
  cancelled,
  children,
}: {
  studentId: string;
  today: string;
  cancelled: { id: string; date: string; time: string }[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { t, locale } = useI18n();
  return (
    <section className="card replacement-section">
      <header>
        <h2 className="h2">{t("Reposições")}</h2>
        <p className="mt-3 text-sm text-muted">
          {t("Reagende uma aula desmarcada sem perder o vínculo com a aula original.")}
        </p>
      </header>
      <div className="replacement-create">
        <Button
          icon="plus"
          variant="primary"
          disabled={!cancelled.length}
          onClick={() => setOpen(true)}
        >
          {t("Adicionar reposição")}
        </Button>
        {!cancelled.length && (
          <p className="mt-3 text-sm text-muted">
            {t("Desmarque uma aula para agendar sua reposição.")}
          </p>
        )}
      </div>
      <div className="replacement-list">{children}</div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        busy={busy}
        title={t("Adicionar reposição")}
        description={t("Selecione a aula original e confira a nova data e o horário.")}
      >
        <ActionForm
          className="space-y-5"
          action={async (data) => {
            setBusy(true);
            try {
              const result = await addReposicao(studentId, data);
              if (!isFormFailure(result)) setOpen(false);
              return result;
            } finally {
              setBusy(false);
            }
          }}
        >
          <div>
            <label className="label" htmlFor="replacement-source">
              {t("Aula desmarcada")}
            </label>
            <select
              id="replacement-source"
              name="source_event_id"
              className="input"
              required
              defaultValue=""
            >
              <option value="" disabled>
                {t("Selecione a aula")}
              </option>
              {cancelled.map((l) => (
                <option key={l.id} value={l.id}>
                  {formatDate(l.date, locale)} · {l.time}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="replacement-date">
                {t("Nova data")}
              </label>
              <input
                id="replacement-date"
                className="input"
                name="date"
                type="date"
                required
                defaultValue={today}
              />
            </div>
            <div>
              <label className="label" htmlFor="replacement-time">
                {t("Horário")}
              </label>
              <TimeField id="replacement-time" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="replacement-note">
              {t("Observações")}
            </label>
            <textarea id="replacement-note" className="input" name="note" maxLength={4000} />
          </div>
          <FormActions>
            <Button icon="close" disabled={busy} onClick={() => setOpen(false)}>
              {t("Cancelar")}
            </Button>
            <SubmitButton icon="calendar">{t("Agendar reposição")}</SubmitButton>
          </FormActions>
        </ActionForm>
      </Dialog>
    </section>
  );
}
