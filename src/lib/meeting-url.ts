export function safeMeetUrl(value: unknown) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && url.hostname === "meet.google.com" ? url.href : null;
  } catch {
    return null;
  }
}
