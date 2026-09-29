import * as Sentry from "@sentry/nextjs";

// Runtime edge (middleware/proxy). Se importa solo con DSN presente.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  sendDefaultPii: false,
});
