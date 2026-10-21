"use client";
import Link from "next/link";
import { useState } from "react";
import { IMPORT_TEMPLATE, type ImportBatch } from "@/lib/import-rules";
import { uploadImport, confirmImport, cancelImport } from "@/app/import-actions";
import { ConfirmButton } from "./confirm-button";
import { ActionForm, SubmitButton } from "./action-form";
import { Button, FormActions } from "./button";
import { FileInput } from "./file-input";
import { Icon } from "./icon";
import { formatDate } from "@/lib/dates";
export function ImportWizard({
  batches,
  selected,
}: {
  batches: ImportBatch[];
  selected: string | undefined;
}) {
  const [mode, setMode] = useState<"guided" | "assisted">("guided");
  const batch = batches.find((b) => b.id === selected);
  const [included, setIncluded] = useState<string[]>([]);
  const [reviewKey, setReviewKey] = useState("");
  const key = batch ? `${batch.id}/${batch.revision}` : "";
  const chosen =
    key === reviewKey
      ? included
      : (batch?.preview?.filter((r) => !r.error).map((r) => r.row_id) ?? []);
  const change = (id: string, checked: boolean) => {
    setReviewKey(key);
    setIncluded(checked ? [...chosen, id] : chosen.filter((x) => x !== id));
  };
  return (
    <div className="space-y-6">
      <section className="card space-y-6">
        <div>
          <h2 className="h2">Como você quer trazer seus alunos?</h2>
          <p className="page-description">
            Nenhum cadastro existente será sobrescrito. Você sempre revisa antes de confirmar.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              [
                "guided",
                "Importar com modelo CSV",
                "Use o modelo, envie o arquivo e confira a prévia agora.",
              ],
              [
                "assisted",
                "Quero ajuda da equipe",
                "Envie sua planilha. A equipe prepara os dados para você revisar aqui.",
              ],
            ] as const
          ).map(([value, title, description]) => (
            <button
              type="button"
              className={`card text-left ${mode === value ? "subscription-active" : ""}`}
              aria-pressed={mode === value}
              key={value}
              onClick={() => setMode(value)}
            >
              <Icon
                name={value === "guided" ? "download" : "chat"}
                className="mb-3 h-5 w-5 text-accent"
              />
              <strong>{title}</strong>
              <p className="mt-2 text-sm text-muted">{description}</p>
            </button>
          ))}
        </div>
        {mode === "guided" && (
          <>
            <a
              className="btn-ghost"
              download="lessonara-modelo.csv"
              href={`data:text/csv;charset=utf-8,${encodeURIComponent("\uFEFF" + IMPORT_TEMPLATE)}`}
            >
              <Icon name="download" className="h-4 w-4" />
              Baixar modelo CSV
            </a>
            <div className="space-y-2 text-sm text-muted">
              <p>
                Use o nome exato de um plano ativo. Saldo inicial é a quantidade de aulas disponível
                na mudança, inclusive negativa; não é pagamento.
              </p>
              <p>
                Início: AAAA-MM-DD, hoje ou no futuro. Horários: seg 18:00|qua 18:00; mensal fixo:
                15 18:00; avulso: AAAA-MM-DD 18:00. Deixe vazio para configurar depois.
              </p>
              <p>
                Telefone com DDI e país de duas letras (BR, PT…). Valor diferente é opcional, usa
                vírgula ou ponto decimal, sem milhar.
              </p>
            </div>
          </>
        )}
        <ActionForm key={mode} action={uploadImport} className="space-y-4">
          <input type="hidden" name="mode" value={mode} />
          <div>
            <label className="label" htmlFor="import-file">
              {mode === "guided" ? "CSV UTF-8" : "Planilha CSV ou XLSX"}
            </label>
            <FileInput
              id="import-file"
              name="file"
              required
              accept={mode === "guided" ? ".csv" : ".csv,.xlsx"}
            />
          </div>
          <p className="text-xs text-muted">
            Até 512 KB e 200 alunos por lote; no máximo dois pedidos abertos. Na opção assistida,
            somente você e a equipe autorizada acessam o arquivo privado, removido ao concluir ou
            cancelar; falhas de limpeza são repetidas pelo processamento periódico. Não o enviamos a
            ferramentas externas. O atendimento é manual, sem prazo automático.
          </p>
          <FormActions>
            <SubmitButton icon="arrow">
              {mode === "guided" ? "Conferir arquivo" : "Pedir ajuda com a planilha"}
            </SubmitButton>
          </FormActions>
        </ActionForm>
      </section>
      {batch && (
        <section className="card space-y-5" key={key}>
          <div>
            <h2 className="h2">{batch.filename}</h2>
            <p className="page-description">
              {batch.status === "waiting"
                ? "Aguardando preparação da equipe. Volte aqui para revisar quando estiver pronta."
                : batch.status === "completed"
                  ? `${batch.result_ids?.length ?? 0} alunos importados. Agendas e saldos foram gravados juntos.`
                  : batch.status === "cancelled"
                    ? "Pedido cancelado. Você pode corrigir o arquivo e enviar uma nova versão."
                    : "Revise os alunos, planos, saldos e horários. Linhas com erro não podem ser selecionadas."}
            </p>
          </div>
          {batch.object_path && (
            <a className="btn-ghost" href={`/students/import/${batch.id}/file`}>
              <Icon name="download" className="h-4 w-4" />
              Baixar original
            </a>
          )}
          {batch.team_note && <p className="text-sm">Equipe: {batch.team_note}</p>}
          {batch.status === "review" && batch.preview && (
            <ActionForm action={confirmImport.bind(null, batch.id)} className="space-y-5">
              <input type="hidden" name="revision" value={batch.revision} />
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        "Importar",
                        "Aluno / contato",
                        "Plano / valor",
                        "Saldo inicial",
                        "Agenda",
                        "Validação",
                      ].map((c) => (
                        <th className="p-3 border-b border-line" key={c}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {batch.preview.map((row) => (
                      <tr key={row.row_id}>
                        <td className="p-3 border-b border-line">
                          <input
                            type="checkbox"
                            aria-label={`Importar linha ${row.row_id}: ${row.name}`}
                            name="rows"
                            value={row.row_id}
                            disabled={Boolean(row.error)}
                            checked={!row.error && chosen.includes(row.row_id)}
                            onChange={(e) => change(row.row_id, e.target.checked)}
                          />
                        </td>
                        <td className="p-3 border-b border-line">
                          <strong>{row.name}</strong>
                          <p>{row.email}</p>
                          <p>{row.phone}</p>
                        </td>
                        <td className="p-3 border-b border-line">
                          {row.plan_name ?? "—"}
                          <p>
                            {row.price_override == null
                              ? "Preço do plano"
                              : `Valor diferente: R$ ${row.price_override}`}
                          </p>
                        </td>
                        <td className="p-3 border-b border-line">
                          {row.opening_credits ?? "—"} aulas
                        </td>
                        <td className="p-3 border-b border-line">
                          <p>{row.starts_on}</p>
                          {row.schedules?.length
                            ? row.schedules.map((s, i) => (
                                <p key={i}>
                                  {s.date ??
                                    (s.monthly_day
                                      ? `Dia ${s.monthly_day}`
                                      : ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][
                                          s.weekday!
                                        ])}{" "}
                                  {s.time}
                                </p>
                              ))
                            : "Configurar depois"}
                        </td>
                        <td
                          className={`p-3 border-b border-line ${row.error ? "text-bad" : "text-accent"}`}
                        >
                          {row.error ?? "Pronto para revisar"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted">
                Conflitos de agenda são verificados novamente ao confirmar. Um conflito reverte o
                lote inteiro. Integrações Google conectadas receberão os novos agendamentos. Não
                importamos pagamentos históricos.
              </p>
              <label className="flex items-center gap-3">
                <input type="checkbox" name="reviewed" value="yes" required />
                Revisei os dados, saldos e horários das linhas selecionadas ({chosen.length}).
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" name="invite" value="yes" />
                Enviar convite de acesso por email aos alunos importados.
              </label>
              <FormActions>
                <Link href="/students" className="btn-ghost">
                  <Icon name="back" className="h-4 w-4" />
                  Voltar aos alunos
                </Link>
                <SubmitButton icon="check" disabled={!chosen.length}>
                  Confirmar importação ({chosen.length})
                </SubmitButton>
              </FormActions>
            </ActionForm>
          )}
          {["waiting", "review"].includes(batch.status) && (
            <ActionForm action={cancelImport.bind(null, batch.id)}>
              <FormActions align="start">
                <ConfirmButton
                  className="btn-ghost"
                  message="Cancelar este pedido? A prévia será descartada e o original enviado à equipe será removido. Nenhum aluno será criado."
                >
                  Cancelar pedido
                </ConfirmButton>
              </FormActions>
            </ActionForm>
          )}
          {batch.status === "completed" && (
            <Link href="/students" className="btn">
              <Icon name="users" className="h-4 w-4" />
              Ver alunos
            </Link>
          )}
        </section>
      )}
      <section className="card space-y-4">
        <h2 className="h2">Seus pedidos</h2>
        {batches.length ? (
          <ul className="divide-y divide-line">
            {batches.map((b) => (
              <li key={b.id} className="flex flex-wrap justify-between gap-3 py-4">
                <div>
                  <strong>{b.filename}</strong>
                  <p className="text-xs text-muted">
                    {formatDate(b.created_at.slice(0, 10))} ·{" "}
                    {
                      {
                        waiting: "Aguardando equipe",
                        review: "Revisão disponível",
                        completed: "Concluído",
                        cancelled: "Cancelado",
                      }[b.status]
                    }
                  </p>
                </div>
                <Link className="btn-ghost" href={`/students/import?batch=${b.id}`}>
                  <Icon name="arrow" className="h-4 w-4" />
                  Abrir pedido
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nenhum pedido enviado.</p>
        )}
        <Button icon="refresh" onClick={() => window.location.reload()}>
          Atualizar pedidos
        </Button>
      </section>
    </div>
  );
}
