import { AlertTriangle } from "lucide-react";

/**
 * Aviso de que los datos NO se pudieron leer.
 *
 * POR QUÉ EXISTE: las listas descartaban el error de Supabase y renderizaban la
 * lista vacía, así que una caída de la base se veía exactamente igual que "no
 * tienes nada pendiente". En una app clínica, donde la pregunta del médico es
 * "¿me falta firmar algo?", esas dos respuestas no se pueden confundir.
 *
 * El reintento es un enlace normal al mismo URL —una recarga completa— a
 * propósito: esto vive en páginas de servidor, y así funciona sin convertirlas
 * en componentes de cliente ni añadir JavaScript.
 */
export function QueryErrorBanner({
  titulo = "No fue posible cargar los datos",
  detalle = "Puede ser una falla temporal de conexión.",
  reintentarHref,
}: {
  titulo?: string;
  detalle?: string;
  /** URL actual, para que el reintento conserve filtros y página. */
  reintentarHref: string;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-[14px] border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning"
    >
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold">{titulo}</p>
        <p className="mt-0.5 opacity-90">
          {detalle}{" "}
          <a href={reintentarHref} className="font-semibold underline underline-offset-2">
            Reintentar
          </a>
        </p>
      </div>
    </div>
  );
}
