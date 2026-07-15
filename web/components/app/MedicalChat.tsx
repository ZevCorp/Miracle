"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Send, Sparkles, X } from "lucide-react";
import {
  ClinicalApiError,
  friendlyClinicalMessage,
  sendAssistantChat,
} from "@/lib/api/clinical";

type Msg = { role: "user" | "assistant"; content: string };

const SUGERENCIAS = [
  "Diagnósticos diferenciales de dolor torácico",
  "Dosis de amoxicilina en adultos",
  "¿Qué CIE-10 uso para cefalea tensional?",
];

export function MedicalChat({ embedded = false }: { embedded?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading, open]);

  // Habla directo con el asistente clínico del backend Miracle (token Supabase
  // del médico). Respuesta completa (sin streaming): el indicador de "puntos"
  // cubre la espera.
  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const history = messages;
    setMessages((m) => [...m, { role: "user", content }]);
    setInput("");
    setLoading(true);
    try {
      const result = await sendAssistantChat({
        message: content,
        history,
        screen_context: pathname ? { route: pathname } : undefined,
      });
      const reply = result.answer?.trim() || "No pude responder en este momento.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (error) {
      const reply =
        error instanceof ClinicalApiError && error.code === "LLM_NOT_CONFIGURED"
          ? "El asistente todavía no está habilitado para tu institución. Mientras tanto puedes seguir registrando tus consultas con normalidad."
          : friendlyClinicalMessage(error);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } finally {
      setLoading(false);
    }
  }

  // Durante una consulta activa el asistente se muestra embebido en el panel
  // lateral de la pantalla, no como una ventana flotante duplicada.
  if (!embedded && (pathname === "/app/consultas/en-vivo" || pathname === "/app/plantillas")) return null;

  const visible = embedded || open;
  const panelClass = embedded
    ? `${open ? "fixed inset-0 z-[80] flex h-dvh w-full" : "hidden"} flex-col overflow-hidden bg-surface xl:static xl:flex xl:h-[min(590px,calc(100vh-8rem))] xl:min-h-[460px] xl:w-auto xl:rounded-[14px] xl:border xl:border-line xl:shadow-[var(--shadow-xs)]`
    : "fixed inset-0 z-[80] flex h-dvh w-full flex-col overflow-hidden bg-surface sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(560px,calc(100vh-2.5rem))] sm:w-[min(380px,calc(100vw-2.5rem))] sm:rounded-[16px] sm:border sm:border-line sm:shadow-[var(--shadow-lg)]";

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente clínico"
          className={`fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] left-3 z-50 inline-flex min-h-12 items-center gap-2 rounded-[12px] border border-line bg-surface px-4 py-3 text-sm font-semibold text-deep shadow-[var(--shadow-md)] active:scale-[0.98] md:bottom-5 md:left-auto md:right-5 md:hover:border-mist md:hover:bg-ice-soft ${embedded ? "xl:hidden" : ""}`}
        >
          <Sparkles size={18} className="text-accent" /> <span className="hidden min-[360px]:inline">Asistente</span>
        </button>
      ) : null}

      {visible ? (
        <div className={panelClass}>
          <div className="flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-3.5 text-deep">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent-soft text-accent">
                <Sparkles size={17} />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold">Asistente clínico</div>
                <div className="text-[12px] text-muted">
                  Apoyo clínico con IA
                </div>
              </div>
            </div>
            {!embedded || open ? (
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar asistente"
                title="Cerrar asistente"
                className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-muted hover:bg-ice-soft hover:text-deep"
              >
                <X size={18} />
              </button>
            ) : null}
          </div>

          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto px-3.5 py-4"
          >
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted">
                  Pregunta sobre diagnóstico, codificación o manejo clínico.
                </p>
                <div className="space-y-2">
                  {SUGERENCIAS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="block min-h-11 w-full rounded-[10px] border border-line px-3 py-2 text-left text-sm text-deep transition-colors hover:border-mist hover:bg-ice-soft"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user" ? "flex justify-end" : "flex justify-start"
                  }
                >
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-accent text-white"
                        : "border border-line bg-pearl text-ink"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}
            {loading ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl border border-line bg-pearl px-3.5 py-3">
                  {[0, 0.15, 0.3].map((d) => (
                    <span
                      key={d}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
                      style={{ animationDelay: `${d}s`, animationDuration: "0.8s" }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="mobile-bottom-sheet flex items-center gap-2 border-t border-line p-2.5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta…"
              aria-label="Pregunta para el asistente clínico"
              className="clinical-control min-w-0 flex-1 px-3.5 text-base outline-none sm:text-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="Enviar pregunta"
              title="Enviar pregunta al asistente"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
