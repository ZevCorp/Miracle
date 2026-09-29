/**
 * Service worker mínimo.
 *
 * Su única razón de existir es cumplir el criterio de instalabilidad de los
 * navegadores basados en Chromium (para que se dispare `beforeinstallprompt`
 * y aparezca el botón "Instalar app").
 *
 * A propósito NO cachea nada: es una app clínica con sesión y datos sensibles,
 * y servir páginas o respuestas de auth desde caché podría mostrar contenido
 * obsoleto o de otra sesión. El handler de `fetch` está presente (requisito)
 * pero deja pasar todas las peticiones a la red sin intervenir.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Pass-through: no se intercepta ni se cachea nada. El navegador maneja la red.
});
