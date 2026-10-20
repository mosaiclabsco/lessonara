"use client";
import { useState, type InputHTMLAttributes } from "react";
import { parseMoney, moneyInput, maskMoney } from "@/lib/money";
import { useI18n } from "./browser-preferences-provider";
export function MoneyField({
  name,
  defaultValue,
  required = false,
  className = "input",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> & {
  name: string;
  defaultValue?: string | number | null;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(
    defaultValue == null || defaultValue === "" ? "" : moneyInput(Number(defaultValue)),
  );
  let amount: number | null = null;
  try {
    amount = parseMoney(value, !required);
  } catch {}
  return (
    <>
      <span className="money-field">
        <span className="money-prefix" aria-hidden="true">
          R$
        </span>
        <input
          {...props}
          className={className}
          type="text"
          inputMode="decimal"
          required={required}
          value={value}
          onChange={(e) => {
            const next = maskMoney(e.target.value);
            setValue(next);
            try {
              parseMoney(next, !required);
              e.target.setCustomValidity("");
            } catch (error) {
              e.target.setCustomValidity(t((error as Error).message));
            }
          }}
          onBlur={() => {
            if (amount !== null) setValue(moneyInput(amount));
          }}
        />
      </span>
      <input type="hidden" name={name} value={amount === null ? "" : amount.toFixed(2)} />
    </>
  );
}
