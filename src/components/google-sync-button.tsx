"use client";
import { Dialog } from "./dialog";
import { Button } from "./button";
import { useState, useTransition } from "react";
import { useI18n } from "./browser-preferences-provider";
import { Icon } from "./icon";
import { BusyContent } from "./busy-content";
import { notify } from "./toast";
import { previewGoogleSync, syncGoogle } from "@/app/(panel)/settings/google-actions";
type Counts = { missing: number; pending: number; failed: number };
export function GoogleSyncButton({ counts }: { counts: Counts }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [phase, setPhase] = useState("");
  const [preview, setPreview] = useState(counts);
  const [open, setOpen] = useState(false);
  const total = counts.missing + counts.pending + counts.failed;
  return (
    <>
      <button
        type="button"
        className="btn-ghost"
        disabled={pending || !total}
        onClick={() => {
          setPhase("preview");
          start(async () => {
            try {
              const fresh = await previewGoogleSync();
              setPreview(fresh);
              if (!fresh.missing && !fresh.pending && !fresh.failed) {
                notify(t("Tudo sincronizado"));
                return;
              }
              setOpen(true);
            } catch {
              notify(t("Não foi possível consultar a sincronização."));
            }
          });
        }}
      >
        <BusyContent pending={pending && phase === "preview"}>
          <Icon name="calendar" className="h-4 w-4" />
          {t(
            !total
              ? "Tudo sincronizado"
              : counts.missing
                ? "Importar aulas existentes"
                : "Processar pendências",
          )}
        </BusyContent>
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("Confirmar sincronização")}
        busy={pending}
        description={t(
          "Serão processados {value0} agendamento(s) na agenda principal da conta Google conectada.",
          { value0: preview.missing + preview.pending + preview.failed },
        )}
        actions={
          <>
            <Button icon="close" disabled={pending} onClick={() => setOpen(false)}>
              {t("Cancelar")}
            </Button>
            <Button
              icon="calendar"
              variant="primary"
              pending={pending && phase === "sync"}
              disabled={pending}
              onClick={() => {
                setPhase("sync");
                start(async () => {
                  try {
                    await syncGoogle();
                    setOpen(false);
                    notify(t("Sincronização processada. Confira as pendências."));
                  } catch {
                    notify(t("Não foi possível sincronizar agora."));
                  }
                });
              }}
            >
              {t("Confirmar")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-warn leading-relaxed">
          {t(
            "Eventos reais e links Meet serão criados ou atualizados. Os alunos podem receber convites por email. Uma recorrência gera várias aulas.",
          )}
        </p>
      </Dialog>
    </>
  );
}
