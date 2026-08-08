import { AlertTriangle, Download, FileSignature, Stethoscope } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Donut } from "@/components/app/Charts";
import { DailyTrend } from "@/components/app/DailyTrend";
import { AdoptionTable } from "@/components/app/AdoptionTable";
import { AppPage, AppPageHeader, ClinicalSectionHeader } from "@/components/app/AppPage";
import { StatTile } from "@/components/superadmin/charts/StatTile";
import { BarList } from "@/components/superadmin/charts/BarList";
import { RangePicker } from "@/components/superadmin/RangePicker";
import {
  comparacion,
  comparacionPorcentaje,
  etiquetaEstado,
  etiquetaTipo,
  type HospitalDashboard,
} from "@/lib/hospital/dashboard";
import { etiquetaPeriodoAnterior, type RangoResuelto } from "@/lib/superadmin/rango";

/**
 * Reportes de gerencia: adopción, estado documental y calidad de codificación
 * en el periodo elegido.
 *
 * Presentacional puro — todas las cifras llegan ya calculadas desde la RPC. Es
 * la misma fuente que alimenta el panel de inicio del administrador, así que las
 * dos pantallas no pueden volver a discrepar.
 */
export function ReportesView({
  data,
  rango,
  error,
}: {
  data: HospitalDashboard;
  rango: RangoResuelto;
  error?: string | null;
}) {
  const { kpis } = data;
  const previo = etiquetaPeriodoAnterior(rango);

  // Los enlaces de exportación heredan el periodo que está en pantalla: el CSV
  // y la vista tienen que hablar del mismo rango.
  const qs = new URLSearchParams(
    Object.entries(rango.params).filter(([, v]) => Boolean(v)) as [string, string][],
  ).toString();

  return (
    <AppPage>
      <AppPageHeader
        kicker="Institución"
        title="Reportes de gerencia"
        description={`${rango.etiqueta} · ${rango.desde} a ${rango.hasta}`}
        action={<RangePicker basePath="/app/reportes" rango={rango} />}
      />

      {error ? (
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>No fue posible calcular las cifras: {error}</span>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Notas del periodo"
          value={kpis.consultas.value.toLocaleString("es-CO")}
          spark={data.serie_diaria.map((d) => d.consultas)}
          {...comparacion(kpis.consultas, previo)}
        />
        <StatTile
          label="Aprobadas o exportadas"
          value={kpis.firmadas.value.toLocaleString("es-CO")}
          icon={FileSignature}
          footnote={
            kpis.consultas.value
              ? `${Math.round((kpis.firmadas.value / kpis.consultas.value) * 100)}% de las del periodo`
              : "Sin notas en el periodo"
          }
        />
        <StatTile
          label="Completitud promedio"
          value={kpis.completitud.value}
          suffix="%"
          {...comparacionPorcentaje(kpis.completitud)}
        />
        <StatTile
          label="Con diagnóstico CIE-10"
          value={`${kpis.con_dx.value}/${kpis.consultas.value}`}
          icon={Stethoscope}
          footnote="Código principal aceptado"
        />
      </div>

      {/* La cola de firma es histórica, no del rango: se rotula así para que
          nadie la lea como "pendientes de estos 30 días". */}
      {kpis.por_firmar.value > 0 ? (
        <p className="mt-4 text-sm text-muted">
          Hay <strong className="text-warning">{kpis.por_firmar.value}</strong>{" "}
          {kpis.por_firmar.value === 1 ? "nota" : "notas"} sin firmar en toda la
          institución, de cualquier fecha, sobre{" "}
          {kpis.total_historico.value.toLocaleString("es-CO")} registradas en total.
        </p>
      ) : null}

      <Card className="mt-8">
        <ClinicalSectionHeader title={`Notas por día · ${rango.etiqueta}`} />
        <DailyTrend data={data.serie_diaria} periodo={rango.etiqueta.toLowerCase()} />
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-base font-semibold text-deep">
            Volumen y calidad por servicio
          </h2>
          {/* Cada barra lleva su completitud como pista: el servicio con más
              volumen no siempre es el que documenta mejor, y esa es la lectura
              que un gerente necesita hacer sin cruzar dos gráficas. */}
          <BarList
            items={data.por_servicio.map((s) => ({
              label: s.servicio,
              value: s.value,
              hint: `· ${s.completitud}% completitud`,
            }))}
            emptyLabel="Sin notas en este periodo."
          />
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold text-deep">Calidad documental</h2>
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <Donut value={kpis.completitud.value} label="Promedio" />
            <div className="flex-1 self-stretch">
              <BarList
                items={data.por_servicio.map((s) => ({
                  label: s.servicio,
                  value: s.completitud,
                }))}
                max={100}
                formatValue={(v) => `${v}%`}
                emptyLabel="Sin datos por servicio."
              />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold text-deep">Notas por estado</h2>
          <BarList
            items={data.por_estado.map((e) => ({
              label: etiquetaEstado(e.estado),
              value: e.value,
            }))}
            emptyLabel="Sin notas en este periodo."
          />
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold text-deep">Tipo de atención</h2>
          <BarList
            items={data.por_tipo.map((t) => ({
              label: etiquetaTipo(t.tipo),
              value: t.value,
            }))}
            emptyLabel="Sin notas en este periodo."
          />
        </Card>
      </div>

      <Card className="mt-5">
        <ClinicalSectionHeader
          title="Adopción por profesional"
          action={
            <a
              href={`/app/reportes/export${qs ? `?${qs}` : ""}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
            >
              <Download size={15} /> Descargar CSV
            </a>
          }
        />
        <p className="mb-3 text-sm text-muted">
          Incluye a los profesionales sin actividad en el periodo: son la respuesta
          a si las licencias se están usando.
        </p>
        <AdoptionTable
          medicos={data.por_medico}
          hrefDe={(m) => `/app/consultas?medico=${m.medico_id}`}
        />
      </Card>

      <p className="mt-6 text-xs text-muted">
        Cifras calculadas en la base sobre todas las consultas de tu institución,
        excluidas las de demostración. Última actualización:{" "}
        {data.generated_at ? new Date(data.generated_at).toLocaleString("es-CO") : "—"}.
      </p>
    </AppPage>
  );
}
