/**
 * Esqueletos de carga de la consola. Todas las páginas son server components
 * que esperan una RPC: sin esto, cada navegación se queda en blanco. Las
 * alturas espejan las de la página real para que el contenido no salte al
 * llegar. Patrón animate-pulse + bg-ice del dashboard del médico.
 */

function Bloque({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[14px] bg-ice ${className}`} aria-hidden />;
}

export function SkeletonTitulo() {
  return (
    <div className="space-y-2">
      <div className="h-7 w-64 animate-pulse rounded-md bg-ice" aria-hidden />
      <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-ice-soft" aria-hidden />
    </div>
  );
}

export function SkeletonTileRow() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Bloque key={i} className="h-32" />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "h-56" }: { className?: string }) {
  return <Bloque className={className} />;
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
      <div className="border-b border-line px-5 py-3">
        <div className="h-4 w-40 animate-pulse rounded bg-ice" aria-hidden />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`px-5 py-4 ${i ? "border-t border-line" : ""}`}>
          <div className="h-4 w-full max-w-md animate-pulse rounded bg-ice-soft" aria-hidden />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChips() {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-ice" aria-hidden />
      ))}
    </div>
  );
}
