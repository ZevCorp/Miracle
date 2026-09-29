import { describe, expect, it } from "vitest";
import {
  catalogDrafts,
  packById,
  packsForSpecialty,
  snippetCatalog,
  SECCIONES_CANONICAS,
  type CatalogSnippet,
} from "@/lib/clinical/snippet-catalog";
import { URGENCIAS_SNIPPETS } from "@/lib/clinical/snippet-catalog-urgencias";
import {
  clampSnippetDraft,
  normalizeForSearch,
  validateSnippetDraft,
  SNIPPET_LIMITS,
} from "@/lib/clinical/snippets";
import { findPlaceholders } from "@/lib/clinical/placeholders";

const todos: CatalogSnippet[] = snippetCatalog.flatMap((pack) => [...pack.snippets]);

function draft(snippet: CatalogSnippet) {
  return {
    title: snippet.title,
    content: snippet.content,
    category: snippet.category,
  };
}

describe("el catálogo respeta el contrato de un atajo", () => {
  it("cada entrada pasa la validación que usa el editor", () => {
    for (const snippet of todos) {
      expect(validateSnippetDraft(draft(snippet)), snippet.title).toBeNull();
    }
  });

  it("nada se recorta en silencio al guardarse", () => {
    // Si clamp cambiara algo, la biblioteca instalada no sería la del repo.
    for (const snippet of todos) {
      expect(clampSnippetDraft(draft(snippet)), snippet.title).toEqual(draft(snippet));
    }
  });

  it("respeta los límites de longitud", () => {
    for (const snippet of todos) {
      expect(snippet.title.length, snippet.title).toBeLessThanOrEqual(SNIPPET_LIMITS.title);
      expect(snippet.content.length, snippet.title).toBeLessThanOrEqual(SNIPPET_LIMITS.content);
      expect(snippet.category.length, snippet.title).toBeLessThanOrEqual(SNIPPET_LIMITS.category);
    }
  });

  it("no repite títulos dentro de un paquete", () => {
    for (const pack of snippetCatalog) {
      const claves = pack.snippets.map((s) => normalizeForSearch(s.title));
      expect(new Set(claves).size, `títulos repetidos en ${pack.id}`).toBe(claves.length);
    }
  });

  it("toda categoría es una sección canónica", () => {
    // La categoría es lo que hace que el atajo suba en la sección correcta
    // (categoryMatchesSection). Inventar una sección nueva lo rompe en silencio.
    for (const snippet of todos) {
      expect(SECCIONES_CANONICAS, `${snippet.title} → «${snippet.category}»`).toContain(
        snippet.category,
      );
    }
  });
});

describe("las dos velocidades", () => {
  it("un bloque de prosa no tiene NI UN hueco", () => {
    for (const snippet of todos.filter((s) => s.tier === "prosa")) {
      expect(findPlaceholders(snippet.content), snippet.title).toHaveLength(0);
    }
  });

  it("un bloque de campos tiene entre 1 y 10 huecos", () => {
    // Más de diez Tabs y escribir a mano sale más rápido que rellenar.
    for (const snippet of todos.filter((s) => s.tier === "campos")) {
      const huecos = findPlaceholders(snippet.content);
      expect(huecos.length, `${snippet.title} no tiene huecos`).toBeGreaterThan(0);
      expect(huecos.length, `${snippet.title} tiene demasiados`).toBeLessThanOrEqual(10);
    }
  });

  it("ningún bloque de prosa empieza por un hueco", () => {
    // Solo aplica a prosa: en una fórmula, empezar por
    // «[Acetaminofén / Dipirona / Ibuprofeno]» es correcto — elegir el
    // medicamento ES la decisión y no puede venir pre-rellenada.
    for (const snippet of todos.filter((s) => s.tier === "prosa")) {
      const primero = findPlaceholders(snippet.content.trimStart())[0];
      expect(primero?.start, snippet.title).not.toBe(0);
    }
  });
});

describe("ninguna dosis va escrita fuera de un hueco", () => {
  // La regla heredada del corpus de urgencias: las cifras que el médico firma
  // solo pueden aparecer dentro de un hueco, para que insertar el atajo le
  // OBLIGUE a pasar por ellas en vez de dejarle una por defecto que pueda
  // firmar sin mirar. Estos textos terminan en historias clínicas reales.
  const UNIDADES = /\d+(?:[.,]\d+)?\s?(?:mg|mcg|µg|g|kg|mL|ml|cc|UI|mEq)\b/gi;

  // Excepciones justificadas una por una. Nada entra aquí sin motivo.
  const PERMITIDO: readonly string[] = [
    // Umbral de consulta, no una dosis: le dice al cuidador cuándo preocuparse.
    "38 °C",
  ];

  it("no queda ninguna cifra con unidad de medicamento", () => {
    const ofensores: string[] = [];
    for (const snippet of todos) {
      let texto = snippet.content;
      // Se quitan los huecos: dentro de ellos la cifra es justo lo que se quiere.
      for (const hueco of findPlaceholders(texto).reverse()) {
        texto = texto.slice(0, hueco.start) + " " + texto.slice(hueco.end);
      }
      for (const permitido of PERMITIDO) texto = texto.split(permitido).join(" ");
      const encontrados = texto.match(UNIDADES);
      if (encontrados) ofensores.push(`${snippet.title}: ${encontrados.join(", ")}`);
    }
    expect(ofensores).toEqual([]);
  });
});

describe("no regresión del piloto de urgencias", () => {
  // Los 5 médicos del Hospital General llevan estos 76 atajos desde el
  // 2026-08-24 y ya tienen memoria muscular de sus prefijos: "/dipi" es
  // Dipirona, "/apen" es Apendicitis. Reemplazar su biblioteca no puede
  // hacer desaparecer ninguno.
  it("el paquete de urgencias conserva los 76 títulos originales", () => {
    const enElPaquete = new Set(
      (packById("urgencias")?.snippets ?? []).map((s) => s.title),
    );
    const faltantes = URGENCIAS_SNIPPETS.map((s) => s.title).filter(
      (title) => !enElPaquete.has(title),
    );
    expect(faltantes).toEqual([]);
  });

  it("se portaron los 76, ni uno menos", () => {
    expect(URGENCIAS_SNIPPETS).toHaveLength(76);
  });

  it("conserva íntegro el vocabulario que se teclea por prefijo", () => {
    // Los medicamentos y diagnósticos son los que se invocan con "/xxx".
    const porTitulo = new Map(
      (packById("urgencias")?.snippets ?? []).map((s) => [s.title, s]),
    );
    for (const original of URGENCIAS_SNIPPETS) {
      if (original.category !== "Intervenciones" && original.category !== "Análisis") continue;
      const actual = porTitulo.get(original.title);
      expect(actual, original.title).toBeDefined();
      expect(actual!.content, original.title).toBe(original.content);
      expect(actual!.category, original.title).toBe(original.category);
    }
  });
});

describe("paquetes", () => {
  it("los tres paquetes existen y no están vacíos", () => {
    expect(snippetCatalog.map((p) => p.id)).toEqual([
      "medicina-general",
      "urgencias",
      "pediatria",
    ]);
    for (const pack of snippetCatalog) {
      expect(pack.snippets.length, pack.id).toBeGreaterThan(10);
      expect(pack.description.length, pack.id).toBeGreaterThan(0);
    }
  });

  it("pone primero el paquete de la especialidad del médico", () => {
    expect(packsForSpecialty("urgencias")[0].id).toBe("urgencias");
    expect(packsForSpecialty("pediatria")[0].id).toBe("pediatria");
    // Acepta la forma del backend, con guion bajo.
    expect(packsForSpecialty("medicina_general")[0].id).toBe("medicina-general");
  });

  it("nunca oculta un paquete, aunque no sea de su especialidad", () => {
    // Un general que empieza a ver niños debe poder instalar pediatría.
    expect(packsForSpecialty("dermatologia")).toHaveLength(snippetCatalog.length);
    expect(packsForSpecialty(null)).toHaveLength(snippetCatalog.length);
  });

  it("packById devuelve null para un id inventado", () => {
    expect(packById("no-existe")).toBeNull();
  });
});

describe("catalogDrafts", () => {
  it("produce borradores guardables, sin el tier", () => {
    const drafts = catalogDrafts(["pediatria"]);
    expect(drafts.length).toBe(packById("pediatria")!.snippets.length);
    for (const d of drafts) {
      expect(Object.keys(d).sort()).toEqual(["category", "content", "title"]);
      expect(validateSnippetDraft(d)).toBeNull();
    }
  });

  it("no duplica los bloques que comparten dos paquetes", () => {
    // El examen normal está en medicina general y en urgencias a propósito.
    const drafts = catalogDrafts(["medicina-general", "urgencias"]);
    const titulos = drafts.map((d) => d.title);
    expect(new Set(titulos).size).toBe(titulos.length);
  });

  it("con una lista vacía no devuelve nada", () => {
    expect(catalogDrafts([])).toEqual([]);
    expect(catalogDrafts(["no-existe"])).toEqual([]);
  });
});
