import {
  adoptionByService,
  managementKpis,
  qualityByService,
  timeBeforeAfter,
  weeklyNotes,
} from "@/lib/mock";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/marketing/MetricCard";
import { BarList, Donut, GroupedBars, MiniLine } from "@/components/app/Charts";
import { requireRole } from "@/lib/auth/server";

export const metadata = { title: "Reportes" };

export default async function ReportesPage() {
  await requireRole("admin", "supervisor");
  const k = managementKpis;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-deep">
            Reportes de gerencia
          </h1>
          <p className="text-sm text-muted">
            Adopción, tiempo, calidad documental e impacto operativo.
          </p>
        </div>
        <Badge tone="neutral">Datos ilustrativos</Badge>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard value={String(k.notasGeneradas)} label="Notas generadas" hint="Últimas 6 semanas" />
        <MetricCard value={`${k.medicosActivos}/${k.medicosTotales}`} label="Médicos activos" />
        <MetricCard value={`~${k.tiempoAhorradoHoras} h`} label="Tiempo ahorrado (est.)" />
        <MetricCard value={`${Math.round(k.completitudPromedio * 100)}%`} label="Completitud promedio" />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 text-base font-semibold text-deep">
            Tiempo de documentación por nota
          </h2>
          <p className="mb-4 text-xs text-muted">Minutos promedio · antes vs. con Miracle</p>
          <GroupedBars data={timeBeforeAfter} unit=" min" />
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold text-deep">
            Notas generadas por semana
          </h2>
          <MiniLine
            points={weeklyNotes.map((w) => ({ label: w.semana, value: w.notas }))}
            height={120}
          />
          <div className="mt-2 flex justify-between text-xs text-muted">
            {weeklyNotes.map((w) => (
              <span key={w.semana}>{w.semana}</span>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold text-deep">
            Adopción por servicio
          </h2>
          <BarList
            data={adoptionByService.map((a) => ({ label: a.servicio, value: a.notas }))}
          />
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold text-deep">
            Calidad documental
          </h2>
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <Donut value={Math.round(k.completitudPromedio * 100)} label="Promedio" />
            <div className="flex-1 space-y-3 self-stretch">
              {qualityByService.map((q) => (
                <div key={q.servicio}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-soft">{q.servicio}</span>
                    <span className="font-semibold text-deep">
                      {Math.round(q.completitud * 100)}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-ice">
                    <div
                      className="h-full rounded-full bg-success"
                      style={{ width: `${q.completitud * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <p className="mt-6 text-xs text-muted">
        Las cifras de esta sección son ilustrativas, para mostrar la estructura
        de los reportes. En una implementación se calculan a partir del uso real
        del sistema.
      </p>
    </div>
  );
}
