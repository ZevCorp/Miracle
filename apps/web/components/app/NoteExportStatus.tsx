"use client";

// Panel de estado de la exportación a historia clínica.
//
// Todo lo que muestra viene del servidor (ver `useNoteExport`): no hay optimismo
// local. En particular, pulsar "Exportar a HC" nunca pinta "Exportada" — pinta
// "En cola", y solo el éxito confirmado por el ejecutor cambia eso.

import { AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw, Send, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { noteExportLabel, type UseNoteExportResult } from "@/lib/hooks/useNoteExport";

const BADGE_TONE = {
  info: "accent",
  success: "success",
  warning: "warning",
  danger: "danger",
} as const;

function StatusIcon({ tone }: { tone: "info" | "success" | "warning" | "danger" }) {
  if (tone === "success") return <CheckCircle2 size={15} aria-hidden />;
  if (tone === "warning" || tone === "danger") return <AlertTriangle size={15} aria-hidden />;
  return <Clock size={15} aria-hidden />;
}

export function NoteExportStatus({
  state,
  className = "",
}: {
  state: UseNoteExportResult;
  className?: string;
}) {
  const { job, loading, busy, error, unavailable, canRetry, canCancel } = state;

  if (unavailable) {
    return (
      <div className={`rounded-[16px] border border-line bg-ice/40 p-3 text-[13px] text-ink-soft ${className}`}>
        La exportación automática a historia clínica no está disponible en este entorno.
      </div>
    );
  }

  // Durante la carga inicial no se afirma nada: no sabemos todavía si hay trabajo.
  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-[13px] text-ink-soft ${className}`}>
        <Loader2 size={14} className="animate-spin" aria-hidden />
        Consultando el estado de la exportación…
      </div>
    );
  }

  if (!job) {
    return error
      ? <p className={`text-[13px] text-danger-ink ${className}`} role="alert">{error}</p>
      : null;
  }

  const { badge, tone, detail } = noteExportLabel(job);
  const inProgress = job.status === "pending" || job.status === "claimed";

  return (
    <div className={`clinical-panel p-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={BADGE_TONE[tone]}>
          <StatusIcon tone={tone} />
          {badge}
        </Badge>
        {inProgress && <Loader2 size={14} className="animate-spin text-ink-soft" aria-hidden />}
        {job.attempts > 1 && (
          <span className="text-xs text-ink-soft">intento {job.attempts}</span>
        )}
      </div>

      <p className="mt-2 text-[13px] text-ink-soft" aria-live="polite">{detail}</p>

      {job.hash_source === "computed_at_export" && (
        <p className="mt-1 text-xs text-ink-soft">
          Nota firmada antes de que la firma incluyera su hash: no se pudo re-verificar el contenido
          contra la firma.
        </p>
      )}

      {error && (
        <p className="mt-2 text-[13px] text-danger-ink" role="alert">{error}</p>
      )}

      {(canRetry || canCancel) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {canRetry && (
            <button
              type="button"
              onClick={() => void state.retry()}
              disabled={busy}
              className="clinical-secondary min-h-10 px-3.5 py-2 text-[13px] disabled:opacity-60"
            >
              {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <RefreshCw size={15} aria-hidden />}
              Reintentar exportación
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={() => void state.cancel()}
              disabled={busy}
              className="clinical-secondary min-h-10 px-3.5 py-2 text-[13px] disabled:opacity-60"
            >
              <X size={15} aria-hidden />
              Cancelar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Botón "Exportar a HC". Deshabilitado mientras hay una acción en vuelo o un
 * trabajo vivo: es la primera barrera contra el doble clic (la segunda es la
 * idempotencia del backend, que cubre dos pestañas o dos dispositivos).
 */
export function NoteExportButton({
  state,
  className = "",
  label = "Exportar a historia clínica",
}: {
  state: UseNoteExportResult;
  className?: string;
  label?: string;
}) {
  const { job, busy, canRequest, loading, unavailable } = state;
  const inProgress = job?.status === "pending" || job?.status === "claimed";
  const done = job?.status === "completed";

  if (unavailable) return null;

  const disabled = busy || loading || inProgress || done || !canRequest;
  const text = done
    ? "Exportada a historia clínica"
    : inProgress
      ? "Exportación en curso…"
      : busy
        ? "Enviando…"
        : label;

  return (
    <button
      type="button"
      onClick={() => void state.requestExport()}
      disabled={disabled}
      aria-busy={busy}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {busy || inProgress
        ? <Loader2 size={17} className="animate-spin" aria-hidden />
        : done
          ? <CheckCircle2 size={17} aria-hidden />
          : <Send size={17} aria-hidden />}
      {text}
    </button>
  );
}
