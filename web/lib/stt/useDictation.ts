"use client";

// Hook de grabación con transcripción en vivo sobre el motor vendoreado.
//
// Decisiones (ver docs del motor en ./deepgram-dictation.js):
// - El motor NO reconecta solo: ante cierre inesperado este hook reintenta
//   hasta 4 veces con backoff, ENCADENANDO cada reintento en el catch del
//   anterior (el motor no re-dispara onUnexpectedClose tras un start() fallido).
//   El contador se resetea al recibir texto (una consulta larga sobrevive
//   cortes repetidos). Agotado el presupuesto, se muestra un error claro.
// - El motor se crea PEREZOSAMENTE en el primer start() (gesto del usuario):
//   StrictMode/dobles renders no crean dobles instancias.
// - Los finales que llegan durante el stop() (finalize/flush) se siguen
//   appendeando: no se pierde la cola de la última frase.
// - Watchdog: si con el micrófono abierto no llega NADA de texto en 45 s, se
//   expone `stalled` para avisar (mic mudo, proveedor caído sin cerrar socket).
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

const MAX_RECONNECT_ATTEMPTS = 4;
const RECONNECT_DELAYS_MS = [300, 1000, 3000, 5000];
// Con el micrófono abierto y grabando, este es el máximo silencio tolerado sin
// ningún fragmento de transcripción antes de avisar. Las pausas clínicas son
// normales; 45 s sin ni un parcial es señal de mic mudo o proveedor caído.
const STALL_THRESHOLD_MS = 45_000;

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
  stalled: boolean;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
} {
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [partialText, setPartialText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [stalled, setStalled] = useState(false);

  const engineRef = useRef<DictationHandle | null>(null);
  const intentRef = useRef<"recording" | "paused" | "stopped">("stopped");
  const statusRef = useRef<DictationStatus>("idle");
  const startGuardRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEngineErrorRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Última señal de actividad de transcripción (parcial o final): base del
  // watchdog. Se marca al iniciar la grabación para no disparar de inmediato.
  const lastActivityAtRef = useRef<number>(0);

  const markActivity = useCallback(() => {
    lastActivityAtRef.current = Date.now();
    setStalled(false);
  }, []);

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

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const failReconnect = useCallback(() => {
    intentRef.current = "stopped";
    setError(DICTATION_MESSAGES.connectionLost);
    setStatusSafe("error");
    stopTimer();
  }, [setStatusSafe, stopTimer]);

  // Reintento de reconexión ENCADENADO: cada fallo programa el siguiente hasta
  // agotar el presupuesto. No depende de que el motor re-dispare onUnexpectedClose
  // (tras un start() fallido no lo hace), que era la causa del cuelgue eterno.
  // La recursión pasa por un ref para no auto-referenciar el useCallback.
  const attemptReconnectRef = useRef<(attempt: number) => void>(() => {});
  const attemptReconnect = useCallback(
    (attempt: number) => {
      if (intentRef.current !== "recording") return;
      if (attempt >= MAX_RECONNECT_ATTEMPTS) {
        failReconnect();
        return;
      }
      reconnectAttemptsRef.current = attempt + 1;
      setStatusSafe("reconnecting");
      const delay = RECONNECT_DELAYS_MS[attempt] ?? 5000;
      clearReconnectTimer();
      reconnectTimerRef.current = setTimeout(() => {
        if (intentRef.current !== "recording" || !engineRef.current) return;
        engineRef.current
          .start()
          .then(() => {
            if (intentRef.current === "recording") {
              markActivity();
              setStatusSafe("recording");
            }
          })
          .catch(() => {
            // Reprograma el siguiente intento (o falla si se agotó).
            attemptReconnectRef.current(attempt + 1);
          });
      }, delay);
    },
    [clearReconnectTimer, failReconnect, markActivity, setStatusSafe],
  );
  useEffect(() => {
    attemptReconnectRef.current = attemptReconnect;
  }, [attemptReconnect]);

  const getEngine = useCallback((): DictationHandle => {
    if (engineRef.current) return engineRef.current;
    engineRef.current = createDictation({
      createStreamSession: fetchStreamSession,
      onPartialTranscript: (text) => {
        markActivity();
        setPartialText(text);
      },
      onFinalTranscript: ({ transcript }) => {
        markActivity();
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
        attemptReconnect(reconnectAttemptsRef.current);
      },
      ...(process.env.NODE_ENV === "development"
        ? { onDebug: (event: string, data: unknown) => console.debug("[stt]", event, data) }
        : {}),
    });
    return engineRef.current;
  }, [attemptReconnect, markActivity]);

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
      markActivity();
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
  }, [getEngine, markActivity, setStatusSafe, startTimer, stopTimer]);

  const pause = useCallback(async () => {
    if (statusRef.current !== "recording" && statusRef.current !== "reconnecting") return;
    intentRef.current = "paused";
    clearReconnectTimer();
    setStalled(false);
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
  }, [clearReconnectTimer, setStatusSafe, stopTimer]);

  const stop = useCallback(async () => {
    if (statusRef.current === "paused") {
      intentRef.current = "stopped";
      setPartialText("");
      setStatusSafe("idle");
      return;
    }
    if (statusRef.current !== "recording" && statusRef.current !== "reconnecting") return;
    intentRef.current = "stopped";
    clearReconnectTimer();
    setStalled(false);
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
  }, [clearReconnectTimer, setStatusSafe, stopTimer]);

  // Watchdog de inactividad: solo mientras se graba. Si con el micrófono
  // abierto no llega ningún fragmento en STALL_THRESHOLD_MS, se marca stalled
  // para avisar (no corta la grabación). Cualquier actividad lo reinicia.
  useEffect(() => {
    if (status !== "recording") return;
    const id = setInterval(() => {
      if (Date.now() - lastActivityAtRef.current > STALL_THRESHOLD_MS) {
        setStalled(true);
      }
    }, 5000);
    return () => clearInterval(id);
  }, [status]);

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
      clearReconnectTimer();
      stopTimer();
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [clearReconnectTimer, stopTimer]);

  return { status, partialText, error, elapsedSec, stalled, start, pause, stop };
}
