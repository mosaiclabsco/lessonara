"use client";
import { useEffect, useRef, useState, type RefObject, type PointerEvent } from "react";
import {
  emptyMaterial,
  type MaterialState,
  type PdfPoint,
  type PdfStroke,
} from "@/lib/classroom-material";
import { AnnotationToolbar, type AnnotationTool } from "./annotation-toolbar";
import { Icon } from "./icon";
import { notify } from "./toast";

type Snapshot = { token: string; state: MaterialState; issuedAt: number; title: string };
export function ClassroomBoard({
  endpoint,
  teacher,
  connected,
  messageRef,
  broadcast,
  onOpen,
}: {
  endpoint: string;
  teacher: boolean;
  connected: boolean;
  messageRef: RefObject<((text: string) => void) | null>;
  broadcast: (text: string) => void;
  onOpen: (open: boolean) => void;
}) {
  const [state, setState] = useState<MaterialState>(emptyMaterial),
    stateRef = useRef(state);
  const [tool, setTool] = useState<AnnotationTool>(null),
    [color, setColor] = useState("#e5484d"),
    [busy, setBusy] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [entry, setEntry] = useState<{
    id: string;
    x: number;
    y: number;
    text: string;
    color: string;
  } | null>(null);
  const token = useRef(""),
    issued = useRef(0),
    mounted = useRef(true),
    pending = useRef(false),
    queue = useRef<MaterialState | null>(null),
    publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chunks = useRef(new Map<string, { parts: string[]; total: number; at: number }>());
  const drawing = useRef<PdfStroke | null>(null),
    drag = useRef<{ id: string; dx: number; dy: number } | null>(null),
    erasing = useRef(false),
    history = useRef<MaterialState[]>([]);
  const page = useRef<HTMLDivElement>(null),
    [size, setSize] = useState({ width: 1000, height: 625 }),
    [clock, setClock] = useState(0);
  const active = state.board;
  async function api(op: string, extra: Record<string, unknown> = {}) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op, ...extra }),
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível atualizar o quadro.");
    return data;
  }
  function announce(value: string) {
    const id = crypto.randomUUID(),
      total = Math.ceil(value.length / 8000);
    for (let index = 0; index < total; index++)
      broadcast(
        JSON.stringify({
          t: "lessonara-pdf",
          id,
          index,
          total,
          part: value.slice(index * 8000, (index + 1) * 8000),
        }),
      );
  }
  function apply(snapshot: Snapshot) {
    if (snapshot.issuedAt < issued.current) return;
    issued.current = snapshot.issuedAt;
    token.current = snapshot.token;
    stateRef.current = snapshot.state;
    setState(snapshot.state);
  }
  async function flush() {
    if (pending.current || !queue.current || !teacher) return;
    const next = queue.current;
    queue.current = null;
    pending.current = true;
    try {
      const saved = (await api("publish", { state: next })) as Snapshot;
      if (mounted.current) {
        token.current = saved.token;
        issued.current = saved.issuedAt;
        announce(saved.token);
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : "Não foi possível sincronizar o quadro.");
    } finally {
      pending.current = false;
      if (queue.current && mounted.current) void flush();
    }
  }
  function update(next: MaterialState) {
    stateRef.current = next;
    setState(next);
    queue.current = next;
    if (!publishTimer.current)
      publishTimer.current = setTimeout(() => {
        publishTimer.current = null;
        void flush();
      }, 120);
  }
  function checkpoint() {
    history.current.push(structuredClone(stateRef.current));
    if (history.current.length > 30) history.current.shift();
    setCanUndo(true);
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (publishTimer.current) clearTimeout(publishTimer.current);
    };
  }, []);
  useEffect(() => {
    onOpen(active);
  }, [active, onOpen]);
  useEffect(() => {
    messageRef.current = (text) => {
      try {
        const message = JSON.parse(text);
        if (message.t === "lessonara-pdf-request") {
          if (token.current) announce(token.current);
          return;
        }
        if (
          message.t !== "lessonara-pdf" ||
          typeof message.id !== "string" ||
          message.id.length > 80 ||
          !Number.isInteger(message.total) ||
          message.total < 1 ||
          message.total > 20 ||
          !Number.isInteger(message.index) ||
          message.index < 0 ||
          message.index >= message.total ||
          typeof message.part !== "string" ||
          message.part.length > 8000
        )
          return;
        for (const [id, value] of chunks.current)
          if (Date.now() - value.at > 10000) chunks.current.delete(id);
        if (!chunks.current.has(message.id)) {
          if (chunks.current.size >= 5) return;
          chunks.current.set(message.id, { parts: [], total: message.total, at: Date.now() });
        }
        const value = chunks.current.get(message.id)!;
        if (value.total !== message.total) return;
        value.parts[message.index] = message.part;
        if (
          Array.from({ length: value.total }, (_, i) => typeof value.parts[i] === "string").every(
            Boolean,
          )
        ) {
          chunks.current.delete(message.id);
          const received = value.parts.join("");
          if (received === token.current) return;
          void api("read", { token: received })
            .then((snapshot: Snapshot) => {
              if (mounted.current && !pending.current && !queue.current && !drawing.current)
                apply(snapshot);
            })
            .catch(() => {});
        }
      } catch {}
    };
    broadcast(JSON.stringify({ t: "lessonara-pdf-request" }));
    return () => {
      messageRef.current = null;
    };
    // The transport callback always reads refs so it does not restart while drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, teacher, messageRef]);
  useEffect(() => {
    if (!active || !page.current) return;
    const box = page.current;
    const observer = new ResizeObserver(() =>
      setSize({ width: box.clientWidth, height: box.clientHeight }),
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setClock(Date.now()), 40);
    return () => clearInterval(timer);
  }, [active]);
  async function open(board: boolean) {
    setBusy(true);
    queue.current = null;
    if (publishTimer.current) {
      clearTimeout(publishTimer.current);
      publishTimer.current = null;
    }
    while (pending.current) await new Promise((resolve) => setTimeout(resolve, 40));
    pending.current = true;
    try {
      const saved = (await api("publish", { state: { ...emptyMaterial(), board } })) as Snapshot;
      apply(saved);
      history.current = [];
      setCanUndo(false);
      announce(saved.token);
      setTool(null);
      setEntry(null);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Não foi possível abrir o quadro.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function point(event: PointerEvent<SVGSVGElement>): PdfPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    ];
  }
  function textAt(event: { target: EventTarget }) {
    const id = (event.target as Element).closest("[data-text-id]")?.getAttribute("data-text-id");
    return stateRef.current.texts.find((text) => text.id === id);
  }
  function distance(p: PdfPoint, a: PdfPoint, b: PdfPoint) {
    const px = p[0] * size.width,
      py = p[1] * size.height,
      ax = a[0] * size.width,
      ay = a[1] * size.height,
      dx = (b[0] - a[0]) * size.width,
      dy = (b[1] - a[1]) * size.height;
    const length = dx * dx + dy * dy,
      t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)) : 0;
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }
  function erase(event: PointerEvent<SVGSVGElement>) {
    const p = point(event),
      text = textAt(event);
    update({
      ...stateRef.current,
      texts: stateRef.current.texts.filter((item) => item.id !== text?.id),
      strokes: stateRef.current.strokes.filter(
        (stroke) =>
          !stroke.points.some((a, index) => distance(p, a, stroke.points[index + 1] ?? a) < 12),
      ),
    });
  }
  function down(event: PointerEvent<SVGSVGElement>) {
    if (!teacher || !tool || busy) return;
    event.preventDefault();
    const [x, y] = point(event),
      text = textAt(event);
    if (tool === "text") {
      setEntry(
        text
          ? { ...text, color: text.color ?? color }
          : { id: crypto.randomUUID(), x, y, text: "", color },
      );
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "select") {
      if (text) {
        checkpoint();
        drag.current = { id: text.id, dx: x - text.x, dy: y - text.y };
      }
      return;
    }
    if (tool !== "laser") checkpoint();
    if (tool === "eraser") {
      erasing.current = true;
      erase(event);
      return;
    }
    drawing.current = {
      id: crypto.randomUUID(),
      page: 1,
      kind: tool,
      at: Date.now(),
      points: [[x, y]],
      ...(tool === "laser" ? { times: [Date.now()] } : {}),
      color,
    };
    setState({
      ...stateRef.current,
      strokes: [...stateRef.current.strokes.filter((s) => s.kind !== "laser"), drawing.current],
    });
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    if (erasing.current) {
      erase(event);
      return;
    }
    const p = point(event);
    if (drag.current) {
      const dragState = drag.current;
      const next = {
        ...stateRef.current,
        texts: stateRef.current.texts.map((text) =>
          text.id === dragState.id
            ? {
                ...text,
                x: Math.max(0, Math.min(0.98, p[0] - dragState.dx)),
                y: Math.max(0, Math.min(0.96, p[1] - dragState.dy)),
              }
            : text,
        ),
      };
      stateRef.current = next;
      setState(next);
      return;
    }
    const stroke = drawing.current;
    if (!stroke || stroke.points.length >= 500) return;
    stroke.points = [...stroke.points, p];
    if (stroke.kind === "laser") stroke.times = [...(stroke.times ?? []), Date.now()];
    stroke.at = Date.now();
    const next = {
      ...stateRef.current,
      strokes: [
        ...stateRef.current.strokes.filter((s) => s.id !== stroke.id && s.kind !== "laser"),
        stroke,
      ],
    };
    setState(next);
    if (stroke.kind === "laser") update(next);
  }
  function end() {
    if (drag.current) {
      drag.current = null;
      update(stateRef.current);
    }
    erasing.current = false;
    if (!drawing.current) return;
    const stroke = drawing.current;
    drawing.current = null;
    update({
      ...stateRef.current,
      strokes: [
        ...stateRef.current.strokes.filter((s) => s.id !== stroke.id && s.kind !== "laser"),
        stroke,
      ],
    });
  }
  function stop() {
    end();
    setTool(null);
    setEntry(null);
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") stop();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  function saveText() {
    if (!entry) return;
    if (entry.text.trim()) {
      checkpoint();
      const text = { ...entry, text: entry.text.trim(), page: 1 };
      update({
        ...stateRef.current,
        texts: [...stateRef.current.texts.filter((item) => item.id !== text.id), text],
      });
    }
    setEntry(null);
  }
  return (
    <>
      <div className="classroom-material-toolbar">
        <strong>{active ? "Quadro" : "Sala de aula"}</strong>
        <span role="status" className="text-xs text-muted">
          {connected ? "Sincronização conectada" : "Conectando sincronização…"}
        </span>
        {teacher && (
          <button className="btn-xs" disabled={busy} onClick={() => void open(!active)}>
            <Icon name={active ? "close" : "board"} className="h-4 w-4" />
            {active ? "Fechar quadro" : "Abrir quadro"}
          </button>
        )}
        {!teacher && active && (
          <span className="text-xs text-muted">Professor apresentando · somente leitura</span>
        )}
      </div>
      {active && (
        <section className="classroom-board-panel" aria-label="Quadro da aula">
          {teacher && (
            <AnnotationToolbar
              tool={tool}
              color={color}
              disabled={busy}
              canUndo={canUndo}
              onTool={(value) => {
                end();
                setEntry(null);
                setTool(value);
              }}
              onColor={setColor}
              onUndo={() => {
                const previous = history.current.pop();
                if (previous) update(previous);
                setCanUndo(history.current.length > 0);
              }}
              onClear={() => {
                checkpoint();
                update({ ...stateRef.current, strokes: [], texts: [] });
              }}
            />
          )}
          <div className="classroom-board-scroll">
            <div ref={page} className="classroom-board-page">
              <svg
                viewBox={`0 0 ${size.width} ${size.height}`}
                className={`classroom-board-overlay ${teacher && tool ? "board-drawing" : ""}`}
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
                onDoubleClick={(event) => {
                  if (!teacher || !(tool === "select" || tool === "text")) return;
                  const text = textAt(event);
                  if (text) setEntry({ ...text, color: text.color ?? color });
                }}
                aria-label="Anotações do professor"
              >
                {state.strokes.map((stroke) =>
                  stroke.kind === "laser" ? (
                    <g key={stroke.id}>
                      {stroke.points.slice(1).map((p, index) => {
                        const alpha = Math.max(
                          0,
                          1 - (clock - (stroke.times?.[index] ?? stroke.at)) / 850,
                        );
                        return alpha > 0 ? (
                          <line
                            key={index}
                            x1={stroke.points[index][0] * size.width}
                            y1={stroke.points[index][1] * size.height}
                            x2={p[0] * size.width}
                            y2={p[1] * size.height}
                            stroke={stroke.color ?? "#e5484d"}
                            strokeOpacity={alpha * alpha}
                            strokeWidth="4"
                            strokeLinecap="round"
                          />
                        ) : null;
                      })}
                    </g>
                  ) : (
                    <polyline
                      key={stroke.id}
                      points={stroke.points
                        .map(([x, y]) => `${x * size.width},${y * size.height}`)
                        .join(" ")}
                      stroke={stroke.color ?? "#e5484d"}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  ),
                )}
                {state.texts.map((text) => (
                  <text
                    key={text.id}
                    data-text-id={text.id}
                    x={text.x * size.width}
                    y={text.y * size.height}
                    dominantBaseline="hanging"
                    fill={text.color ?? "#e5484d"}
                    fontSize="24"
                  >
                    {text.text}
                  </text>
                ))}
              </svg>
              {entry && teacher && (
                <input
                  autoFocus
                  className="annotation-text-input"
                  style={{
                    left: `${entry.x * 100}%`,
                    top: `${entry.y * 100}%`,
                    color: entry.color,
                    borderColor: entry.color,
                  }}
                  aria-label="Texto da anotação"
                  placeholder="Texto e Enter"
                  maxLength={200}
                  value={entry.text}
                  onChange={(event) => setEntry({ ...entry, text: event.target.value })}
                  onBlur={saveText}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      saveText();
                    }
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      setEntry(null);
                      setTool(null);
                    }
                  }}
                />
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
