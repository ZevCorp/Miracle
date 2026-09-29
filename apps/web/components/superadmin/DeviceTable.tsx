import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { esDeHoy, formatFechaHora, formatFechaRelativa } from "@/lib/dates";
import { ESTADO_DISPOSITIVO, estadoDispositivo } from "@/lib/superadmin/versiones";

export type DeviceRow = {
  /** Nombre principal: persona o dispositivo. */
  primary: string;
  /** Línea secundaria: máquina, modelo, sistema operativo. */
  secondary?: string | null;
  version?: string | null;
  /** true cuando la versión está por debajo de la más reciente de la flota. */
  versionOutdated?: boolean;
  lastSeenAt?: string | null;
  /** Enlace a la persona dueña del equipo, si se pudo identificar. */
  href?: string;
};

/**
 * Flota de una app instalada (Windows o móvil): quién la tiene, qué versión
 * corre y cuándo se vio por última vez.
 *
 * El punto de estado tiene cuatro niveles y no dos. Con el binario anterior
 * ("visto hoy" sí/no) un equipo trabajando ahora mismo y otro que se conectó a
 * las 7 de la mañana se veían igual, y a medianoche la flota entera se apagaba
 * de golpe sin que hubiera pasado nada. La cabecera resume lo que se quiere
 * saber de un vistazo: cuántos hay, cuántos vivos y cuántos por actualizar.
 */
export function DeviceTable({
  title,
  icon: Icon,
  emptyLabel,
  rows,
  total,
  versionActual,
}: {
  title: string;
  icon: LucideIcon;
  emptyLabel: string;
  rows: DeviceRow[];
  /** Equipos en total; puede ser mayor que `rows` si la RPC recortó. */
  total?: number;
  /** La versión más alta de TODA la flota, no solo de las filas visibles. */
  versionActual?: string | null;
}) {
  const estados = rows.map((row) => estadoDispositivo(row.lastSeenAt, esDeHoy));
  const activosHoy = estados.filter((e) => e === "en_linea" || e === "hoy").length;
  const desactualizados = rows.filter((row) => row.versionOutdated).length;
  const totalReal = total ?? rows.length;

  const resumen = [
    `${totalReal} ${totalReal === 1 ? "equipo" : "equipos"}`,
    `${activosHoy} ${activosHoy === 1 ? "activo hoy" : "activos hoy"}`,
    desactualizados > 0
      ? `${desactualizados} en versión vieja`
      : versionActual
        ? `todos en v${versionActual}`
        : null,
  ].filter(Boolean);

  return (
    <Card className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
          <Icon size={15} /> {title}
        </h2>
        {rows.length > 0 ? (
          <span className="text-xs text-muted">{resumen.join(" · ")}</span>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {rows.map((row, index) => {
            const estado = estados[index];
            const { punto, etiqueta } = ESTADO_DISPOSITIVO[estado];
            const nombre = row.href ? (
              <Link href={row.href} className="truncate text-sm font-medium text-deep hover:text-accent">
                {row.primary}
              </Link>
            ) : (
              <span className="truncate text-sm font-medium text-deep">{row.primary}</span>
            );

            return (
              <li key={`${row.primary}-${index}`} className="flex items-center gap-3 py-2.5">
                {/* title en el punto: el color solo no comunica el estado. */}
                <span
                  title={etiqueta}
                  aria-label={etiqueta}
                  className={`h-2 w-2 shrink-0 rounded-full ${punto}`}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  {nombre}
                  {row.secondary ? (
                    <span className="truncate text-xs text-muted">{row.secondary}</span>
                  ) : null}
                </div>
                {row.version ? (
                  <Badge tone={row.versionOutdated ? "warning" : "neutral"}>
                    v{row.version}
                    {row.versionOutdated ? " · vieja" : ""}
                  </Badge>
                ) : null}
                <span
                  className="w-24 shrink-0 text-right text-xs text-muted"
                  title={row.lastSeenAt ? formatFechaHora(row.lastSeenAt) : etiqueta}
                >
                  {row.lastSeenAt ? formatFechaRelativa(row.lastSeenAt) : "Nunca"}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {totalReal > rows.length ? (
        <p className="mt-3 text-xs text-muted">
          Se muestran los {rows.length} más recientes de {totalReal}.
        </p>
      ) : null}
    </Card>
  );
}
