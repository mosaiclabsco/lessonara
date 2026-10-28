"use client";
import { useId, useState } from "react";
import { endSchedule } from "@/app/(panel)/actions";
import { isFormFailure } from "@/lib/form-validation";
import { ActionForm, SubmitButton } from "./action-form";
import { Button, FormActions } from "./button";
import { Dialog } from "./dialog";
import { useI18n } from "./browser-preferences-provider";
export function EndScheduleButton({
  studentId,
  scheduleId,
  today,
  startsOn,
}: {
  studentId: string;
  scheduleId: string;
  today: string;
  startsOn: string;
}) {
  const { t } = useI18n();
  const id = useId();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  async function save(form: FormData) {
    setBusy(true);
    try {
      const result = await endSchedule(studentId, scheduleId, form);
      if (!isFormFailure(result)) setOpen(false);
      return result;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button icon="clock" className="btn-xs end-schedule-trigger" onClick={() => setOpen(true)}>
        {t("Encerrar horário")}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        busy={busy}
        title={t("Encerrar horário fixo")}
        description={t(
          "Escolha a data da última aula neste horário. As aulas anteriores permanecem no histórico.",
        )}
      >
        <ActionForm action={save}>
          <label className="label" htmlFor={id}>
            {t("Última aula neste horário")}
          </label>
          <input
            id={id}
            className="input"
            type="date"
            name="ends_on"
            min={startsOn}
            defaultValue={today < startsOn ? startsOn : today}
            required
          />
          <FormActions>
            <Button icon="close" disabled={busy} onClick={() => setOpen(false)}>
              {t("Cancelar")}
            </Button>
            <SubmitButton icon="check">{t("Confirmar encerramento")}</SubmitButton>
          </FormActions>
        </ActionForm>
      </Dialog>
    </>
  );
}
