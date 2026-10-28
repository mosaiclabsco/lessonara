export type DownloadKind = "pdf" | "csv" | "xlsx";
const mime: Record<DownloadKind, string> = {
  pdf: "application/pdf",
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
export function retryAfterSeconds(value: string | null, now = Date.now()) {
  const seconds =
    value && /^\d+(\.\d+)?$/.test(value)
      ? Number(value)
      : value
        ? (Date.parse(value) - now) / 1000
        : 10;
  return Math.min(3600, Math.max(1, Number.isFinite(seconds) ? Math.ceil(seconds) : 10));
}
export class DownloadFailure extends Error {
  constructor(
    message: string,
    public retryAfter = 0,
  ) {
    super(message);
  }
}
export async function readDownload(response: Response, kind: DownloadKind, fallback: string) {
  const type = response.headers.get("Content-Type") ?? "";
  if (!response.ok) {
    const wait =
      response.status === 429 ? retryAfterSeconds(response.headers.get("Retry-After")) : 0;
    const message = type.includes("text/html")
      ? "Não foi possível baixar agora. Recarregue a página e tente novamente."
      : (await response.text()).slice(0, 300);
    throw new DownloadFailure(message || "Não foi possível baixar o arquivo.", wait);
  }
  if (!type.toLowerCase().includes(mime[kind]))
    throw new DownloadFailure(
      "Seu acesso pode ter expirado. Recarregue a página e tente novamente.",
    );
  const blob = await response.blob();
  if (!blob.size) throw new DownloadFailure("O arquivo veio vazio. Tente novamente.");
  const header = response.headers.get("Content-Disposition") ?? "";
  const filename = header.match(/filename="([^"]+)"/)?.[1] ?? fallback;
  return {
    blob,
    filename:
      filename
        .replace(/[\x00-\x1f\x7f]/g, "")
        .split(/[\\/]/)
        .at(-1) || fallback,
  };
}
