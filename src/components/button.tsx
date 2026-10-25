import Link from "next/link";
import type { ComponentProps, ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./icon";
import { BusyContent } from "./busy-content";
export function Button({
  children,
  icon,
  variant = "secondary",
  pending = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName;
  variant?: "primary" | "secondary" | "danger" | "menu";
  pending?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={pending || props.disabled}
      aria-busy={pending}
      className={`${variant === "menu" ? "menu-action" : variant === "primary" ? "btn" : "btn-ghost"} ${variant === "danger" ? "btn-danger" : ""} ${className}`}
    >
      <BusyContent pending={pending}>
        <Icon name={icon} className="h-4 w-4" />
        {children}
      </BusyContent>
    </button>
  );
}
export function ButtonLink({
  icon,
  variant = "secondary",
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & { icon: IconName; variant?: "primary" | "secondary" }) {
  return (
    <Link {...props} className={`${variant === "primary" ? "btn" : "btn-ghost"} ${className}`}>
      <Icon name={icon} className="h-4 w-4" />
      {children}
    </Link>
  );
}

export function FormActions({
  children,
  className = "",
  align = "split",
}: {
  children: ReactNode;
  align?: "split" | "start";
  className?: string;
}) {
  return (
    <div className={`form-actions ${align === "start" ? "form-actions-start" : ""} ${className}`}>
      {children}
    </div>
  );
}
