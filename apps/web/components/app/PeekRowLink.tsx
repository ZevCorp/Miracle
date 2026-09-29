"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePeekClick, type PeekTarget } from "@/components/app/PeekProvider";

/**
 * El <Link> de una fila de lista que abre el panel rápido en vez de navegar.
 *
 * Existe porque /app/notas y /app/pacientes son páginas de servidor: no pueden
 * usar el hook directamente, pero sí pueden renderizar este componente fino
 * pasándole el markup de la fila como children. ⌘-clic y botón central siguen
 * navegando al detalle (usePeekClick los deja pasar).
 */
export function PeekRowLink({
  target,
  listIds,
  href,
  className,
  children,
  ariaLabel,
  dataLight = false,
}: {
  target: PeekTarget;
  listIds?: readonly string[];
  href: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
  /** Superficie con luz de cursor ([data-light], ver CursorLight). */
  dataLight?: boolean;
}) {
  const onClick = usePeekClick(target, listIds);
  return (
    <Link
      href={href}
      onClick={onClick}
      className={className}
      aria-label={ariaLabel}
      data-light={dataLight ? "" : undefined}
    >
      {children}
    </Link>
  );
}
