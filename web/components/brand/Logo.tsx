import Link from "next/link";
import { BrandMark } from "./BrandMark";

type LogoProps = {
  onDark?: boolean;
  href?: string;
  size?: number;
  className?: string;
};

/** Logo completo: esfera + wordmark "MIRACLE". */
export function Logo({
  onDark = false,
  href = "/",
  size = 30,
  className = "",
}: LogoProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2.5 ${className}`}
      aria-label="Miracle — inicio"
    >
      <BrandMark size={size} />
      <span
        className={`font-display text-[1.15rem] font-semibold tracking-[0.18em] ${
          onDark ? "text-white" : "text-deep"
        }`}
      >
        MIRACLE
      </span>
    </Link>
  );
}
