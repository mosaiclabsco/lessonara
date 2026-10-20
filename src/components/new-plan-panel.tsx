"use client";
import { useActionGroup } from "./action-form";
import { useState, type ReactNode } from "react";
import { useI18n } from "./browser-preferences-provider";
import { Icon } from "./icon";
export function NewPlanPanel({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const group = useActionGroup();
  const [open, setOpen] = useState(false);
  return (
    <div className="new-plan-panel">
      {open ? (
        <>
          <div className="section-heading mb-4">
            <h3 className="text-sm font-semibold">{t("Novo plano")}</h3>
            <button
              type="button"
              disabled={Boolean(group?.active)}
              className="btn-xs"
              onClick={() => setOpen(false)}
            >
              {t("Cancelar")}
            </button>
          </div>
          {children}
        </>
      ) : (
        <button
          type="button"
          disabled={Boolean(group?.active)}
          className="btn"
          onClick={() => setOpen(true)}
        >
          <Icon name="plus" className="h-4 w-4" />
          {t("Adicionar plano")}
        </button>
      )}
    </div>
  );
}
