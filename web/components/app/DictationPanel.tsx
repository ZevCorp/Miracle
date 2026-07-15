"use client";

import { useEffect } from "react";
import { AlertTriangle, Loader2, Mic, Square } from "lucide-react";
import { Waveform } from "@/components/app/Waveform";
import { useDictation, type DictationStatus } from "@/lib/stt/useDictation";

const STATUS_TEXT: Partial<Record<DictationStatus, string>> = {
  requesting_mic: "Solicitando acceso al micrófono…",
  connecting: "Conectando con el servicio de transcripción…",
  recording: "Grabando…",
  reconnecting: "Se interrumpió la conexión. Reintentando…",
  stopping: "Finalizando transcripción…",
};

function mmss(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Grabación de la consulta con transcripción en vivo (Soniox/Deepgram vía el
 * backend Miracle). Los segmentos finales se appendean al textarea del padre
 * (`onAppendFinal`); el parcial solo se muestra aquí, nunca entra al texto.
 */
export function DictationPanel({
  disabled,
  onAppendFinal,
  onActiveChange,
}: {
  disabled: boolean;
  onAppendFinal: (text: string) => void;
  onActiveChange: (active: boolean) => void;
}) {
  const { status, partialText, error, elapsedSec, start, stop } =
    useDictation(onAppendFinal);

  // "Activo" = cualquier estado que implique micrófono/conexión en curso.
  const active = status !== "idle" && status !== "error";
  useEffect(() => {
    onActiveChange(active);
  }, [active, onActiveChange]);

  const inFlight =
    status === "requesting_mic" || status === "connecting" || status === "stopping";
  const capturing = status === "recording" || status === "reconnecting";

  return (
    <div className="rounded-md border border-line bg-pearl p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void (capturing ? stop() : start())}
          disabled={disabled || inFlight}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            capturing ? "bg-danger hover:bg-danger/90" : "bg-accent hover:bg-accent-hover"
          }`}
        >
          {inFlight ? (
            <Loader2 size={16} className="animate-spin" />
          ) : capturing ? (
            <Square size={15} />
          ) : (
            <Mic size={16} />
          )}
          {capturing
            ? "Detener"
            : status === "error"
              ? "Reanudar grabación"
              : "Iniciar grabación"}
        </button>

        {capturing ? (
          <>
            <div className="min-w-0 max-w-40 flex-1">
              <Waveform active={status === "recording"} />
            </div>
            <span className="font-mono text-sm text-deep">{mmss(elapsedSec)}</span>
          </>
        ) : null}

        {/* Cambios de estado anunciados a lectores de pantalla (no el contador). */}
        <span role="status" aria-live="polite" className="text-xs font-medium text-muted">
          {STATUS_TEXT[status] ?? ""}
        </span>
      </div>

      {capturing || status === "stopping" ? (
        <p className="mt-3 flex items-start gap-2 text-sm italic text-muted">
          <span
            aria-hidden
            className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-danger"
          />
          {partialText || "Escuchando…"}
        </p>
      ) : null}

      {capturing ? (
        <p className="mt-2 text-xs text-muted">
          El texto se completa automáticamente mientras grabas. Podrás editarlo al
          detener.
        </p>
      ) : null}

      {status === "error" && error ? (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning"
        >
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
