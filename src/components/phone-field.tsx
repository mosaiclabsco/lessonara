"use client";
import { Toast } from "./toast";
import { useI18n } from "@/components/browser-preferences-provider";
import { useEffect, useRef, useState } from "react";
import { CountrySelect } from "./country-select";
import { formatPhoneInput, initialPhone, normalizeStudentPhone, phoneCountry } from "@/lib/phone";
export function PhoneField({
  id,
  name,
  defaultValue,
  defaultCountry,
  onChange,
  autoFocus = false,
}: {
  id: string;
  name?: string;
  defaultValue?: string | null;
  defaultCountry?: string | null;
  onChange?: (value: string, country: string) => void;
  autoFocus?: boolean;
}) {
  const { t } = useI18n();
  const initial = initialPhone(defaultValue, defaultCountry);
  const [country, setCountry] = useState(initial.country);
  const [value, setValue] = useState(initial.value);
  const [touched, setTouched] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  let error = "";
  try {
    normalizeStudentPhone(value, country);
  } catch (cause) {
    error = (cause as Error).message;
  }
  useEffect(() => {
    input.current?.setCustomValidity(error);
  }, [error]);
  function update(raw: string, nextCountry = country) {
    const next = formatPhoneInput(raw, nextCountry);
    setCountry(next.country);
    setValue(next.value);
    onChange?.(next.value, next.country);
  }
  return (
    <div>
      <div className="phone-field">
        <CountrySelect
          name={name ? `${name}_country` : undefined}
          value={country}
          onChange={(code) => {
            const selected = phoneCountry(code);
            const digits = value.replace(/\D/g, "");
            setTouched(false);
            setCountry(selected);
            const formatted = formatPhoneInput(digits, selected).value;
            setValue(formatted);
            onChange?.(formatted, selected);
          }}
        />
        <input
          ref={input}
          suppressHydrationWarning
          id={id}
          name={name}
          className="input phone-number"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          autoFocus={autoFocus}
          value={value}
          placeholder={t("N\u00FAmero com c\u00F3digo de \u00E1rea")}
          aria-invalid={touched && Boolean(error)}
          aria-describedby={touched && error ? `${id}-error` : undefined}
          onBlur={() => {
            setTouched(true);
            const parsed = initialPhone(value, country);
            setValue(parsed.value);
          }}
          onChange={(event) => {
            let raw = event.target.value;
            if (
              event.target.selectionStart === raw.length &&
              raw.length < value.length &&
              raw.replace(/\D/g, "") === value.replace(/\D/g, "")
            )
              raw = raw.replace(/\D/g, "").slice(0, -1);
            update(raw);
          }}
        />
      </div>
      {touched && error && <Toast message={t(error)} />}
    </div>
  );
}
