import { STATUS_LABEL, statusTone, type ConsultationStatus } from "@/lib/mock";

type Tono = ReturnType<typeof statusTone>;

/**
 * Los cuatro estados se pintan como CONJUNTO, no uno por uno: su trabajo no es
 * verse bonitos por separado sino distinguirse ENTRE SÍ de un vistazo, en una
 * lista donde aparecen mezclados.
 *
 * Antes se apoyaban en los tonos genéricos de `Badge` y el resultado era
 * ilegible: el fondo de "neutral" (--color-ice, #e7f0fe) y el de "accent"
 * (--color-accent-soft, #eef4fe) son AMBOS azul pálido, y el del azul era
 * incluso más claro que el del gris. Solo cambiaba el color del texto, asi que
 * "Borrador" y "Aprobada" se leían casi idénticos.
 *
 * Ahora cada uno saca su fondo de su propio color con opacidad, en vez de un
 * token de superficie: el gris sale de `mist` (gris real, sin tinte azul) y el
 * azul de `accent` a fuerza suficiente para leerse azul. El anillo le da borde
 * a la pastilla para que no se difumine sobre el blanco de la tarjeta.
 *
 * Al derivarse de los tokens con opacidad, el modo oscuro sale solo: ahí esos
 * mismos tokens ya son claros y la mezcla ocurre sobre el fondo oscuro.
 */
const CLASES: Record<Tono, string> = {
  neutral: "bg-mist/25 text-ink-soft ring-mist/45",
  warning: "bg-warning/18 text-warning-ink ring-warning/40",
  accent: "bg-accent/26 text-accent-ink ring-accent/50",
  success: "bg-success/18 text-success-ink ring-success/40",
};

/**
 * Chip de filtro *activo*, con el mismo color que el badge del estado que
 * filtra: el médico aprende un solo código de color y ve de inmediato en qué
 * parte del flujo está mirando. El chip inactivo es neutro en todas las
 * páginas. "Todas" no filtra ningún estado, así que usa el acento de la
 * interfaz.
 */
export const STATUS_CHIP_ACTIVE: Record<ConsultationStatus | "todas", string> = {
  todas: "border-accent bg-accent/12 text-accent-ink",
  en_curso: "border-warning/50 bg-warning/15 text-warning-ink",
  borrador: "border-mist bg-mist/25 text-ink-soft",
  revisada: "border-warning/50 bg-warning/15 text-warning-ink",
  aprobada: "border-accent bg-accent/20 text-accent-ink",
  exportada: "border-success/50 bg-success/15 text-success-ink",
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
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${CLASES[statusTone(estado)]}`}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full bg-current"
        aria-hidden
      />
      {STATUS_LABEL[estado]}
    </span>
  );
}
