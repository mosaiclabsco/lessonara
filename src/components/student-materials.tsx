"use client";
import { useI18n } from "./browser-preferences-provider";
import { Icon } from "./icon";
import { FileDownload } from "./file-download";
import { formatDate } from "@/lib/dates";
import { formatFileSize } from "@/lib/document-rules";
import type { Material } from "@/lib/documents";
export function StudentMaterials({
  materials,
  slug,
  today,
}: {
  materials: Material[];
  slug: string;
  today: string;
}) {
  const { t, locale } = useI18n();
  return (
    <section className="card">
      <div className="section-heading mb-5">
        <div>
          <h2>
            {t("Seus documentos")}
            <span className="count-badge">{materials.length}</span>
          </h2>
          <p>{t("Arquivos que seu professor(a) compartilhou com você.")}</p>
        </div>
        <Icon name="book" className="h-5 w-5 text-accent" />
      </div>
      {materials.length ? (
        <ul className="student-material-list">
          {materials.map((material) => {
            const expired = Boolean(material.expiresOn && material.expiresOn < today);
            return (
              <li key={material.id} className={expired ? "material-expired" : ""}>
                <span className="document-type">
                  <Icon name="book" className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{material.title}</h3>
                  {material.subject && (
                    <p className="mt-1 text-xs text-accent">{material.subject}</p>
                  )}
                  <p className={`mt-2 text-xs ${expired ? "text-bad" : "text-muted"}`}>
                    {formatFileSize(material.byteSize)} ·{" "}
                    {material.expiresOn
                      ? t(expired ? "Acesso encerrado em {value0}" : "Disponível até {value0}", {
                          value0: formatDate(material.expiresOn, locale),
                        })
                      : t("Sem prazo de acesso")}
                  </p>
                </div>
                <FileDownload
                  disabled={expired}
                  label={t(expired ? "Prazo encerrado" : "Baixar arquivo")}
                  name={material.fileName}
                  href={`/student/portal/${slug}/materials/${material.id}`}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="empty-state">
          <Icon name="book" className="mx-auto mb-4 h-8 w-8 text-accent" />
          <h3>{t("Seus próximos materiais aparecem aqui")}</h3>
          <p>
            {t(
              "Assim que seu professor(a) compartilhar um arquivo, você poderá acessá-lo nesta aba.",
            )}
          </p>
        </div>
      )}
    </section>
  );
}
