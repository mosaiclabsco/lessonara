"use client";
import { useEffect, useState } from "react";
import type { DesktopState } from "@/lib/desktop-client";
import { Icon, type IconName } from "./icon";
const tools: { id: Exclude<DesktopState["tool"], null>; label: string; icon: IconName }[] = [
  { id: "select", label: "Mover texto", icon: "pointer" },
  { id: "pen", label: "Caneta", icon: "edit" },
  { id: "laser", label: "Laser", icon: "laser" },
  { id: "text", label: "Texto", icon: "text" },
  { id: "eraser", label: "Borracha", icon: "eraser" },
];
export function DesktopCallControls({
  joined,
  teacher,
  onCompact,
}: {
  joined: boolean;
  teacher: boolean;
  onCompact: (compact: boolean) => void;
}) {
  const [version, setVersion] = useState("");
  const [state, setState] = useState<DesktopState>({ compact: false, capture: null, tool: null });
  useEffect(() => {
    const bridge = window.lessonaraDesktop;
    if (!bridge?.onState) return;
    const cancel = bridge.onState((value) => {
      setState(value);
      onCompact(value.compact);
    });
    bridge.call({ joined, teacher });
    const ready = setTimeout(() => setVersion(bridge.version), 0);
    return () => {
      clearTimeout(ready);
      cancel();
      bridge.call({ joined: false, teacher: false });
    };
  }, [joined, teacher, onCompact]);
  if (!version) return null;
  return (
    <div className="desktop-call-controls">
      <a href="/calls" className="btn-xs">
        <Icon name="back" className="h-4 w-4" />
        Chamadas
      </a>
      <span className="desktop-control-spacer" />
      {joined && (
        <button
          className="btn-xs"
          onClick={() =>
            state.compact ? window.lessonaraDesktop?.restore() : window.lessonaraDesktop?.compact()
          }
        >
          <Icon name="video" className="h-4 w-4" />
          {state.compact ? "Voltar à sala" : "Janela flutuante"}
        </button>
      )}
      {teacher && joined && (
        <>
          {tools
            .filter((tool) => version !== "0.2.0" || !["eraser", "select"].includes(tool.id))
            .map((tool) => (
              <button
                key={tool.id}
                className="btn-xs"
                disabled={state.capture !== "screen"}
                aria-pressed={state.tool === tool.id}
                onClick={() =>
                  window.lessonaraDesktop?.tool(state.tool === tool.id ? null : tool.id)
                }
              >
                <Icon name={tool.icon} className="h-4 w-4" />
                {tool.label}
              </button>
            ))}
          <button
            aria-label="Desativar ferramenta"
            className="btn-xs"
            disabled={!state.tool}
            onClick={() => window.lessonaraDesktop?.tool(null)}
          >
            <Icon name="close" className="h-4 w-4" />
            Esc
          </button>
          <button
            className="btn-xs"
            disabled={state.capture !== "screen"}
            onClick={() => window.lessonaraDesktop?.clear()}
          >
            <Icon name="trash" className="h-4 w-4" />
            Limpar
          </button>
        </>
      )}
      {teacher && state.capture === "window" && (
        <small>Anotações externas: use Tela inteira.</small>
      )}
    </div>
  );
}
