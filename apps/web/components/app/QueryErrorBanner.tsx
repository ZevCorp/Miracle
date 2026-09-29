import { AlertBanner } from "@/components/ui/AlertBanner";

/**
 * Aviso de que los datos NO se pudieron leer.
 *
 * POR QUÉ EXISTE: las listas descartaban el error de Supabase y renderizaban la
 * lista vacía, así que una caída de la base se veía exactamente igual que "no
 * tienes nada pendiente". En una app clínica, donde la pregunta del médico es
 * "¿me falta firmar algo?", esas dos respuestas no se pueden confundir.
 *
 * Es warning y no danger a propósito: un fallo de LECTURA significa "no
 * sabemos", no "algo se dañó" (regla fijada en AlertBanner). El reintento es un
 * enlace normal al mismo URL —una recarga completa—: esto vive en páginas de
 * servidor y así funciona sin JavaScript.
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
    <AlertBanner tone="warning" title={titulo}>
      {detalle}{" "}
      <a
        href={reintentarHref}
        className="font-semibold underline underline-offset-2"
      >
        Reintentar
      </a>
    </AlertBanner>
  );
}
