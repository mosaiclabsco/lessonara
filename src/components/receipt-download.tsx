"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "./button";
import { notify } from "./toast";
import { useI18n } from "./browser-preferences-provider";
export function ReceiptDownload({ href, className = "" }: { href: string; className?: string }) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false),
    [remaining, setRemaining] = useState(0);
  const busy = useRef(false);
  useEffect(() => {
    if (!remaining) return;
    const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [remaining]);
  async function download() {
    if (busy.current || remaining) return;
    busy.current = true;
    setPending(true);
    try {
      const response = await fetch(href, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) {
        if (response.status === 429)
          setRemaining(
            Math.min(3600, Math.max(1, Number(response.headers.get("Retry-After")) || 10)),
          );
        throw new Error(
          (await response.text()).slice(0, 300) || t("Não foi possível baixar o recibo."),
        );
      }
      if (!response.headers.get("Content-Type")?.includes("application/pdf"))
        throw new Error(t("Seu acesso pode ter expirado. Recarregue a página e tente novamente."));
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download =
        response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ||
        "recibo.pdf";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setRemaining(10);
      notify(t("Download do recibo iniciado."));
    } catch (error) {
      notify(error instanceof Error ? error.message : t("Não foi possível baixar o recibo."));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <Button
      icon="download"
      className={`receipt-download ${className}`}
      pending={pending}
      disabled={remaining > 0}
      onClick={download}
    >
      {pending
        ? t("Preparando…")
        : remaining
          ? t("Aguarde {value0}s", { value0: remaining })
          : t("Recibo PDF")}
    </Button>
  );
}
