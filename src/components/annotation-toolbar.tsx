"use client";
import { Icon, type IconName } from "./icon";
import palette from "../../desktop/annotation-palette.json";
export type AnnotationTool = "select" | "pen" | "laser" | "text" | "eraser" | null;
const tools: { id: Exclude<AnnotationTool, null>; label: string; icon: IconName }[] = [
  { id: "select", label: "Mover texto", icon: "pointer" },
  { id: "pen", label: "Caneta", icon: "edit" },
  { id: "laser", label: "Laser", icon: "laser" },
  { id: "text", label: "Texto", icon: "text" },
  { id: "eraser", label: "Borracha", icon: "eraser" },
];
export function AnnotationToolbar({
  tool,
  color,
  onTool,
  onColor,
  onUndo,
  onClear,
  disabled = false,
  canUndo = false,
  fontSize = 24,
  onFontSize,
}: {
  tool: AnnotationTool;
  color: string;
  onTool: (tool: AnnotationTool) => void;
  onColor: (color: string) => void;
  onUndo: () => void;
  onClear: () => void;
  disabled?: boolean;
  canUndo?: boolean;
  fontSize?: number;
  onFontSize?: (size: number) => void;
}) {
  return (
    <div className="annotation-toolbar" role="toolbar" aria-label="Ferramentas do quadro">
      <div className="annotation-tools">
        {tools.map((item) => (
          <button
            key={item.id}
            type="button"
            className="btn-xs"
            aria-pressed={tool === item.id}
            disabled={disabled}
            onClick={() => onTool(tool === item.id ? null : item.id)}
          >
            <Icon name={item.icon} className="h-4 w-4" />
            {item.label}
          </button>
        ))}
        <button type="button" className="btn-xs" disabled={disabled || !canUndo} onClick={onUndo}>
          <Icon name="undo" className="h-4 w-4" />
          Desfazer
        </button>
        <button type="button" className="btn-xs" disabled={disabled} onClick={onClear}>
          <Icon name="trash" className="h-4 w-4" />
          Limpar
        </button>
        <button
          type="button"
          className="btn-xs"
          disabled={!tool}
          aria-label="Desativar ferramenta (Esc)"
          title="Desativar ferramenta (Esc)"
          onClick={() => onTool(null)}
        >
          <Icon name="close" className="h-4 w-4" />
          Esc
        </button>
      </div>
      {onFontSize && (tool === "text" || tool === "select") && (
        <label className="annotation-font-size">
          Tamanho da fonte
          <select
            className="input"
            aria-label="Tamanho da fonte"
            disabled={disabled}
            value={fontSize}
            onChange={(e) => onFontSize(Number(e.target.value))}
          >
            {[12, 16, 20, 24, 32, 40, 48, 60, 72].map((size) => (
              <option key={size} value={size}>
                {size} px
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="annotation-colors" role="group" aria-label="Cores de anotação">
        {palette.map((item) => (
          <button
            type="button"
            key={item.value}
            aria-label={item.label}
            title={item.label}
            aria-pressed={color === item.value}
            style={{ backgroundColor: item.value }}
            disabled={disabled}
            onClick={() => onColor(item.value)}
          />
        ))}
        <span>Selecione para mover · dois cliques para editar texto</span>
      </div>
    </div>
  );
}
