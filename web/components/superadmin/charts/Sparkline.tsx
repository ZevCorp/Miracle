/**
 * Sparkline: la microtendencia que acompaña a un número en una tarjeta KPI.
 *
 * Sin ejes, sin rejilla, sin etiquetas: su trabajo es dar la FORMA de la serie
 * junto al valor, no permitir leer valores puntuales (para eso está la gráfica
 * grande). Línea de 2px con punto final de r=4 (mínimo de 8px de diámetro),
 * según las especificaciones de marcas.
 */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  tone = "serie-1",
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: "serie-1" | "serie-2" | "muted";
  label?: string;
}) {
  if (values.length < 2) {
    return <div style={{ width, height }} aria-hidden="true" />;
  }

  const color = `var(--color-${tone === "muted" ? "chart-axis" : tone})`;
  const max = Math.max(...values);
  const min = Math.min(...values);
  // Serie plana: una recta a media altura en vez de dividir por cero.
  const span = max - min || 1;
  const pad = 3; // deja aire para que el punto final no se corte

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });

  const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label ?? "Tendencia"}
      className="overflow-visible"
    >
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Anillo de superficie: mantiene el punto legible si cruza la línea. */}
      <circle cx={lastX} cy={lastY} r={4} fill={color} stroke="var(--color-surface)" strokeWidth={2} />
    </svg>
  );
}
