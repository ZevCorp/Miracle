import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { esDeHoy, formatFechaRelativa } from "@/lib/dates";

export type DeviceRow = {
  /** Nombre principal: persona o dispositivo. */
  primary: string;
  /** Línea secundaria: máquina, modelo, sistema operativo. */
  secondary?: string | null;
  version?: string | null;
  /** true cuando la versión es menor a la más reciente vista en la flota. */
  versionOutdated?: boolean;
  lastSeenAt?: string | null;
};

/**
 * Flota de una app instalada (Windows o móvil): quién la tiene, qué versión
 * corre y cuándo se vio por última vez. El punto verde marca "visto hoy" — la
 * señal que de verdad importa para saber si la instalación está viva.
 */
export function DeviceTable({
  title,
  icon: Icon,
  emptyLabel,
  rows,
}: {
  title: string;
  icon: LucideIcon;
  emptyLabel: string;
  rows: DeviceRow[];
}) {
  return (
    <Card className="min-w-0">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
        <Icon size={15} /> {title}
      </h2>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {rows.map((row, index) => {
            const vivoHoy = row.lastSeenAt ? esDeHoy(row.lastSeenAt) : false;
            return (
              <li key={`${row.primary}-${index}`} className="flex items-center gap-3 py-2.5">
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    vivoHoy ? "bg-success" : "bg-mist"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-deep">{row.primary}</div>
                  {row.secondary ? (
                    <div className="truncate text-xs text-muted">{row.secondary}</div>
                  ) : null}
                </div>
                {row.version ? (
                  <Badge tone={row.versionOutdated ? "warning" : "neutral"}>
                    v{row.version}
                    {row.versionOutdated ? " · vieja" : ""}
                  </Badge>
                ) : null}
                <span className="w-24 shrink-0 text-right text-xs text-muted">
                  {row.lastSeenAt ? formatFechaRelativa(row.lastSeenAt) : "Nunca"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
