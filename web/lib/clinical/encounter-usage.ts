"use client";

// Reloj de "tiempo de uso de Miracle Notes" por consulta.
//
// QUÉ ES EL TIEMPO DE USO. Segundos en los que la consulta estuvo de verdad
// ocurriendo delante del médico, no cuánto tiempo estuvo abierta la pestaña.
// Las reglas viven en `shouldAccumulate` (pura, testeada):
//   1. Grabando cuenta SIEMPRE, aunque la pestaña esté oculta: la consulta
//      está ocurriendo aunque el médico no toque nada.
//   2. Esperando al sistema (generar/guardar) cuenta si la pestaña es visible:
//      el médico está mirando el spinner; exigirle interacción sería absurdo.
//   3. El resto (revisar/editar) cuenta solo visible + interacción en los
//      últimos 60 s. Una pestaña abandonada acumula 60 s como máximo.
//
// DOBLE PESTAÑA. Solo la pestaña que posee el Web Lock del encounter acumula;
// la otra queda latente y hereda el lock si la primera cierra. Es la única
// defensa que evita el doble conteo EN EL ORIGEN (dos pestañas legítimas en
// monitores distintos pasarían cualquier heurística del servidor).
//
// FLUSH. Siempre DELTAS, nunca totales: cada 30 s si hay algo, al cerrar la
// grabación (ahí viaja también la línea de tiempo de hablantes — no en cada
// flush, para no reescribir el jsonb cada 30 s), al ocultar/cerrar la pestaña
// (sendBeacon → /api/telemetry/encounter-usage, porque supabase-js no
// sobrevive un pagehide) y al guardar la nota (finalize). Un flush fallido no
// pierde nada: el saldo queda local y se drena en el siguiente intento. El
// servidor clampa contra el reloj de pared (record_encounter_usage), así que
// un cliente no puede inflar.
//
// PRIVACIDAD. Por aquí solo pasan números: milisegundos, contadores y la línea
// de tiempo [hablante, inicio, fin, stream]. Jamás texto.

import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DictationUsageSnapshot } from "@/lib/stt/useDictation";
import type { TimelineSegment } from "@/lib/stt/usage-segments";

/** Sin interacción durante este tiempo, la pantalla deja de contar (regla 3). */
export const IDLE_MS = 60_000;
/** Un tick jamás aporta más que esto: despertar de un suspend no regala horas. */
export const MAX_TICK_MS = 2_000;
/** Cadencia del flush periódico. */
export const FLUSH_INTERVAL_MS = 30_000;

export interface UsageClockInput {
  /** Captura abierta: recording/reconnecting/pausing/stopping. */
  capturing: boolean;
  /** El sistema trabaja y el médico espera mirando (generar/guardar/ajustar). */
  waiting: boolean;
  visible: boolean;
  msSinceInteraction: number;
}

/** Regla pura del reloj. Exportada para poder testearla sin montar nada. */
export function shouldAccumulate(input: UsageClockInput, idleMs = IDLE_MS): boolean {
  if (input.capturing) return true;
  if (!input.visible) return false;
  if (input.waiting) return true;
  return input.msSinceInteraction <= idleMs;
}

interface FlushOptions {
  finalize?: boolean;
  /** Anexar los segmentos de timeline aún no enviados. */
  includeTimeline?: boolean;
  /** Reportar al ledger los segundos de audio transcritos desde el último reporte. */
  reportStt?: boolean;
  /** Usar sendBeacon (la página se está yendo). */
  beacon?: boolean;
}

export function useEncounterUsage(opts: {
  encounterId: string | null;
  capturing: boolean;
  waiting: boolean;
  /** Foto de telemetría del dictado (null si aún no hay motor). */
  getDictationSnapshot: () => DictationUsageSnapshot | null;
}): {
  /** Llamar tras guardar la nota: sella la fila y computa las derivadas. */
  finalize: () => Promise<void>;
} {
  const { encounterId, capturing, waiting, getDictationSnapshot } = opts;

  const sessionIdRef = useRef<string | null>(null);
  const leaderRef = useRef(false);
  const releaseLockRef = useRef<(() => void) | null>(null);

  const pendingActiveMsRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const lastInteractionRef = useRef(0);
  const lastSentRecordingMsRef = useRef(0);
  const sentSegmentCountRef = useRef(0);
  const lastSttReportedMsRef = useRef(0);
  const flushingRef = useRef(false);

  // Props vigentes para los listeners/intervalos sin recrearlos.
  const capturingRef = useRef(capturing);
  const waitingRef = useRef(waiting);
  const snapshotRef = useRef(getDictationSnapshot);
  useEffect(() => {
    capturingRef.current = capturing;
  }, [capturing]);
  useEffect(() => {
    waitingRef.current = waiting;
  }, [waiting]);
  useEffect(() => {
    snapshotRef.current = getDictationSnapshot;
  }, [getDictationSnapshot]);

  const flush = useCallback(
    async (options: FlushOptions = {}) => {
      const encId = encounterId;
      const sessionId = sessionIdRef.current;
      if (!encId || !sessionId) return;
      if (flushingRef.current && !options.beacon) return;

      const snapshot = snapshotRef.current();
      const activeMs = Math.round(pendingActiveMsRef.current);
      const recordingDelta = snapshot
        ? Math.max(0, Math.round(snapshot.recordingMs - lastSentRecordingMsRef.current))
        : 0;

      let timeline: TimelineSegment[] | null = null;
      if (options.includeTimeline && snapshot) {
        const nuevos = snapshot.segments.slice(sentSegmentCountRef.current);
        if (nuevos.length > 0) timeline = nuevos;
      }

      const hasWork =
        activeMs > 0 || recordingDelta > 0 || timeline !== null || options.finalize;
      if (!hasWork) return;

      const sttDeltaSec =
        options.reportStt && snapshot
          ? Math.max(0, (snapshot.recordingMs - lastSttReportedMsRef.current) / 1000)
          : 0;

      if (options.beacon) {
        // La página se va: no hay tiempo para respuestas. Se drena optimista;
        // perder este beacon cuesta como mucho 30 s de uso, no la consulta.
        const body = JSON.stringify({
          encounterId: encId,
          sessionId,
          activeMs,
          recordingMs: recordingDelta,
          timeline,
          diarization: snapshot?.diarization ?? null,
          finalize: Boolean(options.finalize),
          stt:
            sttDeltaSec >= 1 && snapshot
              ? {
                  audioSeconds: Math.round(sttDeltaSec),
                  provider: snapshot.provider,
                  model: snapshot.model,
                }
              : null,
        });
        try {
          navigator.sendBeacon(
            "/api/telemetry/encounter-usage",
            new Blob([body], { type: "application/json" }),
          );
          pendingActiveMsRef.current = Math.max(0, pendingActiveMsRef.current - activeMs);
          if (snapshot) {
            lastSentRecordingMsRef.current += recordingDelta;
            if (timeline) sentSegmentCountRef.current += timeline.length;
            if (sttDeltaSec >= 1) lastSttReportedMsRef.current = snapshot.recordingMs;
          }
        } catch {
          /* saldo intacto; se drena en el próximo flush */
        }
        return;
      }

      flushingRef.current = true;
      try {
        const supabase = createClient();
        const { error } = await supabase.rpc("record_encounter_usage", {
          p_encounter_id: encId,
          p_session_id: sessionId,
          p_active_ms: activeMs,
          p_recording_ms: recordingDelta,
          p_timeline: timeline,
          p_diarization: snapshot?.diarization ?? null,
          p_finalize: Boolean(options.finalize),
        });
        if (!error) {
          pendingActiveMsRef.current = Math.max(0, pendingActiveMsRef.current - activeMs);
          lastSentRecordingMsRef.current += recordingDelta;
          if (timeline) sentSegmentCountRef.current += timeline.length;
        }
      } catch {
        /* saldo intacto */
      } finally {
        flushingRef.current = false;
      }

      // Minutos transcritos → ledger de consumo. Aparte del RPC porque el
      // ledger vive detrás del servidor (GRAPH_USAGE_INGEST_KEY es secreto).
      if (sttDeltaSec >= 1 && snapshot) {
        const marca = snapshot.recordingMs;
        try {
          const res = await fetch("/api/telemetry/encounter-usage", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              encounterId: encId,
              sessionId,
              stt: {
                audioSeconds: Math.round(sttDeltaSec),
                provider: snapshot.provider,
                model: snapshot.model,
              },
            }),
            keepalive: true,
          });
          if (res.ok) lastSttReportedMsRef.current = marca;
        } catch {
          /* se reintenta en el próximo cierre de grabación */
        }
      }
    },
    [encounterId],
  );

  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // --- Ciclo de vida por encounter ------------------------------------------
  useEffect(() => {
    if (!encounterId || typeof window === "undefined") return;

    sessionIdRef.current = crypto.randomUUID();
    pendingActiveMsRef.current = 0;
    lastTickRef.current = null;
    lastInteractionRef.current = performance.now();
    lastSentRecordingMsRef.current = 0;
    sentSegmentCountRef.current = 0;
    lastSttReportedMsRef.current = 0;

    // Liderazgo entre pestañas del MISMO encounter. Sin Web Locks (navegador
    // viejo) se asume líder: mejor contar de más en un navegador raro que no
    // contar nunca.
    leaderRef.current = typeof navigator.locks === "undefined";
    let lockAbort: AbortController | null = null;
    if (!leaderRef.current) {
      lockAbort = new AbortController();
      navigator.locks
        .request(
          `miracle-notes-usage-${encounterId}`,
          { mode: "exclusive", signal: lockAbort.signal },
          () =>
            new Promise<void>((resolve) => {
              leaderRef.current = true;
              releaseLockRef.current = resolve;
            }),
        )
        .catch(() => {
          /* abortado al desmontar */
        });
    }

    const onInteraction = () => {
      lastInteractionRef.current = performance.now();
    };
    const tick = () => {
      const now = performance.now();
      const delta =
        lastTickRef.current === null ? 0 : Math.min(now - lastTickRef.current, MAX_TICK_MS);
      lastTickRef.current = now;
      if (!leaderRef.current) return;
      const cuenta = shouldAccumulate({
        capturing: capturingRef.current,
        waiting: waitingRef.current,
        visible: document.visibilityState === "visible",
        msSinceInteraction: now - lastInteractionRef.current,
      });
      if (cuenta) pendingActiveMsRef.current += delta;
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        void flushRef.current({ beacon: true, includeTimeline: true });
      }
    };
    const onPageHide = () => {
      void flushRef.current({ beacon: true, includeTimeline: true, reportStt: true });
    };

    const tickId = window.setInterval(tick, 1000);
    const flushId = window.setInterval(() => void flushRef.current({}), FLUSH_INTERVAL_MS);
    window.addEventListener("pointerdown", onInteraction, { passive: true });
    window.addEventListener("keydown", onInteraction, { passive: true });
    window.addEventListener("wheel", onInteraction, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(tickId);
      window.clearInterval(flushId);
      window.removeEventListener("pointerdown", onInteraction);
      window.removeEventListener("keydown", onInteraction);
      window.removeEventListener("wheel", onInteraction);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      releaseLockRef.current?.();
      releaseLockRef.current = null;
      lockAbort?.abort();
      leaderRef.current = false;
    };
  }, [encounterId]);

  // Al cerrar la grabación: viaja la línea de tiempo del tramo y se reportan
  // los minutos transcritos. Es EL momento de mandar timeline (no cada 30 s).
  const prevCapturingRef = useRef(capturing);
  useEffect(() => {
    if (prevCapturingRef.current && !capturing) {
      void flushRef.current({ includeTimeline: true, reportStt: true });
    }
    prevCapturingRef.current = capturing;
  }, [capturing]);

  const finalize = useCallback(async () => {
    await flushRef.current({ finalize: true, includeTimeline: true, reportStt: true });
  }, []);

  return { finalize };
}
