"use client";
import { useI18n } from "@/components/browser-preferences-provider";
import { useId, useRef, useState } from "react";
import { PhoneField } from "./phone-field";
import { initialPhone as preparePhone } from "@/lib/phone";
import { Icon } from "./icon";
import { CopyButton } from "./copy-button";
import { DEFAULT_WHATSAPP_MESSAGE, paymentWhatsAppUrl } from "@/lib/whatsapp";
export function WhatsAppPayment({
  studentName,
  initialPhone,
  initialCountry,
}: {
  studentName: string;
  initialPhone?: string | null;
  initialCountry?: string | null;
}) {
  const { t } = useI18n();
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [country, setCountry] = useState(preparePhone(initialPhone, initialCountry).country);
  const phoneId = useId();
  const [message, setMessage] = useState(DEFAULT_WHATSAPP_MESSAGE);
  const url = paymentWhatsAppUrl(phone, country, message);
  return (
    <>
      <button ref={trigger} type="button" className="btn-xs" onClick={() => setOpen(true)}>
        <Icon name="chat" className="h-4 w-4" />
        {t("Abrir WhatsApp")}
      </button>
      {open && (
        <div
          className="whatsapp-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("Mensagem para {value0}", { value0: studentName })}
            className="whatsapp-dialog card"
            onKeyDown={(event) => {
              if (event.key === "Escape") close();
              if (event.key === "Tab") {
                const controls = event.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not([disabled]), input:not([type=hidden]), select, textarea, a",
                );
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("AVISO DE PAGAMENTO")}</p>
                <h2>{studentName}</h2>
              </div>
              <button
                type="button"
                className="btn-xs"
                aria-label={t("Fechar mensagem")}
                onClick={close}
              >
                <Icon name="close" className="h-4 w-4" />
                {t("Fechar")}
              </button>
            </div>
            <label className="label mt-6" htmlFor={phoneId}>
              {t("Telefone do aluno (opcional)")}
            </label>
            <PhoneField
              autoFocus
              id={phoneId}
              defaultValue={phone}
              defaultCountry={country}
              onChange={(value, nextCountry) => {
                setPhone(value);
                setCountry(preparePhone(value, nextCountry).country);
              }}
            />
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {t(
                "Selecione o pa\u00EDs e informe o n\u00FAmero. Deixe vazio para escolher o contato no WhatsApp. Para salvar o telefone, altere o cadastro do aluno.",
              )}
            </p>
            {!url && (
              <p role="alert" className="mt-2 text-xs text-bad">
                {t("Confira o telefone e o c\u00F3digo do pa\u00EDs.")}
              </p>
            )}
            <label className="label mt-5" htmlFor={`${phoneId}-message`}>
              {t("Mensagem (você pode editar)")}
            </label>
            <textarea
              id={`${phoneId}-message`}
              className="input whatsapp-message-editor"
              rows={5}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button
              className="btn-xs mt-2"
              type="button"
              onClick={() => setMessage(DEFAULT_WHATSAPP_MESSAGE)}
            >
              {t("Restaurar mensagem padrão")}
            </button>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <CopyButton text={message} label={t("Copiar mensagem")} />
              <button
                type="button"
                className="btn"
                disabled={!url}
                onClick={() => {
                  if (url) {
                    window.open(url, "_blank", "noopener,noreferrer");
                    close();
                  }
                }}
              >
                <Icon name="chat" className="h-4 w-4" />
                {t("Abrir conversa")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
