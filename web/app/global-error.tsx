"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/observability";

// Captura errores del layout raíz (reemplaza <html>/<body>). Estilos inline para
// no depender de que el CSS global haya cargado.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { boundary: "global", digest: error.digest });
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f6f8fb",
          color: "#0c1424",
          padding: "1rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Algo salió mal</h1>
          <p style={{ marginTop: 8, fontSize: "0.875rem", color: "#6b7a8f" }}>
            Ocurrió un error inesperado. Puedes reintentar.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              padding: "0.6rem 1.25rem",
              borderRadius: 9999,
              border: "none",
              background: "#1f6fe0",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
