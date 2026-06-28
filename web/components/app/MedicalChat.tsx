"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, X } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGERENCIAS = [
  "Diagnósticos diferenciales de dolor torácico",
  "Dosis de amoxicilina en adultos",
  "¿Qué CIE-10 uso para cefalea tensional?",
];

export function MedicalChat() {
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

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      const reply =
        data.reply ?? data.error ?? "No pude responder en este momento.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Error de conexión. Intenta de nuevo." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente clínico"
          className="fixed bottom-5 left-5 z-50 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-lg)] transition-transform hover:scale-105 hover:bg-accent-hover"
        >
          <Sparkles size={18} /> Asistente
        </button>
      ) : null}

      {open ? (
        <div className="fixed bottom-5 left-5 z-50 flex h-[min(560px,calc(100vh-2.5rem))] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-xl)]">
          <div className="flex items-center justify-between gap-2 bg-night px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                <Sparkles size={16} />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold">Asistente clínico</div>
                <div className="text-[11px] text-mist">
                  Apoyo · no reemplaza tu criterio
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar asistente"
              className="text-white/70 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto px-3.5 py-4"
          >
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted">
                  Hazme una pregunta clínica. Por ejemplo:
                </p>
                <div className="space-y-2">
                  {SUGERENCIAS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="block w-full rounded-lg border border-line px-3 py-2 text-left text-sm text-deep transition-colors hover:border-mist hover:bg-ice-soft"
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
            className="flex items-center gap-2 border-t border-line p-2.5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta…"
              className="min-w-0 flex-1 rounded-full border border-line px-3.5 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="Enviar"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
