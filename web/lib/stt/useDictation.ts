"use client";

// Hook de grabación con transcripción en vivo sobre el motor vendoreado.
//
// Decisiones (ver docs del motor en ./deepgram-dictation.js):
// - El motor NO reconecta solo: ante cierre inesperado este hook reintenta
//   hasta 2 veces consecutivas con sesión/token nuevos; el contador se resetea
//   al recibir texto (así una consulta larga sobrevive cortes del proveedor).
// - El motor se crea PEREZOSAMENTE en el primer start() (gesto del usuario):
//   StrictMode/dobles renders no crean dobles instancias.
// - Los finales que llegan durante el stop() (finalize/flush) se siguen
//   appendeando: no se pierde la cola de la última frase.
// - onDebug incluye preview de transcripción (PHI): solo se conecta en dev.

import { useCallback, useEffect, useRef, useState } from "react";
import { createDictation, type DictationHandle, type VoiceStreamSession } from "./index";
import { dictationErrorMessage, DICTATION_MESSAGES } from "./messages";

export type DictationStatus =
  | "idle"
  | "requesting_mic"
  | "connecting"
  | "recording"
  | "reconnecting"
  | "pausing"
  | "paused"
  | "stopping"
  | "error";

const MAX_RECONNECT_ATTEMPTS = 2;
const RECONNECT_DELAYS_MS = [300, 1500];

async function fetchStreamSession(): Promise<VoiceStreamSession> {
  const res = await fetch("/api/stt/session", { method: "POST" });
  const payload = (await res.json().catch(() => null)) as
    | (VoiceStreamSession & { error?: string })
    | null;
  if (!res.ok || !payload || typeof payload.websocket_url !== "string") {
    // El motor no valida la respuesta HTTP: hay que lanzar para que start() falle.
    throw new Error(payload?.error ?? "No fue posible iniciar la sesión de transcripción.");
  }
  return payload;
}

export function useDictation(onFinal: (text: string) => void): {
  status: DictationStatus;
  partialText: string;
  error: string | null;
  elapsedSec: number;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
} {
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [partialText, setPartialText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const engineRef = useRef<DictationHandle | null>(null);
  const intentRef = useRef<"recording" | "paused" | "stopped">("stopped");
  const statusRef = useRef<DictationStatus>("idle");
  const startGuardRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const lastEngineErrorRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Trampolín: el callback del médico siempre fresco sin recrear el motor.
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const setStatusSafe = useCallback((next: DictationStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
  }, []);

  const getEngine = useCallback((): DictationHandle => {
    if (engineRef.current) return engineRef.current;
    engineRef.current = createDictation({
      createStreamSession: fetchStreamSession,
      onPartialTranscript: (text) => {
        setPartialText(text);
      },
      onFinalTranscript: ({ transcript }) => {
        const clean = (transcript ?? "").trim();
        if (!clean) return;
        // Texto llegó: la conexión sirve → resetea el presupuesto de reintentos.
        reconnectAttemptsRef.current = 0;
        setPartialText("");
        onFinalRef.current(clean);
      },
      onError: (message) => {
        // No pintar aún: si hay reintento en curso el error es transitorio.
        lastEngineErrorRef.current = message;
      },
      onUnexpectedClose: () => {
        if (intentRef.current !== "recording") return;
        const attempt = reconnectAttemptsRef.current;
        if (attempt < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current = attempt + 1;
          setStatusSafe("reconnecting");
          const delay = RECONNECT_DELAYS_MS[attempt] ?? 1500;
          setTimeout(() => {
            if (intentRef.current !== "recording" || !engineRef.current) return;
            engineRef.current
              .start()
              .then(() => {
                if (intentRef.current === "recording") setStatusSafe("recording");
              })
              .catch(() => {
                // El fallo del reintento vuelve a disparar onUnexpectedClose/onError;
                // si el presupuesto se agotó, cae al else de abajo en el siguiente ciclo.
                if (
                  intentRef.current === "recording" &&
                  reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS
                ) {
                  intentRef.current = "stopped";
                  setError(DICTATION_MESSAGES.connectionLost);
                  setStatusSafe("error");
                  stopTimer();
                }
              });
          }, delay);
        } else {
          intentRef.current = "stopped";
          setError(DICTATION_MESSAGES.connectionLost);
          setStatusSafe("error");
          stopTimer();
        }
      },
      ...(process.env.NODE_ENV === "development"
        ? { onDebug: (event: string, data: unknown) => console.debug("[stt]", event, data) }
        : {}),
    });
    return engineRef.current;
  }, [setStatusSafe, stopTimer]);

  const start = useCallback(async () => {
    if (startGuardRef.current) return;
    if (statusRef.current === "recording" || statusRef.current === "stopping") return;
    const resuming = statusRef.current === "paused";
    startGuardRef.current = true;
    setError(null);
    lastEngineErrorRef.current = null;
    reconnectAttemptsRef.current = 0;
    intentRef.current = "recording";
    try {
      const engine = getEngine();
      setStatusSafe("requesting_mic");
      await engine.ensureMicrophone();
      setStatusSafe("connecting");
      await engine.start();
      if (!resuming) setElapsedSec(0);
      startTimer();
      setStatusSafe("recording");
    } catch (e) {
      intentRef.current = "stopped";
      setError(dictationErrorMessage(e ?? lastEngineErrorRef.current ?? undefined));
      setStatusSafe("error");
      stopTimer();
    } finally {
      startGuardRef.current = false;
    }
  }, [getEngine, setStatusSafe, startTimer, stopTimer]);

  const pause = useCallback(async () => {
    if (statusRef.current !== "recording" && statusRef.current !== "reconnecting") return;
    intentRef.current = "paused";
    setStatusSafe("pausing");
    stopTimer();
    try {
      await engineRef.current?.stop();
    } catch {
      /* los segmentos confirmados permanecen en la transcripción */
    } finally {
      setPartialText("");
      setStatusSafe("paused");
    }
  }, [setStatusSafe, stopTimer]);

  const stop = useCallback(async () => {
    if (statusRef.current === "paused") {
      intentRef.current = "stopped";
      setPartialText("");
      setStatusSafe("idle");
      return;
    }
    if (statusRef.current !== "recording" && statusRef.current !== "reconnecting") return;
    intentRef.current = "stopped";
    setStatusSafe("stopping");
    stopTimer();
    try {
      // Durante el stop el motor sigue emitiendo finales (finalize + flush):
      // onFinalTranscript los appendea normalmente.
      await engineRef.current?.stop();
    } catch {
      /* el texto ya acumulado no se pierde */
    } finally {
      setPartialText("");
      setStatusSafe("idle");
    }
  }, [setStatusSafe, stopTimer]);

  // El navegador solo permite advertir, no personalizar, el diálogo de salida.
  // Protege recargas/cierre de pestaña mientras la captura sigue abierta.
  useEffect(() => {
    const protectedStatus = new Set<DictationStatus>([
      "requesting_mic",
      "connecting",
      "recording",
      "reconnecting",
      "pausing",
      "paused",
      "stopping",
    ]);
    if (!protectedStatus.has(status)) return;
    const preventLoss = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [status]);

  // Al desmontar (navegación SPA): apagar micrófono y socket.
  useEffect(() => {
    return () => {
      intentRef.current = "stopped";
      stopTimer();
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [stopTimer]);

  return { status, partialText, error, elapsedSec, start, pause, stop };
}
