"use client";
import { useI18n } from "@/components/browser-preferences-provider";
import { useState } from "react";
export function TimeField({
  name = "time",
  id,
  defaultValue = "",
  value,
  onChange,
}: {
  name?: string;
  id: string;
  defaultValue?: string;
  value?: string;
  onChange?: (time: string) => void;
}) {
  const { t } = useI18n();
  const [hour, setHour] = useState(defaultValue.slice(0, 2));
  const [minute, setMinute] = useState(defaultValue.slice(3, 5) === "30" ? "30" : "00");
  const shownHour = value === undefined ? hour : value.slice(0, 2);
  const shownMinute = value === undefined ? minute : value.slice(3, 5) || "00";
  return (
    <div className="time-field">
      <select
        id={id}
        className="input"
        aria-label={t("Hora da aula")}
        required
        value={shownHour}
        onChange={(event) => {
          setHour(event.target.value);
          onChange?.(event.target.value + ":" + shownMinute);
        }}
      >
        <option value="">{t("Hora")}</option>
        {Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0")).map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <span aria-hidden="true">{t(":")}</span>
      <select
        className="input"
        aria-label={t("Minutos da aula")}
        value={shownMinute}
        onChange={(event) => {
          setMinute(event.target.value);
          onChange?.(shownHour + ":" + event.target.value);
        }}
      >
        <option value="00">{t("00")}</option>
        <option value="30">{t("30")}</option>
      </select>
      <input type="hidden" name={name} value={shownHour ? `${shownHour}:${shownMinute}` : ""} />
    </div>
  );
}
