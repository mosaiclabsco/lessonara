"use client";
import { usePlatformPlan } from "./platform-plan-provider";
import { formatFileSize as uploadSize } from "@/lib/document-rules";
import { useRef, useState, useId } from "react";
import { Icon } from "./icon";
import { useI18n } from "./browser-preferences-provider";
import { DOCUMENT_ACCEPT, validateDocumentFile } from "@/lib/document-rules";
import { notify } from "./toast";
type DocumentOption = { id: string; title: string; file_name: string };
export function DocumentPicker({
  documents,
  name,
  defaultValue = "",
  disabled = false,
  fileName,
}: {
  documents: DocumentOption[];
  name: string;
  defaultValue?: string;
  disabled?: boolean;
  fileName?: string;
}) {
  const { t } = useI18n();
  const plan = usePlatformPlan();
  const [value, setValue] = useState(defaultValue);
  const [chosenFile, setChosenFile] = useState("");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"choice" | "library">("choice");
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const selected = documents.find((d) => d.id === value);
  function close() {
    dialog.current?.close();
    setOpen(false);
  }
  function show() {
    setMode(fileName ? "choice" : "library");
    setQuery("");
    setOpen(true);
    dialog.current?.showModal();
  }
  return (
    <div className="document-picker">
      <input type="hidden" name={name} value={chosenFile ? "" : value} />
      <button
        type="button"
        className="document-picker-trigger"
        title={chosenFile || selected?.title}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={show}
      >
        <Icon name="book" className="h-5 w-5" />
        <span>
          <strong>{chosenFile || selected?.title || t("Escolher arquivo (opcional)")}</strong>
        </span>
        <Icon name="arrow" className="h-4 w-4" />
      </button>
      {(value || chosenFile) && (
        <button
          type="button"
          className="portal-text-button text-xs mt-2"
          disabled={disabled}
          onClick={() => {
            setValue("");
            setChosenFile("");
            if (input.current) input.current.value = "";
          }}
        >
          {t("Remover anexo")}
        </button>
      )}
      <dialog
        ref={dialog}
        className="document-picker-dialog card"
        aria-labelledby={id}
        onCancel={() => setOpen(false)}
      >
        {fileName && (
          <input
            ref={input}
            type="file"
            name={fileName}
            accept={DOCUMENT_ACCEPT}
            disabled={disabled}
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                validateDocumentFile(file.name, file.size, plan.maxFileBytes);
                setChosenFile(file.name);
                setValue("");
                close();
              } catch (error) {
                event.target.value = "";
                notify(t(error instanceof Error ? error.message : "Arquivo inválido."));
              }
            }}
          />
        )}
        <div className="section-heading">
          <h3 id={id}>{t("Escolher arquivo")}</h3>
          <button type="button" className="btn-xs" onClick={close}>
            <Icon name="close" className="h-4 w-4" />
            {t("Fechar")}
          </button>
        </div>
        {mode === "choice" ? (
          <div className="document-picker-choices">
            <button type="button" className="btn-ghost" onClick={() => setMode("library")}>
              <Icon name="book" className="h-5 w-5" />
              {t("Escolher de Documentos")}
            </button>
            <button type="button" className="btn-ghost" onClick={() => input.current?.click()}>
              <Icon name="plus" className="h-5 w-5" />
              {t("Enviar novo arquivo")}
            </button>
            <p className="text-xs text-muted">
              {t("Até {value0}. O arquivo será salvo em Documentos ao confirmar a conferência.", {
                value0: uploadSize(plan.maxFileBytes),
              })}
            </p>
          </div>
        ) : (
          <>
            <input
              className="input mt-4"
              aria-label={t("Buscar documento")}
              placeholder={t("Buscar documento")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="document-picker-options">
              {documents
                .filter((d) =>
                  (d.title + " " + d.file_name)
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toLowerCase()
                    .includes(
                      query
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .toLowerCase(),
                    ),
                )
                .map((d) => (
                  <button
                    type="button"
                    key={d.id}
                    aria-pressed={d.id === value}
                    onClick={() => {
                      setValue(d.id);
                      setChosenFile("");
                      if (input.current) input.current.value = "";
                      close();
                    }}
                  >
                    <Icon name="book" className="h-5 w-5" />
                    <span>
                      <strong>{d.title}</strong>
                      <small>{d.file_name}</small>
                    </span>
                    {d.id === value && <Icon name="check" className="h-4 w-4" />}
                  </button>
                ))}
              {!documents.length && (
                <p className="p-4 text-sm text-muted">{t("Nenhum documento em Documentos.")}</p>
              )}
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
