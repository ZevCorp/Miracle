import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_ROLES, canAccessPath, type AppRole } from "@/lib/auth/roles";

/**
 * Las dos puertas de cada pantalla tienen que decir lo mismo.
 *
 * Una ruta de /app está protegida DOS VECES y por sitios distintos:
 *
 *   1. `canAccessPath` (lib/auth/roles.ts), que gobierna la navegación y el
 *      menú;
 *   2. el `requireRole(...)` del layout o de la página, que es el que de
 *      verdad redirige en el servidor.
 *
 * Si se contradicen no salta ningún error: la pantalla aparece en el menú y al
 * entrar rebota a /app/dashboard?error=forbidden, o al revés. Pasó al añadir el
 * rol `admin_area`: canAccessPath ya lo dejaba grabar consultas y ver
 * auditoría, pero los tres guardias seguían con la lista vieja y el jefe de
 * urgencias no llegaba a ninguna de las tres. Se descubrió entrando a mano en
 * producción, que es tarde.
 *
 * Este test lee los `requireRole(...)` del código y comprueba, rol por rol y
 * ruta por ruta, que ambas puertas coinciden.
 */

const APP_DIR = fileURLToPath(new URL("../app/app", import.meta.url));

/** Los archivos que definen una ruta. `actions.ts` no es una pantalla. */
const ES_RUTA = /^(page|layout)\.tsx$/;

function archivosDeRuta(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      salida.push(...archivosDeRuta(ruta));
    } else if (ES_RUTA.test(entrada)) {
      salida.push(ruta);
    }
  }
  return salida;
}

/** "app/app/consultas/nueva/layout.tsx" -> "/app/consultas/nueva" */
function rutaDesdeArchivo(archivo: string): string {
  const rel = relative(APP_DIR, archivo).replace(/\\/g, "/");
  const carpeta = rel.replace(/\/(page|layout)\.tsx$/, "");
  return carpeta === rel ? "/app" : `/app/${carpeta}`;
}

type Guardia = { archivo: string; ruta: string; roles: AppRole[] };

const guardias: Guardia[] = archivosDeRuta(APP_DIR)
  .map((archivo) => {
    const fuente = readFileSync(archivo, "utf8");
    const match = fuente.match(/requireRole\(([^)]*)\)/);
    if (!match) return null;
    const roles = [...match[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1] as AppRole);
    if (roles.length === 0) return null;
    return {
      archivo: relative(APP_DIR, archivo).replace(/\\/g, "/"),
      ruta: rutaDesdeArchivo(archivo),
      roles,
    };
  })
  .filter((g): g is Guardia => g !== null);

describe("las dos puertas de cada ruta coinciden", () => {
  it("hay guardias que revisar (si esto falla, el escáner dejó de encontrarlos)", () => {
    expect(guardias.length).toBeGreaterThanOrEqual(4);
  });

  it("todo rol nombrado en un requireRole existe", () => {
    for (const g of guardias) {
      for (const r of g.roles) {
        expect(APP_ROLES, `${g.archivo} nombra un rol inexistente: ${r}`).toContain(r);
      }
    }
  });

  // El superadmin queda fuera: canAccessPath le devuelve true en todo /app por
  // una salida temprana, pero el layout de /app lo manda a su propia consola,
  // así que nunca llega a estas pantallas y la discrepancia es teórica.
  const rolesDeHospital = APP_ROLES.filter((r) => r !== "superadmin");

  for (const g of guardias) {
    it(`${g.ruta} — ${g.archivo}`, () => {
      for (const rol of rolesDeHospital) {
        const guardiaLoDeja = g.roles.includes(rol);
        const navegacionLoDeja = canAccessPath(rol, g.ruta);
        expect(
          navegacionLoDeja,
          guardiaLoDeja
            ? `${g.archivo} deja entrar a "${rol}", pero canAccessPath no: la pantalla no aparece en el menú y la ruta no se alcanza.`
            : `canAccessPath deja a "${rol}" navegar a ${g.ruta}, pero ${g.archivo} lo rebota a /app/dashboard?error=forbidden.`,
        ).toBe(guardiaLoDeja);
      }
    });
  }
});
