// Lista presentacional de hallazgos de auditoría ("qué se puede mejorar").
// Sin hooks ni estado → se usa igual en server components (/app/auditoria) y en
// el cliente (pestaña Auditoría de la consulta). La lógica vive en
// lib/clinical/note-audit.ts; aquí solo se pinta.

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import type { AuditFinding, AuditSeverity } from "@/lib/clinical/note-audit";

const SEVERITY_STYLE: Record<
  AuditSeverity,
  { chip: string; icon: LucideIcon; label: string }
> = {
  critico: { chip: "bg-danger-soft text-danger", icon: AlertTriangle, label: "Crítico" },
  advertencia: {
    chip: "bg-warning-soft text-warning",
    icon: AlertCircle,
    label: "Advertencia",
  },
  sugerencia: { chip: "bg-accent-soft text-accent", icon: Lightbulb, label: "Sugerencia" },
};

/** Insignia de la severidad más grave de una nota (o "al día" si no hay hallazgos). */
export function AuditSeverityBadge({
  severidad,
  size = 18,
}: {
  severidad: AuditSeverity | null;
  size?: number;
}) {
  if (!severidad) {
    return (
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-success-soft text-success"
        aria-label="Al día"
        title="Al día"
      >
        <CheckCircle2 size={size} />
      </span>
    );
  }
  const style = SEVERITY_STYLE[severidad];
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${style.chip}`}
      aria-label={style.label}
      title={style.label}
    >
      <Icon size={size} />
    </span>
  );
}

export function AuditFindingList({
  hallazgos,
  max,
  emptyLabel = "Sin observaciones — la nota está completa y consistente.",
}: {
  hallazgos: AuditFinding[];
  /** Máximo a mostrar; el resto se resume en "+N más". */
  max?: number;
  emptyLabel?: string;
}) {
  if (hallazgos.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-success-soft px-3 py-2.5 text-sm text-success">
        <CheckCircle2 size={16} className="shrink-0" />
        <span>{emptyLabel}</span>
      </div>
    );
  }

  const visibles = typeof max === "number" ? hallazgos.slice(0, max) : hallazgos;
  const ocultos = hallazgos.length - visibles.length;

  return (
    <ul className="space-y-2.5">
      {visibles.map((h) => {
        const style = SEVERITY_STYLE[h.severidad];
        const Icon = style.icon;
        return (
          <li key={h.key} className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${style.chip}`}
              aria-label={style.label}
              title={style.label}
            >
              <Icon size={14} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-deep">{h.titulo}</p>
              <p className="text-xs leading-relaxed text-muted">{h.detalle}</p>
            </div>
          </li>
        );
      })}
      {ocultos > 0 ? (
        <li className="pl-[2.125rem] text-xs font-medium text-muted">
          +{ocultos} observación{ocultos === 1 ? "" : "es"} más
        </li>
      ) : null}
    </ul>
  );
}
