"use client";
import { useState, useTransition } from "react";
import { updateStudentEmailPreferences } from "@/app/student/email-preferences";
import { InfoTooltip } from "./info-tooltip";
import { Button, FormActions } from "./button";
import { Toast } from "./toast";
export function StudentEmailPreferences({
  studentId,
  initial,
}: {
  studentId: string;
  initial: { lesson: boolean; renewal: boolean; promotional: boolean };
}) {
  const [values, setValues] = useState(initial),
    [pending, start] = useTransition(),
    [message, setMessage] = useState("");
  return (
    <section className="card">
      <h2 className="h2">Preferências de email</h2>
      <p className="mt-2 mb-5 text-sm text-muted">
        Escolha quais avisos quer receber deste professor. Códigos e convites de acesso continuam
        disponíveis.
      </p>
      <fieldset disabled={pending} className="space-y-4">
        <div className="email-preference-row">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={values.lesson}
              onChange={(e) => setValues({ ...values, lesson: e.target.checked })}
            />
            Lembretes do horário das aulas
          </label>
          <InfoTooltip label="Quando recebo o lembrete da aula?">
            Quando disponível para este professor, o lembrete é preparado cerca de 1 hora antes da
            aula. O horário de entrega pode variar alguns minutos.
          </InfoTooltip>
        </div>
        <div className="email-preference-row">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={values.renewal}
              onChange={(e) => setValues({ ...values, renewal: e.target.checked })}
            />
            Avisos de renovação do pacote
          </label>
          <InfoTooltip label="Quando recebo o aviso de renovação?">
            Quando disponível para este professor, avisa quando faltar uma aula ou o pacote se
            esgotar. O aviso depende do saldo, não de um número fixo de dias.
          </InfoTooltip>
        </div>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={values.promotional}
            onChange={(e) => setValues({ ...values, promotional: e.target.checked })}
          />
          Comunicados e campanhas do professor
        </label>
        <FormActions>
          <Button
            icon="save"
            pending={pending}
            onClick={() =>
              start(async () => {
                const result = await updateStudentEmailPreferences(studentId, values);
                setMessage(result.message);
              })
            }
          >
            {pending ? "Salvando…" : "Salvar preferências"}
          </Button>
        </FormActions>
      </fieldset>
      {message && <Toast message={message} />}
    </section>
  );
}
