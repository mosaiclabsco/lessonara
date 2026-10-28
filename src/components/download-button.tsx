"use client";
import { useEffect, useRef, useState } from "react";
import { readDownload, DownloadFailure, type DownloadKind } from "@/lib/client-download";
import { Button } from "./button";
import { notify } from "./toast";
import { useI18n } from "./browser-preferences-provider";
export function DownloadButton({
  href,
  label,
  kind,
  filename,
  className = "",
}: {
  href: string;
  label: string;
  kind: DownloadKind;
  filename: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false),
    [remaining, setRemaining] = useState(0);
  const busy = useRef(false),
    deadline = useRef(0);
  function wait(seconds: number) {
    deadline.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
  }
  useEffect(() => {
    if (!remaining) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    const timer = setTimeout(tick, 1000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [remaining]);
  async function download() {
    if (busy.current || remaining) return;
    busy.current = true;
    setPending(true);
    try {
      const response = await fetch(href, { cache: "no-store", credentials: "same-origin" });
      const file = await readDownload(response, kind, filename);
      const url = URL.createObjectURL(file.blob),
        link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      wait(10);
      notify(t("Download iniciado."));
    } catch (error) {
      if (error instanceof DownloadFailure && error.retryAfter) wait(error.retryAfter);
      notify(
        t(error instanceof Error ? error.message : "Não foi possível baixar o arquivo."),
        "error",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <Button
      icon="download"
      className={`download-control ${className}`}
      pending={pending}
      disabled={remaining > 0}
      onClick={download}
      aria-label={remaining ? `${label} · ${t("Aguarde {value0}s", { value0: remaining })}` : label}
    >
      {remaining ? `${label} · ${remaining}s` : pending ? t("Preparando…") : label}
    </Button>
  );
}
