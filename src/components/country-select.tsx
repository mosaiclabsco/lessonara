"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { PHONE_COUNTRIES } from "@/lib/phone-countries";
import { PHONE_COUNTRY_NAMES } from "@/lib/phone-country-names";
import { useI18n } from "./browser-preferences-provider";
const POPULAR = [
  "BR",
  "US",
  "PT",
  "GB",
  "ES",
  "FR",
  "DE",
  "IT",
  "CA",
  "AR",
  "MX",
  "CO",
  "CL",
  "AU",
  "JP",
  "CN",
  "IN",
  "NL",
  "CH",
  "UY",
];
const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export function CountrySelect({
  value,
  name,
  onChange,
}: {
  value: string;
  name?: string;
  onChange: (country: string) => void;
}) {
  const { t, locale } = useI18n();
  const { pending } = useFormStatus();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const id = useId();
  const countries = useMemo(
    () =>
      PHONE_COUNTRIES.map((country) => ({
        ...country,
        name: PHONE_COUNTRY_NAMES[locale][country.code] ?? country.name,
      })),
    [locale],
  );
  const selected = countries.find((country) => country.code === value)!;
  const matches = useMemo(() => {
    const q = normalized(query);
    if (q)
      return countries
        .filter(
          (country) => normalized(country.name).includes(q) || country.code.toLowerCase() === q,
        )
        .sort((a, b) => a.name.localeCompare(b.name, locale));
    const codes = POPULAR.includes(value) ? POPULAR : [value, ...POPULAR];
    return codes.map((code) => countries.find((country) => country.code === code)!).filter(Boolean);
  }, [countries, query, value, locale]);
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (open)
      document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function choose(code: string) {
    onChange(code);
    setQuery("");
    setActive(0);
    close();
  }
  return (
    <div className="country-select" ref={root}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={trigger}
        className="input country-trigger"
        type="button"
        disabled={pending}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-haspopup="listbox"
        aria-label={`${t("País do telefone")}: ${selected.name}`}
        title={selected.name}
        onClick={() => {
          setOpen(!open);
          setQuery("");
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive(0);
          }
        }}
      >
        <span aria-hidden="true">{selected.flag}</span>
        <span>+{selected.callingCode}</span>
        <span aria-hidden="true" className="country-chevron">
          ⌄
        </span>
      </button>
      {open && (
        <div className="country-popover">
          <label className="sr-only" htmlFor={`${id}-search`}>
            {t("Buscar país por nome")}
          </label>
          <input
            id={`${id}-search`}
            ref={search}
            className="input country-search"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            placeholder={t("Buscar país…")}
            aria-controls={`${id}-list`}
            aria-activedescendant={
              matches.length ? `${id}-option-${Math.min(active, matches.length - 1)}` : undefined
            }
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                close();
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive(Math.min(active + 1, matches.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive(Math.max(0, active - 1));
              } else if (event.key === "Enter") {
                event.preventDefault();
                const item = matches[Math.max(0, Math.min(active, matches.length - 1))];
                if (item) choose(item.code);
              } else if (event.key === "Tab") setOpen(false);
            }}
          />
          <p className="country-section-label">{t(query ? "Resultados" : "Países mais usados")}</p>
          <ul id={`${id}-list`} className="country-results" role="listbox" aria-label={t("Países")}>
            {matches.map((country, index) => (
              <li key={country.code}>
                <button
                  type="button"
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={country.code === value}
                  className={`country-option ${index === active ? "country-option-active" : ""}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(country.code)}
                >
                  <span aria-hidden="true">{country.flag}</span>
                  <span className="country-name">{country.name}</span>
                  <span className="country-code">+{country.callingCode}</span>
                  {country.code === value && <span aria-hidden="true">✓</span>}
                </button>
              </li>
            ))}
          </ul>
          {!matches.length && (
            <p role="status" className="country-empty">
              {t("Nenhum país encontrado.")}
            </p>
          )}
          {!query && (
            <p className="country-hint">{t("Digite o nome para encontrar outros países.")}</p>
          )}
        </div>
      )}
    </div>
  );
}
