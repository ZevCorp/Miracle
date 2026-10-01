"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, RefreshCw, Send, Sparkles, X } from "lucide-react";
import {
  ClinicalApiError,
  friendlyClinicalMessage,
  sendAssistantChat,
  type AssistantChatMessage,
  type AssistantChatResult,
} from "@/lib/api/clinical";
import { buildDoctorContext } from "@/lib/preferences/assistant";
import { useUserPreferences } from "@/lib/preferences/client";
import { useAssistantContext, type AssistantEncounterContext } from "@/lib/assistant/context";
import { buildAssistantChatPayload } from "@/lib/assistant/payload";
import { normalizeAssistantResult, type AssistantTurnData } from "@/lib/assistant/normalize";
import { starterQuestions } from "@/lib/assistant/starters";
import { AssistantTurnCard, type ProposalState } from "@/components/app/AssistantTurnCard";

type UserTurn = { role: "user"; content: string };
type AssistantTurn = {
  role: "assistant";
  /** El texto de la respuesta: es lo único que vuelve a viajar como historial. */
  content: string;
  data: AssistantTurnData;
  proposalState: ProposalState;
};
type Turn = UserTurn | AssistantTurn;

/** Fallo de la última pregunta. Vive aparte de `turns` a propósito. */
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
  "TIMEOUT",
  "INTERNAL_ERROR",
]);

/** Al backend solo viaja el texto de cada turno, nunca la estructura. */
function toHistory(turns: Turn[]): AssistantChatMessage[] {
  return turns.map((turn) => ({ role: turn.role, content: turn.content }));
}

function contextLabel(context: AssistantEncounterContext | null): string {
  if (!context) return "Sin consulta abierta";
  if (context.encounterId) return "Con contexto de esta consulta";
  return "Con la nota en pantalla";
}

export function MedicalChat({
  embedded = false,
  open: openProp,
  onOpenChange,
}: {
  embedded?: boolean;
  /** Modo controlado (lo usa el dock del shell); sin estas props el estado
   *  sigue siendo interno, como siempre lo fue en el modo embebido. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const { preferences, firstName, specialtyCode } = useUserPreferences();
  // Lo que la página de la consulta publicó: nota en pantalla, códigos,
  // paciente (edad/sexo), si la nota admite cambios y cómo aplicarlos.
  const context = useAssistantContext();
  const [openInterno, setOpenInterno] = useState(false);
  const open = openProp ?? openInterno;
  const setOpen = onOpenChange ?? setOpenInterno;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<number | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Encounters que Graph no conoce (consulta anterior al puente, supervisor):
  // tras un ENCOUNTER_NOT_FOUND se recuerdan para no gastar dos llamadas por
  // turno contra el límite de 20 por minuto.
  const sinBackend = useRef(new Set<string>());

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, loading, failure, open]);

  const starters = useMemo(
    () =>
      starterQuestions({
        hasEncounter: Boolean(context?.encounterId || context?.note),
        hasNote: Boolean(context?.note),
        hasTranscript: Boolean(context?.hasTranscript),
        specialtyCode: context?.specialtyCode ?? specialtyCode ?? null,
      }),
    [context, specialtyCode],
  );

  /**
   * Habla con el asistente clínico del backend Miracle (token Supabase del
   * médico). Respuesta completa (sin streaming): el indicador de "puntos"
   * cubre la espera.
   *
   * El fallo NUNCA entra en `turns`, y eso importa por dos razones. En
   * pantalla, un error pintado como burbuja del asistente es indistinguible de
   * una respuesta clínica real. Y hacia el backend, `turns` es el `history`
   * de la siguiente pregunta: meter ahí "no pude responder" envenenaba el
   * contexto de toda la conversación posterior.
   */
  async function ask(content: string, history: Turn[]) {
    setLoading(true);
    try {
      const doctor = buildDoctorContext(preferences, firstName);
      const payloadContext = context
        ? {
            encounterId: context.encounterId,
            specialtyCode: context.specialtyCode,
            note: context.note,
            codes: context.codes,
            patient: context.patient,
            editable: context.editable,
          }
        : null;
      const base = { message: content, history: toHistory(history), pathname, specialtyCode, doctor, context: payloadContext };
      const encounterId = context?.encounterId ?? null;
      const includeEncounter = Boolean(encounterId) && !sinBackend.current.has(encounterId!);

      let result: AssistantChatResult;
      try {
        result = await sendAssistantChat(buildAssistantChatPayload({ ...base, includeEncounter }));
      } catch (error) {
        // Graph no tiene este encounter (o no es de este médico): se pregunta
        // igual con la nota en pantalla y los códigos, una sola vez más.
        if (includeEncounter && error instanceof ClinicalApiError && error.code === "ENCOUNTER_NOT_FOUND") {
          sinBackend.current.add(encounterId!);
          result = await sendAssistantChat(buildAssistantChatPayload({ ...base, includeEncounter: false }));
        } else {
          throw error;
        }
      }

      const data = normalizeAssistantResult(result);
      if (!data.answer) {
        // 200 con cuerpo vacío: para el médico es un fallo, no una respuesta.
        setFailure({
          question: content,
          code: "ASSISTANT_EMPTY",
          message: "El asistente respondió sin contenido.",
          retryable: true,
        });
        return;
      }
      setTurns([
        ...history,
        { role: "user", content },
        { role: "assistant", content: data.answer, data, proposalState: "pendiente" },
      ]);
    } catch (error) {
      const code = error instanceof ClinicalApiError ? error.code : "INTERNAL_ERROR";
      // La pregunta se conserva en pantalla: el médico ve qué preguntó y puede
      // reintentar sin volver a escribirla.
      setTurns([...history, { role: "user", content }]);
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
    await ask(content, turns);
  }

  async function retry() {
    if (!failure || loading) return;
    // `turns` termina en la pregunta que falló: el historial es todo menos ella.
    const history = turns.slice(0, -1);
    const question = failure.question;
    setFailure(null);
    await ask(question, history);
  }

  function setProposalState(index: number, state: ProposalState) {
    setTurns((current) =>
      current.map((turn, position) =>
        position === index && turn.role === "assistant" ? { ...turn, proposalState: state } : turn,
      ),
    );
  }

  /**
   * «Aplicar a la nota»: la página de la consulta fusiona las secciones
   * cambiadas sobre la nota actual y la deja como cambios sin guardar. Si el
   * médico canceló (editó esa sección entre la propuesta y el clic), la
   * propuesta sigue pendiente.
   */
  async function applyProposal(index: number) {
    const turn = turns[index];
    if (!turn || turn.role !== "assistant" || !turn.data.proposal || !context?.applyProposal || applying !== null) return;
    setApplying(index);
    try {
      const ok = await context.applyProposal(turn.data.proposal);
      if (ok) setProposalState(index, "aplicada");
    } finally {
      setApplying(null);
    }
  }

  // Durante una consulta activa el asistente se muestra embebido en el panel
  // lateral de la pantalla, no como una ventana flotante duplicada.
  if (!embedded && (pathname === "/app/consultas/en-vivo" || pathname === "/app/plantillas")) return null;

  const visible = embedded || open;
  const canApply = Boolean(context?.editable && context?.applyProposal);
  const applyHint = context
    ? context.editable
      ? undefined
      : "La nota está firmada: regístralo como adenda."
    : "Abre la consulta para aplicarla a la nota.";
  const lastAssistantIndex = turns.length - 1 >= 0 && turns[turns.length - 1].role === "assistant" ? turns.length - 1 : -1;

  // Embebido en el panel lateral, el alto se ajusta a lo que hay dentro:
  // sin conversación el panel solo mide lo que ocupan las sugerencias, así
  // el campo "Escribe tu pregunta…" queda a la vista sin bajar la página.
  // Al empezar a conversar sí toma un alto fijo y el historial hace scroll.
  const hasConversation = turns.length > 0 || loading;
  const embeddedHeight = hasConversation
    ? "xl:h-[min(520px,calc(100vh-13rem))] xl:min-h-[320px]"
    : "xl:h-auto";
  const panelClass = embedded
    ? `${open ? "fixed inset-0 z-[80] flex h-dvh w-full" : "hidden"} flex-col overflow-hidden bg-surface xl:static xl:flex xl:w-auto xl:rounded-[16px] xl:border xl:border-line xl:shadow-[var(--elev-1)] ${embeddedHeight}`
    : "fixed inset-0 z-[80] flex h-dvh w-full flex-col overflow-hidden bg-surface sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(600px,calc(100vh-2.5rem))] sm:w-[min(400px,calc(100vw-2.5rem))] sm:rounded-[24px] sm:border sm:border-line sm:shadow-[var(--elev-3)]";

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente clínico"
          /* DE QUE LADO CUELGA.
             El embebido (consulta en vivo) se ve hasta `xl`, y de `md` en
             adelante el menu lateral ocupa la esquina de abajo a la izquierda:
             ahi el boton caia ENCIMA del menu, justo mientras se genera la
             nota. Se va a la derecha, que en esa pantalla esta libre porque el
             dock de acciones no se pinta alli. De paso deja libre la izquierda
             para la pastilla de "Volver a la grabacion".
             El global solo aparece por debajo de `md`, donde no hay menu que
             estorbar, asi que se queda donde estaba. */
          className={`glass-panel fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] z-50 inline-flex min-h-12 items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-deep active:scale-[0.98] ${embedded ? "right-3 sm:bottom-5 sm:right-5 md:hover:bg-ice-soft xl:hidden" : "left-3 md:hidden"}`}
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
                <div className="flex items-center gap-1.5 text-[12px] text-muted">
                  <span
                    aria-hidden
                    className={`inline-block h-1.5 w-1.5 rounded-full ${context ? "bg-success" : "bg-muted/50"}`}
                  />
                  {contextLabel(context)}
                </div>
              </div>
            </div>
            {!embedded || open ? (
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar asistente"
                title="Cerrar asistente"
                className="icon-btn"
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
            {turns.length === 0 ? (
              <div className="space-y-2.5">
                <p className="text-[13px] leading-snug text-muted">
                  {context
                    ? "Pregunta sobre esta consulta: diagnóstico, guías, codificación o cambios en la nota."
                    : "Pregunta sobre diagnóstico, codificación o manejo clínico. Con una consulta abierta, el asistente la tiene en cuenta."}
                </p>
                <div className="space-y-2">
                  {starters.map((s) => (
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
              turns.map((turn, index) => (
                <div
                  key={index}
                  className={turn.role === "user" ? "flex justify-end" : "flex flex-col items-start gap-2"}
                >
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      turn.role === "user"
                        ? "bg-accent text-white"
                        : "border border-line bg-pearl text-ink"
                    }`}
                  >
                    {turn.content}
                  </div>
                  {turn.role === "assistant" ? (
                    <AssistantTurnCard
                      data={turn.data}
                      proposalState={turn.proposalState}
                      canApply={canApply}
                      applyHint={applyHint}
                      applying={applying === index}
                      onApply={() => void applyProposal(index)}
                      onDiscard={() => setProposalState(index, "descartada")}
                    />
                  ) : null}
                  {turn.role === "assistant" && index === lastAssistantIndex && !loading && turn.data.followUps.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {turn.data.followUps.map((question) => (
                        <button
                          key={question}
                          type="button"
                          onClick={() => send(question)}
                          className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-[12px] text-deep transition-colors hover:border-mist hover:bg-ice-soft"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
            {loading ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-line bg-pearl px-3.5 py-3">
                  <span className="flex items-center gap-1">
                    {[0, 0.15, 0.3].map((d) => (
                      <span
                        key={d}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
                        style={{ animationDelay: `${d}s`, animationDuration: "0.8s" }}
                      />
                    ))}
                  </span>
                  <span className="text-[12px] text-muted">
                    {context ? "Consultando guías y la consulta…" : "Consultando guías…"}
                  </span>
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
              placeholder={context ? "Pregunta sobre esta consulta…" : "Escribe tu pregunta…"}
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
