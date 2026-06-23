/**
 * Esfera perlada de Miracle como visual ambiental (no es el logo pequeño).
 * Orbe azul translúcido con brillo suave y halo. Pura SVG, sin dependencias.
 */
export function BrandSphere({
  size = 360,
  className,
  glow = true,
}: {
  size?: number;
  className?: string;
  glow?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 400 400"
      className={className}
      role="img"
      aria-label="Miracle"
    >
      <defs>
        <radialGradient id="bs-core" cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="20%" stopColor="#eef5ff" />
          <stop offset="52%" stopColor="#c1daf8" />
          <stop offset="80%" stopColor="#6ea8f1" />
          <stop offset="100%" stopColor="#2f6fe0" />
        </radialGradient>
        <radialGradient id="bs-hi" cx="32%" cy="24%" r="30%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bs-base" cx="60%" cy="82%" r="45%">
          <stop offset="0%" stopColor="#1b53b8" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#1b53b8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bs-glow" cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="#1f6feb" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#1f6feb" stopOpacity="0" />
        </radialGradient>
      </defs>

      {glow ? <circle cx="200" cy="205" r="196" fill="url(#bs-glow)" /> : null}
      <circle cx="200" cy="200" r="150" fill="url(#bs-core)" />
      <circle cx="200" cy="200" r="150" fill="url(#bs-base)" />
      <ellipse cx="158" cy="146" rx="74" ry="50" fill="url(#bs-hi)" />
      <circle
        cx="200"
        cy="200"
        r="149.5"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.28"
      />
    </svg>
  );
}
