import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatFechaRelativa } from "@/lib/dates";
import {
  COMPLETITUD_MINIMA,
  ETIQUETA_ADOPCION,
  MUESTRA_MINIMA_COMPLETITUD,
  estadoAdopcion,
  tonoSinFirmar,
  type EstadoAdopcion,
  type MedicoActividad,
} from "@/lib/hospital/dashboard";

/**
 * Adopción por profesional: quién documenta, quién dejó de hacerlo y quién
 * acumula notas sin firmar.
 *
 * Es la vista que le faltaba al panel. El resto de las cifras describen el
 * volumen de la institución; esta dice de QUIÉN hay que ocuparse, que es la
 * única de las dos sobre la que un administrador puede actuar el mismo día.
 *
 * Incluye a propósito a los profesionales con cero notas en el periodo: son la
 * respuesta a "compramos licencias, ¿las están usando?", y una tabla que solo
 * lista actividad los deja justamente fuera.
 */

// "Nunca ha documentado" es un HECHO sobre la adopción, no una incidencia: en
// una institución que arranca es la mitad del equipo, y en rojo entierra lo
// único sobre lo que se puede actuar hoy —la cola de firma—, que quedaba pintada
// más suave que cuatro filas en cero. El rojo se reserva para la cola cuando se
// desborda (tonoSinFirmar).
const TONO: Record<EstadoAdopcion, "success" | "warning" | "danger" | "neutral"> = {
  activo: "success",
  rezagado: "warning",
  sin_uso: "neutral",
  nunca: "warning",
};

export function AdoptionTable({
  medicos,
  /** Enlace de "ver sus notas" por médico; sin él, las filas no son navegables. */
  hrefDe,
  max,
}: {
  medicos: MedicoActividad[];
  hrefDe?: (m: MedicoActividad) => string;
  max?: number;
}) {
  if (medicos.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted">
        Todavía no hay profesionales registrados en la institución.
      </p>
    );
  }

  const visibles = max ? medicos.slice(0, max) : medicos;
  const ocultos = medicos.length - visibles.length;

  return (
    <div>
      {/* Cabecera solo en pantallas anchas: en móvil cada fila se lee como
          ficha, con su propia etiqueta por dato. */}
      <div className="hidden grid-cols-[1.6fr_auto_auto_auto] gap-4 border-b border-line pb-2 text-xs font-semibold uppercase tracking-wide text-muted sm:grid">
        <span>Profesional</span>
        <span className="text-right">Notas</span>
        <span className="text-right">Sin firmar</span>
        <span className="text-right">Completitud</span>
      </div>

      <ul className="divide-y divide-line">
        {visibles.map((m) => {
          const estado = estadoAdopcion(m);
          const href = hrefDe?.(m);
          const contenido = (
            <>
              <div className="min-w-0">
                <div className="truncate font-medium text-deep">{m.nombre}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  <Badge tone={TONO[estado]}>{ETIQUETA_ADOPCION[estado]}</Badge>
                  {m.ultima ? (
                    <span>última nota {formatFechaRelativa(m.ultima)}</span>
                  ) : null}
                </div>
              </div>

              <Dato etiqueta="Notas" valor={String(m.consultas)} />
              <Dato
                etiqueta="Sin firmar"
                valor={String(m.sin_firmar)}
                // El tono sale de tonoSinFirmar, que ya distinguía una cola
                // desbordada (≥10) de un par de pendientes. Estaba exportado y
                // sin usar: aquí se pintaba todo de naranja, así que 25 notas
                // atrasadas y 1 se veían igual de graves.
                tono={tonoSinFirmar(m.sin_firmar)}
              />
              <Dato
                etiqueta="Completitud"
                // Sin notas en el periodo no hay promedio que mostrar: un 0%
                // se leería como "documenta mal" cuando el hecho es que no
                // documentó.
                valor={m.consultas ? `${m.completitud}%` : "—"}
                // Con menos de un puñado de notas el promedio es anécdota, no
                // medida: se muestra atenuado y diciendo de cuántas sale.
                atenuado={m.consultas > 0 && m.consultas < MUESTRA_MINIMA_COMPLETITUD}
                titulo={
                  m.consultas > 0 && m.consultas < MUESTRA_MINIMA_COMPLETITUD
                    ? `Promedio de solo ${m.consultas} ${m.consultas === 1 ? "nota" : "notas"}`
                    : undefined
                }
              />
            </>
          );

          const clases =
            "grid grid-cols-2 items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[1.6fr_auto_auto_auto]";

          return (
            <li key={m.medico_id}>
              {href ? (
                <Link href={href} className={`${clases} rounded-[10px] hover:bg-ice-soft`}>
                  {contenido}
                </Link>
              ) : (
                <div className={clases}>{contenido}</div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-muted">
        {ocultos > 0
          ? `Se muestran ${visibles.length} de ${medicos.length} profesionales. `
          : null}
        Las tres cifras son del periodo elegido, incluida la de sin firmar: la
        cola completa de la institución está en «Notas por firmar», que cuenta
        todo el histórico. La completitud RIPS parte de {COMPLETITUD_MINIMA}%
        —toda nota trae identificación y finalidad—, así que el margen real de
        mejora va de {COMPLETITUD_MINIMA}% a 100%.
      </p>
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  tono,
  atenuado,
  titulo,
}: {
  etiqueta: string;
  valor: string;
  tono?: "neutral" | "warning" | "danger";
  /** Dato con base insuficiente: se muestra, pero no compite visualmente. */
  atenuado?: boolean;
  titulo?: string;
}) {
  const color = atenuado
    ? "text-muted"
    : tono === "danger"
      ? "text-danger"
      : tono === "warning"
        ? "text-warning"
        : "text-deep";

  return (
    <div className="text-right" title={titulo}>
      {/* La etiqueta se repite por celda en móvil, donde no hay cabecera de
          tabla que dé contexto a un número suelto. */}
      <span className="mr-2 text-xs text-muted sm:hidden">{etiqueta}</span>
      <span className={`text-sm font-semibold tabular-nums ${color}`}>{valor}</span>
    </div>
  );
}

/** Pie con el acceso a la vista completa; se usa en el dashboard. */
export function AdoptionFooterLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
    >
      Ver adopción completa <ArrowRight size={14} />
    </Link>
  );
}
