import Link from "next/link";

/** Paginador simple basado en enlaces (server-safe) para páginas de lista RSC. */
export function Pager({
  basePath,
  page,
  pageSize,
  total,
  params,
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  params?: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v) sp.set(k, v);
    }
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };

  const linkClass =
    "rounded-full border border-line px-4 py-1.5 text-sm font-semibold text-deep hover:border-mist";
  const disabledClass =
    "rounded-full border border-line px-4 py-1.5 text-sm font-semibold text-muted opacity-50";

  return (
    <div className="mt-4 flex items-center justify-between">
      <span className="text-sm text-muted">
        Página {page} de {totalPages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={linkClass}>
            Anterior
          </Link>
        ) : (
          <span className={disabledClass}>Anterior</span>
        )}
        {page < totalPages ? (
          <Link href={href(page + 1)} className={linkClass}>
            Siguiente
          </Link>
        ) : (
          <span className={disabledClass}>Siguiente</span>
        )}
      </div>
    </div>
  );
}
