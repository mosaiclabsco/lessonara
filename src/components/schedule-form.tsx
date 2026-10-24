"use client";
import { Toast } from "./toast";
import { AvailabilityPreview } from "./availability-preview";
import { canConfigureNewSchedule } from "@/lib/schedule-rules";
import { firstPlannedDate } from "@/lib/plan-frequency";
import { useState, useRef, useTransition, useCallback, type FormEvent } from "react";
import { useI18n } from "./browser-preferences-provider";
import { BusyContent } from "./busy-content";
import { Icon } from "./icon";
import { formatDate, WEEKDAYS } from "@/lib/dates";
import type { Schedule } from "@/lib/ledger";
import { addSchedule } from "@/app/(panel)/actions";
import type { FrequencyPeriod, SchedulingMode } from "@/lib/plan-frequency";
export function ScheduleForm({
  studentId,
  schedules,
  frequency,
  today,
  appointments = [],
  duration = 60,
}: {
  duration?: number;
  studentId: string;
  schedules: Schedule[];
  frequency: { period: FrequencyPeriod; count: number; mode: SchedulingMode };
  today: string;
  limit?: number;
  appointments?: { id: string; date: string; time: string }[];
}) {
  const { t, locale } = useI18n();
  const [day, setDay] = useState(1);
  const [time, setTime] = useState("");
  const [startsOn, setStartsOn] = useState(today);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const running = useRef(false);
  const [revision, setRevision] = useState(0);
  const [available, setAvailable] = useState<string[]>([]);
  const ready = useCallback((times: string[]) => setAvailable(times), []);
  const flexible = frequency.mode === "flexible";
  const configured = !canConfigureNewSchedule(schedules, frequency.count);
  const month = startsOn.slice(0, 7);
  const planned = appointments.filter((a) => a.date.startsWith(month));
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || running.current || !available.includes(time)) return;
    running.current = true;
    const data = new FormData(e.currentTarget);
    setMessage("");
    start(async () => {
      try {
        const result = await addSchedule(studentId, data);
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        setTime("");
        setRevision((value) => value + 1);
        setMessage("Aula agendada.");
      } catch (error) {
        setMessage((error as Error).message || "Não foi possível agendar.");
      } finally {
        running.current = false;
      }
    });
  }
  if (!frequency.count)
    return (
      <p className="text-sm text-muted">
        {t("Escolha o plano do aluno para configurar os horários.")}
      </p>
    );
  if (!flexible && configured)
    return (
      <p className="text-xs text-muted">{t("Todos os horários do plano estão configurados.")}</p>
    );
  return (
    <div className="schedule-config">
      <h3 className="mb-4 text-sm font-semibold">
        {t(flexible ? "Agendar aula avulsa" : "Configurar novo horário")}
      </h3>
      <p className="mb-4 text-xs text-muted">
        {frequency.count} {t(frequency.period === "week" ? "aulas por semana" : "aulas por mês")}
        {flexible ? ` · ${planned.length} ${t("agendadas neste mês")}` : ""}
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={pending} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {!flexible && (
            <div>
              <label className="label">
                {t(frequency.period === "week" ? "Dia da semana" : "Dia do mês")}
              </label>
              <select
                className="input"
                name={frequency.period === "week" ? "weekday" : "monthly_day"}
                value={day}
                onChange={(e) => {
                  setDay(Number(e.target.value));
                  setTime("");
                  setAvailable([]);
                }}
              >
                {frequency.period === "week"
                  ? WEEKDAYS.map((name, index) => (
                      <option key={name} value={index}>
                        {t(name)}
                      </option>
                    ))
                  : Array.from({ length: 31 }, (_, i) => (
                      <option key={i} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">{t(flexible ? "Data da aula" : "A partir de")}</label>
            <input
              className="input"
              name={flexible ? "date" : "starts_on"}
              type="date"
              required
              value={startsOn}
              onChange={(e) => {
                setStartsOn(e.target.value);
                setTime("");
                setAvailable([]);
              }}
            />
          </div>
          <div>
            <label className="label">{t("Hora")}</label>
            <div className="input schedule-picked">{time || t("Selecione na agenda abaixo")}</div>
            <input type="hidden" name="time" value={time} />
          </div>
          <div className="flex items-end">
            <button className="btn w-full" disabled={pending || !available.includes(time)}>
              <BusyContent pending={pending}>
                <Icon name="plus" className="h-4 w-4" />
                {t("Agendar aula")}
              </BusyContent>
            </button>
          </div>
        </fieldset>
      </form>
      <AvailabilityPreview
        key={
          schedules.map((s) => `${s.id}/${s.starts_on}/${s.ends_on}/${s.time}`).join("|") +
          appointments.map((a) => `${a.id}/${a.date}/${a.time}`).join("|")
        }
        date={
          flexible ? startsOn || today : firstPlannedDate(startsOn || today, frequency.period, day)
        }
        disabled={pending}
        duration={duration}
        selected={time}
        revision={revision}
        onReady={ready}
        onPick={setTime}
      />
      {frequency.period === "month" && !flexible && (
        <p className="mt-3 text-xs text-muted">
          {t("Dias que não existem em um mês não geram aula naquele mês.")}
        </p>
      )}
      {flexible && planned.length > 0 && (
        <ul className="mt-4 text-xs text-muted">
          {planned.map((a) => (
            <li key={a.id} className="py-2 border-t border-line">
              {formatDate(a.date, locale)} · {a.time}
            </li>
          ))}
        </ul>
      )}
      {message && <Toast message={t(message)} />}
    </div>
  );
}
