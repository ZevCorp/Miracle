import { CheckCircle2, AlertTriangle } from "lucide-react";

/** Muestra el mensaje de éxito/error que las acciones pasan por query params. */
export function FlashBanner({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-success/40 bg-success-soft px-4 py-3 text-sm text-success">
      <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
      <span>{ok}</span>
    </div>
  );
}
