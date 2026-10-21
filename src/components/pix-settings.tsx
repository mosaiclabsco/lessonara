import { ConfirmButton } from "./confirm-button";
import { ActionForm, SubmitButton } from "./action-form";
import { FormActions } from "./button";
import { savePix, removePix } from "@/app/renewal-actions";
import type { PixSettings } from "@/lib/pix";
export function PixSettingsForm({ settings }: { settings: PixSettings | null }) {
  return (
    <section className="card space-y-6">
      <div>
        <h2 className="h2">Recebimentos por Pix</h2>
        <p className="page-description">
          Seu Pix para os alunos renovarem os pacotes de aulas. A confirmação do pagamento é feita
          por você.
        </p>
      </div>
      <ActionForm action={savePix} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pix-type">
              Tipo de chave
            </label>
            <select
              className="input"
              id="pix-type"
              name="key_type"
              required
              defaultValue={settings?.key_type ?? "email"}
            >
              {[
                ["cpf", "CPF"],
                ["cnpj", "CNPJ"],
                ["email", "Email"],
                ["phone", "Telefone com +55"],
                ["random", "Aleatória"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pix-key">
              Chave Pix
            </label>
            <input
              className="input"
              id="pix-key"
              name="pix_key"
              required
              maxLength={77}
              defaultValue={settings?.pix_key}
            />
          </div>
          <div>
            <label className="label" htmlFor="pix-name">
              Nome do recebedor
            </label>
            <input
              className="input"
              id="pix-name"
              name="receiver_name"
              required
              maxLength={25}
              defaultValue={settings?.receiver_name}
            />
          </div>
          <div>
            <label className="label" htmlFor="pix-city">
              Cidade
            </label>
            <input
              className="input"
              id="pix-city"
              name="receiver_city"
              required
              maxLength={15}
              defaultValue={settings?.receiver_city}
            />
          </div>
        </div>
        <p className="text-sm text-muted">
          Confira o nome e a chave no aplicativo do seu banco. O Lessonara valida o formato, mas não
          consulta a titularidade ou recebe o dinheiro. Solicitações já abertas preservam os dados
          anteriores.
        </p>
        <FormActions>
          <SubmitButton icon="save">Salvar Pix</SubmitButton>
        </FormActions>
      </ActionForm>
      {settings && (
        <ActionForm action={removePix}>
          <FormActions>
            <ConfirmButton
              className="btn-ghost"
              message="Desativar novos Pix? Solicitações já abertas preservam a chave anterior para conferência."
            >
              Desativar novas cobranças Pix
            </ConfirmButton>
          </FormActions>
        </ActionForm>
      )}
    </section>
  );
}
