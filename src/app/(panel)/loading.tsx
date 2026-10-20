import { getTranslator } from "@/lib/i18n/server";
export default async function Loading() {
  const { t } = await getTranslator();
  return (
    <div role="status" aria-label={t("Carregando p\u00E1gina")} className="space-y-6">
      <p className="page-description">{t("Carregando seu espa\u00E7o\u2026")}</p>
      <div aria-hidden="true" className="card space-y-6 motion-safe:animate-pulse">
        <div className="h-6 w-1/3 rounded-lg bg-line" />
        <div className="h-4 w-2/3 rounded bg-line" />
        <div className="h-4 w-1/2 rounded bg-line" />
        <div className="h-4 w-2/3 rounded bg-line" />
      </div>
    </div>
  );
}
