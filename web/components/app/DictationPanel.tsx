"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Mic, Pause, Play, Square, Wifi } from "lucide-react";
import { Waveform } from "@/components/app/Waveform";
import { useDictation, type DictationStatus } from "@/lib/stt/useDictation";

const STATUS_TEXT: Partial<Record<DictationStatus, string>> = {
  requesting_mic: "Solicitando acceso al micrófono…",
  connecting: "Conectando con el servicio de transcripción…",
  recording: "Grabando…",
  reconnecting: "Se interrumpió la conexión. Reintentando…",
  pausing: "Pausando y asegurando la transcripción…",
  paused: "Grabación pausada",
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
  autoStart = false,
  onRecordingStopped,
  finishLabel,
}: {
  disabled: boolean;
  onAppendFinal: (text: string) => void;
  onActiveChange: (active: boolean) => void;
  /** Se usa solo al llegar desde el acceso de grabación rápida. */
  autoStart?: boolean;
  /** Permite encadenar el cierre de captura con la generación de la nota. */
  onRecordingStopped?: () => void;
  /** Etiqueta para una detención que termina la cita. */
  finishLabel?: string;
}) {
  const { status, partialText, error, elapsedSec, stalled, start, pause, stop } =
    useDictation(onAppendFinal);
  const autoStartHandled = useRef(false);
  const [finishConfirm, setFinishConfirm] = useState(false);

  // "Activo" = cualquier estado que implique micrófono/conexión en curso.
  const active = status !== "idle" && status !== "error";
  useEffect(() => {
    onActiveChange(active);
  }, [active, onActiveChange]);

  // El encounter ya se creó desde una acción explícita del médico. Arrancar
  // aquí elimina un segundo clic sin tocar el flujo normal de la consulta.
  useEffect(() => {
    if (!autoStart || disabled || autoStartHandled.current) return;
    autoStartHandled.current = true;
    void start();
  }, [autoStart, disabled, start]);

  const inFlight =
    status === "requesting_mic" ||
    status === "connecting" ||
    status === "pausing" ||
    status === "stopping";
  const capturing = status === "recording" || status === "reconnecting";
  const paused = status === "paused";

  async function startOrContinue() {
    await start();
  }

  async function finishRecording() {
    setFinishConfirm(false);
    await stop();
    onRecordingStopped?.();
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-pearl">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${capturing ? "bg-danger-soft text-danger" : paused ? "bg-warning-soft text-warning" : "bg-ice text-accent"}`}>
            {capturing ? <Mic size={17} className="animate-pulse" /> : paused ? <Pause size={17} /> : <Mic size={17} />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-deep">
              {capturing ? "Micrófono activo" : paused ? "Grabación pausada" : inFlight ? "Preparando micrófono" : "Micrófono listo"}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <Wifi size={13} /> {status === "reconnecting" ? "Reconectando" : active ? "Conexión protegida" : "Sin transmisión activa"}
            </p>
          </div>
        </div>
        <span className="shrink-0 font-mono text-lg font-semibold tabular-nums text-deep">{mmss(elapsedSec)}</span>
      </div>

      <div className="p-4">
        {capturing ? (
          <div className="mb-4 rounded-lg border border-danger/15 bg-surface px-3 py-3">
            <Waveform active={status === "recording"} />
            <p className="mt-2 flex items-start gap-2 text-sm italic text-muted">
              <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-danger" />
              {partialText || "Escuchando…"}
            </p>
          </div>
        ) : null}

        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
          {capturing ? (
            <button type="button" onClick={() => void pause()} disabled={disabled || inFlight} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-warning/35 bg-warning-soft px-5 py-3 text-sm font-semibold text-warning-ink disabled:opacity-60">
              <Pause size={17} /> Pausar
            </button>
          ) : (
            <button type="button" onClick={() => void startOrContinue()} disabled={disabled || inFlight} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60">
              {inFlight ? <Loader2 size={17} className="animate-spin" /> : paused ? <Play size={17} /> : <Mic size={17} />}
              {paused ? "Continuar grabación" : status === "error" ? "Intentar de nuevo" : "Iniciar grabación"}
            </button>
          )}

          {capturing || paused ? (
            <button type="button" onClick={() => setFinishConfirm(true)} disabled={disabled || inFlight} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-danger/35 bg-surface px-5 py-3 text-sm font-semibold text-danger hover:bg-danger-soft disabled:opacity-60">
              <Square size={16} /> {finishLabel ?? "Finalizar"}
            </button>
          ) : null}
        </div>

        <span role="status" aria-live="polite" className="mt-3 block text-xs font-medium text-muted">
          {STATUS_TEXT[status] ?? ""}
        </span>

        {stalled ? (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            Grabando, pero no llega transcripción hace 45 s. Verifica el
            micrófono o tu conexión.
          </p>
        ) : null}

        {finishConfirm ? (
          <div role="alertdialog" aria-label="Confirmar finalización" className="mt-4 rounded-xl border border-danger/25 bg-danger-soft p-4">
            <p className="text-sm font-semibold text-deep">¿Finalizar la consulta y generar la nota?</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">Se cerrará el micrófono y se procesará la transcripción acumulada. Esta acción no descarta el texto.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setFinishConfirm(false)} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-deep">Seguir grabando</button>
              <button type="button" onClick={() => void finishRecording()} className="rounded-xl bg-danger px-3 py-2 text-sm font-semibold text-white">Sí, finalizar</button>
            </div>
          </div>
        ) : null}

        {status === "error" && error ? (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
