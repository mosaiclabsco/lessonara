"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
type API = {
  render: (target: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: API;
  }
}
export function AccessChallenge({ resetKey }: { resetKey: unknown }) {
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const host = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!sitekey || !ready || !host.current || !window.turnstile) return;
    const api = window.turnstile;
    widget.current = api.render(host.current, {
      sitekey,
      theme: "auto",
      size: "flexible",
      action: "teacher-login",
      "response-field": false,
      callback: (value: string) => {
        setToken(value);
        setFailed(false);
      },
      "expired-callback": () => setToken(""),
      "error-callback": () => {
        setToken("");
        setFailed(true);
      },
    });
    return () => {
      if (widget.current) api.remove(widget.current);
      widget.current = undefined;
    };
  }, [sitekey, ready]);
  useEffect(() => {
    if (widget.current && window.turnstile) {
      window.turnstile.reset(widget.current);
      setToken("");
    }
  }, [resetKey]);
  if (!sitekey) return null;
  return (
    <div>
      <Script
        id="lessonara-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setReady(true)}
        onError={() => setFailed(true)}
      />
      <div ref={host} />
      <input type="hidden" name="captchaToken" value={token} />
      {failed && (
        <p role="alert" className="text-sm text-bad">
          Não foi possível carregar a verificação. Atualize a página e tente novamente.
        </p>
      )}
    </div>
  );
}
