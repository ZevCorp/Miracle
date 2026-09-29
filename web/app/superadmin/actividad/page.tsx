// Explorador del registro de auditoría.
//
// Sustituye al redirect que esta ruta era (mandaba a /analitica). Los eventos
// existen desde el principio pero solo se veían ocho en el Resumen, sin hora y
// sin salida: aquí se pueden filtrar, paginar y descargar.
//
// Sin RPC nueva: public.audit_events ya tiene la política "superadmin reads
// audit", así que basta la consulta con RLS.

import Link from "next/link";
import { Download, ScrollText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatFechaRelativa } from "@/lib/dates";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/app/EmptyState";
import { Pager } from "@/components/app/Pager";
import { FilterBar } from "@/components/superadmin/FilterBar";
import { RangePicker } from "@/components/superadmin/RangePicker";
import { resolverRango } from "@/lib/superadmin/rango";
import {
  cargarOpciones,
  construirConsulta,
  etiquetaAccion,
  nombreOrg,
  paramsFiltros,
  resolverFiltros,
  type EventoAuditoria,
} from "@/lib/superadmin/actividad";

const PAGE_SIZE = 50;
const BASE = "/superadmin/actividad";

type Params = {
  rango?: string;
  desde?: string;
  hasta?: string;
  org?: string;
  accion?: string;
  actor?: string;
  q?: string;
  page?: string;
};

export default async function SuperadminActividadPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const db = await createClient();

  const rango = resolverRango(sp);
  const opciones = await cargarOpciones(db);
  const filtros = resolverFiltros(sp, rango, opciones);

  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const { data, count, error } = await construirConsulta(db, filtros).range(
    from,
    from + PAGE_SIZE - 1,
  );
  const eventos = (data ?? []) as unknown as EventoAuditoria[];
  const total = count ?? 0;

  const params = paramsFiltros(filtros);
  const exportHref = `${BASE}/export?${new URLSearchParams(
    Object.entries(params).filter((entrada): entrada is [string, string] => Boolean(entrada[1])),
  ).toString()}`;

  const orgNombre = new Map(opciones.orgs.map((o) => [o.id, o.name]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-deep">
            <ScrollText size={22} className="text-accent" /> Registro de actividad
          </h1>
          <p className="text-sm text-muted">
            Todo lo que ha pasado en la plataforma, de todas las organizaciones. Filtra y
            descárgalo para analizarlo aparte.
          </p>
        </div>
        {/* prefetch={false}: es una descarga, no una página. Sin esto Next la
            pediría al pasar el ratón por encima y generaría el CSV de más. */}
        <Link
          href={exportHref}
          prefetch={false}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-deep hover:border-mist"
        >
          <Download size={15} /> Descargar CSV
        </Link>
      </div>

      <RangePicker
        basePath={BASE}
        rango={rango}
        preserved={{
          org: filtros.org === "todos" ? undefined : filtros.org,
          accion: filtros.accion === "todos" ? undefined : filtros.accion,
          actor: filtros.actor === "todos" ? undefined : filtros.actor,
          q: filtros.termino || undefined,
        }}
      />

      <FilterBar
        basePath={BASE}
        searchPlaceholder="Buscar por acción, detalle o persona"
        initialQuery={filtros.termino}
        preserved={rango.params}
        selects={[
          {
            name: "org",
            value: filtros.org,
            allLabel: "Todas las organizaciones",
            options: opciones.orgs.map((o) => ({ value: o.id, label: o.name })),
          },
          {
            name: "accion",
            value: filtros.accion,
            allLabel: "Todas las acciones",
            options: opciones.acciones.map((a) => ({ value: a, label: etiquetaAccion(a) })),
          },
          {
            name: "actor",
            value: filtros.actor,
            allLabel: "Todas las personas",
            options: opciones.actores.map((a) => ({ value: a.id, label: a.nombre })),
          },
        ]}
      />

      {error ? (
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          No fue posible cargar el registro. Verifica que la política RLS{" "}
          <code>superadmin reads audit</code> esté aplicada.
        </div>
      ) : null}

      <p className="text-sm text-muted">
        {total.toLocaleString("es-CO")} {total === 1 ? "evento" : "eventos"} en{" "}
        {rango.etiqueta.toLowerCase()}.
      </p>

      {/* --- Tabla ---------------------------------------------------------- */}
      <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-xs)]">
        <div className="hidden grid-cols-[1.1fr_1fr_1.6fr_.9fr] gap-4 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted lg:grid">
          <span>Acción</span>
          <span>Persona</span>
          <span>Detalle</span>
          <span>Cuándo</span>
        </div>
        {eventos.map((evento, index) => (
          <div
            key={evento.id}
            className={`grid grid-cols-1 gap-2 px-5 py-4 lg:grid-cols-[1.1fr_1fr_1.6fr_.9fr] lg:items-baseline lg:gap-4 ${
              index ? "border-t border-line" : ""
            }`}
          >
            <div className="min-w-0 text-sm font-medium text-deep">
              {etiquetaAccion(evento.accion)}
            </div>

            <div className="min-w-0">
              <div className="truncate text-sm text-deep">{evento.actor_name ?? "Sistema"}</div>
              <div className="truncate text-xs text-muted">
                {nombreOrg(evento) ?? orgNombre.get(evento.organization_id ?? "") ?? "—"}
              </div>
            </div>

            <div className="min-w-0 text-sm text-muted">
              {evento.detalle ? (
                <span className="line-clamp-2">{evento.detalle}</span>
              ) : (
                <span className="text-mist">—</span>
              )}
            </div>

            <div className="text-sm text-muted">{formatFechaRelativa(evento.fecha)}</div>
          </div>
        ))}

        {eventos.length === 0 && !error ? (
          <div className="p-5">
            <EmptyState
              icon={<ScrollText size={20} />}
              title="Nada coincide con el filtro"
              description={`Sin eventos en ${rango.etiqueta.toLowerCase()}. Amplía el rango de fechas o quita filtros.`}
            />
          </div>
        ) : null}
      </div>

      <Pager basePath={BASE} page={page} pageSize={PAGE_SIZE} total={total} params={params} />

      {/* El CSV incluye `detalle` porque hoy es metadato operativo (quién firmó,
          hash de la nota, de dónde salió) y sin él la descarga pierde casi todo
          su valor. No lleva transcripciones ni datos de pacientes. Aun así
          nombra profesionales y organizaciones, y eso ya no debería salir de la
          plataforma sin pensarlo — de ahí el aviso. */}
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Badge tone="neutral">Antes de compartir</Badge>
        El CSV no lleva transcripciones ni datos de pacientes, pero sí nombres de
        profesionales y organizaciones. Trátalo como información interna.
      </p>
    </div>
  );
}
