// Punto ÚNICO de reporte de errores (isomórfico: server + client).
//
// Hoy registra de forma estructurada (lo captura Vercel / la consola del navegador).
// Está listo para Sentry: para activarlo, crea el proyecto y corre
//   npx @sentry/wizard@latest -i nextjs
// y añade dentro de reportError:
//   import * as Sentry from "@sentry/nextjs";
//   Sentry.captureException(err, { extra: context });
// gateado por process.env.NEXT_PUBLIC_SENTRY_DSN.
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

  // Enganche a Sentry (ver comentario arriba):
  // if (process.env.NEXT_PUBLIC_SENTRY_DSN) Sentry.captureException(err, { extra: context });
}
