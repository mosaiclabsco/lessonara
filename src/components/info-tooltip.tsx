"use client";
import { useId, useState } from "react";
import { Icon } from "./icon";
export function InfoTooltip({ label, children }: { label: string; children: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className="info-tooltip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        <Icon name="info" className="h-4 w-4" />
      </button>
      <span id={id} role="tooltip" hidden={!open}>
        {children}
      </span>
    </span>
  );
}
