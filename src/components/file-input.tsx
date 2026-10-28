"use client";
import { useState, useRef, useEffect, type InputHTMLAttributes } from "react";
import { useI18n } from "./browser-preferences-provider";
export function FileInput({
  className = "",
  onChange,
  multiple,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  useEffect(() => {
    const form = input.current?.form;
    const reset = (event: Event) =>
      queueMicrotask(() => {
        if (!event.defaultPrevented) setName("");
      });
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);
  const { t } = useI18n();
  return (
    <div className={`file-control input ${className}`}>
      <span className="file-control-button" aria-hidden="true">
        {t("Selecionar arquivo")}
      </span>
      <span className="file-control-name" aria-hidden="true" title={name}>
        {name || t("Nenhum arquivo selecionado")}
      </span>
      <input
        {...props}
        ref={input}
        multiple={multiple}
        type="file"
        className="file-control-native"
        onChange={(event) => {
          const files = event.target.files;
          setName(
            files?.length
              ? Array.from(files)
                  .map((file) => file.name)
                  .join(", ")
              : "",
          );
          onChange?.(event);
          if (!event.target.files?.length) setName("");
        }}
      />
    </div>
  );
}
