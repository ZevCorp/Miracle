import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  categoriesFrom,
  clampSnippetDraft,
  countSnippets,
  createSnippet,
  createSnippets,
  deleteSnippet,
  filterSnippets,
  groupSnippetsByCategory,
  getSnippets,
  normalizeForSearch,
  rowToSnippet,
  SNIPPET_LIMITS,
  updateSnippet,
  validateSnippetDraft,
  type Snippet,
} from "@/lib/clinical/snippets";

function snippet(overrides: Partial<Snippet> & { id: string }): Snippet {
  return {
    title: `Atajo ${overrides.id}`,
    content: "Contenido de ejemplo.",
    category: "",
    updatedAt: "2026-08-13T10:00:00.000Z",
    ...overrides,
  };
}

/**
 * Doble de supabase-js: registra las llamadas encadenadas y devuelve lo que se
 * le indique. Solo cubre los eslabones que usa lib/clinical/snippets.ts.
 */
function fakeSupabase(result: { data?: unknown; error?: unknown; count?: number }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const record = (method: string, ...args: unknown[]) => {
    calls.push({ method, args });
  };
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "insert", "update", "delete", "eq", "order", "limit"]) {
    chain[method] = (...args: unknown[]) => {
      record(method, ...args);
      return chain;
    };
  }
  chain.single = (...args: unknown[]) => {
    record("single", ...args);
    return Promise.resolve(result);
  };
  // Sin .single() la cadena se resuelve como promesa (getSnippets, delete...).
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  const client = {
    from: (table: string) => {
      record("from", table);
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

/* ------------------------------------------------------------------ */
/* Validación y saneo                                                  */
/* ------------------------------------------------------------------ */

describe("validateSnippetDraft", () => {
  const ok = { title: "Gastritis crónica", content: "Plan: omeprazol.", category: "Diagnóstico" };

  it("acepta un borrador completo", () => {
    expect(validateSnippetDraft(ok)).toBeNull();
  });

  it("exige título y contenido (los espacios no cuentan)", () => {
    expect(validateSnippetDraft({ ...ok, title: "   " })).toMatch(/título/i);
    expect(validateSnippetDraft({ ...ok, content: "\n  \n" })).toMatch(/vac/i);
  });

  it("la categoría es opcional", () => {
    expect(validateSnippetDraft({ ...ok, category: "" })).toBeNull();
  });

  it("rechaza lo que pasa de los límites", () => {
    expect(validateSnippetDraft({ ...ok, title: "a".repeat(SNIPPET_LIMITS.title + 1) })).toMatch(
      /título/i,
    );
    expect(
      validateSnippetDraft({ ...ok, content: "a".repeat(SNIPPET_LIMITS.content + 1) }),
    ).toMatch(/texto/i);
    expect(
      validateSnippetDraft({ ...ok, category: "a".repeat(SNIPPET_LIMITS.category + 1) }),
    ).toMatch(/categoría/i);
  });
});

describe("clampSnippetDraft", () => {
  it("recorta a los límites en vez de rechazar (lo que propone la IA)", () => {
    const clamped = clampSnippetDraft({
      title: "  " + "a".repeat(200) + "  ",
      content: "  texto  ",
      category: "b".repeat(90),
    });
    expect(clamped.title).toHaveLength(SNIPPET_LIMITS.title);
    expect(clamped.content).toBe("texto");
    expect(clamped.category).toHaveLength(SNIPPET_LIMITS.category);
  });
});

/* ------------------------------------------------------------------ */
/* Normalización, categorías y filtrado                                */
/* ------------------------------------------------------------------ */

describe("normalizeForSearch", () => {
  it("ignora mayúsculas y tildes", () => {
    expect(normalizeForSearch("Diagnóstico")).toBe("diagnostico");
    expect(normalizeForSearch("  ÚLCERA  ")).toBe("ulcera");
    expect(normalizeForSearch("Niño")).toBe("nino");
  });
});

describe("categoriesFrom", () => {
  it("devuelve categorías únicas y ordenadas, sin las vacías", () => {
    expect(
      categoriesFrom([
        snippet({ id: "1", category: "Plan" }),
        snippet({ id: "2", category: "" }),
        snippet({ id: "3", category: "Diagnóstico" }),
        snippet({ id: "4", category: "plan" }),
      ]),
    ).toEqual(["Diagnóstico", "Plan"]);
  });
});

describe("filterSnippets", () => {
  const base = [
    snippet({
      id: "gastritis",
      title: "Gastritis crónica",
      category: "Diagnóstico",
      updatedAt: "2026-08-01T00:00:00.000Z",
    }),
    snippet({
      id: "plan-gastritis",
      title: "Omeprazol 20 mg",
      content: "Indicado en gastritis.",
      category: "Plan de manejo",
      updatedAt: "2026-08-02T00:00:00.000Z",
    }),
    snippet({
      id: "hta",
      title: "Hipertensión esencial",
      category: "Diagnóstico",
      updatedAt: "2026-08-03T00:00:00.000Z",
    }),
  ];

  it("sin término prioriza la categoría de la sección actual", () => {
    expect(
      filterSnippets(base, { sectionTitle: "Diagnóstico" }).map((s) => s.id),
    ).toEqual(["hta", "gastritis", "plan-gastritis"]);
  });

  it("sin término ni sección ordena por recencia", () => {
    expect(filterSnippets(base).map((s) => s.id)).toEqual([
      "hta",
      "plan-gastritis",
      "gastritis",
    ]);
  });

  it("el título gana al contenido, aunque el de contenido sea de la sección", () => {
    expect(
      filterSnippets(base, { query: "gastritis", sectionTitle: "Diagnóstico" }).map(
        (s) => s.id,
      ),
    ).toEqual(["gastritis", "plan-gastritis"]);
  });

  it("busca sin tildes y sin distinguir mayúsculas", () => {
    expect(filterSnippets(base, { query: "HIPERTENSION" }).map((s) => s.id)).toEqual([
      "hta",
    ]);
  });

  it("descarta lo que no coincide en ningún campo", () => {
    expect(filterSnippets(base, { query: "dermatitis" })).toEqual([]);
  });

  it("el filtro de categoría es estricto", () => {
    expect(
      filterSnippets(base, { category: "Plan de manejo" }).map((s) => s.id),
    ).toEqual(["plan-gastritis"]);
  });
});

/* ------------------------------------------------------------------ */
/* Mapeo de filas y acceso a datos                                     */
/* ------------------------------------------------------------------ */

describe("rowToSnippet", () => {
  it("mapea la fila de Supabase y trata category null como cadena vacía", () => {
    expect(
      rowToSnippet({
        id: "a1",
        title: "Gastritis",
        content: "Texto",
        category: null,
        updated_at: "2026-08-13T10:00:00.000Z",
      }),
    ).toEqual({
      id: "a1",
      title: "Gastritis",
      content: "Texto",
      category: "",
      updatedAt: "2026-08-13T10:00:00.000Z",
    });
  });
});

describe("acceso a datos", () => {
  const row = {
    id: "a1",
    title: "Gastritis",
    content: "Texto",
    category: "Diagnóstico",
    updated_at: "2026-08-13T10:00:00.000Z",
  };

  it("getSnippets lee user_snippets ordenado por recencia", async () => {
    const { client, calls } = fakeSupabase({ data: [row] });
    const result = await getSnippets(client);
    expect(result[0].id).toBe("a1");
    expect(calls[0]).toEqual({ method: "from", args: ["user_snippets"] });
    expect(calls.find((c) => c.method === "order")?.args).toEqual([
      "updated_at",
      { ascending: false },
    ]);
    // `content` viene entero, así que sin tope una cuenta en el máximo traería
    // del orden de veinte megas. El tope de la consulta y el de la app tienen
    // que ser el mismo número.
    expect(calls.find((c) => c.method === "limit")?.args).toEqual([
      SNIPPET_LIMITS.perUser,
    ]);
  });

  it("getSnippets propaga el error de Supabase", async () => {
    const { client } = fakeSupabase({ error: new Error("RLS") });
    await expect(getSnippets(client)).rejects.toThrow("RLS");
  });

  it("createSnippet no envía user_id: lo pone el default de la tabla", async () => {
    const { client, calls } = fakeSupabase({ data: row });
    await createSnippet(client, {
      title: "Gastritis",
      content: "Texto",
      category: "Diagnóstico",
    });
    const insert = calls.find((c) => c.method === "insert");
    expect(insert?.args[0]).toEqual({
      title: "Gastritis",
      content: "Texto",
      category: "Diagnóstico",
    });
  });

  it("updateSnippet y deleteSnippet filtran por id", async () => {
    const update = fakeSupabase({ data: row });
    await updateSnippet(update.client, "a1", {
      title: "Gastritis",
      content: "Texto",
      category: "",
    });
    expect(update.calls.find((c) => c.method === "eq")?.args).toEqual(["id", "a1"]);

    const remove = fakeSupabase({});
    await deleteSnippet(remove.client, "a1");
    expect(remove.calls.find((c) => c.method === "eq")?.args).toEqual(["id", "a1"]);
  });

  it("createSnippets inserta por tandas de 50", async () => {
    const { client, calls } = fakeSupabase({});
    const drafts = Array.from({ length: 120 }, (_, i) => ({
      title: `Atajo ${i}`,
      content: "Texto",
      category: "",
    }));
    expect(await createSnippets(client, drafts)).toBe(120);
    const inserts = calls.filter((c) => c.method === "insert");
    expect(inserts).toHaveLength(3);
    expect((inserts[0].args[0] as unknown[]).length).toBe(50);
    expect((inserts[2].args[0] as unknown[]).length).toBe(20);
  });

  it("createSnippets avisa cuántos alcanzaron a guardarse si algo falla", async () => {
    let call = 0;
    const chain: Record<string, unknown> = {
      insert: () => {
        call += 1;
        return Promise.resolve(call === 1 ? {} : { error: new Error("timeout") });
      },
    };
    const client = { from: () => chain } as unknown as SupabaseClient;
    const drafts = Array.from({ length: 60 }, () => ({
      title: "Atajo",
      content: "Texto",
      category: "",
    }));
    await expect(createSnippets(client, drafts)).rejects.toThrow(/Se guardaron 50/);
  });

  it("countSnippets pide solo el conteo", async () => {
    const { client, calls } = fakeSupabase({ count: 7 });
    expect(await countSnippets(client)).toBe(7);
    expect(calls.find((c) => c.method === "select")?.args).toEqual([
      "id",
      { count: "exact", head: true },
    ]);
  });
});

describe("groupSnippetsByCategory", () => {
  const s = (id: string, category: string): Snippet => ({
    id,
    title: `Atajo ${id}`,
    content: "texto",
    category,
    updatedAt: "2026-08-01T00:00:00Z",
  });

  it("agrupa y ordena las secciones alfabéticamente en español", () => {
    const grupos = groupSnippetsByCategory([
      s("a", "Plan"),
      s("b", "Análisis"),
      s("c", "Plan"),
    ]);
    expect(grupos.map((g) => g.category)).toEqual(["Análisis", "Plan"]);
    expect(grupos[1].snippets.map((x) => x.id)).toEqual(["a", "c"]);
  });

  it("junta las grafías distintas de la misma sección", () => {
    const grupos = groupSnippetsByCategory([s("a", "Plan"), s("b", "plan")]);
    expect(grupos).toHaveLength(1);
    // Se queda la primera grafía vista, igual que categoriesFrom.
    expect(grupos[0].category).toBe("Plan");
    expect(grupos[0].snippets).toHaveLength(2);
  });

  it("manda los que no tienen sección al final, no mezclados", () => {
    const grupos = groupSnippetsByCategory([
      s("a", ""),
      s("b", "Zeta"),
      s("c", "Análisis"),
    ]);
    expect(grupos.map((g) => g.category)).toEqual(["Análisis", "Zeta", ""]);
    expect(grupos[2].snippets.map((x) => x.id)).toEqual(["a"]);
  });

  it("conserva el orden de entrada dentro de cada grupo", () => {
    // filterSnippets ya viene ordenado por relevancia y recencia: agrupar no
    // puede deshacer ese orden.
    const grupos = groupSnippetsByCategory([
      s("primero", "Plan"),
      s("segundo", "Plan"),
      s("tercero", "Plan"),
    ]);
    expect(grupos[0].snippets.map((x) => x.id)).toEqual([
      "primero",
      "segundo",
      "tercero",
    ]);
  });

  it("con una lista vacía no devuelve grupos", () => {
    expect(groupSnippetsByCategory([])).toEqual([]);
  });
});
