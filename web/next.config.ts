import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Fija la raíz del proyecto (hay un package-lock.json suelto en el home del
  // usuario que confunde la inferencia del workspace root).
  turbopack: {
    root: __dirname,
  },
  env: {
    // Qué versión atendió cada consulta. Sin esto, "¿mejoró el producto con el
    // cambio de ayer?" no se puede responder: la telemetría sabría cuánto se
    // corrigió una nota pero no con qué build. Se congela en el build porque es
    // exactamente lo que identifica a ese build.
    //
    // En local queda "dev" a propósito: un número de versión inventado en la
    // máquina de alguien ensuciaría la comparación entre versiones reales.
    NEXT_PUBLIC_APP_VERSION:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
  },
  // `opus-decoder` (audio del Omi) arrastra `@eshaz/web-worker`, cuyo build de
  // Node hace un `import(variable)` que el bundler no puede resolver y rompe el
  // build de servidor. El paquete solo se ejecuta en el navegador y bajo demanda
  // (ver lib/omi/opusStream.ts), así que se saca del bundle de servidor.
  serverExternalPackages: ["opus-decoder"],
  images: {
    // Un sitio de marketing no necesita variantes de 2048/3840 px; capar aquí
    // evita que next/image reescale las fotos a tamaños enormes (más rápido de
    // optimizar y suficiente para retina).
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  },
  // La home es la experiencia de Ü: un sitio estático en /public/u servido en
  // la raíz. Se hace por rewrite y no moviendo archivos para no tocar ninguna
  // de las rutas del producto (auth, precios, piloto, API…), que siguen vivas.
  async rewrites() {
    // beforeFiles: las reescrituras por defecto corren DESPUÉS del filesystem,
    // así que app/(marketing)/page.tsx ganaba y la home seguía siendo la vieja.
    return {
      beforeFiles: [{ source: "/", destination: "/u/index.html" }],
    };
  },
  /* Las subpáginas de marketing se retiran del sitio.
   *
   * La home pasó a ser la experiencia completa de Ü —el recorrido 3D, la
   * película y la landing de "cómo se pone en marcha"— y estas ocho repetían,
   * peor y en frío, lo que la home ya cuenta.
   *
   * Se retiran REDIRIGIENDO, no borrando el código: revertirlo es quitar este
   * bloque. El copy y el fuente de las ocho quedan guardados en
   * `contexto-viejo.md`, en el repo del sitio conceptual.
   *
   * Ojo con lo que NO está aquí: /login, /registro, /onboarding, /suscripcion,
   * /app/* y /superadmin/* son el PRODUCTO, no el sitio, y siguen intactas.
   * Tumbarlas dejaría fuera a quien ya esté usando la plataforma. */
  async redirects() {
    const retiradas = [
      "casos-de-uso",
      "como-funciona",
      "contacto",
      "demo",
      "piloto",
      "precios",
      "recursos",
      "seguridad",
    ];
    return retiradas.flatMap((r) => [
      { source: `/${r}`, destination: "/", permanent: false },
      { source: `/${r}/:ruta*`, destination: "/", permanent: false },
    ]);
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // La plataforma clínica nunca debe poder embeberse en un iframe ajeno.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

// Sin DSN el export es el config actual, intacto: Sentry no toca el build. Con
// DSN se envuelve para que el SDK funcione (sin subir sourcemaps en esta fase,
// así no hace falta SENTRY_AUTH_TOKEN).
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      silent: true,
      telemetry: false,
      sourcemaps: { disable: true },
      disableLogger: true,
    })
  : nextConfig;
