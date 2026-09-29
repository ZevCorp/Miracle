import Link from "next/link";
import { AlertTriangle, CheckCircle2, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";

export type Severidad = "critica" | "atencion" | "info";

export type Alerta = {
  id: string;
  label: string;
  count: number;
  severity: Severidad;
  /** Solo si existe de verdad una lista filtrada a la que ir. */
  href?: string;
  hint?: string;
  icon?: LucideIcon;
};

const ORDEN: Record<Severidad, number> = { critica: 0, atencion: 1, info: 2 };

const ESTILO: Record<Severidad, { borde: string; texto: string }> = {
  critica: { borde: "border-l-danger", texto: "text-danger" },
  atencion: { borde: "border-l-warning", texto: "text-warning" },
  info: { borde: "border-l-mist", texto: "text-deep" },
};

/**
 * Panel "Atención": qué necesita a alguien, ordenado por gravedad.
 *
 * Tres decisiones que lo diferencian de la lista de números que era antes:
 *
 *  · ESTADO VACÍO EXPLÍCITO. Antes una plataforma sana y una rota se veían
 *    idénticas —cinco filas, unas con 0 y otras con 7—, así que había que leer
 *    los números para saberlo. Ahora "todo en orden" se dice con todas las letras.
 *
 *  · LAS FILAS EN CERO SE PLIEGAN. Un muro de ceros entierra el único 4 que
 *    importa.
 *
 *  · SOLO SE ENLAZA DONDE HAY ADÓNDE IR. Un enlace que lleva a una lista sin
 *    filtrar es peor que ningún enlace: promete una respuesta y no la da.
 *
 * La severidad nunca se comunica solo con color (borde + icono + texto), igual
 * que en StatTile.
 */
export function AlertPanel({
  alertas,
  titulo = "Atención",
}: {
  alertas: Alerta[];
  titulo?: string;
}) {
  const activas = alertas
    .filter((a) => a.count > 0)
    .sort((a, b) => ORDEN[a.severity] - ORDEN[b.severity] || b.count - a.count);
  const enCero = alertas.filter((a) => a.count === 0);

  return (
    <Card className="min-w-0">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
        <AlertTriangle size={15} /> {titulo}
      </h2>

      {activas.length === 0 ? (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-success/30 bg-mint-soft px-4 py-3">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
          <div>
            <p className="text-sm font-semibold text-deep">Nada que atender</p>
            <p className="text-xs text-muted">
              Sin notas fallidas, sin consultas atascadas y sin borradores viejos.
            </p>
          </div>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {activas.map((alerta) => {
            const estilo = ESTILO[alerta.severity];
            const Icono = alerta.icon;
            const contenido = (
              <>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {Icono ? <Icono size={14} className={`shrink-0 ${estilo.texto}`} /> : null}
                    <span className="truncate text-sm font-medium text-deep">{alerta.label}</span>
                  </div>
                  {alerta.hint ? (
                    <span className="mt-0.5 block text-xs text-muted">{alerta.hint}</span>
                  ) : null}
                </div>
                <span className={`shrink-0 font-display text-lg font-semibold ${estilo.texto}`}>
                  {alerta.count}
                </span>
              </>
            );

            const clases = `flex items-center gap-3 rounded-r-lg border-l-[3px] bg-pearl px-3 py-2.5 ${estilo.borde}`;

            return (
              <li key={alerta.id}>
                {alerta.href ? (
                  <Link href={alerta.href} className={`${clases} transition-colors hover:bg-ice-soft`}>
                    {contenido}
                  </Link>
                ) : (
                  <div className={clases}>{contenido}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {enCero.length > 0 && activas.length > 0 ? (
        <p className="mt-3 text-xs text-muted">
          Sin novedad en: {enCero.map((a) => a.label.toLowerCase()).join(", ")}.
        </p>
      ) : null}
    </Card>
  );
}
