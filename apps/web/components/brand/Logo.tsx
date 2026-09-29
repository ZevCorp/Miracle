import Link from "next/link";
import { BrandMark } from "./BrandMark";

type LogoProps = {
  onDark?: boolean;
  href?: string;
  size?: number;
  className?: string;
  /** Para frenar el enlace cuando quien lo usa navega a mano (guard de cambios sin guardar). */
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
};

/**
 * Logo completo: orbe + palabra "Miracle".
 *
 * La palabra sigue la tipografía del logo de marca —caja mixta, peso ligero y
 * tracking ancho— y ya no las versales apretadas de antes. En el logo original
 * va DENTRO del orbe; aquí sale al lado porque a los tamaños de interfaz
 * (25-34px) meterla dentro la dejaría en menos de 3px de alto. Cuando hay
 * espacio de verdad —login, portada, banda oscura— se usa BrandSphere, que sí
 * la lleva adentro.
 */
export function Logo({
  onDark = false,
  href = "/",
  size = 34,
  className = "",
  onClick,
}: LogoProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`inline-flex items-center gap-2 ${className}`}
      aria-label="Miracle — inicio"
    >
      <BrandMark size={size} />
      <span
        /* Inter extralight, no la display: Schibsted Grotesk no tiene pesos
           por debajo de 400 y el wordmark de marca es fino. */
        className={`text-[1.05rem] font-extralight tracking-[0.22em] ${
          onDark ? "text-white" : "text-deep"
        }`}
      >
        Miracle
      </span>
    </Link>
  );
}
