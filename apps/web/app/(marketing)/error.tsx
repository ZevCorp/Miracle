"use client";

import { useEffect } from "react";
import Link from "next/link";
import { reportError } from "@/lib/observability";

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { boundary: "marketing", digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold text-deep">Algo salió mal</h1>
      <p className="mt-2 text-sm text-muted">
        Tuvimos un problema al cargar esta página. Puedes reintentar o volver al inicio.
      </p>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-deep hover:border-mist"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
