"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, RefreshCw, Send, Sparkles, X } from "lucide-react";
import {
  ClinicalApiError,
  friendlyClinicalMessage,
  sendAssistantChat,
} from "@/lib/api/clinical";

type Msg = { role: "user" | "assistant"; content: string };

/** Fallo de la última pregunta. Vive aparte de `messages` a propósito. */
type Failure = {
  /** Se guarda para poder reintentar sin que el médico la reescriba. */
  question: string;
  /** Código del backend; se muestra para que se pueda reportar. */
  code: string;
  message: string;
  retryable: boolean;
};

/**
 * Códigos que valen la pena reintentar: fallos transitorios del backend o de
 * la red. Los demás (asistente no configurado, sesión expirada, mensaje
 * inválido) no se arreglan repitiendo, así que ahí no se ofrece el botón.
 */
const RETRYABLE_CODES = new Set([
  "ASSISTANT_FAILED",
  "ASSISTANT_EMPTY",
  "RATE_LIMITED",
  "NETWORK_ERROR",
  "INTERNAL_ERROR",
]);

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
  const [failure, setFailure] = useState<Failure | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading, failure, open]);

  /**
   * Habla directo con el asistente clínico del backend Miracle (token Supabase
   * del médico). Respuesta completa (sin streaming): el indicador de "puntos"
   * cubre la espera.
   *
   * El fallo NUNCA entra en `messages`, y eso importa por dos razones. En
   * pantalla, un error pintado como burbuja del asistente es indistinguible de
   * una respuesta clínica real. Y hacia el backend, `messages` es el `history`
   * de la siguiente pregunta: meter ahí "no pude responder" envenenaba el
   * contexto de toda la conversación posterior.
   */
  async function ask(content: string, history: Msg[]) {
    setLoading(true);
    try {
      const result = await sendAssistantChat({
        message: content,
        history,
        screen_context: pathname ? { route: pathname } : undefined,
      });
      const reply = result.answer?.trim();
      if (!reply) {
        // 200 con cuerpo vacío: para el médico es un fallo, no una respuesta.
        setFailure({
          question: content,
          code: "ASSISTANT_EMPTY",
          message: "El asistente respondió sin contenido.",
          retryable: true,
        });
        return;
      }
      setMessages([...history, { role: "user", content }, { role: "assistant", content: reply }]);
    } catch (error) {
      const code = error instanceof ClinicalApiError ? error.code : "INTERNAL_ERROR";
      // La pregunta se conserva en pantalla: el médico ve qué preguntó y puede
      // reintentar sin volver a escribirla.
      setMessages([...history, { role: "user", content }]);
      setFailure({
        question: content,
        code,
        message:
          code === "LLM_NOT_CONFIGURED"
            ? "El asistente todavía no está habilitado para tu institución. Mientras tanto puedes seguir registrando tus consultas con normalidad."
            : friendlyClinicalMessage(error),
        retryable: RETRYABLE_CODES.has(code),
      });
    } finally {
      setLoading(false);
    }
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    setInput("");
    setFailure(null);
    await ask(content, messages);
  }

  async function retry() {
    if (!failure || loading) return;
    // `messages` termina en la pregunta que falló: el historial es todo menos ella.
    const history = messages.slice(0, -1);
    const question = failure.question;
    setFailure(null);
    await ask(question, history);
  }

  // Durante una consulta activa el asistente se muestra embebido en el panel
  // lateral de la pantalla, no como una ventana flotante duplicada.
  if (!embedded && (pathname === "/app/consultas/en-vivo" || pathname === "/app/plantillas")) return null;

  const visible = embedded || open;

  // Embebido en el panel lateral, el alto se ajusta a lo que hay dentro:
  // sin conversación el panel solo mide lo que ocupan las sugerencias, así
  // el campo "Escribe tu pregunta…" queda a la vista sin bajar la página.
  // Al empezar a conversar sí toma un alto fijo y el historial hace scroll.
  const hasConversation = messages.length > 0 || loading;
  const embeddedHeight = hasConversation
    ? "xl:h-[min(460px,calc(100vh-13rem))] xl:min-h-[320px]"
    : "xl:h-auto";
  const panelClass = embedded
    ? `${open ? "fixed inset-0 z-[80] flex h-dvh w-full" : "hidden"} flex-col overflow-hidden bg-surface xl:static xl:flex xl:w-auto xl:rounded-[14px] xl:border xl:border-line xl:shadow-[var(--shadow-xs)] ${embeddedHeight}`
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
          <div className="flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-3.5 text-deep xl:py-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent-soft text-accent xl:h-8 xl:w-8">
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
            className={`flex-1 space-y-3 overflow-y-auto px-3.5 py-4 xl:py-3 ${
              hasConversation ? "" : "xl:basis-auto"
            }`}
          >
            {messages.length === 0 ? (
              <div className="space-y-2.5">
                <p className="text-[13px] leading-snug text-muted">
                  Pregunta sobre diagnóstico, codificación o manejo clínico.
                </p>
                <div className="space-y-2">
                  {SUGERENCIAS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="block min-h-11 w-full rounded-[10px] border border-line px-3 py-2 text-left text-sm text-deep transition-colors hover:border-mist hover:bg-ice-soft xl:min-h-0 xl:py-1.5 xl:text-[13px]"
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

            {/* Deliberadamente NO es una burbuja del asistente: un fallo con la
                misma forma que una respuesta clínica se lee como si la IA
                hubiera contestado eso. */}
            {failure && !loading ? (
              <div role="alert" className="flex justify-start">
                <div className="max-w-[92%] rounded-2xl border border-warning/40 bg-warning-soft px-3.5 py-2.5">
                  <p className="flex items-start gap-1.5 text-sm leading-relaxed text-warning">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>{failure.message}</span>
                  </p>
                  {failure.retryable ? (
                    <button
                      type="button"
                      onClick={() => void retry()}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-surface px-3 py-1.5 text-xs font-semibold text-warning hover:bg-warning-soft"
                    >
                      <RefreshCw size={12} /> Reintentar
                    </button>
                  ) : null}
                  <p className="mt-1.5 text-[11px] text-warning/70">
                    Código: {failure.code}
                  </p>
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
