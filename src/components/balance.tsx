"use client";
import { useI18n } from "@/components/browser-preferences-provider";
import { formatDate } from "@/lib/dates";
import type { Ledger } from "@/lib/ledger";
export function balanceTone(remaining: number) {
  if (remaining < 0) return "text-bad";
  if (remaining <= 1) return "text-bad";
  return "text-ok";
}
export function Balance({ ledger }: { ledger: Ledger }) {
  const { t, locale } = useI18n();
  const items = [
    {
      label: "Aulas restantes",
      value: String(ledger.remaining),
      tone: balanceTone(ledger.remaining),
    },
    { label: "Usadas", value: `${ledger.used} de ${ledger.credits}` },
    {
      label: "Pacote cobre até",
      value: ledger.coveredUntil ? formatDate(ledger.coveredUntil, locale).slice(0, 5) : "—",
    },
  ];
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((i) => (
          <div key={i.label} className="card p-3">
            <div className="text-xs text-muted">{t(i.label)}</div>
            <div className={`mt-1 text-2xl font-semibold tabular-nums ${i.tone ?? ""}`}>
              {i.value}
            </div>
          </div>
        ))}
      </div>
      {Boolean(ledger.openingCredits) && (
        <p className="mt-3 text-xs text-muted">
          Saldo inicial importado: {ledger.openingCredits} aulas. Não representa um pagamento
          registrado.
        </p>
      )}
    </div>
  );
}
