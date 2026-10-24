"use client";
import { useState, useTransition } from "react";
import { updateStudentEmailPreferences } from "@/app/student/email-preferences";
import { Icon } from "./icon";
import { Toast } from "./toast";
export function StudentEmailPreferences({
  studentId,
  initial,
}: {
  studentId: string;
  initial: { operational: boolean; promotional: boolean };
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
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={values.operational}
            onChange={(e) => setValues({ ...values, operational: e.target.checked })}
          />
          Lembretes de aula e avisos de renovação
        </label>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={values.promotional}
            onChange={(e) => setValues({ ...values, promotional: e.target.checked })}
          />
          Comunicados e campanhas do professor
        </label>
        <button
          className="btn-outline"
          onClick={() =>
            start(async () => {
              const result = await updateStudentEmailPreferences(studentId, values);
              setMessage(result.message);
            })
          }
        >
          <Icon name="save" className="h-4 w-4" />
          {pending ? "Salvando…" : "Salvar preferências"}
        </button>
      </fieldset>
      {message && <Toast message={message} />}
    </section>
  );
}
