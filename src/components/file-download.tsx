"use client";
import { Icon } from "./icon";
export function FileDownload({
  href,
  label,
  name,
  disabled = false,
}: {
  href: string;
  label: string;
  name?: string;
  disabled?: boolean;
}) {
  const content = (
    <>
      <Icon name="download" className="h-4 w-4 shrink-0" />
      <span>
        {label}
        {name && (
          <>
            {" "}
            · <strong>{name}</strong>
          </>
        )}
      </span>
    </>
  );
  return disabled ? (
    <span className="btn-ghost file-download file-download-disabled" aria-disabled="true">
      {content}
    </span>
  ) : (
    <a className="btn-ghost file-download" href={href} target="_blank" rel="noreferrer">
      {content}
    </a>
  );
}
