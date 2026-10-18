import type {ButtonHTMLAttributes, ReactNode} from "react";
import {Icon, type IconName} from "./icon";
import {BusyContent} from "./busy-content";
export function Button({children,icon,variant="secondary",pending=false,className="",...props}:ButtonHTMLAttributes<HTMLButtonElement>&{icon:IconName;variant?:"primary"|"secondary"|"danger";pending?:boolean}) {
  return <button type="button" {...props} disabled={pending||props.disabled} aria-busy={pending} className={`${variant==="primary"?"btn":"btn-ghost"} ${variant==="danger"?"btn-danger":""} ${className}`}><BusyContent pending={pending}><Icon name={icon} className="h-4 w-4"/>{children}</BusyContent></button>;
}
export function FormActions({children,className=""}:{children:ReactNode;className?:string}) {return <div className={`form-actions ${className}`}>{children}</div>;}
