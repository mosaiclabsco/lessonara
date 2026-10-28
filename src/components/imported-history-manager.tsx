"use client";
import { useId, useRef, useState } from "react";
import {
  addImportedLesson,
  reconstructHistory,
  correctImportedLesson,
} from "@/app/(panel)/actions";
import { isFormFailure } from "@/lib/form-validation";
import type { Lesson } from "@/lib/ledger";
import { formatDate } from "@/lib/dates";
import { Button, FormActions } from "./button";
import { ActionForm, SubmitButton, ActionGroup } from "./action-form";
import { Dialog } from "./dialog";
import { TimeField } from "./time-field";
import { useI18n } from "./browser-preferences-provider";
export function ImportedHistoryManager({
  studentId,
  today,
  initialDate,
  lessons,
}: {
  studentId: string;
  today: string;
  initialDate?: string;
  lessons: Lesson[];
}) {
  const { t, locale } = useI18n();
  const id = useId();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const running = useRef(false);
  async function execute(action: (form: FormData) => Promise<unknown>, form: FormData) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const result = await action(form);
      if (!isFormFailure(result)) setOpen(false);
      return result;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  const imported = lessons.filter((l) => l.provenance && l.provenance !== "schedule");
  return (
    <>
      <Button icon="edit" onClick={() => setOpen(true)}>
        {t("Gerenciar aulas importadas")}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("Aulas anteriores ao Lessonara")}
        description={t(
          "Reconstrua os horários atuais desde uma data inicial ou lance aulas individualmente. São registros presumidos; os horários e o plano atuais podem ser diferentes dos antigos.",
        )}
        busy={busy}
      >
        <ActionGroup className="space-y-6">
          <ActionForm action={(form) => execute(reconstructHistory.bind(null, studentId), form)}>
            <label className="label" htmlFor={`${id}-start`}>
              {t("Reconstruir desde")}
            </label>
            <input
              className="input"
              type="date"
              name="starts_on"
              id={`${id}-start`}
              required
              max={today}
              defaultValue={initialDate}
            />
            <FormActions>
              <SubmitButton icon="clock">{t("Reconstruir aulas presumidas")}</SubmitButton>
            </FormActions>
          </ActionForm>
          <div className="border-t border-line pt-6">
            <h3 className="h2 mb-4">{t("Adicionar aula anterior")}</h3>
            <ActionForm action={(form) => execute(addImportedLesson.bind(null, studentId), form)}>
              <div className="payment-fields">
                <div>
                  <label className="label" htmlFor={`${id}-date`}>
                    {t("Data")}
                  </label>
                  <input
                    className="input"
                    type="date"
                    name="date"
                    id={`${id}-date`}
                    required
                    max={today}
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`${id}-time`}>
                    {t("Horário")}
                  </label>
                  <TimeField id={`${id}-time`} />
                </div>
              </div>
              <FormActions>
                <SubmitButton icon="plus">{t("Adicionar aula presumida")}</SubmitButton>
              </FormActions>
            </ActionForm>
          </div>
          {imported.length > 0 && (
            <div className="border-t border-line pt-6">
              <h3 className="h2 mb-4">{t("Corrigir aulas importadas")}</h3>
              <ul className="imported-history-list">
                {imported.map((l) => (
                  <li key={l.historyId}>
                    <span>
                      {formatDate(l.date, locale)} · {l.time}
                    </span>
                    <ActionForm
                      action={(form) =>
                        execute(
                          () =>
                            correctImportedLesson(
                              studentId,
                              l.historyId!,
                              String(form.get("status")),
                            ),
                          form,
                        )
                      }
                    >
                      <div className="imported-history-correction">
                        <select
                          className="input"
                          name="status"
                          aria-label={t("Estado da aula")}
                          defaultValue={
                            l.status === "falta" || l.status === "desmarcada" ? l.status : "dada"
                          }
                        >
                          <option value="dada">{t("Dada")}</option>
                          <option value="falta">{t("Falta")}</option>
                          <option value="desmarcada">{t("Desconsiderar aula")}</option>
                        </select>
                        <SubmitButton icon="save">{t("Salvar")}</SubmitButton>
                      </div>
                    </ActionForm>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted mt-4">
                {t(
                  "Desconsiderar preserva a auditoria e devolve o crédito. Para corrigir a data ou o horário, desconsidere e adicione a aula correta.",
                )}
              </p>
            </div>
          )}
        </ActionGroup>
      </Dialog>
    </>
  );
}
