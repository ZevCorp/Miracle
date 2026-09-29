import { OrbArt } from "./orb-art";

type BrandMarkProps = {
  size?: number;
  className?: string;
  /** Sin sonrisa: para usos por debajo de ~22px, donde el trazo es un borrón. */
  plain?: boolean;
};

/**
 * Símbolo de Miracle: el orbe luminoso, redibujado del logo de marca con los
 * colores muestreados del original.
 *
 * Va sin fondo a propósito. El logo original viene sobre un gris azulado muy
 * claro, pero este símbolo vive sobre el navy del menú lateral, sobre blanco y
 * sobre el lienzo oscuro: cualquier fondo horneado se vería como un parche
 * rectangular en al menos una de las tres superficies.
 *
 * El dibujo vive en orb-art.tsx, compartido con BrandSphere.
 */
export function BrandMark({ size = 36, className, plain = false }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Miracle"
    >
      <OrbArt id="bm" size={size} />
      {/* La sonrisa. En el símbolo suelto va centrada: sin la palabra encima,
          descentrarla la dejaría flotando sin motivo. Por debajo de 22px se
          retira — a ese tamaño solo ensucia el orbe. */}
      {!plain && size >= 22 ? (
        <path
          d="M 44.4 55.8 q 5.6 6.2 11.2 0"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.95"
          strokeWidth={Math.max(1.4, 120 / size)}
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}
