"use client";
import { useEffect, useState, useId } from "react";

export function notify(message: string) {
  window.dispatchEvent(
    new CustomEvent("lessonara:toast", { detail: { id: crypto.randomUUID(), message } }),
  );
}
export function Toast({ message }: { message: string }) {
  const id = useId();
  useEffect(() => {
    if (message)
      window.dispatchEvent(new CustomEvent("lessonara:toast", { detail: { id, message } }));
  }, [message, id]);
  return null;
}
export function ToastHost() {
  const [items, setItems] = useState<{ id: string; message: string }[]>([]);
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
          className={`toast-message ${/não|could not|no se|impossible|inválid|invalid|ocupado|já existe/i.test(item.message) ? "toast-error" : ""}`}
          role="status"
          key={item.id}
        >
          <span aria-hidden="true">
            {/não|could not|no se|impossible|inválid|invalid|ocupado|já existe/i.test(item.message)
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
