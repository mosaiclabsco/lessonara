import type { InputHTMLAttributes } from "react";
export function FileInput({
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <input {...props} type="file" className={`input file-input ${className}`} />;
}
