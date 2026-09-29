import type { MetadataRoute } from "next";

/**
 * Web App Manifest (Next 16 lo sirve en /manifest.webmanifest e inyecta
 * el <link rel="manifest"> automáticamente en todas las páginas).
 * Permite instalar el portal como aplicación de escritorio (PWA).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Miracle · Portal clínico",
    short_name: "Miracle",
    description:
      "Documente, revise y firme sus consultas clínicas desde el escritorio.",
    // Al abrir la app instalada se entra directo al panel (o al login si no hay sesión).
    start_url: "/app/dashboard",
    scope: "/",
    display: "standalone",
    lang: "es",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
