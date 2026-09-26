import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * El Inicio no espera lo que no necesita.
 *
 * Hasta septiembre de 2026 el Inicio del médico —el orbe para empezar a grabar,
 * la hora, la agenda— se escondía tras un esqueleto hasta que el store
 * terminaba DOS viajes a la base en serie: primero consultas, pacientes y
 * perfiles; después, con los ids de esas consultas, toda su auditoría. Esa
 * segunda tanda era la más cara (la RLS de audit_events evalúa
 * private.alcanza_consulta() fila por fila) y solo la usaba la pestaña de
 * Auditoría del detalle. PostgREST además la cortaba en 1000 filas, así que a
 * las consultas más recientes les faltaba la historia.
 *
 * Estas pruebas leen el código (igual que store-foto-vieja.test.ts) para que
 * la cascada no vuelva sin que salte nada.
 */

const leer = (ruta: string) =>
  readFileSync(fileURLToPath(new URL(ruta, import.meta.url)), "utf8");

const PROVIDERS = leer("../app/app/providers.tsx");
const DASHBOARD = leer("../app/app/dashboard/page.tsx");
const DETALLE = leer("../app/app/consultas/[id]/page.tsx");

/** El cuerpo de `load` en el store, de su declaración a su cierre. */
function cuerpoDeLoad(): string {
  const inicio = PROVIDERS.indexOf("const load = useCallback(");
  expect(inicio, "no se encontró `load` en app/app/providers.tsx").toBeGreaterThan(-1);
  const fin = PROVIDERS.indexOf("}, [supabase]);", inicio);
  expect(fin).toBeGreaterThan(inicio);
  return PROVIDERS.slice(inicio, fin);
}

describe("el Inicio no espera lo que no necesita", () => {
  it("la carga inicial del store es UN solo viaje a la base", () => {
    const load = cuerpoDeLoad();
    expect(load).toMatch(/await Promise\.all\(\[/);
    // Todo sale en el mismo Promise.all. Un `await supabase…` suelto después
    // es exactamente la segunda tanda en serie que se quitó.
    expect(
      load.match(/await\s+supabase\b/g) ?? [],
      "load() vuelve a esperar una consulta DESPUÉS del Promise.all: eso es " +
        "otro viaje en serie antes de poder pintar el Inicio.",
    ).toEqual([]);
    expect(load).not.toMatch(/\.in\(\s*["']consultation_id["']/);
  });

  it("las marcas de demostración siguen llegando en la carga inicial", () => {
    // Sin ellas, el Inicio y la firma en serie contarían una nota de
    // demostración como trabajo real (el servidor igual se niega a firmarla,
    // pero la pantalla mentiría).
    expect(cuerpoDeLoad()).toMatch(/\.eq\(\s*["']accion["'],\s*DEMO_AUDIT_ACCION\s*\)/);
  });

  it("el Inicio no esconde el orbe detrás de la carga del store", () => {
    expect(
      /if\s*\(\s*loading\b[^)]*\)\s*return\s*<DashboardSkeleton/.test(DASHBOARD),
      "app/app/dashboard/page.tsx vuelve a devolver el esqueleto entero mientras " +
        "carga el store: el orbe, la hora y la agenda no dependen de él.",
    ).toBe(false);
  });

  it("la trazabilidad del detalle se lee de la base, no de la foto", () => {
    expect(DETALLE).not.toMatch(/<Timeline\s+events=\{consultation\.auditoria\}/);
    expect(DETALLE).toMatch(/\bloadAuditoria\(/);
  });
});
