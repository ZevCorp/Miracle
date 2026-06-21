type BrandMarkProps = {
  size?: number;
  className?: string;
};

/**
 * Símbolo de marca de Miracle: esfera azul perlada (brand oficial).
 * SVG con gradientes radiales para el efecto de orbe translúcido.
 */
export function BrandMark({ size = 36, className }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Miracle"
    >
      <defs>
        <radialGradient id="mk-orb" cx="38%" cy="32%" r="74%">
          <stop offset="0%" stopColor="#f6fbff" />
          <stop offset="34%" stopColor="#cfe6fb" />
          <stop offset="66%" stopColor="#7fb2f2" />
          <stop offset="100%" stopColor="#2f74d0" />
        </radialGradient>
        <radialGradient id="mk-hi" cx="34%" cy="26%" r="34%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mk-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="#0f172a" stopOpacity="0" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.14" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="url(#mk-orb)" />
      <circle cx="50" cy="50" r="46" fill="url(#mk-shadow)" />
      <ellipse cx="39" cy="33" rx="19" ry="13" fill="url(#mk-hi)" />
      <circle
        cx="50"
        cy="50"
        r="45.5"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.28"
      />
    </svg>
  );
}
