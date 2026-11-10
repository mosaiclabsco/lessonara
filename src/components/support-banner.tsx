"use client";
import { useEffect, useState } from "react";
import { useI18n } from "./browser-preferences-provider";
import { useRouter } from "next/navigation";
import { endSupportAccess } from "@/app/support/access/actions";
import { ActionForm, SubmitButton } from "./action-form";
export function SupportBanner({
  actor,
  name,
  expiresAt,
}: {
  actor: string;
  name: string;
  expiresAt: number;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil(expiresAt - Date.now() / 1000)));
    update();
    const timer = setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [expiresAt]);
  useEffect(() => {
    const timer = setTimeout(
      () => router.replace("/login?expired=1"),
      Math.max(0, Math.min(expiresAt * 1000 - Date.now(), 2147483647)),
    );
    return () => clearTimeout(timer);
  }, [expiresAt, router]);
  return (
    <div className="support-banner" role="status">
      <span>
        <strong>{t("Acesso de suporte · {value0}", { value0: name })}</strong>
        <small>
          {actor} · {t("Acesso registrado")}
        </small>
        <span
          className="support-countdown"
          role="timer"
          aria-live="off"
          aria-label={t("Tempo restante do acesso de suporte")}
        >
          {remaining === null
            ? "--:--"
            : `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`}{" "}
          · {t("Encerra automaticamente")}
        </span>
      </span>
      <ActionForm action={endSupportAccess}>
        <SubmitButton className="btn-xs" icon="logout">
          {t("Encerrar acesso")}
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
