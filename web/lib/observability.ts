// Punto ÚNICO de reporte de errores (isomórfico: server + client).
//
// Siempre registra de forma estructurada (lo captura Vercel / la consola del
// navegador). Si NEXT_PUBLIC_SENTRY_DSN está configurado, además envía el error
// a Sentry; sin la variable, esa rama no hace nada (comportamiento de hoy).
//
// IMPORTANTE: nunca pasar PHI/PII en `context` (ni transcripciones, ni respuestas
// del modelo, ni datos del paciente) — solo metadatos seguros (ruta, status, id).

export type ErrorContext = Record<string, string | number | boolean | null | undefined>;

export function reportError(error: unknown, context: ErrorContext = {}): void {
  const err = error instanceof Error ? error : new Error(String(error));

  console.error(
    JSON.stringify({
      level: "error",
      name: err.name,
      message: err.message,
      ...context,
    }),
  );

  // Enganche a Sentry, gateado por DSN e importado en dinámico para no cargar
  // el SDK cuando no está configurado. Los fallos del reporte se ignoran.
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    void import("@sentry/nextjs")
      .then((Sentry) => Sentry.captureException(err, { extra: context }))
      .catch(() => {});
  }
}
