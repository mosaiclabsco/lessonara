// Keep the supplied SVG artwork intact; these local images do not need raster optimization.
/* eslint-disable @next/next/no-img-element */
export function Logo({ className = "h-9 w-auto" }: { className?: string }) {
  return (
    <img
      src="/brand/complete-logo.svg"
      width={162}
      height={36}
      alt="Lessonara"
      className={`lessonara-logo ${className}`}
    />
  );
}
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <img
      src="/brand/logo.svg"
      width={36}
      height={36}
      alt=""
      aria-hidden="true"
      className={className}
    />
  );
}
