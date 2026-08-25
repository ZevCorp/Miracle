"use client";

// Estado real de la exportación de una nota a la historia clínica.
//
// Reglas de honestidad que impone este hook:
//   · Pulsar "Exportar a HC" NO es exportar. Crea un trabajo en `pending` y la
//     UI dice "enviada al asistente", nunca "exportada".
//   · El estado vive en el SERVIDOR, no en memoria: al montar se lee, así que
//     una recarga (F5), otra pestaña u otro dispositivo muestran lo mismo.
//   · Mientras el trabajo no termina se consulta cada 10 s. Se deja de consultar
//     al llegar a un estado terminal o si la pestaña no está visible (no tiene
//     sentido gastar red por una pestaña de fondo).
//   · Doble clic imposible: `busy` bloquea la acción mientras hay una petición
//     en vuelo, y el backend es idempotente por si el bloqueo no basta
//     (dos pestañas, dos dispositivos).
//
// La consulta solo llega a `exportada` cuando el ejecutor confirma el éxito;
// `consultationEstado` refleja lo que dice el servidor, no un optimismo local.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClinicalApiError,
  cancelNoteExport,
  createNoteExport,
  friendlyClinicalMessage,
  getNoteExport,
  isNoteExportRetryable,
  isNoteExportTerminal,
  retryNoteExport,
  type NoteExport,
} from "@/lib/api/clinical";

const POLL_INTERVAL_MS = 10_000;
/** Tras este tiempo en cola sospechamos que el asistente no está encendido. */
export const STALE_PENDING_MS = 5 * 60_000;

export interface UseNoteExportResult {
  /** Trabajo actual, o null si nunca se pidió una exportación. */
  job: NoteExport | null;
  /** Estado de negocio de la consulta según el servidor. */
  consultationEstado: string | null;
  /** true durante la carga inicial (antes de saber si hay trabajo). */
  loading: boolean;
  /** true mientras hay una acción en vuelo: bloquea el botón. */
  busy: boolean;
  /** Error de la última acción, apto para mostrar. */
  error: string | null;
  /** El backend no está configurado: la exportación automática no existe aquí. */
  unavailable: boolean;
  requestExport: () => Promise<void>;
  retry: () => Promise<void>;
  cancel: () => Promise<void>;
  refresh: () => Promise<void>;
  canRequest: boolean;
  canRetry: boolean;
  canCancel: boolean;
}

export function useNoteExport(
  consultationId: string | null | undefined,
  options: { enabled?: boolean } = {},
): UseNoteExportResult {
  const enabled = options.enabled !== false && Boolean(consultationId);

  const [job, setJob] = useState<NoteExport | null>(null);
  const [consultationEstado, setConsultationEstado] = useState<string | null>(null);
  // `loading` es DERIVADO, no un estado que se setea en un efecto: estamos
  // cargando mientras la consulta que ya leímos no sea la actual. Así cambiar de
  // consulta vuelve a "cargando" sin renders en cascada.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const loading = enabled && loadedId !== `${consultationId}`;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  // Evita escribir estado tras desmontar, y que dos acciones se pisen.
  const mounted = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const applyState = useCallback((next: { export: NoteExport | null; consultation_estado: string }) => {
    if (!mounted.current) return;
    setJob(next.export);
    setConsultationEstado(next.consultation_estado);
  }, []);

  const refresh = useCallback(async () => {
    if (!consultationId || !enabled) return;
    try {
      applyState(await getNoteExport(consultationId));
      if (mounted.current) setUnavailable(false);
    } catch (err) {
      // Un fallo de lectura NO debe romper el detalle de la consulta ni borrar
      // lo último que sabíamos: solo marcamos que la función no está disponible
      // cuando el backend dice explícitamente que no está configurado.
      if (
        err instanceof ClinicalApiError
        && (err.code === "API_NOT_CONFIGURED" || err.code === "SUPABASE_NOT_CONFIGURED")
      ) {
        if (mounted.current) setUnavailable(true);
      }
    } finally {
      if (mounted.current) setLoadedId(`${consultationId}`);
    }
  }, [applyState, consultationId, enabled]);

  // Carga inicial: es lo que hace que el estado sobreviva a una recarga.
  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  // Polling mientras el trabajo esté vivo y la pestaña visible.
  useEffect(() => {
    if (!enabled || !job || isNoteExportTerminal(job.status)) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        void refresh();
      }, POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // Al volver a la pestaña, refresca de inmediato: puede haber cambiado.
        void refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, job, refresh]);

  /** Envuelve una acción: un solo vuelo a la vez y errores normalizados. */
  const runAction = useCallback(
    async (action: () => Promise<{ export: NoteExport }>) => {
      if (!consultationId || inFlight.current) return;
      inFlight.current = true;
      if (mounted.current) {
        setBusy(true);
        setError(null);
      }
      try {
        const result = await action();
        if (mounted.current) setJob(result.export);
        // Relee el estado de la consulta desde el servidor: nunca se asume aquí
        // que algo quedó exportado.
        await refresh();
      } catch (err) {
        if (mounted.current) setError(friendlyClinicalMessage(err));
        // Aunque falle, reconciliamos: el trabajo pudo crearse igual.
        await refresh();
      } finally {
        inFlight.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [consultationId, refresh],
  );

  const requestExport = useCallback(async () => {
    if (!consultationId) return;
    // `createNoteExport` ya absorbe el 409 de duplicado devolviendo el trabajo
    // que existía: un doble clic termina en el mismo trabajo, no en un error.
    await runAction(() => createNoteExport(consultationId));
  }, [consultationId, runAction]);

  const retry = useCallback(async () => {
    if (!job) return;
    await runAction(() => retryNoteExport(job.id));
  }, [job, runAction]);

  const cancel = useCallback(async () => {
    if (!job) return;
    await runAction(() => cancelNoteExport(job.id));
  }, [job, runAction]);

  const status = job?.status ?? null;
  const alreadyExported = consultationEstado === "exportada";

  return {
    job,
    consultationEstado,
    loading,
    busy,
    error,
    unavailable,
    requestExport,
    retry,
    cancel,
    refresh,
    // Se puede pedir cuando no hay trabajo vivo ni terminado con éxito.
    canRequest: !busy && !unavailable && !alreadyExported
      && (!job || isNoteExportRetryable(status)),
    canRetry: !busy && !unavailable && Boolean(job) && isNoteExportRetryable(status),
    canCancel: !busy && !unavailable && status === "pending",
  };
}

/**
 * Lo que reporta el ejecutor de escritorio en `detail_code`, traducido a algo
 * que el médico pueda usar.
 *
 * POR QUÉ EXISTE ESTE MAPA: el 2026-08-25 una exportación falló a los 2,2 s y en
 * el portal solo se leía «La exportación falló (EXECUTOR_ERROR)». El log del
 * equipo decía exactamente qué pasó —«SAP GUI está abierto pero no hay ninguna
 * conexión activa»— y esa frase no cruzaba la red: el trabajo llegaba con
 * `detail_code: NAVEGACION_FALLIDA`, el servidor lo guardaba, y aquí se tiraba.
 * La causa estaba a un campo de distancia de la pantalla del médico.
 *
 * CADA TEXTO DESCRIBE EL PASO QUE FALLÓ; NINGUNO CONCLUYE UNA CAUSA. Hoy
 * `NAVEGACION_FALLIDA` cubre varias situaciones distintas (SAP sin sesión, Graph
 * inalcanzable, workflow sin pasos, la navegación fallando de verdad), así que
 * afirmar una sola sería inventarla. Cuando el ejecutor aprenda a distinguirlas,
 * los códigos nuevos entran aquí y el texto se estrecha.
 */
export const NOTE_EXPORT_DETAIL_MESSAGES: Record<string, string> = {
  NAVEGACION_FALLIDA:
    "El asistente no llegó a la pantalla de la historia clínica. Lo más frecuente: "
    + "SAP GUI abierto pero sin sesión iniciada. Comprueba que hay una conexión activa y reintenta.",
  PANTALLA_INESPERADA:
    "El asistente terminó en otra pantalla de SAP y no escribió nada, para no meter datos "
    + "en el formulario equivocado. Déjalo en la pantalla de triage y reintenta.",
  PAYLOAD_SIN_NOTA:
    "El trabajo llegó sin texto de nota. Revisa que la nota tenga contenido y vuelve a enviarla.",
  PLAN_RESOLUTION_FAILED:
    "No se pudo preparar el plan de automatización de la historia clínica. Contacta al administrador.",
  PLAN_UNRESOLVED_FIELDS:
    "El plan necesitaba datos que no estaban disponibles.",
};

/** Lo que se puede decir del fallo: el detalle del ejecutor si lo hay, y si no el código. */
function failureDetail(job: NoteExport): string {
  const detailCode = job.result_summary?.detail_code ?? null;
  const known = detailCode ? NOTE_EXPORT_DETAIL_MESSAGES[detailCode] : undefined;
  if (known) return `${known} (${detailCode})`;
  // Sin traducción: se enseña el código en crudo igualmente. Un código que no
  // reconocemos sigue siendo más útil que «falló» a secas — es lo que se busca
  // en el log del equipo.
  const code = detailCode || job.error_code;
  return code
    ? `La exportación falló (${code}). Puedes reintentarla.`
    : "La exportación falló. Puedes reintentarla.";
}

/** Textos de UI por estado. Nunca dicen "exportada" antes de la confirmación. */
export function noteExportLabel(job: NoteExport | null): {
  badge: string;
  tone: "info" | "warning" | "success" | "danger";
  detail: string;
} {
  if (!job) {
    return { badge: "Sin enviar", tone: "info", detail: "Esta nota todavía no se ha enviado a la historia clínica." };
  }
  switch (job.status) {
    case "pending": {
      const waited = job.created_at ? Date.now() - Date.parse(job.created_at) : 0;
      return {
        badge: "En cola",
        tone: "info",
        detail: waited > STALE_PENDING_MS
          ? "El asistente de escritorio no ha tomado la tarea. ¿Está encendido el equipo?"
          : "Enviando a la historia clínica…",
      };
    }
    case "claimed":
      return {
        badge: "En proceso",
        tone: "info",
        detail: "El asistente está registrando la nota en la historia clínica…",
      };
    case "completed": {
      const folio = job.result_summary?.folio;
      return {
        badge: "Exportada",
        tone: "success",
        detail: folio
          ? `Exportada a la historia clínica · folio ${folio}`
          : "Exportada a la historia clínica.",
      };
    }
    case "needs_doctor": {
      const fields = job.result_summary?.unresolved_fields ?? [];
      return {
        badge: "Requiere acción",
        tone: "warning",
        detail: fields.length
          ? `Quedaron campos sin completar en la historia clínica: ${fields.join(", ")}.`
          // Sin lista de campos, el detalle del ejecutor es lo único que explica
          // por qué quedó parado; antes se caía a una frase que no decía nada.
          : job.result_summary?.detail_code
            ? failureDetail(job)
            : "El asistente necesita que completes datos en la historia clínica.",
      };
    }
    case "cancelled":
      return { badge: "Cancelada", tone: "warning", detail: "La exportación se canceló antes de ejecutarse." };
    case "failed":
    default:
      return { badge: "Error", tone: "danger", detail: failureDetail(job) };
  }
}
