"use client";
import { useEffect, useState } from "react";
export function useClassroomRejoin(href: string | null, afterEnd: boolean) {
  const [confirmed, setConfirmed] = useState<string | null>(null);
  useEffect(() => {
    if (!href || !afterEnd || !href.startsWith("/classroom/")) return;
    const abort = new AbortController();
    void fetch(`${href}/join`, { cache: "no-store", signal: abort.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((value) => {
        if (value?.canRejoin) setConfirmed(href);
      })
      .catch(() => {});
    return () => abort.abort();
  }, [href, afterEnd]);
  return confirmed === href && Boolean(href);
}
