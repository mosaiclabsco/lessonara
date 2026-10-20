"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, FormActions } from "./button";
import { useI18n } from "./browser-preferences-provider";
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  busy = false,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  actions?: ReactNode;
  busy?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  const { t } = useI18n();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
    return () => {
      if (el.open) el.close();
      if (open && opener?.isConnected) opener.focus();
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <dialog
      ref={ref}
      className={`app-dialog ${className}`}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="dialog-heading">
        <h2 id={`${id}-title`}>{title}</h2>
        <Button
          icon="close"
          className="icon-button"
          aria-label={t("Fechar")}
          disabled={busy}
          onClick={onClose}
        />
      </header>
      {description && (
        <p className="dialog-description" id={`${id}-description`}>
          {description}
        </p>
      )}
      {children && <div className="dialog-body">{children}</div>}
      {actions && <FormActions>{actions}</FormActions>}
    </dialog>,
    document.body,
  );
}
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Confirmar ação",
  message,
  confirmLabel = "Confirmar",
  danger = false,
  pending = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  pending?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(title)}
      description={t(message)}
      busy={pending}
      actions={
        <>
          <Button icon="close" disabled={pending} onClick={onClose}>
            {t("Cancelar")}
          </Button>
          <Button
            icon={danger ? "trash" : "check"}
            variant={danger ? "danger" : "primary"}
            pending={pending}
            onClick={onConfirm}
          >
            {t(confirmLabel)}
          </Button>
        </>
      }
    />
  );
}
