"use client";
import { useEffect } from "react";
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
        <strong>Acesso de suporte · {name}</strong>
        <small>{actor} · sessão de até 15 minutos · acesso registrado</small>
      </span>
      <ActionForm action={endSupportAccess}>
        <SubmitButton className="btn-xs" icon="logout">
          Encerrar acesso
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
