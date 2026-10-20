"use client";
import { useState, useTransition } from "react";
import { createPlan, updatePlan, deletePlan, reorderPlans } from "@/app/(panel)/actions";
import { PlanFields } from "./plan-fields";
import { Button } from "./button";
import { Dialog, ConfirmDialog } from "./dialog";
import { notify } from "./toast";
import { formatBRL } from "@/lib/dates";
import { frequencyName, planFrequency } from "@/lib/plan-frequency";
import { SortableList } from "./sortable-list";
import { DropdownMenu } from "./dropdown-menu";
import { useI18n } from "./browser-preferences-provider";
import type { Plan } from "@/lib/data";
export function PlanManager({ plans }: { plans: Plan[] }) {
  const { t, locale } = useI18n();
  const [editor, setEditor] = useState<Plan | "new" | null>(null),
    [removal, setRemoval] = useState<Plan | null>(null),
    [ordering, setOrdering] = useState(false),
    [pending, start] = useTransition();
  function run(action: () => Promise<void>, success: string) {
    start(async () => {
      try {
        await action();
        setEditor(null);
        setRemoval(null);
        notify(t(success));
      } catch (error) {
        notify(error instanceof Error ? error.message : t("Não foi possível salvar."));
      }
    });
  }
  const blocked = pending || ordering;
  return (
    <section className="card plan-manager">
      <div className="section-heading">
        <div>
          <h2 className="h2">{t("Planos")}</h2>
          <p>
            {t(
              "Defina os créditos, a frequência e o preço. A ordem abaixo aparece no cadastro de alunos.",
            )}
          </p>
        </div>
        <Button icon="plus" variant="primary" disabled={blocked} onClick={() => setEditor("new")}>
          {t("Adicionar plano")}
        </Button>
      </div>
      <SortableList
        key={plans.map((p) => p.id).join(",")}
        items={plans}
        disabled={pending}
        onBusyChange={setOrdering}
        onReorder={async (ids) => {
          try {
            await reorderPlans(ids);
            notify(t("Ordem dos planos atualizada."));
          } catch (error) {
            notify(error instanceof Error ? error.message : t("Não foi possível salvar."));
            throw error;
          }
        }}
        renderItem={(plan, handle, index) => {
          const frequency = planFrequency(plan);
          return (
            <article key={plan.id} className="saved-plan">
              {handle}
              <span className="plan-position">{index + 1}</span>
              <div className="saved-plan-info">
                <h3>{t(frequencyName(frequency.period, frequency.count))}</h3>
                <p>
                  {plan.lessons} {t("aulas no pacote")} ·{" "}
                  {t(frequency.mode === "flexible" ? "Datas avulsas" : "Datas fixas")}
                </p>
                {!plan.is_active && (
                  <span className="balance-pill balance-warning">
                    {t("Sugestão · confirme para ativar")}
                  </span>
                )}
              </div>
              <strong className="saved-plan-price">{formatBRL(plan.price, locale)}</strong>
              <DropdownMenu
                label={t("Ações do plano")}
                disabled={blocked}
                items={[
                  {
                    label: t(plan.is_active ? "Editar" : "Ativar plano"),
                    icon: "edit",
                    onSelect: () => setEditor(plan),
                  },
                  {
                    label: t("Excluir"),
                    icon: "trash",
                    danger: true,
                    onSelect: () => setRemoval(plan),
                  },
                ]}
              />
            </article>
          );
        }}
      />
      {!plans.length && (
        <p className="empty-state">
          {t("Crie seu primeiro plano para começar a cadastrar alunos.")}
        </p>
      )}
      <Dialog
        open={editor !== null}
        onClose={() => setEditor(null)}
        title={t(editor === "new" ? "Criar plano" : "Editar plano")}
        description={t("Mudar o preço não altera pagamentos já registrados.")}
        busy={pending}
        className="plan-editor"
        actions={
          <>
            <Button icon="close" disabled={pending} onClick={() => setEditor(null)}>
              {t("Cancelar")}
            </Button>
            <Button
              icon="save"
              type="submit"
              form="plan-editor-form"
              variant="primary"
              pending={pending}
            >
              {t(editor === "new" ? "Criar plano" : "Salvar plano")}
            </Button>
          </>
        }
      >
        {editor && (
          <form
            key={typeof editor === "string" ? "new" : editor.id}
            id="plan-editor-form"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              run(
                () => (editor === "new" ? createPlan(data) : updatePlan(editor.id, data)),
                "Plano salvo.",
              );
            }}
          >
            <fieldset disabled={pending} className="plan-editor-fields">
              <PlanFields plan={editor === "new" ? undefined : editor} />
            </fieldset>
          </form>
        )}
      </Dialog>
      <ConfirmDialog
        open={Boolean(removal)}
        onClose={() => setRemoval(null)}
        title="Excluir plano"
        message="Excluir o plano? Alunos nele ficam sem plano. Pagamentos registrados são preservados."
        confirmLabel="Excluir plano"
        danger
        pending={pending}
        onConfirm={() => {
          if (removal) run(() => deletePlan(removal.id), "Plano excluído.");
        }}
      />
    </section>
  );
}
