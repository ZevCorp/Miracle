import { describe, expect, it } from "vitest";
import {
  noteReviewLabel,
  noteReviewScore,
  reviewGeneratedNote,
  sectionCoverage,
  splitReviewFindings,
  type NoteReviewInput,
} from "@/lib/clinical/note-review";
import type { AuditSeverity } from "@/lib/clinical/note-audit";
import type {
  ClinicalNoteJson,
  EncounterTemplateSnapshot,
} from "@/lib/api/clinical";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Transcripción larga: dispara las reglas que exigen consulta sustancial. */
const TRANSCRIPCION_LARGA = "Paciente refiere cefalea de dos semanas. ".repeat(15);

/**
 * Nota "buena": todo lo que el revisor busca está presente, así que no debería
 * producir ningún hallazgo. Cada test la degrada en un solo aspecto.
 */
function notaCompleta(over: Partial<ClinicalNoteJson> = {}): ClinicalNoteJson {
  return {
    summary: "Cefalea tensional, se indica manejo sintomático y control.",
    sections: [
      {
        key: "motivo",
        label: "Motivo de consulta",
        content: "Cefalea opresiva de dos semanas de evolución.",
        confidence: 0.9,
      },
      {
        key: "examen",
        label: "Examen físico",
        content: "TA 120/80, FC 72, temperatura 36.5. Sin focalización.",
        confidence: 0.88,
      },
      {
        key: "analisis",
        label: "Análisis",
        content: "Cuadro compatible con cefalea tensional. Niega alergias.",
        confidence: 0.85,
      },
    ],
    discharge: {
      plan: {
        medications: [
          { name: "Acetaminofén", dose: "500 mg", frequency: "cada 8 horas" },
        ],
        non_pharmacological: [{ text: "Higiene de sueño." }],
        follow_up: [{ text: "Control en dos semanas." }],
      },
      recommendations: [{ text: "Hidratación y pausas activas." }],
      alarm_signs: [{ text: "Cefalea súbita e intensa: consultar a urgencias." }],
    },
    warnings: [],
    missing_required_sections: [],
    ...over,
  };
}

function plantilla(
  over: Partial<EncounterTemplateSnapshot> = {},
): EncounterTemplateSnapshot {
  return {
    template_id: "t1",
    name: "Consulta inicial",
    specialty: "medicina_general",
    sections: [
      { key: "motivo", label: "Motivo de consulta", order: 1, required: true },
      { key: "examen", label: "Examen físico", order: 2, required: true },
      { key: "analisis", label: "Análisis", order: 3, required: false },
    ],
    ...over,
  };
}

function revisar(over: Partial<NoteReviewInput> = {}) {
  return reviewGeneratedNote({
    note: notaCompleta(),
    template: plantilla(),
    transcript: TRANSCRIPCION_LARGA,
    ...over,
  });
}

/** Claves de los hallazgos, para aserciones legibles. */
function claves(review: ReturnType<typeof reviewGeneratedNote>): string[] {
  return review.hallazgos.map((h) => h.key);
}

/* ------------------------------------------------------------------ */
/* Determinismo: la razón de ser del módulo                            */
/* ------------------------------------------------------------------ */

describe("reviewGeneratedNote — determinismo", () => {
  it("la misma entrada da exactamente el mismo resultado", () => {
    const input: NoteReviewInput = {
      note: notaCompleta({ summary: "", warnings: ["Audio con ruido"] }),
      template: plantilla(),
      transcript: TRANSCRIPCION_LARGA,
    };
    expect(reviewGeneratedNote(input)).toEqual(reviewGeneratedNote(input));
  });

  it("sin nota no hay hallazgos (aún no hay nada que revisar)", () => {
    const review = reviewGeneratedNote({ note: null });
    expect(review.hallazgos).toEqual([]);
    expect(noteReviewLabel(review)).toBe("Todo en orden");
  });

  it("una nota completa no produce ruido", () => {
    const review = revisar();
    expect(review.hallazgos).toEqual([]);
    expect(noteReviewLabel(review)).toBe("Todo en orden");
  });
});

/* ------------------------------------------------------------------ */
/* Secciones                                                           */
/* ------------------------------------------------------------------ */

describe("reviewGeneratedNote — secciones", () => {
  it("cada obligatoria vacía se nombra aparte; las opcionales van en una línea", () => {
    const note = notaCompleta();
    note.sections[1].content = "   "; // examen: obligatoria
    note.sections[2].content = ""; // analisis: opcional
    const review = reviewGeneratedNote({
      note,
      template: plantilla(),
      transcript: TRANSCRIPCION_LARGA,
    });

    // La obligatoria bloquea la firma: se nombra sola.
    const critico = review.hallazgos.find((h) => h.key === "falta-examen");
    expect(critico?.severidad).toBe("critico");
    expect(critico?.titulo).toBe("Falta Examen físico");

    // La opcional se agrupa, pero se sigue nombrando en el detalle.
    const aviso = review.hallazgos.find((h) => h.key === "secciones-vacias");
    expect(aviso?.severidad).toBe("advertencia");
    expect(aviso?.detalle).toContain("Análisis");
  });

  it("un campo de dato corto (rótulo, cédula, fecha) no se reclama como breve", () => {
    // La plantilla de patología pide identificadores: un rótulo "26-2513" es
    // exactamente lo que se pidió, no una sección que quedó a medias.
    const note = notaCompleta({
      sections: [
        { key: "rotulo", label: "Rótulo", content: "26-2513", confidence: 0.9 },
        { key: "cedula", label: "Cédula", content: "1040181619", confidence: 0.9 },
        {
          key: "fecha",
          label: "Fecha de lectura",
          content: "22/07/2026",
          confidence: 0.9,
        },
      ],
    });
    const review = reviewGeneratedNote({
      note,
      template: plantilla({
        specialty: "patologia",
        sections: [
          { key: "rotulo", label: "Rótulo", order: 1 },
          { key: "cedula", label: "Cédula", order: 2 },
          { key: "fecha", label: "Fecha de lectura", order: 3 },
        ],
      }),
      transcript: TRANSCRIPCION_LARGA,
    });
    expect(claves(review)).not.toContain("secciones-breves");
  });

  it("el aviso cita la plantilla que el médico usó", () => {
    const note = notaCompleta();
    note.sections[1].content = "";
    const review = reviewGeneratedNote({ note, template: plantilla() });
    const falta = review.hallazgos.find((h) => h.key === "falta-examen");
    expect(falta?.detalle).toContain("«Consulta inicial»");
  });

  it("el relleno sin contenido cuenta como vacío", () => {
    const note = notaCompleta();
    note.sections[1].content = "Sin información documentada.";
    const review = reviewGeneratedNote({ note, template: plantilla() });
    expect(claves(review)).toContain("falta-examen");
  });

  it("una negación clínica NO cuenta como vacío", () => {
    const note = notaCompleta();
    note.sections[1].content = "No refiere dolor ni fiebre.";
    const review = reviewGeneratedNote({ note, template: plantilla() });
    expect(claves(review)).not.toContain("falta-examen");
  });

  it("una obligatoria que ni siquiera vino como sección se reporta", () => {
    const note = notaCompleta();
    note.sections = note.sections.filter((s) => s.key !== "examen");
    const review = reviewGeneratedNote({ note, template: plantilla() });
    const critico = review.hallazgos.find((h) => h.key === "falta-examen");
    expect(critico?.severidad).toBe("critico");
    expect(critico?.titulo).toBe("Falta Examen físico");
  });

  it("missing_required_sections del backend ya resuelto no vuelve a avisar", () => {
    // El backend marcó "examen" como faltante, pero el médico ya lo llenó.
    const note = notaCompleta({ missing_required_sections: ["examen"] });
    const review = reviewGeneratedNote({ note, template: plantilla() });
    expect(claves(review)).not.toContain("falta-examen");
  });

  it("missing_required_sections aplica aunque la plantilla no marque required", () => {
    const note = notaCompleta({ missing_required_sections: ["analisis"] });
    note.sections[2].content = "";
    const review = reviewGeneratedNote({
      note,
      template: plantilla({
        sections: [{ key: "analisis", label: "Análisis", order: 1 }],
      }),
    });
    const falta = review.hallazgos.find((h) => h.key === "falta-analisis");
    expect(falta?.severidad).toBe("critico");
  });

  it("baja confianza de la IA se señala como advertencia", () => {
    const note = notaCompleta();
    note.sections[1].confidence = 0.3;
    const review = reviewGeneratedNote({ note, template: plantilla() });
    const dudosa = review.hallazgos.find((h) => h.key === "confianza-baja");
    expect(dudosa?.severidad).toBe("advertencia");
    expect(dudosa?.detalle).toContain("Examen físico");
  });
});

/* ------------------------------------------------------------------ */
/* Cierre: plan, seguimiento, alarma, medicación                       */
/* ------------------------------------------------------------------ */

describe("reviewGeneratedNote — cierre de la consulta", () => {
  it("sin plan terapéutico es advertencia y lo dice en una sola línea", () => {
    const note = notaCompleta();
    note.discharge!.plan = {
      medications: [],
      non_pharmacological: [],
      follow_up: [],
    };
    note.discharge!.alarm_signs = [];
    note.discharge!.recommendations = [];
    const review = reviewGeneratedNote({ note, template: plantilla() });

    // Un solo hallazgo para todo el cierre, no cuatro.
    const cierre = review.hallazgos.filter((h) => h.key === "cierre-incompleto");
    expect(cierre).toHaveLength(1);
    expect(cierre[0].severidad).toBe("advertencia");
    expect(cierre[0].detalle).toContain("plan terapéutico");
    expect(cierre[0].detalle).toContain("signos de alarma");
    expect(cierre[0].detalle).toContain("recomendaciones al paciente");
  });

  it("con plan pero sin control, el cierre baja a sugerencia", () => {
    const note = notaCompleta();
    note.discharge!.plan.follow_up = [];
    const review = reviewGeneratedNote({ note, template: plantilla() });
    const cierre = review.hallazgos.find((h) => h.key === "cierre-incompleto");
    expect(cierre?.severidad).toBe("sugerencia");
    expect(cierre?.detalle).toContain("control o seguimiento");
    expect(cierre?.detalle).not.toContain("plan terapéutico");
  });

  it("medicamento sin dosis o sin frecuencia se nombra", () => {
    const note = notaCompleta();
    note.discharge!.plan.medications = [
      { name: "Ibuprofeno", frequency: "cada 8 horas" }, // sin dosis
      { name: "Omeprazol", dose: "20 mg" }, // sin frecuencia
    ];
    const review = reviewGeneratedNote({ note, template: plantilla() });
    const med = review.hallazgos.find((h) => h.key === "medicacion-incompleta");
    expect(med?.severidad).toBe("advertencia");
    expect(med?.detalle).toContain("Ibuprofeno");
    expect(med?.detalle).toContain("Omeprazol");
  });

  it("con plan completo, la alarma y las recomendaciones van juntas en una línea", () => {
    const note = notaCompleta();
    note.discharge!.alarm_signs = [];
    note.discharge!.recommendations = [];
    const review = reviewGeneratedNote({ note, template: plantilla() });
    const cierre = review.hallazgos.find((h) => h.key === "cierre-incompleto");
    expect(cierre?.severidad).toBe("sugerencia");
    expect(cierre?.detalle).toContain("signos de alarma");
    expect(cierre?.detalle).toContain("recomendaciones al paciente");
  });

  it("una nota sin discharge no rompe la revisión", () => {
    const review = reviewGeneratedNote({
      note: notaCompleta({ discharge: undefined }),
      template: plantilla(),
    });
    const cierre = review.hallazgos.find((h) => h.key === "cierre-incompleto");
    expect(cierre?.severidad).toBe("advertencia");
    expect(cierre?.detalle).toContain("plan terapéutico");
  });
});

/* ------------------------------------------------------------------ */
/* Lo que se olvida preguntar                                          */
/* ------------------------------------------------------------------ */

describe("reviewGeneratedNote — datos que se olvidan", () => {
  it("sin signos vitales en la nota, lo recuerda", () => {
    const note = notaCompleta();
    note.sections[1].content = "Paciente en buen estado general, sin hallazgos.";
    const review = reviewGeneratedNote({
      note,
      template: plantilla(),
      transcript: TRANSCRIPCION_LARGA,
    });
    expect(claves(review)).toContain("sin-signos-vitales");
  });

  it("no reclama signos vitales en patología", () => {
    const note = notaCompleta();
    note.sections[1].content = "Muestra recibida en formol, sin alteraciones.";
    const review = reviewGeneratedNote({
      note,
      template: plantilla({ specialty: "patologia" }),
      transcript: TRANSCRIPCION_LARGA,
    });
    expect(claves(review)).not.toContain("sin-signos-vitales");
  });

  it("un informe de muestra no reclama plan, alarma ni recomendaciones", () => {
    // Informe de patología real: hay diagnóstico sobre la muestra, pero no hay
    // paciente al frente a quien indicarle un tratamiento.
    const note = notaCompleta({
      discharge: {
        plan: { medications: [], non_pharmacological: [], follow_up: [] },
        recommendations: [],
        alarm_signs: [],
      },
    });
    const review = reviewGeneratedNote({
      note,
      template: plantilla({ specialty: "patologia", name: "Histopatología" }),
      transcript: TRANSCRIPCION_LARGA,
    });
    expect(claves(review)).not.toContain("cierre-incompleto");
  });

  it("la misma nota sin cierre SÍ avisa en una consulta asistencial", () => {
    const note = notaCompleta({
      discharge: {
        plan: { medications: [], non_pharmacological: [], follow_up: [] },
        recommendations: [],
        alarm_signs: [],
      },
    });
    const review = reviewGeneratedNote({
      note,
      template: plantilla(),
      transcript: TRANSCRIPCION_LARGA,
    });
    const cierre = review.hallazgos.find((h) => h.key === "cierre-incompleto");
    expect(cierre?.severidad).toBe("advertencia");
    expect(cierre?.detalle).toContain("plan terapéutico");
  });

  it("no reclama signos vitales si la consulta fue corta", () => {
    const note = notaCompleta();
    note.sections[1].content = "Sin hallazgos.";
    const review = reviewGeneratedNote({
      note,
      template: plantilla(),
      transcript: "Consulta breve.",
    });
    expect(claves(review)).not.toContain("sin-signos-vitales");
  });

  it("prescribir sin mencionar alergias en ninguna parte avisa", () => {
    const note = notaCompleta();
    note.sections[2].content = "Cuadro compatible con cefalea tensional.";
    const review = reviewGeneratedNote({
      note,
      template: plantilla(),
      transcript: TRANSCRIPCION_LARGA,
    });
    expect(claves(review)).toContain("alergias-no-documentadas");
  });

  it("si las alergias se hablaron aunque no queden en la nota, no avisa", () => {
    const note = notaCompleta();
    note.sections[2].content = "Cuadro compatible con cefalea tensional.";
    const review = reviewGeneratedNote({
      note,
      template: plantilla(),
      transcript: `${TRANSCRIPCION_LARGA} El paciente niega alergias a medicamentos.`,
    });
    expect(claves(review)).not.toContain("alergias-no-documentadas");
  });

  it("sin medicación prescrita no se pregunta por alergias", () => {
    const note = notaCompleta();
    note.sections[2].content = "Cuadro compatible con cefalea tensional.";
    note.discharge!.plan.medications = [];
    const review = reviewGeneratedNote({
      note,
      template: plantilla(),
      transcript: TRANSCRIPCION_LARGA,
    });
    expect(claves(review)).not.toContain("alergias-no-documentadas");
  });

  it("secciones muy breves solo se señalan tras una consulta larga", () => {
    const note = notaCompleta();
    // Prosa que arrancó y quedó a medias (no un dato suelto, que sería válido).
    note.sections[2].content = "Todo normal ok.";

    const larga = reviewGeneratedNote({
      note,
      template: plantilla(),
      transcript: TRANSCRIPCION_LARGA,
    });
    expect(claves(larga)).toContain("secciones-breves");

    const corta = reviewGeneratedNote({
      note,
      template: plantilla(),
      transcript: "Consulta breve.",
    });
    expect(claves(corta)).not.toContain("secciones-breves");
  });
});

/* ------------------------------------------------------------------ */
/* Avisos del backend y orden                                          */
/* ------------------------------------------------------------------ */

describe("reviewGeneratedNote — backend y orden", () => {
  it("los warnings del backend se conservan como hallazgos", () => {
    const review = reviewGeneratedNote({
      note: notaCompleta({ warnings: ["  El audio tenía ruido de fondo  ", "  "] }),
      template: plantilla(),
      transcript: TRANSCRIPCION_LARGA,
    });
    const avisos = review.hallazgos.filter((h) => h.key.startsWith("generacion-"));
    expect(avisos).toHaveLength(1);
    expect(avisos[0].detalle).toBe("El audio tenía ruido de fondo");
  });

  it("el aviso del backend es sugerencia y queda de último", () => {
    // Es texto libre del modelo, no una comprobación: no debe desplazar a lo
    // que el médico sí tiene que corregir.
    const note = notaCompleta({ warnings: ["Transcripción fragmentada"] });
    note.discharge!.plan.medications = [{ name: "Ibuprofeno" }]; // sin dosis ni frecuencia
    const review = reviewGeneratedNote({
      note,
      template: plantilla(),
      transcript: TRANSCRIPCION_LARGA,
    });

    const aviso = review.hallazgos.find((h) => h.key.startsWith("generacion-"));
    expect(aviso?.severidad).toBe("sugerencia");
    expect(review.hallazgos.at(-1)?.key).toMatch(/^generacion-/);
    // El riesgo real (fármaco sin dosis) se lee antes que el comentario.
    expect(claves(review).indexOf("medicacion-incompleta")).toBeLessThan(
      claves(review).findIndex((k) => k.startsWith("generacion-")),
    );
  });

  it("ordena crítico → advertencia → sugerencia y cuenta cada severidad", () => {
    const note = notaCompleta({ summary: "" });
    note.sections[1].content = ""; // crítico
    note.discharge!.recommendations = []; // sugerencia
    const review = reviewGeneratedNote({
      note,
      template: plantilla(),
      transcript: TRANSCRIPCION_LARGA,
    });

    const severidades = review.hallazgos.map((h) => h.severidad);
    expect(severidades[0]).toBe("critico");
    expect([...severidades].sort()).toEqual(severidades.slice().sort());
    expect(review.criticos).toBe(1);
    expect(review.advertencias).toBeGreaterThan(0);
    expect(review.sugerencias).toBeGreaterThan(0);
    expect(
      review.criticos + review.advertencias + review.sugerencias,
    ).toBe(review.hallazgos.length);
  });

  it("noteReviewLabel resume, pluraliza y omite las severidades sin hallazgos", () => {
    // Vaciar "Examen físico" arrastra también los signos vitales (viven ahí),
    // así que este caso da 1 crítico y 2 sugerencias, sin ninguna advertencia.
    const note = notaCompleta();
    note.sections[1].content = "";
    note.discharge!.recommendations = [];
    const review = reviewGeneratedNote({
      note,
      template: plantilla(),
      transcript: TRANSCRIPCION_LARGA,
    });
    expect(review.advertencias).toBe(0);
    expect(noteReviewLabel(review)).toBe("1 crítico · 2 sugerencias");
  });
});

/* ------------------------------------------------------------------ */
/* Puntaje y cobertura (panel de auditoría en vivo)                    */
/* ------------------------------------------------------------------ */

describe("noteReviewScore", () => {
  it("una nota completa puntúa 100", () => {
    expect(noteReviewScore(revisar())).toBe(100);
  });

  it("penaliza con la escala de la auditoría (crítico 30, sugerencia 5)", () => {
    // 1 crítico (obligatoria vacía) + 2 sugerencias (vitales y brevedad no
    // aplican aquí): construimos un caso con hallazgos conocidos.
    const note = notaCompleta();
    note.discharge!.recommendations = []; // sugerencia (-5)
    const review = reviewGeneratedNote({
      note,
      template: plantilla(),
      transcript: TRANSCRIPCION_LARGA,
    });
    expect(review.hallazgos).toHaveLength(1);
    expect(noteReviewScore(review)).toBe(95);
  });

  it("nunca baja de 0", () => {
    const note = notaCompleta({ summary: "", discharge: undefined });
    note.sections.forEach((s) => {
      s.content = "";
    });
    const review = reviewGeneratedNote({
      note,
      template: plantilla(),
      transcript: TRANSCRIPCION_LARGA,
    });
    expect(noteReviewScore(review)).toBeGreaterThanOrEqual(0);
    expect(noteReviewScore(review)).toBeLessThan(30);
  });
});

describe("splitReviewFindings", () => {
  function review(hallazgos: { key: string; severidad: AuditSeverity }[]) {
    return {
      hallazgos: hallazgos.map((h) => ({ ...h, titulo: h.key, detalle: "" })),
      criticos: hallazgos.filter((h) => h.severidad === "critico").length,
      advertencias: hallazgos.filter((h) => h.severidad === "advertencia").length,
      sugerencias: hallazgos.filter((h) => h.severidad === "sugerencia").length,
    };
  }

  it("muestra 3 de entrada y pliega el resto", () => {
    const { principales, plegados } = splitReviewFindings(
      review([
        { key: "a", severidad: "advertencia" },
        { key: "b", severidad: "advertencia" },
        { key: "c", severidad: "advertencia" },
        { key: "d", severidad: "sugerencia" },
        { key: "e", severidad: "sugerencia" },
      ]),
    );
    expect(principales.map((h) => h.key)).toEqual(["a", "b", "c"]);
    expect(plegados.map((h) => h.key)).toEqual(["d", "e"]);
  });

  it("nunca pliega un crítico, aunque pasen del cupo", () => {
    const { principales, plegados } = splitReviewFindings(
      review([
        { key: "c1", severidad: "critico" },
        { key: "c2", severidad: "critico" },
        { key: "c3", severidad: "critico" },
        { key: "c4", severidad: "critico" },
        { key: "a1", severidad: "advertencia" },
      ]),
    );
    expect(principales.map((h) => h.key)).toEqual(["c1", "c2", "c3", "c4"]);
    expect(plegados.map((h) => h.key)).toEqual(["a1"]);
  });

  it("los críticos ocupan cupo: con 2 críticos solo sube 1 advertencia", () => {
    const { principales, plegados } = splitReviewFindings(
      review([
        { key: "c1", severidad: "critico" },
        { key: "c2", severidad: "critico" },
        { key: "a1", severidad: "advertencia" },
        { key: "a2", severidad: "advertencia" },
      ]),
    );
    expect(principales.map((h) => h.key)).toEqual(["c1", "c2", "a1"]);
    expect(plegados.map((h) => h.key)).toEqual(["a2"]);
  });

  it("sin hallazgos no hay nada que plegar", () => {
    const { principales, plegados } = splitReviewFindings(review([]));
    expect(principales).toEqual([]);
    expect(plegados).toEqual([]);
  });
});

describe("sectionCoverage", () => {
  it("clasifica completa / breve / vacía y marca las obligatorias", () => {
    const note = notaCompleta();
    note.sections[1].content = "Todo normal ok."; // prosa a medias = breve
    note.sections[2].content = "Sin información documentada."; // relleno = vacía
    const cobertura = sectionCoverage(note, plantilla());

    expect(cobertura.map((s) => s.estado)).toEqual(["completa", "breve", "vacia"]);
    expect(cobertura[0].obligatoria).toBe(true); // motivo
    expect(cobertura[2].obligatoria).toBe(false); // analisis
    expect(cobertura[2].caracteres).toBe(0);
  });

  it("agrega al final la obligatoria que no vino en la nota", () => {
    const note = notaCompleta();
    note.sections = note.sections.filter((s) => s.key !== "examen");
    const cobertura = sectionCoverage(note, plantilla());
    const faltante = cobertura.at(-1);
    expect(faltante?.key).toBe("examen");
    expect(faltante?.label).toBe("Examen físico");
    expect(faltante?.estado).toBe("vacia");
    expect(faltante?.obligatoria).toBe(true);
  });

  it("marca la baja confianza y sobrevive sin nota ni plantilla", () => {
    const note = notaCompleta();
    note.sections[0].confidence = 0.2;
    const cobertura = sectionCoverage(note, null);
    expect(cobertura[0].confianzaBaja).toBe(true);

    // Una sección INTERPRETADA por la IA llega con grounding "inferred" y
    // confidence 0.4 (mapeo del backend): tiene que disparar el badge. Una
    // deducida (0.8) no.
    const interpretada = notaCompleta();
    interpretada.sections[0].grounding = "inferred";
    interpretada.sections[0].confidence = 0.4;
    interpretada.sections[1].grounding = "entailed";
    interpretada.sections[1].confidence = 0.8;
    const revisada = sectionCoverage(interpretada, null);
    expect(revisada[0].confianzaBaja).toBe(true);
    expect(revisada[1].confianzaBaja).toBe(false);

    expect(sectionCoverage(null)).toEqual([]);
    expect(sectionCoverage(undefined, plantilla())).toEqual([]);
  });
});
