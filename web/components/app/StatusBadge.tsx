import { Badge } from "@/components/ui/Badge";
import { STATUS_LABEL, statusTone, type ConsultationStatus } from "@/lib/mock";

/**
 * Chip de filtro *activo*, con el mismo color que el badge del estado que filtra:
 * el médico aprende un solo código de color y ve de inmediato en qué parte del
 * flujo está mirando. El chip inactivo es neutro en todas las páginas.
 * "Todas" no filtra ningún estado, así que usa el acento de la interfaz.
 */
export const STATUS_CHIP_ACTIVE: Record<ConsultationStatus | "todas", string> = {
  todas: "border-accent bg-accent-soft text-accent-ink",
  en_curso: "border-warning/40 bg-warning-soft text-warning",
  borrador: "border-mist bg-ice text-ink-soft",
  revisada: "border-warning/40 bg-warning-soft text-warning",
  aprobada: "border-accent bg-accent-soft text-accent-ink",
  exportada: "border-success/40 bg-success-soft text-success",
};

/** Franja sólida del color del estado (cabecera de la vista rápida). */
export const STATUS_BAR: Record<ConsultationStatus, string> = {
  en_curso: "bg-warning",
  borrador: "bg-mist",
  revisada: "bg-warning",
  aprobada: "bg-accent",
  exportada: "bg-success",
};

export function StatusBadge({ estado }: { estado: ConsultationStatus }) {
  return (
    <Badge tone={statusTone(estado)}>
      <span
        className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70"
        aria-hidden
      />
      {STATUS_LABEL[estado]}
    </Badge>
  );
}
