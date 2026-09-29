import Link from "next/link";
import { AlertTriangle, Coins, Cpu, Gauge, Zap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { StatTile } from "@/components/superadmin/charts/StatTile";
import { BarList } from "@/components/superadmin/charts/BarList";
import { RangePicker } from "@/components/superadmin/RangePicker";
import { AutoRefresh } from "@/components/superadmin/AutoRefresh";
import {
  etiquetaPeriodoAnterior,
  resolverRango,
  type RangoResuelto,
} from "@/lib/superadmin/rango";
import {
  ETIQUETA_FEATURE,
  formatTokens,
  formatUsd,
  type ConsumoIa,
} from "@/lib/superadmin/consumo";

/**
 * Consumo de IA de la plataforma: dos preguntas, dos tableros.
 *
 *  1. GASTO Y VOLUMEN — ¿cuánto se está consumiendo y en qué se va?
 *  2. QUIÉN CONSUME    — ¿a quién se le imputa, y qué tan fiable es el servicio?
 *
 * Se separan porque se miran en momentos distintos: la primera antes de mirar la
 * factura del proveedor, la segunda antes de facturarle a un cliente.
 *
 * LA DECISIÓN QUE MANDA EN TODA LA PANTALLA
 * `cost_usd` es nulo cuando el modelo no tiene tarifa en ai_model_prices. Al
 * construir esto, eso era el 73 % de los tokens: sumar la columna y llamarlo
 * "el gasto" daría una cifra tres veces menor que la real. Por eso el dinero
 * nunca se muestra a secas — va con el sufijo "al menos" y con la cobertura
 * delante, y la banda de arriba nombra los modelos que faltan por tarifar.
 */

export default async function SuperadminConsumoPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; desde?: string; hasta?: string }>;
}) {
  const sp = await searchParams;
  const db = await createClient();
  const rango = resolverRango(sp);

  const { data, error } = await db.rpc("superadmin_ai_usage", rango.rpcArgs);
  const consumo = (data ?? null) as ConsumoIa | null;

  if (error || !consumo) {
    return (
      <div className="space-y-6">
        <Encabezado rango={rango} />
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          <p>
            No fue posible cargar el consumo. Verifica que la migración{" "}
            <code>superadmin_ai_usage</code> esté aplicada en la base.
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

  const { kpis, cobertura, serie_diaria, por_feature, modelos_sin_tarifa } = consumo;
  const { por_organizacion, por_usuario, fiabilidad } = consumo;

  const periodo = rango.etiqueta.toLowerCase();
  const comparativa = etiquetaPeriodoAnterior(rango);
  const spark = serie_diaria.slice(-14).map((d) => d.tokens);

  // Un costo con parte del volumen sin tarifar es un SUELO, no un total.
  const costoParcial = cobertura.tokens_sin_tarifa > 0;

  return (
    <div className="space-y-6">
      <Encabezado generadoEn={consumo.generated_at} rango={rango} />

      {/* --- Aviso de cobertura: lo primero, porque condiciona todo lo demás -- */}
      {modelos_sin_tarifa.length > 0 ? (
        <div className="rounded-[14px] border border-warning/40 bg-warning-soft px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-warning-ink">
                El {cobertura.pct_sin_tarifa}% de los tokens no tiene tarifa configurada
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Las cifras en dólares de esta pantalla son un mínimo, no el gasto real. Falta
                el precio de{" "}
                {modelos_sin_tarifa.map((m, i) => (
                  <span key={`${m.provider}-${m.model}`}>
                    {i > 0 ? ", " : ""}
                    <code className="text-warning-ink">{m.model}</code> ({m.provider},{" "}
                    {formatTokens(m.tokens)})
                  </span>
                ))}
                . Se corrige agregando su fila en <code>ai_model_prices</code>.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* ================================================================== */}
      {/* TABLERO 1 — Gasto y volumen                                        */}
      {/* ================================================================== */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-deep">Gasto y volumen</h2>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Tokens del periodo"
            value={formatTokens(kpis.tokens.value)}
            deltaPct={kpis.tokens.delta_pct}
            previousLabel={comparativa}
            spark={spark}
            icon={Cpu}
          />
          <StatTile
            label="Costo conocido"
            value={formatUsd(kpis.costo_usd.value)}
            suffix={costoParcial ? "o más" : undefined}
            deltaPct={kpis.costo_usd.delta_pct}
            previousLabel={comparativa}
            footnote={
              costoParcial
                ? `sobre el ${100 - cobertura.pct_sin_tarifa}% de los tokens que sí tienen tarifa`
                : "todo el consumo está tarifado"
            }
            footnoteTone={costoParcial ? "warning" : undefined}
            icon={Coins}
          />
          <StatTile
            label="Llamadas a modelos"
            value={kpis.eventos.value.toLocaleString("es-CO")}
            deltaPct={kpis.eventos.delta_pct}
            previousLabel={comparativa}
            icon={Zap}
          />
          <StatTile
            label="Llamadas fallidas"
            value={kpis.errores.value.toLocaleString("es-CO")}
            footnote={
              kpis.errores.total === 0
                ? `sin actividad en ${periodo}`
                : `de ${kpis.errores.total.toLocaleString("es-CO")} · un fallo puede haber gastado el prompt igual`
            }
            footnoteTone={kpis.errores.value > 0 ? "warning" : undefined}
            icon={AlertTriangle}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card className="min-w-0">
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Tokens por día
              </h3>
              <span className="text-xs text-muted">{rango.etiqueta}</span>
            </div>
            <p className="mb-4 text-xs text-muted">
              Volumen y no dinero: es la única serie completa, porque no depende de que el
              modelo tenga tarifa.
            </p>
            <BarList
              items={serie_diaria
                .filter((d) => d.tokens > 0)
                .slice(-12)
                .map((d) => ({
                  label: d.date.slice(8) + "/" + d.date.slice(5, 7),
                  value: d.tokens,
                  hint: `${d.eventos} llamada${d.eventos === 1 ? "" : "s"}`,
                }))}
              formatValue={formatTokens}
              emptyLabel={`Sin consumo registrado en ${periodo}.`}
            />
          </Card>

          <Card className="min-w-0">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
              En qué se va
            </h3>
            <p className="mb-4 mt-1 text-xs text-muted">
              Por función y modelo. Las filas marcadas no tienen tarifa: su costo real no se
              conoce.
            </p>
            <ul className="space-y-3">
              {por_feature.map((f) => (
                <li key={`${f.app}-${f.feature}-${f.model}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm text-deep" title={f.feature}>
                      {ETIQUETA_FEATURE[f.feature] ?? f.feature}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-deep">
                      {formatTokens(f.tokens)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <code>{f.model}</code>
                    <span>·</span>
                    <span>{f.eventos} llamadas</span>
                    <span>·</span>
                    {f.sin_tarifa > 0 ? (
                      <Badge tone="warning">Sin tarifa</Badge>
                    ) : (
                      <span className="font-semibold text-deep">{formatUsd(f.costo_usd)}</span>
                    )}
                  </div>
                </li>
              ))}
              {por_feature.length === 0 ? (
                <li className="py-4 text-center text-sm text-muted">
                  Sin llamadas registradas en {periodo}.
                </li>
              ) : null}
            </ul>
          </Card>
        </div>
      </section>

      {/* ================================================================== */}
      {/* TABLERO 2 — Quién consume                                          */}
      {/* ================================================================== */}
      <section className="space-y-4 border-t border-line pt-6">
        <div>
          <h2 className="font-display text-lg font-semibold text-deep">Quién consume</h2>
          <p className="text-sm text-muted">
            El reparto que haría falta para facturar. Hoy{" "}
            <strong className="text-warning">
              el {cobertura.pct_sin_atribucion}% de las llamadas llega sin organización
            </strong>{" "}
            ({cobertura.eventos_sin_atribucion} de {cobertura.eventos}), así que ese consumo no
            se le puede cobrar a nadie.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <Card className="min-w-0">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Por organización
            </h3>
            <p className="mb-4 mt-1 text-xs text-muted">
              «Sin atribuir» se muestra como una fila más, no se reparte entre las demás: si se
              ocultara, los porcentajes cuadrarían sobre una base que no es el consumo real.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-xs font-semibold uppercase tracking-wide text-muted">
                    <th className="pb-2 text-left">Organización</th>
                    <th className="pb-2 text-right">Tokens</th>
                    <th className="pb-2 text-right">Llamadas</th>
                    <th className="pb-2 text-right">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {por_organizacion.map((o) => (
                    <tr key={o.id ?? "sin-atribuir"} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-3">
                        {o.id ? (
                          <Link
                            href={`/superadmin/organizaciones/${o.id}`}
                            className="font-medium text-deep hover:text-accent hover:underline"
                          >
                            {o.nombre}
                          </Link>
                        ) : (
                          <span className="font-medium text-warning">{o.nombre}</span>
                        )}
                        <span className="block text-xs text-muted">
                          {o.usuarios === 0
                            ? "sin usuario identificado"
                            : `${o.usuarios} usuario${o.usuarios === 1 ? "" : "s"}`}
                        </span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-deep">
                        {formatTokens(o.tokens)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-muted">{o.eventos}</td>
                      <td className="py-2.5 text-right tabular-nums">
                        <span className="text-deep">{formatUsd(o.costo_usd)}</span>
                        {o.sin_tarifa > 0 ? (
                          <span className="block text-xs text-warning">
                            +{o.sin_tarifa} sin tarifa
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {por_organizacion.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted">
                        Sin consumo en {periodo}.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="min-w-0">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Quién más consume
              </h3>
              <p className="mb-4 mt-1 text-xs text-muted">
                Solo cuentas identificadas.
              </p>
              <BarList
                items={por_usuario.map((u) => ({
                  label: u.nombre,
                  value: u.tokens,
                  hint: u.organizacion ?? undefined,
                }))}
                formatValue={formatTokens}
                emptyLabel="Ninguna llamada llegó con usuario identificado."
              />
            </Card>

            <Card className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
                <Gauge size={15} /> Fiabilidad
              </h3>
              <p className="mb-4 mt-1 text-xs text-muted">
                Errores y latencia p95 por función.
              </p>
              <ul className="space-y-2.5">
                {fiabilidad.map((f) => (
                  <li key={f.feature} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm text-deep">
                      {ETIQUETA_FEATURE[f.feature] ?? f.feature}
                    </span>
                    <span className="flex shrink-0 items-baseline gap-2 text-xs">
                      {f.errores > 0 ? (
                        <span className="font-semibold text-warning">{f.pct_error}% error</span>
                      ) : (
                        <span className="text-muted">sin fallos</span>
                      )}
                      <span className="text-muted">
                        {f.latencia_p95 ? `p95 ${(f.latencia_p95 / 1000).toFixed(1)}s` : "—"}
                      </span>
                    </span>
                  </li>
                ))}
                {fiabilidad.length === 0 ? (
                  <li className="text-sm text-muted">Sin llamadas en {periodo}.</li>
                ) : null}
              </ul>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}

function Encabezado({ generadoEn, rango }: { generadoEn?: string; rango: RangoResuelto }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-deep">Consumo de IA</h1>
          <p className="text-sm text-muted">
            Cuántos tokens gasta Miracle, en qué se van y a quién se le imputan.
          </p>
        </div>
        {generadoEn ? <AutoRefresh generadoEn={generadoEn} /> : null}
      </div>
      <RangePicker basePath="/superadmin/consumo" rango={rango} />
    </div>
  );
}
