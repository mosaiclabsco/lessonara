"use client";
import { useEffect, useState, useId } from "react";

export function notify(message: string, kind?: "success" | "error") {
  window.dispatchEvent(
    new CustomEvent("lessonara:toast", { detail: { id: crypto.randomUUID(), message, kind } }),
  );
}
export function Toast({ message, kind }: { message: string; kind?: "success" | "error" }) {
  const id = useId();
  useEffect(() => {
    if (message)
      window.dispatchEvent(new CustomEvent("lessonara:toast", { detail: { id, message, kind } }));
  }, [message, id, kind]);
  return null;
}
export function ToastHost() {
  const [items, setItems] = useState<{ id: string; message: string; kind?: "success" | "error" }[]>(
    [],
  );
  useEffect(() => {
    const listener = (event: Event) => {
      const item = (event as CustomEvent).detail;
      setItems((previous) => [...previous.filter((p) => p.id !== item.id), item].slice(-3));
    };
    window.addEventListener("lessonara:toast", listener);
    return () => window.removeEventListener("lessonara:toast", listener);
  }, []);
  useEffect(() => {
    if (!items.length) return;
    const timer = setTimeout(() => setItems((previous) => previous.slice(1)), 6000);
    return () => clearTimeout(timer);
  }, [items]);
  return (
    <div className="toast-stack" aria-live="polite">
      {items.map((item) => (
        <div
          className={`toast-message ${item.kind === "error" || (item.kind !== "success" && /não|could not|no se|impossible|inválid|invalid|ocupado|já existe/i.test(item.message)) ? "toast-error" : ""}`}
          role="status"
          key={item.id}
        >
          <span aria-hidden="true">
            {item.kind === "error" ||
            (item.kind !== "success" &&
              /não|could not|no se|impossible|inválid|invalid|ocupado|já existe/i.test(
                item.message,
              ))
              ? "!"
              : "✓"}
          </span>
          <span>{item.message}</span>
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setItems((previous) => previous.filter((p) => p.id !== item.id))}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
