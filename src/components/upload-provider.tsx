"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Upload } from "tus-js-client";
import { createResumableUpload } from "@/lib/resumable-upload";
import { useI18n } from "./browser-preferences-provider";
import { Icon } from "./icon";
type Options = {
  file: File;
  bucket: string;
  id: string;
  path: string;
  token: string;
  mimeType: string;
  complete: () => Promise<void>;
  discard: () => Promise<void>;
};
type Progress = {
  name: string;
  percent: number;
  state: "sending" | "paused" | "finishing" | "failed" | "done";
  message?: string;
};
const Context = createContext<{ busy: boolean; send: (options: Options) => Promise<void> } | null>(
  null,
);
export function useUploads() {
  const context = useContext(Context);
  if (!context) throw new Error("UploadProvider missing");
  return context;
}
export function UploadProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [progress, setProgress] = useState<Progress | null>(null),
    task = useRef<{
      upload: Upload;
      options: Options;
      uploaded: boolean;
      finish: () => void;
      reject: (reason: Error) => void;
    } | null>(null);
  const busy = progress !== null && progress.state !== "done";
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  useEffect(
    () => () => {
      void task.current?.upload.abort();
    },
    [],
  );
  function send(options: Options) {
    if (task.current)
      return Promise.reject(
        new Error("Conclua ou descarte o envio em andamento antes de enviar outro arquivo."),
      );
    setProgress({ name: options.file.name, percent: 0, state: "sending" });
    return new Promise<void>((resolve, reject) => {
      const fail = () => {
        setProgress((p) =>
          p
            ? {
                ...p,
                state: "failed",
                message: "Envio interrompido. Tente retomar ou descarte para começar novamente.",
              }
            : p,
        );
        // Keep the form awaiting completion when the user resumes the same upload.
      };
      const upload = createResumableUpload(options.file, {
        ...options,
        onProgress: (sent, total) =>
          setProgress((p) =>
            p
              ? { ...p, percent: Math.min(99, Math.floor((sent / total) * 100)), state: "sending" }
              : p,
          ),
        onError: fail,
        onSuccess: () => {
          if (task.current) task.current.uploaded = true;
          finish();
        },
      });
      const finish = () => {
        setProgress((p) => (p ? { ...p, percent: 100, state: "finishing" } : p));
        void options
          .complete()
          .then(() => {
            setProgress((p) =>
              p
                ? { ...p, percent: 100, state: "done", message: "Arquivo enviado e confirmado." }
                : p,
            );
            task.current = null;
            resolve();
          })
          .catch(fail);
      };
      task.current = { upload, options, uploaded: false, finish, reject };
      upload.start();
    });
  }
  async function pause() {
    await task.current?.upload.abort();
    setProgress((p) => (p ? { ...p, state: "paused" } : p));
  }
  function resume() {
    if (!task.current) return;
    setProgress((p) => (p ? { ...p, state: "sending", message: undefined } : p));
    if (task.current.uploaded) task.current.finish();
    else task.current.upload.start();
  }
  async function discard() {
    const active = task.current;
    if (!active) return;
    await active.upload.abort(true);
    try {
      await active.options.discard();
      active.reject(new Error("Envio descartado."));
      task.current = null;
      setProgress(null);
    } catch {
      setProgress((p) =>
        p
          ? {
              ...p,
              state: "failed",
              message: "Não foi possível descartar. Confira sua sessão e tente novamente.",
            }
          : p,
      );
    }
  }
  return (
    <Context.Provider value={{ busy, send }}>
      {children}
      {progress && (
        <aside className="upload-status" aria-label={t("Envio de arquivo")}>
          <div className="flex items-center justify-between gap-4">
            <strong className="truncate">
              {t(
                progress.state === "done"
                  ? "Envio concluído"
                  : progress.state === "paused"
                    ? "Envio pausado"
                    : progress.state === "failed"
                      ? "Envio interrompido"
                      : progress.state === "finishing"
                        ? "Confirmando arquivo…"
                        : "Enviando arquivo",
              )}
            </strong>
            {progress.state === "done" && (
              <button aria-label={t("Fechar aviso de envio")} onClick={() => setProgress(null)}>
                <Icon name="close" className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="mt-2 truncate text-sm" title={progress.name}>
            {progress.name}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <progress
              className="w-full"
              max={100}
              value={progress.percent}
              aria-label={t("Progresso do upload")}
            />
            <span className="text-xs tabular-nums">{progress.percent}%</span>
          </div>
          <p role="status" className="mt-3 text-xs text-muted">
            {t(
              progress.message ??
                "Pode navegar dentro do Lessonara. Mantenha esta aba aberta; fechar ou recarregar interrompe o envio.",
            )}
          </p>
          {progress.state !== "done" && progress.state !== "finishing" && (
            <div className="mt-4 flex gap-3">
              {progress.state === "sending" ? (
                <button className="btn-xs" onClick={() => void pause()}>
                  <Icon name="clock" className="h-4 w-4" />
                  {t("Pausar")}
                </button>
              ) : (
                <button className="btn-xs" onClick={resume}>
                  <Icon name="arrow" className="h-4 w-4" />
                  {t("Retomar")}
                </button>
              )}
              <button className="btn-xs" onClick={() => void discard()}>
                <Icon name="trash" className="h-4 w-4" />
                {t("Descartar")}
              </button>
            </div>
          )}
        </aside>
      )}
    </Context.Provider>
  );
}
