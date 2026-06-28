"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft text-warning">
        <AlertTriangle size={24} />
      </span>
      <h1 className="mt-4 text-xl font-semibold text-deep">Algo salió mal</h1>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Ocurrió un error al cargar esta sección. Puedes reintentar; si el
        problema persiste, recarga la página.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
      >
        Reintentar
      </button>
    </div>
  );
}
