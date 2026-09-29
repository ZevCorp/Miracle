import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  OctagonAlert,
} from "lucide-react";

/**
 * EL aviso de la app. Antes había ~17 cajas escritas a mano con bordes,
 * fondos y radios distintos; el mismo evento se pintaba ámbar en una pantalla
 * y rojo en otra. Este componente fija la regla de una vez:
 *
 *   - warning  → no pudimos LEER algo (no sabemos el estado real)
 *   - danger   → una ACCIÓN falló (guardar, generar, subir)
 *   - success  → confirmación de que algo quedó hecho
 *   - info     → contexto neutral (fases en curso, avisos)
 *
 * Sin hooks: sirve igual en páginas de servidor y de cliente.
 */

type Tone = "warning" | "danger" | "success" | "info";

const TONE_CLASSES: Record<Tone, string> = {
  warning: "border-warning/40 bg-warning-soft text-warning",
  danger: "border-danger/30 bg-danger-soft text-danger-ink",
  success: "border-success/25 bg-success-soft text-success",
  info: "border-accent/25 bg-accent-soft/50 text-accent-ink",
};

const TONE_ICON: Record<Tone, typeof AlertTriangle> = {
  warning: AlertTriangle,
  danger: OctagonAlert,
  success: CheckCircle2,
  info: Info,
};

export function AlertBanner({
  tone,
  title,
  children,
  action,
  className = "",
}: {
  tone: Tone;
  /** Primera línea en negrita. Sin título, el contenido va directo. */
  title?: string;
  children?: ReactNode;
  /** Botón o enlace a la derecha (p. ej. Reintentar). */
  action?: ReactNode;
  className?: string;
}) {
  const Icon = TONE_ICON[tone];
  // Un fallo exige atención inmediata del lector de pantalla; una
  // confirmación o un dato de contexto no interrumpen.
  const role = tone === "warning" || tone === "danger" ? "alert" : "status";

  return (
    <div
      role={role}
      className={`flex items-start gap-3 rounded-[12px] border px-4 py-3 text-sm ${TONE_CLASSES[tone]} ${className}`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? (
          <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
