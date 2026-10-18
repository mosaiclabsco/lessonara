import type { SVGProps } from "react";

export type IconName = "menu" | "close" | "chevron" | "edit" | "more" | "up" | "down" | "chart" | "grid" | "users" | "calendar" | "settings" | "arrow" | "plus" | "search" | "book" | "logout" | "clock" | "check" | "download" | "language" | "sun" | "moon" | "archive" | "trash" | "mail" | "chat" | "copy" | "save" | "video";
const paths: Record<IconName, string> = {
 menu:"M3 6h18 M3 12h18 M3 18h18",close:"M6 6l12 12 M6 18L18 6",chevron:"M6 9l6 6 6-6",edit:"M15 4l5 5 M4 20l4-1 12-12-4-4L4 15z",more:"M5 12h.01 M12 12h.01 M19 12h.01",up:"M6 14l6-6 6 6",down:"M6 10l6 6 6-6",
  video:"M3 5h12v14H3z M15 9l6-4v14l-6-4",
  archive:"M3 3h18v5H3z M5 8v13h14V8 M9 12h6",
  trash:"M3 6h18 M8 6V3h8v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
  mail:"M3 4h18v16H3z M3 5l9 7 9-7",
  chat:"M3 3h18v14H9l-6 4z",
  copy:"M8 8h13v13H8z M16 8V3H3v13h5",
  save:"M3 3h15l3 3v15H3z M7 3v6h10V3 M7 21v-8h10v8",
  download:"M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5",
  language:"M3 5h12 M9 3v2 M5 5c0 5 4 9 9 11 M13 5c0 5-4 9-9 11 M14 21l4-10 4 10 M16 17h4",
  sun:"M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1",
  moon:"M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11",
  chart: "M3 3v18h18 M7 14l4-4 4 3 5-7",
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  calendar: "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2 M8 14h2 M14 14h2 M8 18h2",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z",
  arrow: "M5 12h14 M14 7l5 5-5 5",
  plus: "M12 5v14 M5 12h14",
  search: "M21 21l-5-5 M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15",
  book: "M12 5v16 M12 5C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 1",
  logout: "M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4 M9 12h12 M16 7l5 5-5 5",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2",
  check: "M5 12l4 4L19 6",
};
export function Icon({ name, className = "h-5 w-5", ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
