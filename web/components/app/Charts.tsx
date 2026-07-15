// Charts ligeros en SVG/CSS (sin librerías).

export function BarList({
  data,
  unit = "",
}: {
  data: { label: string; value: number }[];
  unit?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-soft">{d.label}</span>
            <span className="font-semibold text-deep">
              {d.value}
              {unit}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-ice">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GroupedBars({
  data,
  unit = "",
}: {
  data: { label: string; antes: number; despues: number }[];
  unit?: string;
}) {
  const max = Math.max(...data.flatMap((d) => [d.antes, d.despues]), 1);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-mist" /> Antes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" /> Con Miracle
        </span>
      </div>
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 text-sm text-ink-soft">{d.label}</div>
          <div className="space-y-1">
            <Bar value={d.antes} max={max} unit={unit} color="bg-mist" />
            <Bar value={d.despues} max={max} unit={unit} color="bg-accent" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Bar({
  value,
  max,
  unit,
  color,
}: {
  value: number;
  max: number;
  unit: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ice">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
      <span className="w-12 text-right text-xs font-medium text-muted">
        {value}
        {unit}
      </span>
    </div>
  );
}

export function MiniLine({
  points,
  height = 80,
}: {
  points: { label: string; value: number }[];
  height?: number;
}) {
  const w = 300;
  const max = Math.max(...points.map((p) => p.value), 1);
  const min = Math.min(...points.map((p) => p.value), 0);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * step;
    const y = height - ((p.value - min) / range) * (height - 12) - 6;
    return [x, y] as const;
  });
  const path = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${path} L${w},${height} L0,${height} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      className="w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="Tendencia"
    >
      <defs>
        <linearGradient id="line-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#line-fill)" />
      <path
        d={path}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="var(--color-accent)" />
      ))}
    </svg>
  );
}

export function Donut({
  value,
  label,
  size = 132,
}: {
  value: number; // 0-100
  label: string;
  size?: number;
}) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} role="img" aria-label={label}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-ice)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeLinecap="round"
        />
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-deep font-display"
          fontSize="22"
          fontWeight="700"
        >
          {value}%
        </text>
      </svg>
      <span className="mt-1 text-sm text-muted">{label}</span>
    </div>
  );
}
