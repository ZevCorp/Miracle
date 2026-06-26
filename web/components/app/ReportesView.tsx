"use client";

import { useMemo } from "react";
import { useStore } from "@/app/app/providers";
import {
  acceptedCodes,
  completitud,
  STATUS_LABEL,
  TYPE_LABEL,
  type ConsultationStatus,
  type ConsultationType,
} from "@/lib/mock";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/marketing/MetricCard";
import { BarList, Donut } from "@/components/app/Charts";

const ESTADOS: ConsultationStatus[] = [
  "borrador",
  "revisada",
  "aprobada",
  "exportada",
];

export function ReportesView() {
  const { consultations } = useStore();

  const m = useMemo(() => {
    const total = consultations.length;
    const firmadas = consultations.filter(
      (c) => c.estado === "aprobada" || c.estado === "exportada",
    ).length;
    const conCIE10 = consultations.filter(
      (c) => acceptedCodes(c, "CIE-10").length > 0,
    ).length;
    const completitudProm = total
      ? Math.round(
          consultations.reduce((a, c) => a + completitud(c), 0) / total,
        )
      : 0;

    const porEstado = ESTADOS.map((e) => ({
      label: STATUS_LABEL[e],
      value: consultations.filter((c) => c.estado === e).length,
    })).filter((d) => d.value > 0);

    const servMap = new Map<string, number>();
    consultations.forEach((c) =>
      servMap.set(c.servicio, (servMap.get(c.servicio) ?? 0) + 1),
    );
    const porServicio = [...servMap.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    const tipoMap = new Map<ConsultationType, number>();
    consultations.forEach((c) =>
      tipoMap.set(c.tipo, (tipoMap.get(c.tipo) ?? 0) + 1),
    );
    const porTipo = [...tipoMap.entries()].map(([t, value]) => ({
      label: TYPE_LABEL[t],
      value,
    }));

    const compMap = new Map<string, { sum: number; n: number }>();
    consultations.forEach((c) => {
      const cur = compMap.get(c.servicio) ?? { sum: 0, n: 0 };
      cur.sum += completitud(c);
      cur.n += 1;
      compMap.set(c.servicio, cur);
    });
    const compPorServicio = [...compMap.entries()]
      .map(([servicio, { sum, n }]) => ({
        servicio,
        completitud: Math.round(sum / n),
      }))
      .sort((a, b) => b.completitud - a.completitud);

    return {
      total,
      firmadas,
      conCIE10,
      completitudProm,
      porEstado,
      porServicio,
      porTipo,
      compPorServicio,
    };
  }, [consultations]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-deep">
            Reportes de gerencia
          </h1>
          <p className="text-sm text-muted">
            Adopción, estado documental y calidad de la codificación.
          </p>
        </div>
        <Badge tone="accent">Calculado en vivo</Badge>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard value={String(m.total)} label="Notas registradas" />
        <MetricCard
          value={String(m.firmadas)}
          label="Aprobadas / exportadas"
        />
        <MetricCard
          value={`${m.completitudProm}%`}
          label="Completitud promedio"
          hint="Sobre campos de RIPS"
        />
        <MetricCard
          value={`${m.conCIE10}/${m.total}`}
          label="Con diagnóstico CIE-10"
        />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-base font-semibold text-deep">
            Notas por estado
          </h2>
          {m.porEstado.length ? (
            <BarList data={m.porEstado} />
          ) : (
            <p className="text-sm text-muted">Sin notas registradas.</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold text-deep">
            Notas por servicio
          </h2>
          {m.porServicio.length ? (
            <BarList data={m.porServicio} />
          ) : (
            <p className="text-sm text-muted">Sin datos.</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold text-deep">
            Calidad documental
          </h2>
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <Donut value={m.completitudProm} label="Promedio" />
            <div className="flex-1 space-y-3 self-stretch">
              {m.compPorServicio.map((q) => (
                <div key={q.servicio}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-soft">{q.servicio}</span>
                    <span className="font-semibold text-deep">
                      {q.completitud}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-ice">
                    <div
                      className="h-full rounded-full bg-success"
                      style={{ width: `${q.completitud}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold text-deep">
            Tipo de atención
          </h2>
          {m.porTipo.length ? (
            <BarList data={m.porTipo} />
          ) : (
            <p className="text-sm text-muted">Sin datos.</p>
          )}
        </Card>
      </div>

      <p className="mt-6 text-xs text-muted">
        Cifras calculadas a partir de las consultas registradas en este entorno.
        Al conectar la base de datos institucional reflejarán la actividad real
        de todos los médicos.
      </p>
    </div>
  );
}
