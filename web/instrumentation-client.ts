// Instrumentación de cliente (Sentry). Sin NEXT_PUBLIC_SENTRY_DSN no inicializa
// nada y onRouterTransitionStart queda como no-op: el comportamiento es idéntico
// al de hoy hasta que se configure el DSN en Vercel.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
  });
}

export const onRouterTransitionStart = dsn
  ? Sentry.captureRouterTransitionStart
  : () => {};
