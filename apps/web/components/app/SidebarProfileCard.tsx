import Link from "next/link";
import { ChevronRight } from "lucide-react";

function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra[0] ?? "")
    .join("")
    .toUpperCase();
}

/**
 * Quién está adentro, al pie del sidebar: avatar, nombre y especialidad.
 * Pulsar abre la configuración personal — solo si el rol la tiene en su
 * menú (la demo no la ve, así que para ella es un bloque estático).
 *
 * No reutiliza ui/Avatar a propósito: aquel pinta bg-night, invisible sobre
 * este navy. Y NO trae "Salir": cerrar sesión vive en la cabecera (y en la
 * hoja «Más» del móvil) desde el arreglo del hueco 768-1024px.
 */
export function SidebarProfileCard({
  name,
  specialtyName,
  canOpenSettings,
}: {
  name: string;
  specialtyName?: string | null;
  canOpenSettings: boolean;
}) {
  const contenido = (
    <>
      <span
        aria-hidden
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-[13px] font-semibold text-white ring-1 ring-white/20"
      >
        {iniciales(name)}
      </span>
      <span className="sidebar-label min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold leading-tight text-sidebar-text">
          {name}
        </span>
        {specialtyName ? (
          <span className="block truncate text-[11px] leading-tight text-sidebar-muted">
            {specialtyName}
          </span>
        ) : null}
      </span>
      {canOpenSettings ? (
        <ChevronRight
          size={15}
          className="sidebar-expanded-only shrink-0 text-sidebar-muted"
          aria-hidden
        />
      ) : null}
    </>
  );

  const clases =
    "sidebar-item relative flex min-h-12 items-center gap-3 rounded-[12px] px-3 py-2";

  if (!canOpenSettings) {
    return <div className={clases}>{contenido}</div>;
  }

  return (
    <Link
      href="/app/configuracion"
      aria-label={`Abrir tu configuración personal (${name})`}
      className={`${clases} transition-colors hover:bg-sidebar-hover`}
    >
      {contenido}
    </Link>
  );
}
