import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Reglas nuevas del React Compiler (eslint-plugin-react-hooks v6): útiles,
      // pero marcan patrones válidos preexistentes en NoteSectionView (detección
      // de capacidades del navegador, autoguardado y el patrón "latest ref").
      // Se dejan como AVISO para no bloquear el CI ni refactorizar un componente
      // clínico ahora; quedan como deuda a revisar.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
