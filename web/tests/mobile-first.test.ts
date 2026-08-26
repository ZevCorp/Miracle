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
    expect(navigation).toContain('"/app/plantillas"');
    expect(shell).toContain("<MobileBottomNavigation");
  });

  it("deja cerrar sesion y cambiar de tema desde la hoja «Más»", () => {
    /* En AppShell el botón de tema es sm:inline-flex y el de salir lg:inline:
       en un teléfono ninguno de los dos existe. Si «Más» deja de
       dibujarse (por ejemplo, condicionado a que queden secciones detrás), el
       médico se queda sin forma de cerrar sesión. */
    const navigation = source("components/app/MobileBottomNavigation.tsx");

    expect(navigation).toContain("Cerrar sesión");
    expect(navigation).toContain("signOut");
    expect(navigation).toContain("Cambiar modo claro u oscuro");
  });

  it("deja cerrar sesión en TODOS los anchos, sin huecos entre breakpoints", () => {
    /* Dos zonas y quién cubre cada una, tras retirar el pie del sidebar:
         < md   → hoja «Más» de la barra inferior (`md:hidden`)
         ≥ md   → botón "Salir" de la cabecera
       Si ese "Salir" vuelve a `lg:inline`, entre 768 y 1024 px el médico se
       queda encerrado en la sesión: el sidebar ya no tiene salida. */
    const shell = source("components/app/AppShell.tsx");
    const sidebar = source("components/app/AppSidebar.tsx");

    expect(shell).toMatch(/md:inline[\s\S]{0,80}Salir/);
    expect(shell).not.toMatch(/lg:inline[\s\S]{0,80}Salir/);
    // El sidebar es solo navegación: ya no ofrece salir (ni instalar).
    expect(sidebar).not.toContain("signOut");
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
