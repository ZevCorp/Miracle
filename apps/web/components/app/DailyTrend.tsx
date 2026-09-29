"use client";

import { useId, useMemo, useRef, useState } from "react";

/**
 * Notas por día: una sola serie, con eje y valores exactos consultables.
 *
 * Sustituye a `MiniLine` en el panel institucional. MiniLine dibuja un trazo sin
 * eje ni rejilla: sirve como adorno junto a un número, pero no permite responder
 * "¿cuántas notas hubo el martes?", que es justo lo que un administrador
 * pregunta al ver un pico. Aquí el trazo es consultable con puntero y con
 * teclado, y debajo va la misma serie como tabla para lectores de pantalla.
 *
 * No se reutiliza TrendChart de la consola de plataforma porque está construido
 * alrededor de DOS series (consultas + asistente clínico) con su leyenda fija:
 * pasarle una sola dibujaría una línea plana en cero rotulada "Asistente
 * clínico". Comparte, eso sí, los mismos tokens de color y las mismas medidas,
 * para que las dos consolas se lean como el mismo producto.
 */

const W = 760;
const H = 200;
const PAD = { top: 14, right: 16, bottom: 26, left: 38 };

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

export function DailyTrend({
  data,
  periodo = "el periodo seleccionado",
  etiquetaSerie = "Notas",
}: {
  data: { fecha: string; consultas: number }[];
  periodo?: string;
  etiquetaSerie?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useId();
  const pistaId = useId();
  const svgRef = useRef<SVGSVGElement>(null);

  // Al cambiar el rango la serie es otra y el índice apuntaría a un día
  // distinto: se suelta la selección. Se ajusta en render (no en un efecto) para
  // no provocar un segundo render en cascada.
  const claveSerie = `${data.length}:${data[0]?.fecha ?? ""}:${data[data.length - 1]?.fecha ?? ""}`;
  const [serieVista, setSerieVista] = useState(claveSerie);
  if (serieVista !== claveSerie) {
    setSerieVista(claveSerie);
    setHover(null);
  }

  const { linea, area, ticks, maxY, plotW, plotH } = useMemo(() => {
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const rawMax = Math.max(1, ...data.map((d) => d.consultas));
    const ticks = niceTicks(rawMax);
    const maxY = Math.max(rawMax, ticks[ticks.length - 1] ?? rawMax);

    const x = (i: number) =>
      PAD.left + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
    const y = (v: number) => PAD.top + plotH - (v / maxY) * plotH;

    const pts = data.map((d, i) => [x(i), y(d.consultas)] as const);
    const trazo = pts
      .map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`)
      .join(" ");

    return {
      linea: trazo,
      area: pts.length
        ? `${trazo} L${pts[pts.length - 1][0].toFixed(1)},${PAD.top + plotH} L${pts[0][0].toFixed(1)},${PAD.top + plotH} Z`
        : "",
      ticks,
      maxY,
      plotW,
      plotH,
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        Todavía no hay notas en este periodo.
      </p>
    );
  }

  const xDe = (i: number) =>
    PAD.left + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const yDe = (v: number) => PAD.top + plotH - (v / maxY) * plotH;
  const activo = hover === null ? null : data[hover];
  const acotar = (i: number) => Math.min(data.length - 1, Math.max(0, i));

  const alPuntero = (clientX: number) => {
    const caja = svgRef.current?.getBoundingClientRect();
    if (!caja || caja.width === 0) return;
    if (data.length === 1) return setHover(0);
    const enViewBox = ((clientX - caja.left) / caja.width) * W;
    setHover(acotar(Math.round(((enViewBox - PAD.left) / plotW) * (data.length - 1))));
  };

  // 5 fechas repartidas con la última siempre presente (el módulo suelto
  // solapaba la última con el penúltimo múltiplo).
  const marcasX = (() => {
    if (data.length <= 5) return data.map((_, i) => i);
    const paso = (data.length - 1) / 4;
    const idx = new Set<number>();
    for (let k = 0; k <= 4; k++) idx.add(Math.round(k * paso));
    return [...idx].sort((a, b) => a - b);
  })();

  return (
    <div className="w-full">
      {/* En móvil scrollea dentro de su tarjeta: al escalar el viewBox a 375px
          el texto de los ejes cae a ~5px y deja de leerse. */}
      <div className="overflow-x-auto">
        <div className="relative min-w-[520px]">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent"
            style={{ height: "auto", touchAction: "pan-y" }}
            role="img"
            aria-label={`${etiquetaSerie} por día en ${periodo}`}
            aria-describedby={pistaId}
            tabIndex={0}
            onPointerMove={(e) => alPuntero(e.clientX)}
            onPointerDown={(e) => alPuntero(e.clientX)}
            onPointerLeave={() => setHover(null)}
            onPointerCancel={() => setHover(null)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const paso = e.key === "ArrowRight" ? 1 : -1;
                setHover((h) =>
                  acotar(h === null ? (paso > 0 ? 0 : data.length - 1) : h + paso),
                );
              } else if (e.key === "Home") {
                e.preventDefault();
                setHover(0);
              } else if (e.key === "End") {
                e.preventDefault();
                setHover(data.length - 1);
              } else if (e.key === "Escape") {
                setHover(null);
              }
            }}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-serie-1)" stopOpacity="0.16" />
                <stop offset="100%" stopColor="var(--color-serie-1)" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            <rect x={0} y={0} width={W} height={H} fill="transparent" />

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

            {marcasX.map((i) => (
              <text
                key={data[i].fecha}
                x={xDe(i)}
                y={H - 7}
                textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
                className="fill-[var(--color-chart-axis)] text-[12px]"
              >
                {formatDia(data[i].fecha)}
              </text>
            ))}

            <path d={area} fill={`url(#${gradId})`} />
            <path
              d={linea}
              fill="none"
              stroke="var(--color-serie-1)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {hover !== null ? (
              <g pointerEvents="none">
                <line
                  x1={xDe(hover)}
                  x2={xDe(hover)}
                  y1={PAD.top}
                  y2={PAD.top + plotH}
                  stroke="var(--color-chart-axis)"
                  strokeWidth={1}
                />
                <circle
                  cx={xDe(hover)}
                  cy={yDe(data[hover].consultas)}
                  r={4}
                  fill="var(--color-serie-1)"
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                />
              </g>
            ) : null}
          </svg>

          {activo ? (
            <div
              className="pointer-events-none absolute top-0 z-10 min-w-[7.5rem] rounded-lg border border-line bg-surface px-3 py-2 shadow-[var(--shadow-md)]"
              style={{
                left: `${(xDe(hover!) / W) * 100}%`,
                transform: `translateX(${
                  hover! > data.length * 0.75
                    ? "-85%"
                    : hover! < data.length * 0.25
                      ? "-15%"
                      : "-50%"
                })`,
              }}
            >
              <div className="text-xs font-semibold text-deep">{formatDia(activo.fecha)}</div>
              <div className="mt-1 flex items-center justify-between gap-3 text-xs">
                <span className="text-muted">{etiquetaSerie}</span>
                <span className="font-semibold text-deep">{activo.consultas}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <p id={pistaId} className="sr-only">
        Gráfica interactiva. Con el foco puesto, usa las flechas izquierda y derecha
        para recorrer los días, Inicio y Fin para ir a los extremos y Escape para
        soltar la selección. Debajo hay una tabla con los mismos datos.
      </p>

      <p className="sr-only" aria-live="polite">
        {activo ? `${formatDia(activo.fecha)}: ${activo.consultas} notas.` : ""}
      </p>

      <table className="sr-only">
        <caption>
          {etiquetaSerie} por día en {periodo}
        </caption>
        <thead>
          <tr>
            <th scope="col">Día</th>
            <th scope="col">{etiquetaSerie}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.fecha}>
              <th scope="row">{d.fecha}</th>
              <td>{d.consultas}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
