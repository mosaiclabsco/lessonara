import { classroomRefValid } from "./classroom";
export const DESKTOP_RELEASE_URL =
  "https://github.com/gabrielgoncalvesr/lessonara-downloads/releases/download/desktop-v0.3.1/Lessonara-0.3.1-mac-arm64.zip";
export const DESKTOP_WINDOWS_RELEASE_URL =
  "https://github.com/gabrielgoncalvesr/lessonara-downloads/releases/download/desktop-v0.3.1/Lessonara-0.3.1-windows-x64-setup.exe";
export function desktopClassroomHref(path: string) {
  const match = path.match(
    /^\/classroom\/([^/]+)\/(schedule|appointment|makeup)\/([^/]+)\/(\d{4}-\d{2}-\d{2})$/,
  );
  if (!match) return null;
  const ref = {
    studentId: match[1],
    sourceKind: match[2] as "schedule" | "appointment" | "makeup",
    sourceId: match[3],
    date: match[4],
  };
  return classroomRefValid(ref) ? `lessonara://${path.slice(1)}` : null;
}
