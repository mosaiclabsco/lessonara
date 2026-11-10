"use client";
import { useState, useTransition, useId } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink, FormActions } from "./button";
import { Dialog, ConfirmDialog } from "./dialog";
import { useI18n } from "./browser-preferences-provider";
import { formatDate } from "@/lib/dates";
import { notify } from "./toast";
import {
  listGoogleLessons,
  previewGoogleLesson,
  linkGoogleLesson,
  unlinkGoogleLesson,
} from "@/app/(panel)/students/google-link-actions";
import type {
  GoogleLessonChoice,
  GoogleLessonLink,
  GoogleLessonInstance,
} from "@/lib/google/lesson-links";
function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
type Preview = {
  title: string;
  recurring: boolean;
  until: string;
  instances: GoogleLessonInstance[];
};
export function GoogleLessonLinker({
  studentId,
  today,
  enabled,
  links,
}: {
  studentId: string;
  today: string;
  enabled: boolean;
  links: GoogleLessonLink[];
}) {
  const { t, locale } = useI18n(),
    router = useRouter(),
    id = useId();
  const [open, setOpen] = useState(false),
    [pending, start] = useTransition();
  const [from, setFrom] = useState(today),
    [choices, setChoices] = useState<GoogleLessonChoice[] | null>(null),
    [selected, setSelected] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null),
    [error, setError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  function run(work: () => Promise<void>) {
    setError("");
    start(async () => {
      try {
        await work();
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível consultar os eventos Google. Tente novamente.",
        );
      }
    });
  }
  return (
    <div className="space-y-4">
      {enabled && (
        <Button
          icon="calendar"
          onClick={() => {
            setOpen(true);
            setChoices(null);
            setPreview(null);
            setSelected("");
            setError("");
          }}
        >
          {t("Vincular aula do Google")}
        </Button>
      )}
      {links.map((link) => (
        <div key={link.id} className="rounded-xl border border-line p-4 space-y-3">
          <div>
            <strong>{link.title === "Evento sem título" ? t(link.title) : link.title}</strong>
            <p className="text-sm text-muted">
              {t("Gerenciado no Google Calendar")} ·{" "}
              {t(link.recurring ? "Série recorrente" : "Aula avulsa")} · {t("A partir de")}{" "}
              {formatDate(link.starts_on, locale)}
            </p>
          </div>
          {link.last_error && (
            <p className="text-sm text-warn" role="status">
              {t(link.last_error)}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <ButtonLink
              icon="calendar"
              href="https://calendar.google.com/calendar/u/0/r"
              target="_blank"
              rel="noreferrer"
            >
              {t("Abrir no Google Calendar")}
            </ButtonLink>
            <Button icon="close" onClick={() => setRemoving(link.id)}>
              {t("Desvincular do Lessonara")}
            </Button>
          </div>
        </div>
      ))}
      <Dialog
        open={open}
        busy={pending}
        onClose={() => setOpen(false)}
        title={t("Vincular aula do Google")}
        description={t(
          "Escolha um evento da agenda principal. O evento, os convidados e o link original serão preservados.",
        )}
      >
        <div className="space-y-5">
          <div>
            <label className="label" htmlFor={id}>
              {t("A partir de")}
            </label>
            <input
              id={id}
              className="input"
              type="date"
              min={today}
              value={from}
              disabled={pending}
              onChange={(e) => {
                setFrom(e.target.value);
                setChoices(null);
                setPreview(null);
                setSelected("");
              }}
            />
          </div>
          <Button
            icon="search"
            pending={pending}
            onClick={() =>
              run(async () => {
                setChoices(unwrap(await listGoogleLessons(studentId, from)));
                setSelected("");
                setPreview(null);
              })
            }
          >
            {t("Buscar eventos Google")}
          </Button>
          {choices && (
            <div>
              <label className="label" htmlFor={`${id}-event`}>
                {t("Evento do Google")}
              </label>
              <select
                id={`${id}-event`}
                className="input"
                disabled={pending}
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setPreview(null);
                  setError("");
                }}
              >
                <option value="">{t("Selecione um evento")}</option>
                {choices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title === "Evento sem título" ? t(c.title) : c.title} ·{" "}
                    {formatDate(c.date, locale)} {c.time} ·{" "}
                    {t(c.recurring ? "Série recorrente" : "Aula avulsa")}
                  </option>
                ))}
              </select>
              {!choices.length && (
                <p className="mt-2 text-sm text-muted">
                  {t(
                    "Nenhum evento disponível nos próximos 90 dias. Eventos já vinculados não aparecem nesta lista.",
                  )}
                </p>
              )}
            </div>
          )}
          {selected && !preview && (
            <Button
              icon="calendar"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  setPreview(unwrap(await previewGoogleLesson(studentId, selected, from)));
                })
              }
            >
              {t("Revisar aulas do vínculo")}
            </Button>
          )}
          {preview && (
            <div className="rounded-xl border border-line p-4 space-y-3">
              <strong>{preview.title}</strong>
              <p className="text-sm">
                {t("{value0} aulas futuras até {value1}", {
                  value0: preview.instances.length,
                  value1: formatDate(preview.until, locale),
                })}
              </p>
              <ul className="max-h-48 overflow-y-auto text-sm divide-y divide-line">
                {preview.instances.map((i) => (
                  <li key={i.id} className="py-2">
                    {formatDate(i.date, locale)} · {i.time} · {i.duration} {t("minutos")}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted">
                {t(
                  "Nenhuma presença anterior será criada. As próximas aulas seguem sua configuração de presença manual ou automática.",
                )}
              </p>
              <p className="text-sm text-muted">
                {t(
                  "Novas ocorrências serão atualizadas periodicamente. Conflitos e limites do plano são verificados ao confirmar.",
                )}
              </p>
            </div>
          )}
          {error && (
            <p className="text-sm text-bad" role="alert">
              {t(error)}
            </p>
          )}
          <FormActions>
            <Button icon="close" disabled={pending} onClick={() => setOpen(false)}>
              {t("Cancelar")}
            </Button>
            <Button
              icon="check"
              variant="primary"
              pending={pending}
              disabled={!preview?.instances.length}
              onClick={() =>
                run(async () => {
                  unwrap(await linkGoogleLesson(studentId, selected, from));
                  setOpen(false);
                  notify(t("Aula vinculada. O evento Google foi preservado."));
                  router.refresh();
                })
              }
            >
              {t("Confirmar vínculo")}
            </Button>
          </FormActions>
        </div>
      </Dialog>
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        pending={pending}
        title="Desvincular do Lessonara"
        message="O evento continuará no Google Calendar. As aulas futuras deste vínculo sairão do Lessonara; o histórico será preservado."
        confirmLabel="Desvincular"
        onConfirm={() => {
          start(async () => {
            try {
              unwrap(await unlinkGoogleLesson(studentId, removing!));
              setRemoving(null);
              notify(t("Vínculo removido. O evento continua no Google."));
              router.refresh();
            } catch {
              notify(t("Não foi possível desvincular a aula."));
            }
          });
        }}
      />
    </div>
  );
}
