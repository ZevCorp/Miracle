import * as Sentry from "@sentry/nextjs";

// Solo se importa desde instrumentation.ts cuando hay DSN. sendDefaultPii:false
// para no capturar datos personales (contexto clínico) por defecto.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  sendDefaultPii: false,
});
