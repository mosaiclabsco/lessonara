"use client";
import { useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { BusyContent } from "./busy-content";
import { ConfirmDialog } from "./dialog";
import { Icon } from "./icon";
export function ConfirmButton({
  message,
  children,
  className = "btn-xs",
}: {
  message: string;
  children: ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus(),
    [open, setOpen] = useState(false),
    approved = useRef(false),
    button = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={button}
        type="submit"
        className={`${className} btn-danger`}
        disabled={pending}
        aria-busy={pending}
        onClick={(e) => {
          if (approved.current) {
            approved.current = false;
            return;
          }
          e.preventDefault();
          setOpen(true);
        }}
      >
        <BusyContent pending={pending}>
          <Icon name="trash" className="h-4 w-4" />
          {children}
        </BusyContent>
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Confirmar ação"
        message={message}
        confirmLabel={typeof children === "string" ? children : "Confirmar"}
        danger
        onConfirm={() => {
          setOpen(false);
          approved.current = true;
          button.current?.click();
        }}
      />
    </>
  );
}
