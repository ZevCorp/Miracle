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
    <html lang="es" suppressHydrationWarning>
      <head>
        <style>{`:root{color-scheme:light;--error-bg:#f6f8fb;--error-text:#0c1424;--error-muted:#5d6b80;--error-accent:#2f6fe0}@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--error-bg:#08111f;--error-text:#f3f7fc;--error-muted:#9cabbe;--error-accent:#3272d9}}:root.dark,:root[data-theme="dark"]{color-scheme:dark;--error-bg:#08111f;--error-text:#f3f7fc;--error-muted:#9cabbe;--error-accent:#3272d9}:root[data-theme="light"]{color-scheme:light;--error-bg:#f6f8fb;--error-text:#0c1424;--error-muted:#5d6b80;--error-accent:#2f6fe0}`}</style>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('miracle-theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var r=document.documentElement;r.classList.toggle('dark',t==='dark');r.dataset.theme=t;r.style.colorScheme=t}catch(e){}`,
          }}
        />
      </head>
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", background: "var(--error-bg)", color: "var(--error-text)", padding: "1rem", textAlign: "center" }}>
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Algo salió mal</h1>
          <p style={{ marginTop: 8, fontSize: "0.875rem", color: "var(--error-muted)" }}>
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
              background: "var(--error-accent)",
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
