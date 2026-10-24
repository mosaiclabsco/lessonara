"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DesktopCallControls } from "./desktop-call-controls";
import { ClassroomBoard } from "./classroom-board";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { RealtimeChannel } from "@supabase/supabase-js";

type JitsiApi = {
  addListener(
    event: string,
    callback: (data: {
      id?: string;
      on?: boolean;
      eventData?: { text?: string };
      isFatal?: boolean;
      error?: { isFatal?: boolean };
    }) => void,
  ): void;
  executeCommand(command: string, ...args: unknown[]): void;
  pinParticipant(id: string): void;
  dispose(): void;
};
declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => JitsiApi;
  }
}
type JoinResponse = {
  error?: string;
  opensAt?: string;
  closesAt?: string;
  jitsiUrl: string;
  roomName: string;
  jwt: string;
  displayName: string;
  role: "teacher" | "student";
  lesson: { title: string };
};

export function Classroom({ joinUrl, backHref }: { joinUrl: string; backHref: string }) {
  const container = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiApi | null>(null);
  const materialMessage = useRef<((text: string) => void) | null>(null);
  const materialChannel = useRef<RealtimeChannel | null>(null);
  const [channelName, setChannelName] = useState("");
  const [materialConnected, setMaterialConnected] = useState(false);
  const [compact, setCompact] = useState(false);
  const [joined, setJoined] = useState(false);
  const [role, setRole] = useState<"teacher" | "student">("student");
  const [boardOpen, setBoardOpen] = useState(false);
  const broadcast = useCallback((text: string) => {
    void materialChannel.current
      ?.send({ type: "broadcast", event: "material", payload: { text } })
      .catch(() => setMaterialConnected(false));
  }, []);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    message: string;
    window?: string;
    active?: boolean;
    left?: boolean;
    loading?: boolean;
  }>({ message: "Preparando sua aula…", loading: true });
  useEffect(() => {
    if (!state.active || !channelName) return;
    const client = createBrowserSupabase();
    // Only encrypted, occurrence-bound grants cross this opaque public topic.
    // Reading or publishing the material still requires the authenticated backend.
    const channel = client.channel(`lessonara-material:${channelName}`, {
      config: { broadcast: { self: false, ack: true } },
    });
    materialChannel.current = channel;
    channel
      .on("broadcast", { event: "material" }, ({ payload }) => {
        if (typeof payload?.text === "string" && payload.text.length <= 8500)
          materialMessage.current?.(payload.text);
      })
      .subscribe((status) => {
        setMaterialConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") {
          materialMessage.current?.(JSON.stringify({ t: "lessonara-pdf-request" }));
          broadcast(JSON.stringify({ t: "lessonara-pdf-request" }));
        }
      });
    return () => {
      materialChannel.current = null;
      void client.removeChannel(channel);
    };
  }, [state.active, channelName, broadcast]);
  useEffect(() => {
    const controller = new AbortController();
    let api: JitsiApi | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let script: HTMLScriptElement | null = null;
    const fail = (message: string) => {
      if (controller.signal.aborted) return;
      clearTimeout(timer);
      api?.dispose();
      api = null;
      apiRef.current = null;
      setJoined(false);
      setState({ message });
    };
    async function start() {
      timer = setTimeout(() => {
        fail("O servidor de vídeo não respondeu. Tente novamente.");
        controller.abort();
      }, 30_000);
      try {
        const response = await fetch(joinUrl, {
          method: "POST",
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as JoinResponse;
        if (controller.signal.aborted) return;
        if (!response.ok) {
          clearTimeout(timer);
          const format = (iso: string) =>
            new Intl.DateTimeFormat("pt-BR", {
              timeZone: "America/Sao_Paulo",
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(iso));
          setState({
            message: data.error ?? "Não foi possível entrar na aula.",
            window:
              data.opensAt && data.closesAt
                ? `Acesso de ${format(data.opensAt)} até ${format(data.closesAt)} (São Paulo).`
                : undefined,
          });
          return;
        }
        if (!window.JitsiMeetExternalAPI)
          await new Promise<void>((resolve, reject) => {
            script = document.createElement("script");
            script.src = `${data.jitsiUrl}/external_api.js`;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("video_unavailable"));
            document.head.appendChild(script);
            controller.signal.addEventListener("abort", () => reject(new Error("aborted")), {
              once: true,
            });
          });
        if (controller.signal.aborted || !container.current || !window.JitsiMeetExternalAPI) return;
        clearTimeout(timer);
        api = new window.JitsiMeetExternalAPI(new URL(data.jitsiUrl).host, {
          roomName: data.roomName,
          jwt: data.jwt,
          parentNode: container.current,
          width: "100%",
          height: "100%",
          lang: "pt-BR",
          userInfo: { displayName: data.displayName },
          configOverwrite: {
            whiteboard: { enabled: false },
            prejoinConfig: { enabled: true },
            disableDeepLinking: true,
            startWithAudioMuted: true,
            startWithVideoMuted: true,
          },
        });
        apiRef.current = api;
        setRole(data.role);
        setChannelName(data.roomName);
        api.addListener("participantJoined", () =>
          materialMessage.current?.(JSON.stringify({ t: "lessonara-pdf-request" })),
        );
        setState({ message: "Conectando à sala…", active: true });
        let myId: string | undefined;
        api.addListener("videoConferenceJoined", ({ id }) => {
          clearTimeout(timer);
          myId = id;
          setJoined(true);
          void (async () => {
            for (let attempt = 0; attempt < 3 && !controller.signal.aborted; attempt++) {
              try {
                const saved = await fetch(joinUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ op: "joined" }),
                  cache: "no-store",
                  signal: controller.signal,
                });
                if (saved.ok || saved.status < 500) return;
              } catch {
                if (controller.signal.aborted) return;
              }
              await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
            }
          })();
          api?.executeCommand("localSubject", data.lesson.title);
          materialMessage.current?.(JSON.stringify({ t: "lessonara-pdf-request" }));
          broadcast(JSON.stringify({ t: "lessonara-pdf-request" }));
        });
        api.addListener("errorOccurred", ({ error, isFatal }) => {
          if (isFatal || error?.isFatal)
            fail("Não foi possível conectar à videochamada. Tente novamente.");
        });
        api.addListener("screenSharingStatusChanged", ({ on }) => {
          if (!on) window.lessonaraDesktop?.captureStopped?.();
          if (on && myId && !window.lessonaraDesktop) api?.pinParticipant(`${myId}-v1`);
        });
        api.addListener("readyToClose", () => {
          clearTimeout(timer);
          api?.dispose();
          api = null;
          apiRef.current = null;
          if (!controller.signal.aborted) {
            setJoined(false);
            setState({ message: "Você saiu da aula.", left: true });
          }
        });
        // Pré-entrada pode permanecer aberta enquanto a pessoa escolhe seus dispositivos.
        timer = setTimeout(() => {
          if (!container.current?.querySelector("iframe"))
            fail("O servidor de vídeo não respondeu.");
        }, 30_000);
      } catch {
        fail("Não foi possível carregar a sala. Verifique sua conexão e tente novamente.");
      }
    }
    void start();
    return () => {
      controller.abort();
      clearTimeout(timer);
      api?.dispose();
      apiRef.current = null;
      script?.remove();
    };
  }, [joinUrl, attempt, broadcast]);
  useEffect(() => {
    if (!joined) return;
    apiRef.current?.executeCommand("setTileView", compact);
  }, [compact, joined]);
  return (
    <main
      className={`classroom-screen ${boardOpen && state.active ? "board-presenting" : ""} ${compact ? "desktop-compact" : ""}`}
    >
      <DesktopCallControls joined={joined} teacher={role === "teacher"} onCompact={setCompact} />
      {state.active && (
        <ClassroomBoard
          key={joinUrl}
          endpoint={joinUrl.replace(/\/join$/, "/material")}
          teacher={role === "teacher"}
          connected={materialConnected}
          messageRef={materialMessage}
          broadcast={broadcast}
          onOpen={setBoardOpen}
        />
      )}
      <div ref={container} className="classroom-video" hidden={!state.active} />
      {!state.active && (
        <section className="classroom-state" role="status">
          {state.loading ? (
            <p className="flex items-center justify-center gap-3">
              <span className="action-spinner" aria-hidden="true" />
              {state.message}
            </p>
          ) : (
            <h1>{state.message}</h1>
          )}
          {state.window && <p>{state.window}</p>}
          {!state.loading && (
            <div className="flex flex-wrap justify-center gap-3">
              <button
                className="btn"
                onClick={() => {
                  setState({ message: "Preparando sua aula…", loading: true });
                  setAttempt((a) => a + 1);
                }}
              >
                {state.left ? "Entrar novamente" : "Tentar novamente"}
              </button>
              <Link className="btn-ghost" href={backHref}>
                Voltar ao meu espaço
              </Link>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
