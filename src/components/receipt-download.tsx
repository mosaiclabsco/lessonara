"use client";
import { DownloadButton } from "./download-button";
import { useI18n } from "./browser-preferences-provider";
export function ReceiptDownload({ href, className = "" }: { href: string; className?: string }) {
  const { t } = useI18n();
  return (
    <DownloadButton
      href={href}
      label={t("Recibo PDF")}
      kind="pdf"
      filename="recibo.pdf"
      className={`receipt-download ${className}`}
    />
  );
}
