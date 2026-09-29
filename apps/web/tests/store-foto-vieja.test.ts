import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Ninguna pantalla puede decir "no existe" mirando solo la foto del store.
 *
 * `MiracleProvider` carga consultas y pacientes UNA vez, al montar el armazón,
 * y con tope (CONSULTATIONS_CAP / PATIENTS_CAP). Es una foto: no se refresca
 * sola, y el SPA no remonta el provider al navegar. Todo lo que nazca DESPUÉS
 * de esa foto —o que quede fuera del tope— es invisible para `getConsultation`
 * y `getPatient`, que devuelven undefined sin distinguir "no está en la foto"
 * de "no existe".
 *
 * El 2 de septiembre de 2026, en el piloto de urgencias del Hospital General,
 * el médico terminaba una consulta, abría su detalle y leía "Consulta no
 * encontrada" sobre una nota que existía, que la base sí le entregaba y que el
 * panel rápido —el único que la pedía por id— sí abría. El espejo lo escribe
 * el backend, no el navegador, así que jamás entraba a la foto.
 *
 * Este test lee el código de las pantallas y exige que cualquiera que pueda
 * afirmar "no encontrado" tenga antes un rescate (`ensureConsultation` /
 * `ensurePatient`), que es quien va a la base y sabe distinguir "no existe" de
 * "no se pudo preguntar". Sin él, una pantalla nueva reintroduce el mismo
 * defecto sin que salte nada.
 */

const APP_DIR = fileURLToPath(new URL("../app/app", import.meta.url));
const PROVIDERS = fileURLToPath(new URL("../app/app/providers.tsx", import.meta.url));
const RAIZ = fileURLToPath(new URL("..", import.meta.url));

function pantallas(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...pantallas(ruta));
    else if (/\.tsx$/.test(entrada)) salida.push(ruta);
  }
  return salida;
}

/**
 * Un título de EmptyState que le afirma al médico que algo no existe. Se busca
 * dentro de `title=` a propósito: en un comentario la frase es documentación,
 * en un `title` es lo que el médico lee en pantalla.
 */
const AFIRMA_QUE_NO_EXISTE = /title=\{?["'`][^"'`]*no\s+encontrad[oa]/i;

/** El rescate que sí pregunta a la base antes de afirmar nada. */
const TIENE_RESCATE = /\bensure(Consultation|Patient)\s*\(/;

describe("el store es una foto: nadie puede confundirla con la base", () => {
  const archivos = [
    ...pantallas(APP_DIR),
    ...pantallas(fileURLToPath(new URL("../components/app", import.meta.url))),
  ];

  it("encuentra pantallas que revisar (el propio test no puede quedar vacío)", () => {
    expect(archivos.length).toBeGreaterThan(20);
  });

  it("toda pantalla que dice 'no encontrado' pregunta antes a la base", () => {
    const culpables: string[] = [];
    for (const archivo of archivos) {
      const fuente = readFileSync(archivo, "utf8");
      // Solo pantallas de cliente: las RSC leen de la base directamente y no
      // pasan por el store.
      if (!fuente.includes("useStore(")) continue;
      if (!AFIRMA_QUE_NO_EXISTE.test(fuente)) continue;
      if (TIENE_RESCATE.test(fuente)) continue;
      culpables.push(relative(RAIZ, archivo).replace(/\\/g, "/"));
    }
    expect(
      culpables,
      `Estas pantallas afirman "no encontrado" con lo que hay en la foto del ` +
        `store, sin preguntarle a la base. Usa ensureConsultation(id) o ` +
        `ensurePatient(id) y distingue "missing" de "error" antes de decirle ` +
        `a un médico que su nota o su paciente no existen.`,
    ).toEqual([]);
  });

  it("la carga inicial no se traga los errores de Supabase", () => {
    const fuente = readFileSync(PROVIDERS, "utf8");
    // supabase-js NO lanza: un fallo llega como { data: null, error }. Sin un
    // corte explícito, una consulta que revienta se lee como "no hay nada" y el
    // store queda vacío en silencio: el panel dice "Estás al día" y el detalle
    // "Consulta no encontrada" sobre historia clínica que existe.
    expect(
      /const\s+fallo\s*=[\s\S]{0,200}?conRes\.error[\s\S]{0,200}?throw/.test(fuente),
      "load() en app/app/providers.tsx tiene que lanzar cuando alguna de sus " +
        "consultas devuelve `error`, para caer en loadError (que avisa y ofrece " +
        "reintentar) en vez de dejar el store vacío como si no hubiera datos.",
    ).toBe(true);
  });

  it("los getters de la foto avisan en su propio contrato", () => {
    const fuente = readFileSync(PROVIDERS, "utf8");
    // Quien lea el tipo del store tiene que toparse con la advertencia sin
    // necesidad de haber vivido el incidente.
    expect(fuente).toMatch(/getConsultation[\s\S]{0,400}?ensureConsultation/);
    expect(fuente).toMatch(/getPatient[\s\S]{0,400}?ensurePatient/);
  });
});
