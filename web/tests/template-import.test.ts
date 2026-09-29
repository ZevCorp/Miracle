import { describe, expect, it } from "vitest";
import {
  classifyImportFile,
  mergeTextSources,
  proposalToDraft,
  sanitizeTemplateProposal,
  validateImportBatch,
  MAX_IMPORT_IMAGES,
  MAX_PASTED_EXAMPLE_CHARS,
  TEMPLATE_IMAGE_CHARS,
  TEMPLATE_IMAGE_TOTAL_CHARS,
  type ImportItem,
} from "@/lib/clinical/template-import";
import {
  buildTemplatePayload,
  createBlock,
  validateBlocks,
  MAX_LABEL_LENGTH,
  MAX_INSTRUCTION_LENGTH,
  MAX_TEMPLATE_SECTIONS,
} from "@/lib/clinical/template-builder";

function file(name: string, type: string, size = 1024) {
  return { name, type, size };
}

function item(overrides: Partial<ImportItem> & { tempId: string }): ImportItem {
  return {
    kind: "document",
    name: `${overrides.tempId}.docx`,
    payload: "Motivo de consulta",
    ...overrides,
  };
}

describe("classifyImportFile", () => {
  it("reconoce las fotos por MIME y por extensión", () => {
    expect(classifyImportFile(file("hoja.jpg", "image/jpeg"))).toEqual({
      kind: "image",
    });
    expect(classifyImportFile(file("hoja.png", "image/png"))).toEqual({
      kind: "image",
    });
    expect(classifyImportFile(file("hoja.webp", "image/webp"))).toEqual({
      kind: "image",
    });
    // Android manda muchas veces el type vacío: decide la extensión.
    expect(classifyImportFile(file("IMG_0042.JPEG", ""))).toEqual({
      kind: "image",
    });
  });

  it("reconoce los documentos de texto", () => {
    expect(classifyImportFile(file("plantilla.txt", "text/plain"))).toEqual({
      kind: "document",
    });
    expect(classifyImportFile(file("plantilla.md", ""))).toEqual({
      kind: "document",
    });
    expect(
      classifyImportFile(
        file(
          "plantilla.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
      ),
    ).toEqual({ kind: "document" });
  });

  it("explica el PDF en vez de rechazarlo en seco", () => {
    const result = classifyImportFile(file("plantilla.pdf", "application/pdf"));
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("foto");
  });

  it("hereda de validateSnippetFile la salida para los .doc antiguos", () => {
    const result = classifyImportFile(file("vieja.doc", "application/msword"));
    expect((result as { error: string }).error).toContain(".docx");
  });

  it("rechaza una foto de más de 15 MB", () => {
    const result = classifyImportFile(
      file("enorme.jpg", "image/jpeg", 20 * 1024 * 1024),
    );
    expect((result as { error: string }).error).toContain("15 MB");
  });

  it("rechaza el archivo vacío", () => {
    expect(classifyImportFile(file("vacia.jpg", "image/jpeg", 0))).toEqual({
      error: "El archivo está vacío.",
    });
  });

  it("explica el .docx pesado sin hablar de atajos", () => {
    const result = classifyImportFile(
      file("con-logo.docx", "", 3 * 1024 * 1024),
    );
    const message = (result as { error: string }).error;
    expect(message).toContain("2 MB");
    expect(message).not.toContain("atajo");
  });
});

describe("validateImportBatch", () => {
  const foto = (tempId: string, chars = 1000): ImportItem => ({
    tempId,
    kind: "image",
    name: `${tempId}.jpg`,
    payload: "d".repeat(chars),
  });

  it("sin nada que enviar, pide algo", () => {
    expect(validateImportBatch([], "")).toContain("Añade");
    expect(validateImportBatch([], "   ")).toContain("Añade");
  });

  it("acepta la mezcla de fotos, documento y texto", () => {
    expect(
      validateImportBatch([foto("a"), foto("b"), item({ tempId: "c" })], "Notas"),
    ).toBeNull();
  });

  it("corta por encima del tope de fotos", () => {
    const fotos = Array.from({ length: MAX_IMPORT_IMAGES + 1 }, (_, i) =>
      foto(`f${i}`),
    );
    expect(validateImportBatch(fotos, "")).toContain(String(MAX_IMPORT_IMAGES));
  });

  it("no cuenta los ítems que fallaron al leerse", () => {
    const fotos = Array.from({ length: MAX_IMPORT_IMAGES + 1 }, (_, i) =>
      foto(`f${i}`),
    );
    fotos[0].error = "No se pudo leer la imagen.";
    expect(validateImportBatch(fotos, "")).toBeNull();
  });

  it("corta el texto pegado demasiado largo", () => {
    const largo = "a".repeat(MAX_PASTED_EXAMPLE_CHARS + 1);
    expect(validateImportBatch([], largo)).toContain("supera");
  });

  it("corta cuando las fotos juntas pasan del presupuesto", () => {
    const pesadas = [
      foto("a", TEMPLATE_IMAGE_CHARS),
      foto("b", TEMPLATE_IMAGE_CHARS),
      foto("c", TEMPLATE_IMAGE_CHARS),
      foto("d", TEMPLATE_IMAGE_CHARS + 1),
    ];
    expect(validateImportBatch(pesadas, "")).toContain("pesan");
  });
});

describe("presupuesto de bytes", () => {
  // Si alguien sube MAX_IMPORT_IMAGES sin recalcular, el body pasa del límite
  // de la plataforma y la respuesta deja de ser JSON. Esto lo impide.
  it("el agregado cabe bajo el límite de body de 4.5 MB", () => {
    expect(TEMPLATE_IMAGE_CHARS * MAX_IMPORT_IMAGES).toBe(
      TEMPLATE_IMAGE_TOTAL_CHARS,
    );
    expect(TEMPLATE_IMAGE_TOTAL_CHARS).toBeLessThan(4_500_000);
  });
});

describe("mergeTextSources", () => {
  it("une documentos y texto pegado, cada archivo con su nombre", () => {
    const salida = mergeTextSources(
      [
        item({ tempId: "a", name: "control.docx", payload: "Motivo" }),
        item({ tempId: "b", name: "egreso.txt", payload: "Plan" }),
      ],
      "Pegado",
    );
    expect(salida).toBe(
      "--- control.docx ---\nMotivo\n\n--- egreso.txt ---\nPlan\n\nPegado",
    );
  });

  it("ignora imágenes, ítems con error y payloads vacíos", () => {
    expect(
      mergeTextSources(
        [
          item({ tempId: "a", kind: "image", payload: "data:image/jpeg;base64,x" }),
          item({ tempId: "b", payload: "Roto", error: "No se pudo leer." }),
          item({ tempId: "c", payload: "   " }),
        ],
        "",
      ),
    ).toBe("");
  });
});

describe("sanitizeTemplateProposal", () => {
  const ok = {
    name: "Control de hipertensión",
    description: "Para el control mensual",
    sections: [
      { label: "Motivo de consulta", required: true },
      { label: "Cifras tensionales", required: false, instruction: "Últimas tres" },
      { label: "Plan", required: false },
    ],
  };

  it("deja pasar la forma feliz", () => {
    expect(sanitizeTemplateProposal(ok)).toEqual({
      name: "Control de hipertensión",
      description: "Para el control mensual",
      sections: [
        { label: "Motivo de consulta", required: true },
        {
          label: "Cifras tensionales",
          required: false,
          instruction: "Últimas tres",
        },
        { label: "Plan", required: false },
      ],
    });
  });

  it("devuelve null ante cualquier basura", () => {
    expect(sanitizeTemplateProposal(null)).toBeNull();
    expect(sanitizeTemplateProposal({})).toBeNull();
    expect(sanitizeTemplateProposal("texto")).toBeNull();
    expect(sanitizeTemplateProposal([])).toBeNull();
    expect(sanitizeTemplateProposal({ sections: "no es array" })).toBeNull();
  });

  it("recorta labels e instrucciones larguísimas", () => {
    const salida = sanitizeTemplateProposal({
      sections: [
        { label: "A".repeat(200), instruction: "B".repeat(900) },
        { label: "Plan" },
      ],
    });
    expect(salida?.sections[0].label).toHaveLength(MAX_LABEL_LENGTH);
    expect(salida?.sections[0].instruction).toHaveLength(MAX_INSTRUCTION_LENGTH);
  });

  it("no pasa del máximo de secciones", () => {
    const salida = sanitizeTemplateProposal({
      sections: Array.from({ length: 45 }, (_, i) => ({ label: `Sección ${i}` })),
    });
    expect(salida?.sections).toHaveLength(MAX_TEMPLATE_SECTIONS);
  });

  it("deduplica con la misma regla que usa el validador del constructor", () => {
    // Si esto no se hiciera aquí, el borrador abriría el constructor en un
    // estado que validateBlocks rechaza al guardar.
    const salida = sanitizeTemplateProposal({
      sections: [
        { label: "Motivo de consulta" },
        { label: "MOTIVO DE  CONSULTA" },
        { label: "Plan" },
      ],
    });
    expect(salida?.sections.map((s) => s.label)).toEqual([
      "Motivo de consulta",
      "Plan",
    ]);
  });

  it("descarta labels vacíos o de solo espacios", () => {
    const salida = sanitizeTemplateProposal({
      sections: [
        { label: "   " },
        { label: "" },
        { label: 42 },
        { label: "Motivo" },
        { label: "Plan" },
      ],
    });
    expect(salida?.sections).toHaveLength(2);
  });

  it("solo acepta required booleano exacto", () => {
    const salida = sanitizeTemplateProposal({
      sections: [
        { label: "Motivo", required: "sí" },
        { label: "Plan", required: 1 },
        { label: "Egreso", required: true },
      ],
    });
    expect(salida?.sections.map((s) => s.required)).toEqual([false, false, true]);
  });

  it("cae al nombre de reserva cuando el modelo no propone uno", () => {
    const salida = sanitizeTemplateProposal(
      { sections: ok.sections },
      { fallbackName: "control-hta.jpg" },
    );
    expect(salida?.name).toBe("control-hta.jpg");
    expect(sanitizeTemplateProposal({ sections: ok.sections })?.name).toBe(
      "Plantilla importada",
    );
  });

  it("devuelve null si no sobreviven dos secciones", () => {
    expect(
      sanitizeTemplateProposal({ sections: [{ label: "Motivo" }] }),
    ).toBeNull();
    expect(sanitizeTemplateProposal({ sections: [] })).toBeNull();
  });

  it("omite descripción vacía en vez de mandarla en blanco", () => {
    const salida = sanitizeTemplateProposal({
      description: "   ",
      sections: ok.sections,
    });
    expect(salida).not.toHaveProperty("description");
  });
});

describe("proposalToDraft", () => {
  it("produce un borrador que el constructor puede guardar sin quejarse", () => {
    const proposal = sanitizeTemplateProposal({
      name: "Control de hipertensión",
      sections: [
        { label: "Motivo de consulta", required: true },
        { label: "Cifras tensionales" },
        { label: "Plan" },
      ],
    });
    const draft = proposalToDraft(proposal!, "cardiologia");
    expect(draft.specialty).toBe("cardiologia");
    expect(draft.sections).toHaveLength(3);

    // El camino completo: borrador → bloques del editor → payload del backend.
    // Es lo que garantiza que foto y texto convergen en el mismo sitio.
    const blocks = draft.sections.map((section) =>
      createBlock({
        label: typeof section === "string" ? section : section.label,
        required: typeof section === "string" ? false : section.required === true,
        instruction:
          typeof section === "string" ? "" : (section.instruction ?? ""),
      }),
    );
    expect(validateBlocks(blocks).ok).toBe(true);
    const payload = buildTemplatePayload({
      name: draft.name,
      specialtyCode: draft.specialty,
      blocks,
    });
    // buildTemplatePayload antepone la casilla de identificación del paciente.
    expect(payload.sections.length).toBe(4);
  });
});
