import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("experiencia mobile-first Miracle", () => {
  it("protege las zonas seguras y evita el zoom de campos en iOS", () => {
    const css = source("app/globals.css");

    expect(css).toContain("safe-area-inset-bottom");
    expect(css).toContain("safe-area-inset-top");
    expect(css).toMatch(/font-size:\s*16px/);
    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).toContain("overflow-x: hidden");
  });

  it("ofrece navegación inferior sin invadir la captura clínica", () => {
    const navigation = source("components/app/MobileBottomNavigation.tsx");
    const shell = source("components/app/AppShell.tsx");

    expect(navigation).toContain('pathname === "/app/consultas/en-vivo"');
    expect(navigation).toContain('pathname === "/app/consultas/nueva"');
    expect(navigation).toContain('"/app/dashboard"');
    expect(navigation).toContain('"/app/consultas"');
    expect(navigation).toContain('"/app/pacientes"');
    expect(navigation).toContain('"/app/notas"');
    expect(shell).toContain("<MobileBottomNavigation");
  });

  it("mantiene pausa, reanudación y confirmación antes de finalizar", () => {
    const hook = source("lib/stt/useDictation.ts");
    const panel = source("components/app/DictationPanel.tsx");

    expect(hook).toContain('"paused"');
    expect(hook).toContain("pause:");
    expect(hook).toContain("beforeunload");
    expect(panel).toContain("Pausar");
    expect(panel).toContain("Continuar");
    expect(panel).toContain("¿Finalizar la consulta y generar la nota?");
    expect(panel).toContain("Sí, finalizar");
  });

  it("mantiene acciones clínicas persistentes en revisión y consulta activa", () => {
    const live = source("app/app/consultas/en-vivo/page.tsx");
    const review = source("app/app/consultas/[id]/page.tsx");

    expect(live).toMatch(/fixed bottom-\[calc\(/);
    expect(live).toContain("Guardar nota");
    expect(review).toContain("Marcar revisada");
    expect(review).toContain("Aprobar y firmar nota");
  });
});
