import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // Reproduce el alias "@/..." de tsconfig para que los tests importen igual
      // que el código de la app.
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
