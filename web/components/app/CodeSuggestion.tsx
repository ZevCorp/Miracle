import { Check, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { ClinicalCode } from "@/lib/mock";

export function CodeSuggestion({
  code,
  onAccept,
  onDiscard,
}: {
  code: ClinicalCode;
  onAccept?: () => void;
  onDiscard?: () => void;
}) {
  const accepted = code.estado === "aceptado";
  const discarded = code.estado === "descartado";

  return (
    <div
      className={`rounded-md border p-3 ${
        accepted
          ? "border-success/30 bg-success-soft/40"
          : discarded
            ? "border-line bg-pearl opacity-70"
            : "border-line bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Badge tone={code.sistema === "CIE-10" ? "accent" : "mint"}>
            {code.sistema}
          </Badge>
          <div className="min-w-0">
            <div className="font-mono text-sm font-semibold text-deep">
              {code.codigo}
            </div>
            <div className="text-sm text-ink-soft">{code.descripcion}</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {accepted ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
              <Check size={13} /> Aceptado
            </span>
          ) : discarded ? (
            <button
              type="button"
              onClick={onAccept}
              className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-muted hover:text-deep"
            >
              <RotateCcw size={13} /> Restaurar
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onAccept}
                aria-label="Aceptar código"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent text-white hover:bg-accent-hover"
              >
                <Check size={16} />
              </button>
              <button
                type="button"
                onClick={onDiscard}
                aria-label="Descartar código"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted hover:text-danger"
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {!discarded ? (
        <div className="mt-2.5 flex items-center gap-2">
          <span className="text-xs text-muted">Confianza</span>
          <span className="h-1.5 w-28 overflow-hidden rounded-full bg-ice">
            <span
              className="block h-full rounded-full bg-success"
              style={{ width: `${code.confianza}%` }}
            />
          </span>
          <span className="text-xs font-medium text-muted">
            {code.confianza}%
          </span>
        </div>
      ) : null}
    </div>
  );
}
