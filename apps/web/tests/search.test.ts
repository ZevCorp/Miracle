import { describe, expect, it } from "vitest";
import {
  categoryMatchesSection,
  editDistance,
  fuzzyWordMatch,
  matchesQuery,
  normalizeForSearch,
  searchList,
} from "@/lib/clinical/search";

describe("normalizeForSearch", () => {
  it("iguala mayúsculas y tildes", () => {
    expect(normalizeForSearch("Pediatría")).toBe("pediatria");
    expect(normalizeForSearch("  ANÁLISIS  ")).toBe("analisis");
    expect(normalizeForSearch("Niño")).toBe("nino");
  });
});

describe("editDistance", () => {
  it("cuenta inserciones, borrados y sustituciones", () => {
    expect(editDistance("pediatria", "pediatria")).toBe(0);
    expect(editDistance("pedriatria", "pediatria")).toBe(1); // r de más
    expect(editDistance("pediatri", "pediatria")).toBe(1); // falta una letra
  });

  it("cobra una sola edición por intercambiar dos letras contiguas", () => {
    // Sin transposiciones esto costaría 2; es el error de tecleo más común.
    expect(editDistance("pedaitria", "pediatria")).toBe(1);
    expect(editDistance("gastritsi", "gastritis")).toBe(1);
  });
});

describe("fuzzyWordMatch", () => {
  it("perdona un error en palabras medianas y dos en largas", () => {
    expect(fuzzyWordMatch("pedriatria", "pediatria")).toBe(true);
    expect(fuzzyWordMatch("gastrits", "gastritis")).toBe(true);
  });

  it("no perdona nada en palabras cortas: casarían con media lista", () => {
    expect(fuzzyWordMatch("plan", "plam")).toBe(false);
    expect(fuzzyWordMatch("plan", "plan")).toBe(true);
  });

  it("descarta por longitud sin calcular la distancia", () => {
    expect(fuzzyWordMatch("cardiologia", "ped")).toBe(false);
  });
});

describe("matchesQuery", () => {
  const texto = "Control de niño sano · crecimiento, desarrollo y prevención";

  it("encuentra sin tildes y sin distinguir mayúsculas", () => {
    expect(matchesQuery(texto, "NIÑO")).toBe(true);
    expect(matchesQuery(texto, "prevencion")).toBe(true);
  });

  it("sobrevive a un error de tecleo", () => {
    expect(matchesQuery("Consulta pediátrica integral", "pedriatrica")).toBe(true);
  });

  it("exige todas las palabras buscadas", () => {
    expect(matchesQuery(texto, "control niño")).toBe(true);
    expect(matchesQuery(texto, "control quirúrgico")).toBe(false);
  });

  it("una búsqueda vacía no filtra nada", () => {
    expect(matchesQuery(texto, "   ")).toBe(true);
  });
});

describe("searchList", () => {
  const plantillas = [
    "Control de niño sano · crecimiento, desarrollo y prevención — pediatria",
    "Consulta inicial · enfermedad aguda en el niño — pediatria",
    "Consulta inicial · valoración quirúrgica — cirugia_pediatrica",
    "Control de hipertensión — medicina_interna",
  ];

  it("devuelve solo las coincidencias reales cuando las hay", () => {
    // "control" casa literalmente con dos; el parecido no debe colar más.
    expect(searchList(plantillas, "control", (t) => t)).toHaveLength(2);
  });

  it("rescata la búsqueda mal escrita solo si no hubo ninguna exacta", () => {
    // Bien escrito: solo las dos que dicen "pediatria" literal.
    expect(searchList(plantillas, "pediatria", (t) => t)).toHaveLength(2);

    // El caso de la captura: una "r" de más dejaba la lista en blanco. Ahora
    // aparecen esas dos y además la de cirugía pediátrica, que se parece lo
    // suficiente — al médico le sirve verla, y nada de medicina interna se cuela.
    const conError = searchList(plantillas, "pedriatria", (t) => t);
    expect(conError.length).toBeGreaterThanOrEqual(2);
    expect(conError.some((t) => t.includes("niño sano"))).toBe(true);
    expect(conError.some((t) => t.includes("enfermedad aguda"))).toBe(true);
    expect(conError.some((t) => t.includes("medicina_interna"))).toBe(false);
  });

  it("sin término devuelve todo", () => {
    expect(searchList(plantillas, "", (t) => t)).toHaveLength(4);
  });

  it("una búsqueda sin nada parecido sí devuelve vacío", () => {
    expect(searchList(plantillas, "dermatologia", (t) => t)).toHaveLength(0);
  });
});

/**
 * Regresión con el catálogo REAL. Buscar "pedriatria" en el selector de
 * "Iniciar consulta" devolvía "No encontramos una plantilla con esa búsqueda"
 * teniendo nueve plantillas de pediatría cargadas.
 */
describe("catálogo real de pediatría", () => {
  // Nombre + código de especialidad, como los concatena el buscador.
  const catalogo = [
    "Consulta inicial · enfermedad aguda en el niño pediatria",
    "Consulta pediátrica integral · crecimiento, desarrollo y vacunas pediatria",
    "Control de niño sano · crecimiento, desarrollo y prevención pediatria",
    "Control y seguimiento · patología pediátrica en tratamiento pediatria",
    "Procedimiento pediátrico ambulatorio · técnica, tolerancia y cuidados pediatria",
    "Consulta inicial · valoración quirúrgica del niño cirugia_pediatrica",
    "Control postoperatorio · recuperación del niño operado cirugia_pediatrica",
    "Consulta inicial · control prenatal ginecologia_obstetricia",
    "Control de hipertensión arterial medicina_interna",
  ];
  const buscar = (q: string) => searchList(catalogo, q, (t) => t);

  it("encuentra las de pediatría escribiendo bien, con o sin tilde", () => {
    expect(buscar("pediatria")).toHaveLength(5);
    expect(buscar("pediatría")).toHaveLength(5);
    expect(buscar("Pediatría")).toHaveLength(5);
  });

  it("las encuentra igual con la errata de la captura", () => {
    const r = buscar("pedriatria");
    expect(r.length).toBeGreaterThanOrEqual(5);
    expect(r.some((t) => t.includes("niño sano"))).toBe(true);
    // Y sin arrastrar lo que no tiene nada que ver.
    expect(r.some((t) => t.includes("medicina_interna"))).toBe(false);
    expect(r.some((t) => t.includes("ginecologia"))).toBe(false);
  });

  it("busca también por el nombre de la plantilla, no solo por especialidad", () => {
    expect(buscar("niño sano")).toHaveLength(1);
    expect(buscar("vacunas")).toHaveLength(1);
    expect(buscar("postoperatorio")).toHaveLength(1);
  });
});

describe("categoryMatchesSection", () => {
  it("casa la categoría corta con el nombre largo de la sección", () => {
    expect(categoryMatchesSection("Plan", "Plan y dosis por peso")).toBe(true);
    expect(categoryMatchesSection("Plan", "Plan y educación al cuidador")).toBe(true);
    expect(categoryMatchesSection("Análisis", "Análisis e impresión diagnóstica")).toBe(
      true,
    );
    expect(categoryMatchesSection("Examen físico", "Examen físico pediátrico")).toBe(
      true,
    );
  });

  it("ignora tildes y mayúsculas", () => {
    expect(categoryMatchesSection("analisis", "Análisis y evolución")).toBe(true);
  });

  it("no casa secciones que no tienen nada que ver", () => {
    expect(categoryMatchesSection("Plan", "Motivo de consulta")).toBe(false);
    expect(categoryMatchesSection("Recomendaciones", "Examen físico")).toBe(false);
  });

  it("con cualquiera de las dos vacía, no hay coincidencia", () => {
    expect(categoryMatchesSection("", "Plan")).toBe(false);
    expect(categoryMatchesSection("Plan", "")).toBe(false);
  });
});
