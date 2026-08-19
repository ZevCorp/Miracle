import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Fija la raíz del proyecto (hay un package-lock.json suelto en el home del
  // usuario que confunde la inferencia del workspace root).
  turbopack: {
    root: __dirname,
  },
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
