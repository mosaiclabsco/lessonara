"use client";
import { Toast } from "./toast";
import { useEffect, useState, useTransition } from "react";
import { useI18n } from "./browser-preferences-provider";
import { cancelLesson, addReposicao } from "@/app/(panel)/actions";
import { BusyContent } from "./busy-content";
import { Icon } from "./icon";
import { TimeField } from "./time-field";
export function CancelLessonButton({
  studentId,
  date,
  time,
}: {
  studentId: string;
  date: string;
  time: string;
  today: string;
}) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <>
      <button
        className="btn-xs btn-warning"
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              const source = await cancelLesson(studentId, date, time);
              window.dispatchEvent(
                new CustomEvent("lessonara-replacement", { detail: { studentId, source } }),
              );
            } catch (cause) {
              setError((cause as Error).message);
            }
          })
        }
      >
        <BusyContent pending={pending}>
          <Icon name="calendar" className="h-4 w-4" />
          {t("desmarcar")}
        </BusyContent>
      </button>
      {error && <Toast message={t(error)} />}
    </>
  );
}
export function ReplacementPrompt({ studentId, today }: { studentId: string; today: string }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<{ studentId: string; source: string }>).detail;
      if (detail.studentId === studentId) {
        setSource(detail.source);
        setError("");
      }
    };
    window.addEventListener("lessonara-replacement", receive);
    return () => window.removeEventListener("lessonara-replacement", receive);
  }, [studentId]);
  return source ? (
    <div className="whatsapp-overlay">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t("Agendar reposição")}
        className="card whatsapp-dialog"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !pending) setSource(null);
        }}
      >
        <div className="section-heading">
          <h2>{t("Agendar reposição")}</h2>
          <button
            className="btn-xs"
            type="button"
            disabled={pending}
            onClick={() => setSource(null)}
          >
            {t("Fechar")}
          </button>
        </div>
        <p className="mt-3 text-sm text-muted">
          {t(
            "A aula foi desmarcada. Você pode agendar a reposição agora ou fechar e fazer isso depois.",
          )}
        </p>
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            start(async () => {
              try {
                await addReposicao(studentId, data);
                setSource(null);
                setError("");
              } catch (cause) {
                setError((cause as Error).message);
              }
            });
          }}
        >
          <input type="hidden" name="source_event_id" value={source} />
          <label className="label">{t("Data da reposição")}</label>
          <input
            className="input"
            type="date"
            name="date"
            min={today}
            required
            defaultValue={today}
          />
          <label className="label">{t("Hora")}</label>
          <TimeField id={`replacement-${source}`} />
          <input className="input" name="note" placeholder={t("Observação (opcional)")} />
          <button className="btn" disabled={pending}>
            <BusyContent pending={pending}>
              <Icon name="calendar" className="h-4 w-4" />
              {t("Agendar reposição")}
            </BusyContent>
          </button>
          {error && <Toast message={t(error)} />}
        </form>
      </section>
    </div>
  ) : null;
}
