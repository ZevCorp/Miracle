import { OrbArt } from "./orb-art";

type BrandSphereProps = {
  size?: number;
  className?: string;
  /** Halo exterior. Se apaga cuando la esfera va sobre un fondo muy cargado. */
  glow?: boolean;
  /**
   * "Miracle" escrito DENTRO del orbe, como en el logo original.
   *
   * Por defecto aparece cuando el ORBE (no la caja, que incluye el halo) pasa
   * de 118px: por debajo, la palabra mide menos de 3px de alto y se vuelve una
   * mancha gris. Más vale un orbe limpio que un wordmark ilegible.
   */
  wordmark?: boolean;
};

/**
 * La esfera de marca en grande: el logo completo de Miracle.
 *
 * Mismo orbe que BrandMark (orb-art.tsx) con lo que solo cabe cuando hay
 * tamaño: la palabra dentro y su sonrisa, colocada bajo "ra" como en el
 * original.
 */
export function BrandSphere({
  size = 360,
  className,
  glow = true,
  wordmark,
}: BrandSphereProps) {
  // El orbe ocupa 76 de las 140 unidades del viewBox.
  const diametroOrbe = size * (76 / 140);
  const conPalabra = wordmark ?? diametroOrbe >= 118;

  return (
    <svg
      width={size}
      height={size}
      viewBox="-20 -20 140 140"
      className={className}
      role="img"
      aria-label="Miracle"
    >
      <OrbArt id="bs" size={size} glow={glow} haloRadius={70} />

      {conPalabra ? (
        <>
          <text
            x="50"
            y="53"
            textAnchor="middle"
            fill="#ffffff"
            /* Inter y no la display: Schibsted Grotesk no baja de 400 (200,
               300 y 400 miden exactamente lo mismo), y el wordmark del logo
               original es mucho más fino que eso. Inter sí tiene eje de peso. */
            fontFamily="var(--font-sans), ui-sans-serif, system-ui, sans-serif"
            fontSize="8.6"
            fontWeight={200}
            letterSpacing="1.5"
            /* El tracking sobra después de la última letra y empuja la palabra
               a la derecha: se compensa media unidad. */
            dx="-0.72"
          >
            Miracle
          </text>
          {/* La sonrisa, bajo "ra", como en el original. */}
          <path
            d="M 43.9 57.4 q 3.1 3.5 6.2 0"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.95"
            strokeWidth="0.8"
            strokeLinecap="round"
          />
        </>
      ) : (
        <path
          d="M 44.4 55.8 q 5.6 6.2 11.2 0"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.95"
          strokeWidth={Math.max(1.2, 168 / size)}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
