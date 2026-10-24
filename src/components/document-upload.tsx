"use client";
import { FileInput } from "./file-input";
import { usePlatformPlan } from "./platform-plan-provider";
import { formatFileSize as uploadSize } from "@/lib/document-rules";
import { Toast } from "./toast";
import { Icon } from "@/components/icon";

import { useI18n } from "@/components/browser-preferences-provider";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { useUploads } from "./upload-provider";
import { DOCUMENT_ACCEPT, DOCUMENT_BUCKET, validateDocumentFile } from "@/lib/document-rules";
import {
  beginDocumentUpload,
  finishDocumentUpload,
  removeLibraryDocument,
} from "@/app/(panel)/documents/actions";
export function DocumentUpload({ available }: { available: boolean }) {
  const { t } = useI18n();
  const plan = usePlatformPlan();
  const uploads = useUploads();
  const form = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || uploads.busy || !available) return;
    const data = new FormData(event.currentTarget);
    const file = data.get("file");
    if (!(file instanceof File)) return;
    try {
      validateDocumentFile(file.name, file.size, plan.maxFileBytes);
    } catch (error) {
      setMessage((error as Error).message);
      return;
    }
    setMessage("");
    startTransition(async () => {
      let documentId: string | null = null;
      try {
        const prepared = await beginDocumentUpload({
          title: String(data.get("title")),
          subject: String(data.get("subject") ?? ""),
          fileName: file.name,
          byteSize: file.size,
        });
        if (!prepared.ok) throw new Error(prepared.message);
        documentId = prepared.data.id;
        await uploads.send({
          file,
          bucket: DOCUMENT_BUCKET,
          id: documentId,
          path: prepared.data.path,
          token: prepared.data.token,
          mimeType: prepared.data.mimeType,
          complete: async () => {
            const result = await finishDocumentUpload(prepared.data.id);
            if (!result.ok) throw new Error(result.message);
          },
          discard: async () => {
            const result = await removeLibraryDocument(prepared.data.id, true);
            if (!result.ok) throw new Error(result.message);
          },
        });
        form.current?.reset();
        setTitle("");

        setMessage(
          "Arquivo salvo em Documentos. Agora você pode compartilhá-lo no perfil de cada aluno.",
        );
      } catch (error) {
        setMessage((error as Error).message || "Não foi possível enviar o arquivo.");
      }
    });
  }
  return (
    <section className="card document-upload">
      <h2 className="h2">{t("Adicionar documento")}</h2>
      <p className="mb-5 text-xs leading-relaxed text-muted">
        {t("Envie uma vez e reutilize com vários alunos. Até {value0} por arquivo.", {
          value0: uploadSize(plan.maxFileBytes),
        })}
      </p>
      <form ref={form} onSubmit={upload}>
        <fieldset
          disabled={!available || pending || uploads.busy}
          className="document-upload-fields"
        >
          <div>
            <label className="label" htmlFor="document-file">
              {t("Arquivo")}
            </label>
            <FileInput
              id="document-file"
              name="file"
              accept={DOCUMENT_ACCEPT}
              required
              className="input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file && !title) setTitle(file.name.replace(/\.[^.]+$/, ""));
              }}
            />
          </div>
          <div>
            <label className="label" htmlFor="document-title">
              {t("Título do documento")}
            </label>
            <input
              id="document-title"
              name="title"
              className="input"
              required
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("Ex.: Voz passiva \u00B7 exerc\u00EDcios")}
            />
          </div>
          <div>
            <label className="label" htmlFor="document-subject">
              {t("Assunto (opcional)")}
            </label>
            <input
              id="document-subject"
              name="subject"
              className="input"
              maxLength={80}
              placeholder={t("Ex.: Gram\u00E1tica \u00B7 B1")}
            />
          </div>
          <button className="btn" type="submit">
            <Icon name="save" className="h-4 w-4" />
            {pending ? t("Enviando arquivo\u2026") : t("Salvar documento")}
          </button>
        </fieldset>
      </form>
      {pending && (
        <progress className="document-upload-progress" aria-label={t("Enviando documento")} />
      )}
      {message && <Toast message={t(message)} />}
    </section>
  );
}
