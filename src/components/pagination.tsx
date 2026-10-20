"use client";
import { useI18n } from "./browser-preferences-provider";
import { Icon } from "./icon";
export function Pagination({
  page,
  count,
  size,
  onChange,
}: {
  page: number;
  count: number;
  size: number;
  onChange: (page: number) => void;
}) {
  const { t } = useI18n();
  const pages = Math.ceil(count / size);
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label={t("Paginação")}>
      <span>
        {t("Página {value0} de {value1}", { value0: page + 1, value1: pages })} · {count}
      </span>
      <button
        type="button"
        className="btn-ghost"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        <Icon name="arrow" className="h-4 w-4 rotate-180" />
        {t("Anterior")}
      </button>
      <button
        type="button"
        className="btn-ghost"
        disabled={page === pages - 1}
        onClick={() => onChange(page + 1)}
      >
        {t("Próxima")}
        <Icon name="arrow" className="h-4 w-4" />
      </button>
    </nav>
  );
}
