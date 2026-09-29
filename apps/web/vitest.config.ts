import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // TZ fija y distinta de Bogotá: reproduce el runtime de Vercel (UTC) y hace
    // que las pruebas de lib/dates.ts fallen si alguien vuelve a leer el reloj
    // de la máquina en vez de la zona clínica. Sin esto la suite pasaría en un
    // portátil colombiano y fallaría en CI, o —peor— al revés.
    env: { TZ: "UTC" },
  },
  resolve: {
    alias: {
      // Reproduce el alias "@/..." de tsconfig para que los tests importen igual
      // que el código de la app.
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
