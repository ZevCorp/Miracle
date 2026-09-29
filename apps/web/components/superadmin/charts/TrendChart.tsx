"use client";

import { useId, useMemo, useRef, useState } from "react";

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
 *
 * CÓMO SE INSPECCIONA UN DÍA
 * Con puntero (ratón, dedo o lápiz) sobre una única capa de captura: el índice
 * sale de la posición, no de una rejilla de rectángulos con `onMouseEnter`. Esa
 * versión anterior solo existía para el ratón, así que en tablet —donde de
 * verdad se mira esta consola— el tooltip no aparecía nunca.
 *
 * Y con teclado: la gráfica recibe foco y las flechas recorren los días. Sin
 * eso, el único sitio donde se pueden leer los valores exactos era inalcanzable
 * sin ratón. La tabla equivalente para lectores de pantalla va debajo, oculta.
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

export function TrendChart({
  data,
  /** Periodo ya resuelto ("últimos 7 días"), para que el lector de pantalla
      anuncie el mismo rango que ve el resto de la página. */
  periodo = "el periodo seleccionado",
}: {
  data: Punto[];
  periodo?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useId();
  const pistaId = useId();
  const svgRef = useRef<SVGSVGElement>(null);

  // Al cambiar de rango la serie es otra y el índice que había apuntaría a un
  // día distinto, así que se suelta la selección. La identidad se mide por
  // extremos y largo, no por la referencia del array: cada refresco automático
  // trae un array nuevo con los mismos días, y ahí borrar el tooltip que
  // alguien está leyendo sería un parpadeo gratuito. Se ajusta en render —el
  // patrón para derivar estado de props— y no en un efecto, que provocaría un
  // segundo render en cascada.
  const claveSerie = `${data.length}:${data[0]?.date ?? ""}:${data[data.length - 1]?.date ?? ""}`;
  const [serieVista, setSerieVista] = useState(claveSerie);
  if (serieVista !== claveSerie) {
    setSerieVista(claveSerie);
    setHover(null);
  }

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

  const acotar = (i: number) => Math.min(data.length - 1, Math.max(0, i));

  /**
   * Día bajo el puntero. Se convierte de píxeles de pantalla a unidades del
   * viewBox con el ancho real del `<svg>`: el lienzo se escala y además puede
   * estar desplazado dentro del contenedor con scroll, así que la proporción
   * sobre el contenedor no sirve.
   */
  const alPuntero = (clientX: number) => {
    const caja = svgRef.current?.getBoundingClientRect();
    if (!caja || caja.width === 0) return;
    if (data.length === 1) return setHover(0);
    const enViewBox = ((clientX - caja.left) / caja.width) * W;
    setHover(acotar(Math.round(((enViewBox - PAD.left) / plotW) * (data.length - 1))));
  };

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
      <div className="overflow-x-auto">
        {/* El tooltip se ancla A ESTE div, no al contenedor con scroll: comparte
            ancho exacto con el lienzo, así que su `left` en % cae sobre el día
            correcto también cuando la gráfica está desplazada. */}
        <div className="relative min-w-[600px]">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent"
            style={{ height: "auto", touchAction: "pan-y" }}
            role="img"
            aria-label={`Atenciones por día en ${periodo}`}
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
                // Sin día activo, la primera flecha entra por el extremo que
                // corresponde: derecha empieza en el primer día, izquierda en el último.
                setHover((h) => acotar(h === null ? (paso > 0 ? 0 : data.length - 1) : h + paso));
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

            {/* Fondo de captura: una sola superficie para todo el área de trazado.
                El puntero no tiene que acertarle a una marca ni a una banda. */}
            <rect x={0} y={0} width={W} height={H} fill="transparent" />

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
              <g pointerEvents="none">
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
          </svg>

          {activo ? (
            <div
              className="pointer-events-none absolute top-0 z-10 min-w-[9rem] rounded-lg border border-line bg-surface px-3 py-2 shadow-[var(--shadow-md)]"
              style={{
                left: `${(xDe(hover!) / W) * 100}%`,
                // Cerca de los bordes el tooltip se recoge hacia dentro en vez de
                // salirse de la tarjeta.
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

      <p id={pistaId} className="sr-only">
        Gráfica interactiva. Con el foco puesto, usa las flechas izquierda y derecha
        para recorrer los días, Inicio y Fin para ir a los extremos y Escape para
        soltar la selección. Debajo hay una tabla con los mismos datos.
      </p>

      {/* El día bajo el cursor se anuncia al vuelo: sin esto, mover la selección
          con el teclado no produce ningún cambio audible. */}
      <p className="sr-only" aria-live="polite">
        {activo
          ? `${formatDia(activo.date)}: ${activo.consultations} consultas, ${activo.encounters} del asistente clínico.`
          : ""}
      </p>

      {/* Los datos exactos, para quien no puede leer el trazo. */}
      <table className="sr-only">
        <caption>Atenciones por día en {periodo}</caption>
        <thead>
          <tr>
            <th scope="col">Día</th>
            <th scope="col">Consultas</th>
            <th scope="col">Asistente clínico</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <th scope="row">{d.date}</th>
              <td>{d.consultations}</td>
              <td>{d.encounters}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
