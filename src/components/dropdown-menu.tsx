"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "./button";
import type { IconName } from "./icon";
export function DropdownMenu({
  label,
  items,
  disabled = false,
}: {
  label: string;
  disabled?: boolean;
  items: { label: string; icon: IconName; danger?: boolean; onSelect: () => void }[];
}) {
  const [open, setOpen] = useState(false),
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function outside(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div
      className="context-menu"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
        if (open && ["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          const buttons = Array.from(
            root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
          );
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? buttons.length - 1
                : (index + (e.key === "ArrowUp" ? -1 : 1) + buttons.length) % buttons.length;
          buttons[next]?.focus();
        }
      }}
    >
      <Button
        icon="more"
        variant="menu"
        className="icon-button"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          trigger.current = e.currentTarget;
          setOpen(!open);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            trigger.current = e.currentTarget;
            setOpen(true);
            requestAnimationFrame(() =>
              root.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus(),
            );
          }
        }}
      />
      {open && (
        <div role="menu" aria-label={label} className="context-menu-panel">
          {items.map((item) => (
            <Button
              key={item.label}
              role="menuitem"
              icon={item.icon}
              variant="menu"
              className={item.danger ? "menu-danger" : ""}
              onClick={() => {
                close();
                item.onSelect();
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
