"use client";
import { useEffect, useState, useRef } from "react";
import { slotOccupancy } from "@/lib/availability-slot";
import { teacherAvailability } from "@/app/(panel)/availability/actions";
import { useI18n } from "./browser-preferences-provider";
import { Icon } from "./icon";
export function AvailabilityPreview({
  date,
  duration = 60,
  selected,
  revision = 0,
  disabled = false,
  onPick,
  onReady,
}: {
  date: string;
  duration?: number;
  selected: string;
  revision?: number;
  disabled?: boolean;
  onPick: (time: string) => void;
  onReady: (times: string[]) => void;
}) {
  const { t } = useI18n();
  const list = useRef<HTMLDivElement>(null);
  const [early, setEarly] = useState(false);
  const [result, setResult] = useState<{
    key: string;
    data: Awaited<ReturnType<typeof teacherAvailability>>;
  } | null>(null);
  const [error, setError] = useState("");
  const key = `${date}/${revision}`;
  const data = result?.key === key ? result.data : null;
  useEffect(() => {
    let active = true;
    teacherAvailability(date)
      .then((value) => {
        if (active) setResult({ key, data: value });
      })
      .catch(() => {
        if (active) setError(key);
      });
    return () => {
      active = false;
    };
  }, [date, key]);
  const slots = Array.from({ length: 48 }, (_, i) => {
    const minutes = i * 30;
    const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    const starts = Date.parse(`${date}T${time}:00-03:00`);
    const occupancy = slotOccupancy(data?.busy ?? [], starts, duration);
    return { time, minutes, occupancy };
  }).filter((slot) => slot.minutes + duration <= 1440 && (early || slot.minutes >= 480));
  const available =
    data && !data.googleError
      ? slots.filter((slot) => !slot.occupancy.blocked).map((slot) => slot.time)
      : [];
  const signature = available.join(",");
  useEffect(() => {
    onReady(signature ? signature.split(",") : []);
  }, [signature, onReady]);
  return (
    <details className="mini-agenda mt-5" open>
      <summary className="text-sm text-accent cursor-pointer">
        {t("Ver disponibilidade do dia")}
      </summary>
      <p className="mt-2 text-xs text-muted">
        {t("Escolha o início da aula. Cada opção reserva {value0} minutos.", { value0: duration })}
      </p>
      {error === key ? (
        <p role="alert">{t("Não foi possível consultar a agenda.")}</p>
      ) : !data ? (
        <div className="agenda-loading" role="status">
          <span className="action-spinner" />
          <span>{t("Carregando agenda…")}</span>
        </div>
      ) : (
        <>
          <label className="mini-agenda-early">
            <input
              type="checkbox"
              checked={early}
              onChange={(event) => setEarly(event.target.checked)}
            />
            {t("Mostrar horários antes das 08:00")}
          </label>
          <div ref={list} className="mini-agenda-slots">
            {slots.map(({ time, minutes, occupancy }) => (
              <button
                type="button"
                key={time}
                aria-pressed={time === selected}
                disabled={disabled || occupancy.blocked || data.googleError}
                className={`mini-agenda-slot ${occupancy.blocked ? "mini-agenda-busy" : time === selected ? "mini-agenda-selected" : "mini-agenda-free"}`}
                onClick={() => onPick(time)}
              >
                <span>
                  <small>{t("Início")}</small>
                  {time} —{" "}
                  {`${String(Math.floor((minutes + duration) / 60)).padStart(2, "0")}:${String((minutes + duration) % 60).padStart(2, "0")}`}
                </span>
                <span>
                  {occupancy.blocked
                    ? occupancy.names.length
                      ? occupancy.names.join(" · ")
                      : t(
                          occupancy.reason === "lesson"
                            ? "Bloqueado · sobrepõe outra aula"
                            : "Bloqueado · ocupado no Google",
                        )
                    : t(time === selected ? "Selecionado" : "Livre")}
                </span>
                <Icon
                  name={occupancy.blocked ? "clock" : time === selected ? "check" : "plus"}
                  className="h-4 w-4"
                />
              </button>
            ))}
          </div>
          {data.googleError && (
            <p role="alert" className="mt-2 text-xs text-warn">
              {t("Não foi possível confirmar os horários livres no Google. Tente novamente.")}
            </p>
          )}
        </>
      )}
    </details>
  );
}
