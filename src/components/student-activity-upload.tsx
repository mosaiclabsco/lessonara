"use client";
import { FileInput } from "./file-input";
import { usePlatformPlan } from "./platform-plan-provider";
import { formatFileSize as uploadSize } from "@/lib/document-rules";
import { Toast } from "./toast";
import { Icon } from "@/components/icon";

import { BusyContent } from "@/components/busy-content";
import { useI18n } from "@/components/browser-preferences-provider";
import { useState, useTransition, type FormEvent } from "react";
import { useUploads } from "./upload-provider";
import { DOCUMENT_ACCEPT, validateDocumentFile } from "@/lib/document-rules";
import { ACTIVITY_BUCKET } from "@/lib/activities";
import {
  beginActivitySubmission,
  cancelActivitySubmission,
  finishActivitySubmission,
} from "@/app/student/actions";
export function StudentActivityUpload({
  studentId,
  activityId,
  incomplete,
}: {
  studentId: string;
  activityId: string;
  incomplete: boolean;
}) {
  const { t } = useI18n();
  const plan = usePlatformPlan();
  const uploads = useUploads();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || uploads.busy) return;
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
      try {
        const result = await beginActivitySubmission(studentId, activityId, {
          fileName: file.name,
          byteSize: file.size,
        });
        if (!result.ok) throw new Error(result.message);

        await uploads.send({
          file,
          bucket: ACTIVITY_BUCKET,
          id: result.data.id,
          path: result.data.path,
          token: result.data.token,
          mimeType: result.data.mimeType,
          complete: async () => {
            const finished = await finishActivitySubmission(
              studentId,
              activityId,
              result.data.id,
              String(data.get("note") ?? ""),
            );
            if (!finished.ok) throw new Error(finished.message);
          },
          discard: async () => {
            const cancelled = await cancelActivitySubmission(studentId, activityId);
            if (!cancelled.ok) throw new Error(cancelled.message);
          },
        });
        setMessage("Atividade entregue. Sua professora já pode conferir o arquivo.");
      } catch (error) {
        setMessage((error as Error).message);
      }
    });
  }
  return (
    <div className="activity-upload">
      <h4>{t("Devolver minha atividade")}</h4>
      {incomplete ? (
        <>
          <p className="text-xs text-muted">
            {t("H\u00E1 um envio incompleto. Descarte-o antes de tentar novamente.")}
          </p>
          <button
            className="btn-xs"
            disabled={pending || uploads.busy}
            onClick={() =>
              startTransition(async () => {
                try {
                  const result = await cancelActivitySubmission(studentId, activityId);
                  setMessage(
                    result.ok
                      ? "Envio incompleto descartado. Você pode tentar novamente."
                      : result.message,
                  );
                } catch {
                  setMessage("Não foi possível descartar o envio.");
                }
              })
            }
          >
            <Icon name="trash" className="h-4 w-4" />
            <BusyContent pending={pending}>{t("Descartar envio incompleto")}</BusyContent>
          </button>
        </>
      ) : (
        <form onSubmit={send} className="space-y-3">
          <div>
            <label className="label" htmlFor={`submission-file-${activityId}`}>
              {t("Exercício feito · até {value0}", { value0: uploadSize(plan.maxFileBytes) })}
            </label>
            <FileInput
              id={`submission-file-${activityId}`}
              name="file"
              className="input"
              accept={DOCUMENT_ACCEPT}
              required
              disabled={pending || uploads.busy}
            />
          </div>
          <div>
            <label className="label" htmlFor={`submission-note-${activityId}`}>
              {t("Observa\u00E7\u00F5es da entrega (opcional)")}
            </label>
            <textarea
              id={`submission-note-${activityId}`}
              name="note"
              className="input"
              maxLength={4000}
              rows={2}
              disabled={pending || uploads.busy}
            />
          </div>
          <div className="form-actions">
            <button className="btn" disabled={pending || uploads.busy}>
              <BusyContent pending={pending}>
                <Icon name="mail" className="h-4 w-4" />
                {pending ? t("Enviando atividade\u2026") : t("Entregar atividade")}
              </BusyContent>
            </button>
          </div>
          {pending && (
            <progress className="document-upload-progress" aria-label={t("Enviando atividade")} />
          )}
          <p className="text-[11px] text-muted">
            {t("Confira o arquivo antes de entregar. Uma entrega por atividade.")}
          </p>
        </form>
      )}
      {message && <Toast message={t(message)} />}
    </div>
  );
}
