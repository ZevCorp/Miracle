"use client";

import { useId, useMemo, useState } from "react";

/**
 * Gráfica de tendencia diaria con dos series en UNA sola escala.
 *
 * Las dos series son conteos de atenciones, así que comparten eje: nunca un
 * segundo eje Y (dos escalas en un mismo marco hacen que el lector compare
 * alturas que no son comparables).
 *
 * Serie 1 (consultas de la web) va como área + línea porque es la principal;
 * serie 2 (asistente clínico) va como línea sola. Leyenda siempre presente
 * —son dos series— y capa de hover con crosshair y tooltip.
 */

type Punto = { date: string; consultations: number; encounters: number };

const W = 760;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 40 };

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v));
  return ticks;
}

function formatDia(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function TrendChart({ data }: { data: Punto[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useId();

  const { puntos1, puntos2, area1, ticks, maxY, plotW, plotH } = useMemo(() => {
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const rawMax = Math.max(1, ...data.map((d) => Math.max(d.consultations, d.encounters)));
    const ticks = niceTicks(rawMax);
    const maxY = Math.max(rawMax, ticks[ticks.length - 1] ?? rawMax);

    const x = (i: number) => PAD.left + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
    const y = (v: number) => PAD.top + plotH - (v / maxY) * plotH;

    const p1 = data.map((d, i) => [x(i), y(d.consultations)] as const);
    const p2 = data.map((d, i) => [x(i), y(d.encounters)] as const);
    const linea = (pts: readonly (readonly [number, number])[]) =>
      pts.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");

    return {
      puntos1: linea(p1),
      puntos2: linea(p2),
      area1: `${linea(p1)} L${(p1[p1.length - 1]?.[0] ?? 0).toFixed(1)},${PAD.top + plotH} L${(p1[0]?.[0] ?? 0).toFixed(1)},${PAD.top + plotH} Z`,
      ticks,
      maxY,
      plotW,
      plotH,
    };
  }, [data]);

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">Todavía no hay datos para graficar.</p>;
  }

  const xDe = (i: number) => PAD.left + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const yDe = (v: number) => PAD.top + plotH - (v / maxY) * plotH;
  const activo = hover === null ? null : data[hover];

  // Etiquetas del eje X: 5 fechas repartidas, con la última siempre presente.
  // Se calculan los índices en vez de usar el módulo suelto porque el último
  // punto caía pegado al penúltimo múltiplo y las dos fechas se solapaban.
  const marcasX = (() => {
    const total = data.length;
    if (total <= 5) return data.map((_, i) => i);
    const paso = (total - 1) / 4;
    const idx = new Set<number>();
    for (let k = 0; k <= 4; k++) idx.add(Math.round(k * paso));
    return [...idx].sort((a, b) => a - b);
  })();

  return (
    <div className="w-full">
      {/* Leyenda: identidad nunca depende solo del color. */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-serie-1)" }} />
          Consultas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-serie-2)" }} />
          Asistente clínico
        </span>
      </div>

      {/* En móvil la gráfica scrollea dentro de su tarjeta en vez de encogerse:
          al escalar el viewBox a 375px el texto de los ejes cae a ~5px y deja de
          leerse. Con un ancho mínimo, el eje se mantiene legible y el que se
          mueve es el contenedor, no la página. */}
      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[600px]"
          style={{ height: "auto" }}
          role="img"
          aria-label="Atenciones por día en los últimos 30 días"
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-serie-1)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--color-serie-1)" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Rejilla: hairline sólida, recesiva. */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={yDe(t)}
                y2={yDe(t)}
                stroke="var(--color-chart-grid)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={yDe(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-[var(--color-chart-axis)] text-[12px]"
              >
                {t}
              </text>
            </g>
          ))}

          {/* Fechas del eje X */}
          {marcasX.map((i) => (
            <text
              key={data[i].date}
              x={xDe(i)}
              y={H - 8}
              textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
              className="fill-[var(--color-chart-axis)] text-[12px]"
            >
              {formatDia(data[i].date)}
            </text>
          ))}

          <path d={area1} fill={`url(#${gradId})`} />
          <path d={puntos1} fill="none" stroke="var(--color-serie-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={puntos2} fill="none" stroke="var(--color-serie-2)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {hover !== null ? (
            <g>
              <line
                x1={xDe(hover)}
                x2={xDe(hover)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke="var(--color-chart-axis)"
                strokeWidth={1}
              />
              <circle cx={xDe(hover)} cy={yDe(data[hover].consultations)} r={4}
                fill="var(--color-serie-1)" stroke="var(--color-surface)" strokeWidth={2} />
              <circle cx={xDe(hover)} cy={yDe(data[hover].encounters)} r={4}
                fill="var(--color-serie-2)" stroke="var(--color-surface)" strokeWidth={2} />
            </g>
          ) : null}

          {/* Bandas de captura: el objetivo del puntero es más ancho que la marca. */}
          {data.map((d, i) => (
            <rect
              key={d.date}
              x={xDe(i) - plotW / data.length / 2}
              y={PAD.top}
              width={plotW / data.length}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>

        {activo ? (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-[9rem] -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 shadow-[var(--shadow-md)]"
            style={{
              left: `${(xDe(hover!) / W) * 100}%`,
              transform: `translateX(${hover! > data.length * 0.75 ? "-85%" : hover! < data.length * 0.25 ? "-15%" : "-50%"})`,
            }}
          >
            <div className="text-xs font-semibold text-deep">{formatDia(activo.date)}</div>
            <div className="mt-1.5 space-y-1 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-serie-1)" }} />
                  Consultas
                </span>
                <span className="font-semibold text-deep">{activo.consultations}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-serie-2)" }} />
                  Asistente
                </span>
                <span className="font-semibold text-deep">{activo.encounters}</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
