import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ClipboardList,
  Clock3,
  Coins,
  Cpu,
  FileCheck2,
  Gauge,
  Hourglass,
  MessagesSquare,
  PencilLine,
  Timer,
  VolumeX,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { formatFechaRelativa } from "@/lib/dates";
import { StatTile } from "@/components/superadmin/charts/StatTile";
import { BarList } from "@/components/superadmin/charts/BarList";
import { RangePicker } from "@/components/superadmin/RangePicker";
import { MetricasFilters } from "@/components/superadmin/MetricasFilters";
import { EmptyState } from "@/components/app/EmptyState";
import { Pager } from "@/components/app/Pager";
import { resolverRango, type RangoResuelto } from "@/lib/superadmin/rango";
import { formatTokens } from "@/lib/superadmin/consumo";
import { formatUsd } from "@/lib/superadmin/consumo";
import {
  ETIQUETA_FASE,
  ETIQUETA_FUENTE,
  formatDelta,
  formatMs,
  formatPct,
  formatSeg,
  resolverFranjaHoraria,
  type CalidadNota,
  type MetricasConsultas,
} from "@/lib/superadmin/metricas";

const PAGE_SIZE = 25;
const BASE = "/superadmin/metricas";

/**
 * Métricas por consulta: qué pasa DENTRO de cada consulta de Miracle Notes.
 *
 * Es la pantalla hermana de Consumo IA pero con la consulta como unidad:
 * duración, tiempo de uso real, interrogatorio, silencios y tokens atribuidos
 * (session_id = encounter_id en el ledger). La regla heredada de Consumo
 * manda aquí también: los datos están incompletos por construcción — solo las
 * consultas posteriores a la telemetría tienen fila, el interrogatorio
 * necesita diarización y los tokens necesitan el contrato de Graph — así que
 * la banda de cobertura va ANTES que los promedios, y "no medido" se muestra
 * como no disponible, jamás como cero.
 */
export default async function SuperadminMetricasPage({
  searchParams,
}: {
  searchParams: Promise<{
    rango?: string;
    desde?: string;
    hasta?: string;
    hdesde?: string;
    hhasta?: string;
    org?: string;
    usuario?: string;
    prueba?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const db = await createClient();

  const rango = resolverRango(sp);
  const franja = resolverFranjaHoraria(sp);
  const incluirPrueba = sp.prueba === "1";
  const page = Math.max(1, Number(sp.page) || 1);

  const [orgsRes, medicosRes] = await Promise.all([
    db.from("organizations").select("id, name").order("name"),
    db.from("profiles").select("id, full_name, email").order("full_name"),
  ]);
  const orgs = (orgsRes.data ?? []) as { id: string; name: string }[];
  const medicos = (medicosRes.data ?? []) as {
    id: string;
    full_name: string | null;
    email: string;
  }[];
  const orgFilter = orgs.some((o) => o.id === sp.org) ? (sp.org as string) : "";
  const usuarioFilter = medicos.some((m) => m.id === sp.usuario) ? (sp.usuario as string) : "";

  // Las dos RPC van juntas: la de telemetría parte de `encounter_metrics` y la
  // de calidad parte de `clinical_encounters`, así que la segunda alcanza a las
  // consultas anteriores a la telemetría. Son universos distintos a propósito y
  // cada bloque declara el suyo.
  const [{ data, error }, calidadRes] = await Promise.all([
    db.rpc("superadmin_encounter_metrics", {
      ...rango.rpcArgs,
      p_hour_from: franja.desde,
      p_hour_to: franja.hasta,
      p_org: orgFilter || null,
      p_user: usuarioFilter || null,
      p_incluir_prueba: incluirPrueba,
      p_page: page,
      p_page_size: PAGE_SIZE,
    }),
    db.rpc("superadmin_note_quality", {
      ...rango.rpcArgs,
      p_org: orgFilter || null,
      p_user: usuarioFilter || null,
      p_incluir_prueba: incluirPrueba,
    }),
  ]);
  const metricas = (data ?? null) as MetricasConsultas | null;
  // Si la calidad falla, el resto de la pantalla sigue sirviendo: su bloque se
  // oculta en vez de tumbar la página entera.
  const calidad = (calidadRes.data ?? null) as CalidadNota | null;

  if (error || !metricas) {
    return (
      <div className="space-y-6">
        <Encabezado rango={rango} />
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          <p>
            No fue posible cargar las métricas. Verifica que la migración{" "}
            <code>encounter_metrics</code> esté aplicada en la base.
          </p>
          {error?.message ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold">Detalle técnico</summary>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs">{error.message}</pre>
            </details>
          ) : null}
        </div>
      </div>
    );
  }

  const { kpis, cobertura, serie_diaria, por_hora, por_usuario } = metricas;
  const { por_organizacion, por_modelo, consultas } = metricas;

  // Parámetros ajenos al RangePicker (él maneja rango/desde/hasta).
  const filtrosParams = {
    hdesde: franja.desde === null ? undefined : String(franja.desde),
    hhasta: franja.hasta === null ? undefined : String(franja.hasta),
    org: orgFilter || undefined,
    usuario: usuarioFilter || undefined,
    prueba: incluirPrueba ? "1" : undefined,
  };
  const paramsComunes = { ...rango.params, ...filtrosParams };

  const sparkConsultas = serie_diaria.slice(-14).map((d) => d.consultas);
  const sparkDuracion = serie_diaria.slice(-14).map((d) => d.recording_ms_prom);
  const sinMedir = Math.max(0, cobertura.encounters_periodo - cobertura.consultas_medidas);
  const horasActivas = por_hora.filter((h) => h.consultas > 0);

  return (
    <div className="space-y-6">
      <Encabezado generadoEn={metricas.generated_at} rango={rango} />

      <div className="space-y-2">
        <RangePicker basePath={BASE} rango={rango} preserved={filtrosParams} />
        <MetricasFilters
          basePath={BASE}
          org={orgFilter}
          usuario={usuarioFilter}
          hdesde={franja.desde === null ? "" : String(franja.desde)}
          hhasta={franja.hasta === null ? "" : String(franja.hasta)}
          incluirPrueba={incluirPrueba}
          orgs={orgs.map((o) => ({ value: o.id, label: o.name }))}
          usuarios={medicos.map((m) => ({
            value: m.id,
            label: m.full_name?.trim() || m.email,
          }))}
          preserved={rango.params}
        />
      </div>

      {/* --- Cobertura: primero, porque condiciona todo lo demás ------------- */}
      {(sinMedir > 0 || cobertura.tokens_no_atribuibles > 0) ? (
        <div className="rounded-[14px] border border-warning/40 bg-warning-soft px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
            <div className="min-w-0 text-sm text-deep">
              <p className="font-semibold">Cobertura de la ventana</p>
              <p className="mt-0.5 text-ink-soft">
                {cobertura.consultas_medidas.toLocaleString("es-CO")} consultas con telemetría de{" "}
                {cobertura.encounters_periodo.toLocaleString("es-CO")} del periodo
                {sinMedir > 0
                  ? ` (${sinMedir.toLocaleString("es-CO")} anteriores a la telemetría o de cuentas filtradas)`
                  : ""}
                .
                {cobertura.tokens_no_atribuibles > 0 ? (
                  <>
                    {" "}
                    {formatTokens(cobertura.tokens_no_atribuibles)} tokens del periodo no son
                    atribuibles a ninguna consulta (Graph aún no envía{" "}
                    <code>session_id</code> en esos eventos).
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* --- KPIs ------------------------------------------------------------ */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Consultas medidas"
          value={kpis.consultas.toLocaleString("es-CO")}
          suffix={`· ${kpis.completadas} completadas`}
          spark={sparkConsultas}
          icon={ClipboardList}
        />
        <StatTile
          label="Duración promedio"
          value={formatMs(kpis.recording_ms_prom)}
          footnote={`mediana ${formatMs(kpis.recording_ms_p50)} · p90 ${formatMs(kpis.recording_ms_p90)}`}
          spark={sparkDuracion}
          icon={Timer}
        />
        {/* La mediana y el p90 van al lado del promedio a propósito: si la
            media se despega de la mediana, hay una consulta larguísima
            arrastrándola y el titular por sí solo engaña. */}
        <StatTile
          label="Tiempo de uso promedio"
          value={formatMs(kpis.active_ms_prom)}
          footnote={`mediana ${formatMs(kpis.active_ms_p50)} · p90 ${formatMs(kpis.active_ms_p90)}`}
          icon={Clock3}
        />
        <StatTile
          label="Tokens por minuto"
          value={kpis.tokens_por_minuto === null ? "—" : kpis.tokens_por_minuto.toLocaleString("es-CO")}
          footnote={`${formatTokens(kpis.tokens_total)} tokens atribuidos en total`}
          icon={Gauge}
        />
        <StatTile
          label="Interrogatorio promedio"
          value={formatMs(kpis.interrogation_ms_prom)}
          footnote={
            kpis.interrogation_pct_prom === null
              ? "requiere diarización (aún sin datos)"
              : `${formatPct(kpis.interrogation_pct_prom)} de la consulta`
          }
          icon={MessagesSquare}
        />
        <StatTile
          label="Silencio promedio"
          value={formatMs(kpis.silence_ms_prom)}
          footnote={
            kpis.silence_pct_prom === null
              ? "requiere timestamps (consultas nuevas)"
              : `${formatPct(kpis.silence_pct_prom)} de la consulta`
          }
          icon={VolumeX}
        />
        {/* Cuánto cuesta operar una consulta: el objetivo declarado de toda
            esta capa. Mientras haya llamadas sin tarifa el número es un SUELO
            y lo dice el pie, no una nota al margen en otra pantalla. */}
        <StatTile
          label="Costo por consulta"
          value={kpis.costo_usd_prom === null ? "—" : formatUsd(kpis.costo_usd_prom)}
          footnote={
            kpis.consultas_sin_tarifa > 0
              ? `al menos · ${kpis.consultas_sin_tarifa} consultas con modelos sin tarifar`
              : `${formatUsd(kpis.costo_usd_total)} en la ventana`
          }
          footnoteTone={kpis.consultas_sin_tarifa > 0 ? "warning" : undefined}
          icon={Coins}
        />
        <StatTile
          label="Minutos procesados"
          value={Math.round(kpis.recording_ms_total / 60000).toLocaleString("es-CO")}
          suffix="min"
          footnote="audio grabado dentro de la ventana"
          icon={Activity}
        />
        <StatTile
          label="Tokens totales"
          value={formatTokens(kpis.tokens_total)}
          footnote={`${cobertura.con_tokens} consultas con consumo atribuido`}
          icon={Cpu}
        />
      </div>

      {/* --- Calidad de la nota ---------------------------------------------
          El bloque que dice si el producto SIRVE, no cuánto se usa. Sale de
          comparar la nota que generó la IA contra la que el médico firmó: dos
          versiones que el backend ya guardaba y que nadie leía. Es retroactivo,
          así que mide también las consultas anteriores a la telemetría. */}
      {calidad && calidad.kpis.consultas > 0 ? (
        <div className="space-y-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-deep">Calidad de la nota</h2>
            <p className="text-sm text-muted">
              Cuánto trabajo le queda al médico después de que la IA escribió.{" "}
              {calidad.cobertura.medibles} de {calidad.cobertura.encuentros} consultas del periodo
              se pueden comparar ({calidad.cobertura.pct_medible}%); el resto no guardó la versión
              original de la IA y no se puede juzgar.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Nota corregida"
              value={formatPct(calidad.kpis.pct_secciones_editadas)}
              footnote={`${calidad.kpis.editadas_prom} de ${calidad.kpis.secciones_prom} secciones por nota`}
              icon={PencilLine}
              invertido
            />
            <StatTile
              label="Notas sin tocar"
              value={formatPct(calidad.kpis.pct_sin_tocar)}
              footnote={`${calidad.kpis.sin_tocar} de ${calidad.kpis.consultas} salieron listas`}
              icon={FileCheck2}
            />
            <StatTile
              label="Texto que añade el médico"
              value={formatDelta(calidad.kpis.delta_chars_prom)}
              suffix="car."
              footnote={`${calidad.kpis.secciones_rellenadas} secciones que la IA dejó vacías`}
              icon={ClipboardList}
            />
            {/* El promedio va DESPUÉS de la mediana en el pie porque es el que
                miente: una consulta olvidada de horas lo dobla. */}
            <StatTile
              label="Espera hasta la nota"
              value={formatSeg(calidad.espera_nota.p50_s)}
              footnote={`p90 ${formatSeg(calidad.espera_nota.p90_s)} · promedio ${formatSeg(calidad.espera_nota.prom_s)}`}
              icon={Hourglass}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            {/* Qué sección hay que reescribir. Es la lista accionable: una
                sección corregida el 98 % de las veces es un prompt que no
                sirve, no un médico quisquilloso. */}
            <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-xs)]">
              <div className="border-b border-line px-5 py-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Secciones que más se corrigen
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Solo secciones con 5 o más apariciones: con menos, un 100 % es una anécdota.
                </p>
              </div>
              {calidad.por_seccion.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={<PencilLine size={20} />}
                    title="Sin secciones suficientes para comparar"
                  />
                </div>
              ) : (
                <div>
                  <div className="hidden grid-cols-[1.6fr_1fr_auto_auto] gap-4 border-b border-line px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted sm:grid">
                    <span>Sección</span>
                    <span>Especialidad</span>
                    <span className="text-right">Corregida</span>
                    <span className="text-right">Texto</span>
                  </div>
                  {calidad.por_seccion.map((sec, i) => (
                    <div
                      key={`${sec.especialidad}-${sec.seccion}`}
                      className={`grid grid-cols-1 gap-1 px-5 py-3 sm:grid-cols-[1.6fr_1fr_auto_auto] sm:items-center sm:gap-4 ${
                        i ? "border-t border-line" : ""
                      }`}
                    >
                      <div className="min-w-0 truncate text-sm font-medium text-deep">
                        {sec.seccion}
                      </div>
                      <div className="min-w-0 truncate text-sm text-muted">{sec.especialidad}</div>
                      <div
                        className={`text-sm font-semibold sm:text-right ${
                          sec.pct >= 80 ? "text-warning" : "text-deep"
                        }`}
                      >
                        {sec.pct}%
                        <span className="ml-1 text-xs font-normal text-muted">
                          ({sec.editadas}/{sec.total})
                        </span>
                      </div>
                      <div className="text-sm text-muted sm:text-right">
                        {formatDelta(sec.delta_chars_prom)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Card className="p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Por especialidad
              </h3>
              <div className="mt-4">
                <BarList
                  items={calidad.por_especialidad.map((e) => ({
                    label: `${e.especialidad} · ${e.consultas}`,
                    value: Math.round(e.pct_editadas),
                  }))}
                  formatValue={(v) => `${v}%`}
                  emptyLabel="Sin consultas comparables."
                />
              </div>
              <p className="mt-3 text-xs text-muted">
                Porcentaje de la nota que el médico corrige. Es la cifra que debería bajar cuando
                se ajusta un prompt.
              </p>
            </Card>
          </div>
        </div>
      ) : null}

      {/* --- En qué se va el tiempo + embudo -------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            En qué se va el tiempo
          </h2>
          <div className="mt-4">
            <BarList
              items={Object.entries(metricas.fases)
                .sort((a, b) => b[1] - a[1])
                .map(([fase, ms]) => ({
                  label: ETIQUETA_FASE[fase] ?? fase,
                  value: ms,
                }))}
              formatValue={(v) => formatMs(v)}
              emptyLabel="Aún sin consultas con fases medidas."
            />
          </div>
          <p className="mt-3 text-xs text-muted">
            La revisión es el trabajo que le queda al médico después de la IA: si una versión
            nueva sirve, esa barra se encoge aunque la captura dure lo mismo.
          </p>
        </Card>

        {calidad ? (
          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Dónde se cae una consulta
            </h2>
            <div className="mt-4">
              <BarList
                items={[
                  { label: "Creadas", value: calidad.embudo.creadas },
                  { label: "Con transcripción", value: calidad.embudo.con_transcripcion },
                  { label: "Con nota", value: calidad.embudo.con_nota },
                  { label: "Completadas", value: calidad.embudo.completadas },
                ]}
                emptyLabel="Sin consultas en el periodo."
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs">
              <span className={calidad.embudo.abandonadas > 0 ? "text-warning" : "text-muted"}>
                {calidad.embudo.abandonadas} abandonadas
              </span>
              <span className={calidad.embudo.fallidas > 0 ? "text-warning" : "text-muted"}>
                {calidad.embudo.fallidas} fallidas
              </span>
              <span className="text-muted">{calidad.embudo.con_reintento} con reintento</span>
            </div>
          </Card>
        ) : null}
      </div>

      {/* --- Por hora + por organización ------------------------------------ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Consultas por hora del día
          </h2>
          <p className="mb-4 mt-1 text-xs text-muted">
            Hora de Bogotá. Usa la franja horaria de arriba para acotar los promedios a un turno.
          </p>
          <BarList
            items={horasActivas.map((h) => ({
              label: `${h.hora}:00 – ${h.hora + 1}:00`,
              value: h.consultas,
            }))}
            emptyLabel="Sin consultas medidas en el periodo."
          />
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Por organización
          </h2>
          <p className="mb-4 mt-1 text-xs text-muted">
            Consultas medidas; el matiz indica tokens/minuto cuando existe.
          </p>
          <BarList
            items={por_organizacion.map((o) => ({
              label: o.nombre,
              value: o.consultas,
              hint:
                o.tokens_por_minuto === null
                  ? `· uso prom. ${formatMs(o.active_ms_prom)}`
                  : `· ${o.tokens_por_minuto.toLocaleString("es-CO")} tok/min`,
            }))}
            emptyLabel="Sin consultas medidas en el periodo."
          />
        </Card>
      </div>

      {/* --- Por médico ------------------------------------------------------ */}
      <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-xs)]">
        <div className="border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Por médico</h2>
        </div>
        <div className="hidden grid-cols-[1.6fr_.7fr_.9fr_.9fr_.8fr_.8fr] gap-4 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted lg:grid">
          <span>Médico</span>
          <span className="text-right">Consultas</span>
          <span className="text-right">Duración prom.</span>
          <span className="text-right">Uso prom.</span>
          <span className="text-right">Tokens</span>
          <span className="text-right">Tok/min</span>
        </div>
        {por_usuario.map((u, index) => (
          <div
            key={u.id}
            className={`grid grid-cols-2 gap-2 px-5 py-3 text-sm lg:grid-cols-[1.6fr_.7fr_.9fr_.9fr_.8fr_.8fr] lg:items-center lg:gap-4 ${index ? "border-t border-line" : ""}`}
          >
            <div className="col-span-2 min-w-0 lg:col-span-1">
              <div className="truncate font-medium text-deep">{u.nombre}</div>
              {u.organizacion ? (
                <div className="truncate text-xs text-muted">{u.organizacion}</div>
              ) : null}
            </div>
            <div className="text-right text-deep">{u.consultas.toLocaleString("es-CO")}</div>
            <div className="text-right text-muted">{formatMs(u.recording_ms_prom)}</div>
            <div className="text-right text-muted">{formatMs(u.active_ms_prom)}</div>
            <div className="text-right text-muted">{formatTokens(u.tokens)}</div>
            <div className="text-right text-muted">
              {u.tokens_por_minuto === null ? "—" : u.tokens_por_minuto.toLocaleString("es-CO")}
            </div>
          </div>
        ))}
        {por_usuario.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted">
            Sin consultas medidas en el periodo.
          </p>
        ) : null}
      </div>

      {/* --- Por modelo ------------------------------------------------------ */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Consumo por modelo (atribuido a consultas)
        </h2>
        <p className="mb-4 mt-1 text-xs text-muted">
          Solo eventos con <code>session_id</code> de una consulta del filtro. Un costo con filas
          sin tarifa es un mínimo, no un total.
        </p>
        <BarList
          items={por_modelo.map((m) => ({
            label: `${m.model} · ${m.provider}`,
            value: m.tokens,
            hint: `· ${m.eventos} llamadas${m.sin_tarifa > 0 ? ` · ${m.sin_tarifa} sin tarifa` : ""}`,
          }))}
          formatValue={(v) => formatTokens(v)}
          emptyLabel="Aún no hay consumo atribuido a consultas (requiere el contrato de Graph)."
        />
      </Card>

      {/* --- Lista de consultas ---------------------------------------------- */}
      <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-xs)]">
        <div className="border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Consultas del periodo
          </h2>
          <p className="mt-1 text-xs text-muted">
            Abre una consulta para ver su desglose completo (tokens por operación, hablantes,
            silencios). «—» significa no medido, no cero.
          </p>
        </div>
        <div className="hidden grid-cols-[1.4fr_1fr_.8fr_.8fr_.8fr_.8fr_.7fr] gap-4 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted lg:grid">
          <span>Médico</span>
          <span>Fecha</span>
          <span className="text-right">Duración</span>
          <span className="text-right">Uso</span>
          <span className="text-right">Interrog.</span>
          <span className="text-right">Silencio</span>
          <span className="text-right">Tokens</span>
        </div>
        {consultas.rows.map((c, index) => (
          <Link
            key={c.encounter_id}
            href={`/superadmin/metricas/${c.encounter_id}`}
            className={`grid grid-cols-2 gap-2 px-5 py-3 text-sm transition-colors hover:bg-pearl lg:grid-cols-[1.4fr_1fr_.8fr_.8fr_.8fr_.8fr_.7fr] lg:items-center lg:gap-4 ${index ? "border-t border-line" : ""}`}
          >
            <div className="col-span-2 min-w-0 lg:col-span-1">
              <div className="truncate font-medium text-deep">{c.medico}</div>
              <div className="truncate text-xs text-muted">
                {c.organizacion ?? "—"}
                {c.finalizada ? "" : " · sin finalizar"}
              </div>
            </div>
            <div className="text-muted">{formatFechaRelativa(c.fecha)}</div>
            <div className="text-right text-deep">{formatMs(c.recording_ms || null)}</div>
            <div className="text-right text-muted">{formatMs(c.active_ms || null)}</div>
            <div className="text-right text-muted">{formatMs(c.interrogation_ms)}</div>
            <div className="text-right text-muted">{formatMs(c.silence_ms)}</div>
            <div className="text-right text-muted">
              {c.tokens > 0 ? formatTokens(c.tokens) : "—"}
            </div>
          </Link>
        ))}
        {consultas.rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<ClipboardList size={20} />}
              title="Sin consultas medidas"
              description="La telemetría solo existe para consultas realizadas después de activarla. Ajusta el periodo o los filtros."
            />
          </div>
        ) : null}
      </div>

      <Pager
        basePath={BASE}
        page={consultas.page}
        pageSize={consultas.page_size}
        total={consultas.total}
        params={paramsComunes}
      />
    </div>
  );
}

function Encabezado({ generadoEn, rango }: { generadoEn?: string; rango: RangoResuelto }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold text-deep">Métricas de consultas</h1>
        <p className="text-sm text-muted">
          Qué ocurre dentro de cada consulta: duración, uso real, conversación y costo de IA ·{" "}
          {rango.etiqueta.toLowerCase()}
        </p>
      </div>
      {generadoEn ? (
        <p className="text-xs text-muted">
          Actualizado {formatFechaRelativa(generadoEn)}
        </p>
      ) : null}
    </div>
  );
}
