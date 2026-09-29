import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  ClipboardList,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { formatFechaHora, formatFechaRelativa } from "@/lib/dates";
import { FlashBanner } from "@/components/superadmin/FlashBanner";
import { StatTile } from "@/components/superadmin/charts/StatTile";
import { TrendChart } from "@/components/superadmin/charts/TrendChart";
import { BarList } from "@/components/superadmin/charts/BarList";
import { Sparkline } from "@/components/superadmin/charts/Sparkline";
import { RangePicker } from "@/components/superadmin/RangePicker";
import { AutoRefresh } from "@/components/superadmin/AutoRefresh";
import {
  etiquetaPeriodoAnterior,
  resolverRango,
  type RangoResuelto,
} from "@/lib/superadmin/rango";

type Kpi = { value: number; previous?: number; delta_pct: number | null };

type Dashboard = {
  generated_at: string;
  /** Ventana que la RPC resolvió de verdad (puede diferir de la pedida). */
  rango: { desde: string; hasta: string; dias: number };
  kpis: {
    consultas: Kpi;
    medicos: Kpi;
    organizaciones: { value: number; total: number };
    exito_notas: { value: number | null; fallidos: number; total: number };
  };
  serie_diaria: {
    date: string;
    consultations: number;
    encounters: number;
    /** Médicos distintos con consulta ese día. Llega desde la migración
        20260808…; opcional para que la página siga sirviendo si la base
        todavía tiene la versión anterior de la RPC. */
    medicos?: number;
  }[];
  organizaciones: {
    id: string;
    name: string;
    kind: string;
    nit: string | null;
    members: number;
    /** Médicos activos DENTRO del rango elegido. `members_active_30d` es el
        nombre viejo del mismo dato, que solo era exacto con el rango por
        defecto; se conserva como respaldo mientras se aplica la migración. */
    members_active_rango?: number;
    members_active_30d: number;
    consultas_total: number;
    /** Consultas dentro del rango elegido. Es lo que manda el selector. */
    consultas_rango: number;
    consultas_30d: number;
    consultas_7d: number;
    last_activity_at: string | null;
    weekly: number[];
  }[];
  especialidades: { name: string; count: number }[];
  actividad_reciente: {
    id: string;
    accion: string;
    actor: string | null;
    organizacion: string | null;
    fecha: string;
  }[];
  salud: {
    encounters_stuck: number;
    encounters_failed: number;
  };
};

const nf = new Intl.NumberFormat("es-CO");

/** Organizaciones que caben en el resumen. El listado completo tiene su página. */
const TOPE_TABLA = 8;

export default async function SuperadminResumenPage({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string;
    error?: string;
    rango?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  const sp = await searchParams;
  const { ok, error } = sp;
  const db = await createClient();

  const rango = resolverRango(sp);
  const { data, error: rpcError } = await db.rpc("superadmin_dashboard", rango.rpcArgs);
  const dash = (data ?? null) as Dashboard | null;

  if (rpcError || !dash) {
    return (
      <div className="space-y-6">
        <Encabezado rango={rango} />
        <FlashBanner ok={ok} error={error} />
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          <p>
            No fue posible cargar las métricas. Verifica que la migración{" "}
            <code>superadmin_dashboard</code> esté aplicada en la base.
          </p>
          {/* El motivo real, no solo la sospecha más probable: quien ve esta
              página ya es super-admin y sin el mensaje de Postgres el
              diagnóstico se hace a ciegas. */}
          {rpcError?.message ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold">Detalle técnico</summary>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs">{rpcError.message}</pre>
            </details>
          ) : null}
        </div>
      </div>
    );
  }

  const { kpis, serie_diaria, organizaciones, especialidades, actividad_reciente, salud } = dash;

  // La sparkline de las tarjetas usa los últimos 14 días: suficiente para ver
  // la forma sin convertir la microtendencia en una gráfica en miniatura.
  const ultimos = serie_diaria.slice(-14);
  const sparkConsultas = ultimos.map((d) => d.consultations);
  // La tarjeta de médicos usaba la serie del ASISTENTE CLÍNICO: el titular
  // contaba médicos y la línea de debajo contaba encuentros, dos métricas
  // distintas en la misma tarjeta. Ahora usa su propia serie, y si la base aún
  // no la devuelve se queda sin sparkline en vez de dibujar otra cosa.
  const sparkMedicos = ultimos.every((d) => typeof d.medicos === "number")
    ? ultimos.map((d) => d.medicos as number)
    : undefined;

  const activosEnRango = (org: Dashboard["organizaciones"][number]) =>
    org.members_active_rango ?? org.members_active_30d;

  // La tarjeta de volumen mide el PERIODO, así que se filtra por el periodo. Con
  // el filtro puesto en "tiene histórico" un rango tranquilo llenaba la tarjeta
  // de seis barras en cero, que ocupan sitio y no dicen nada.
  const topOrgs = organizaciones.filter((o) => o.consultas_rango > 0).slice(0, 6);
  const orgsTabla = organizaciones.slice(0, TOPE_TABLA);

  // Etiquetas derivadas del rango: nada de textos fijos "últimos 30 días", que
  // mentirían en cuanto se cambia el periodo.
  const periodo = rango.etiqueta.toLowerCase();
  const comparativa = etiquetaPeriodoAnterior(rango);

  // Un periodo sin consultas en una plataforma que sí tiene histórico no es una
  // plataforma parada: casi siempre es un rango demasiado estrecho. Se dice,
  // porque cuatro ceros y una gráfica plana no distinguen los dos casos.
  const periodoVacio =
    kpis.consultas.value === 0 && organizaciones.some((o) => o.consultas_total > 0);

  return (
    <div className="space-y-6">
      <Encabezado generadoEn={dash.generated_at} rango={rango} />
      <FlashBanner ok={ok} error={error} />

      <BandaOperativa
        fallidasEnRango={kpis.exito_notas.fallidos}
        atascadas={salud.encounters_stuck}
        periodo={periodo}
      />

      {periodoVacio ? (
        <p className="rounded-lg border border-line bg-ice-soft px-4 py-3 text-sm text-ink-soft">
          Sin consultas en {periodo}, aunque la plataforma sí tiene actividad registrada.{" "}
          <Link href="/superadmin?rango=90" className="font-semibold text-accent hover:underline">
            Mirar los últimos 90 días
          </Link>
          .
        </p>
      ) : null}

      {/* --- Fila de KPIs ------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Consultas del periodo"
          value={nf.format(kpis.consultas.value)}
          deltaPct={kpis.consultas.delta_pct}
          previousLabel={comparativa}
          spark={sparkConsultas}
          icon={ClipboardList}
        />
        <StatTile
          label="Médicos trabajando"
          value={nf.format(kpis.medicos.value)}
          deltaPct={kpis.medicos.delta_pct}
          previousLabel={comparativa}
          spark={sparkMedicos}
          icon={Stethoscope}
        />
        <StatTile
          label="Organizaciones activas"
          value={nf.format(kpis.organizaciones.value)}
          suffix={`de ${nf.format(kpis.organizaciones.total)}`}
          footnote={`con consultas en ${periodo}`}
          icon={Building2}
        />
        <StatTile
          label="Notas sin fallar"
          value={kpis.exito_notas.value === null ? "—" : `${kpis.exito_notas.value}%`}
          footnote={
            kpis.exito_notas.total === 0
              ? `sin actividad del asistente en ${periodo}`
              : `${nf.format(kpis.exito_notas.fallidos)} fallidas de ${nf.format(kpis.exito_notas.total)}`
          }
          footnoteTone={kpis.exito_notas.fallidos > 0 ? "warning" : undefined}
          icon={ShieldCheck}
        />
      </div>

      {/* --- Gráfica principal + actividad -------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-[1.75fr_1fr]">
        {/* min-w-0: sin esto la gráfica, que tiene ancho mínimo propio para que
            sus ejes sigan siendo legibles, estira la tarjeta y desborda la página. */}
        <Card className="min-w-0">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Atenciones por día
            </h2>
            <span className="text-xs text-muted">{rango.etiqueta}</span>
          </div>
          <p className="mb-4 text-xs text-muted">
            Las consultas de la web y las del asistente clínico se cuentan aparte: una misma
            atención puede quedar registrada en ambos.
          </p>
          <TrendChart data={serie_diaria} periodo={periodo} />
        </Card>

        <Card className="flex min-w-0 flex-col">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Actividad reciente
            </h2>
            {/* Siempre el enlace al explorador. Antes se sustituía por el aviso
                de incidencias, así que justo cuando algo estaba roto se perdía
                el acceso al historial; las incidencias ya tienen su banda arriba. */}
            <Link
              href="/superadmin/actividad"
              className="text-xs font-semibold text-accent hover:underline"
            >
              Ver todo →
            </Link>
          </div>

          <ul className="mt-4 min-h-0 flex-1 space-y-3.5 overflow-hidden">
            {actividad_reciente.slice(0, 8).map((evento) => (
              <li key={evento.id} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-serie-1)]" />
                <div className="min-w-0">
                  <div className="truncate text-sm text-deep">{evento.accion}</div>
                  <div className="truncate text-xs text-muted">
                    {evento.actor ?? "Sistema"}
                    {evento.organizacion ? ` · ${evento.organizacion}` : ""}
                  </div>
                </div>
                {/* La etiqueta completa, no solo el día: con `.split(" · ")[0]`
                    todas las filas de hoy decían "Hoy" y la lista quedaba sin
                    orden legible. El título lleva la fecha larga al pasar el
                    ratón, para los eventos de hace semanas. */}
                <span
                  className="ml-auto shrink-0 text-xs text-muted"
                  title={formatFechaHora(evento.fecha)}
                >
                  {formatFechaRelativa(evento.fecha)}
                </span>
              </li>
            ))}
            {actividad_reciente.length === 0 ? (
              <li className="text-sm text-muted">Sin eventos registrados.</li>
            ) : null}
          </ul>
        </Card>
      </div>

      {/* --- Organizaciones + especialidades ------------------------------ */}
      <div className="grid gap-4 xl:grid-cols-[1.75fr_1fr]">
        <Card className="min-w-0">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Organizaciones por volumen
            </h2>
            <Link
              href="/superadmin/organizaciones"
              className="text-xs font-semibold text-accent hover:underline"
            >
              Ver todas →
            </Link>
          </div>
          <BarList
            items={topOrgs.map((org) => ({
              label: org.name,
              value: org.consultas_rango,
              hint: `${activosEnRango(org)} de ${org.members} médicos`,
              href: `/superadmin/organizaciones/${org.id}`,
            }))}
            emptyLabel={`Ninguna organización registró consultas en ${periodo}.`}
            trailing={(_, index) => {
              const org = topOrgs[index];
              return org?.weekly?.length ? (
                <Sparkline
                  values={org.weekly}
                  width={64}
                  height={20}
                  label={`Tendencia de ${org.name}`}
                />
              ) : null;
            }}
          />
          <p className="mt-4 text-xs text-muted">
            Consultas de {periodo}, y cuántos miembros de cada organización atendieron en ese
            mismo periodo. La línea muestra las últimas 8 semanas, siempre.
          </p>
        </Card>

        <Card className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Especialidades
          </h2>
          <p className="mb-4 mt-1 text-xs text-muted">Consultas de {periodo}.</p>
          <BarList
            items={especialidades.map((e) => ({ label: e.name, value: e.count }))}
            emptyLabel="Sin consultas registradas."
          />
        </Card>
      </div>

      {/* --- Tabla de organizaciones -------------------------------------- */}
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Organizaciones
          </h2>
          <span className="text-xs text-muted">Ordenadas por consultas de {periodo}</span>
        </div>
        <div className="hidden grid-cols-[1.8fr_.8fr_.8fr_.9fr_1fr] gap-4 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted sm:grid">
          <span>Organización</span>
          <span>Tipo</span>
          <span className="text-center">Médicos activos</span>
          <span className="text-center">Consultas</span>
          <span>Última actividad</span>
        </div>
        {orgsTabla.map((org, index) => (
          <Link
            key={org.id}
            href={`/superadmin/organizaciones/${org.id}`}
            className={`grid grid-cols-2 gap-3 px-5 py-4 transition-colors hover:bg-ice-soft sm:grid-cols-[1.8fr_.8fr_.8fr_.9fr_1fr] sm:items-center sm:gap-4 ${
              index ? "border-t border-line" : ""
            }`}
          >
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <div className="truncate font-medium text-deep">{org.name}</div>
              {org.nit ? <div className="truncate text-sm text-muted">NIT {org.nit}</div> : null}
            </div>
            <div>
              <Badge tone={org.kind === "institution" ? "mint" : "neutral"}>
                {org.kind === "institution" ? "Hospital" : "Personal"}
              </Badge>
            </div>
            {/* En móvil no hay cabecera de tabla, así que cada número lleva la
                suya: sin esto las filas eran "3/5" y "128" sin decir de qué. */}
            <div className="text-sm text-deep sm:text-center">
              <span className="text-xs text-muted sm:hidden">Médicos activos </span>
              {activosEnRango(org)}
              <span className="text-muted">/{org.members}</span>
            </div>
            <div className="text-sm text-deep sm:text-center">
              <span className="text-xs text-muted sm:hidden">Consultas </span>
              {nf.format(org.consultas_rango)}
              {/* El histórico, en segundo plano. Antes esta columna mostraba solo
                  el total de siempre justo debajo de un selector de periodo, así
                  que el número no respondía al control que tenía encima. */}
              <span className="block text-xs text-muted">
                {nf.format(org.consultas_total)} en total
              </span>
            </div>
            <div className="col-span-2 text-sm text-muted sm:col-span-1">
              <span className="text-xs sm:hidden">Última actividad: </span>
              {org.last_activity_at ? formatFechaRelativa(org.last_activity_at) : "Sin actividad"}
            </div>
          </Link>
        ))}
        {organizaciones.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted">Aún no hay organizaciones.</div>
        ) : null}
        {organizaciones.length > TOPE_TABLA ? (
          <div className="border-t border-line px-5 py-3 text-xs text-muted">
            Mostrando {TOPE_TABLA} de {nf.format(organizaciones.length)} organizaciones.{" "}
            <Link
              href="/superadmin/organizaciones"
              className="font-semibold text-accent hover:underline"
            >
              Ver todas →
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Banda operativa: "¿hay algo roto ahora mismo?" antes que cualquier métrica.
 *
 * Antes esto vivía como un enlace de 12px dentro del título de la tarjeta de
 * actividad, donde se lee después de los cuatro KPI y de la gráfica. En una
 * consola de plataforma el orden correcto es el contrario.
 *
 * Las notas fallidas se cuentan DENTRO del periodo, no desde siempre: un fallo
 * de hace tres meses dejaría la banda encendida para siempre y la banda que
 * nunca se apaga deja de leerse. Las atascadas sí son estado actual —siguen sin
 * cerrarse hoy—, así que solas bajan el tono a informativo.
 */
function BandaOperativa({
  fallidasEnRango,
  atascadas,
  periodo,
}: {
  fallidasEnRango: number;
  atascadas: number;
  periodo: string;
}) {
  if (fallidasEnRango === 0 && atascadas === 0) return null;

  const grave = fallidasEnRango > 0;
  const titulo = grave
    ? `${fallidasEnRango} ${fallidasEnRango === 1 ? "nota falló" : "notas fallaron"} en ${periodo}`
    : `${atascadas} ${atascadas === 1 ? "atención lleva" : "atenciones llevan"} más de un día sin cerrarse`;

  const detalle = [
    grave && atascadas > 0
      ? `${atascadas} ${atascadas === 1 ? "atención" : "atenciones"} sin cerrar hace más de un día`
      : null,
    grave ? "Esas notas hubo que rehacerlas a mano." : "Revisa si quedaron a medias o hay que reintentarlas.",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href="/superadmin/salud"
      className={`flex items-center gap-3 rounded-[14px] border px-4 py-3 transition-colors ${
        grave
          ? "border-warning/40 bg-warning-soft hover:border-warning/70"
          : "border-line bg-pearl hover:border-mist"
      }`}
    >
      <AlertTriangle
        size={18}
        className={`shrink-0 ${grave ? "text-warning" : "text-muted"}`}
      />
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${grave ? "text-warning-ink" : "text-deep"}`}>
          {titulo}
        </p>
        <p className="text-xs text-muted">{detalle}</p>
      </div>
      <span className="ml-auto shrink-0 text-xs font-semibold text-accent">Ver salud →</span>
    </Link>
  );
}

function Encabezado({
  generadoEn,
  rango,
}: {
  generadoEn?: string;
  rango: RangoResuelto;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-deep">
            Resumen de la plataforma
          </h1>
          <p className="text-sm text-muted">
            Cómo va Miracle hoy: volumen, adopción y estado del servicio.
          </p>
        </div>
        {generadoEn ? <AutoRefresh generadoEn={generadoEn} /> : null}
      </div>
      <RangePicker basePath="/superadmin" rango={rango} />
    </div>
  );
}
