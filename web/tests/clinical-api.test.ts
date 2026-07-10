import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// El API client importa el cliente de Supabase para leer la sesión; aquí se
// reemplaza por un stub controlable para probar el flujo completo sin red.
const getSessionMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getSession: getSessionMock } }),
}));

import {
  buildClinicalRequest,
  CLINICAL_ERROR_MESSAGES,
  ClinicalApiError,
  createClinicalEncounter,
  friendlyClinicalMessage,
  getClinicalTemplates,
  normalizeSpecialtyCode,
  parseClinicalErrorPayload,
  parseTemplateSectionsInput,
  saveEditedClinicalNote,
  sortedTemplateSections,
  toBackendConsultationType,
  updateNoteSectionContent,
  type ClinicalNoteJson,
} from "@/lib/api/clinical";

/* ------------------------------------------------------------------ */
/* Helpers puros                                                       */
/* ------------------------------------------------------------------ */

describe("parseTemplateSectionsInput", () => {
  it("convierte el textarea (una sección por línea) en un array limpio", () => {
    const raw = [
      "Identificación",
      "Motivo de consulta",
      "  Enfermedad actual  ",
      "",
      "Antecedentes relevantes",
      "Examen físico dirigido",
      "Impresión diagnóstica",
      "Plan y recomendaciones",
    ].join("\n");

    expect(parseTemplateSectionsInput(raw)).toEqual([
      "Identificación",
      "Motivo de consulta",
      "Enfermedad actual",
      "Antecedentes relevantes",
      "Examen físico dirigido",
      "Impresión diagnóstica",
      "Plan y recomendaciones",
    ]);
  });

  it("soporta saltos de línea de Windows y entradas vacías", () => {
    expect(parseTemplateSectionsInput("Uno\r\nDos\r\n\r\n")).toEqual(["Uno", "Dos"]);
    expect(parseTemplateSectionsInput("   \n  \n")).toEqual([]);
  });
});

describe("normalizeSpecialtyCode", () => {
  it("normaliza guiones y acentos al snake_case del backend", () => {
    expect(normalizeSpecialtyCode("medicina-general")).toBe("medicina_general");
    expect(normalizeSpecialtyCode("Ginecología y obstetricia")).toBe(
      "ginecologia_y_obstetricia",
    );
    expect(normalizeSpecialtyCode("medicina_general")).toBe("medicina_general");
  });
});

describe("toBackendConsultationType", () => {
  it("mapea el tipo de la UI al contrato del backend", () => {
    expect(toBackendConsultationType("presencial")).toBe("presencial");
    expect(toBackendConsultationType("telemedicina")).toBe("telemedicina");
    expect(toBackendConsultationType("audio")).toBe("audio_upload");
    expect(toBackendConsultationType("audio_upload")).toBe("audio_upload");
    expect(toBackendConsultationType("desconocido")).toBe("presencial");
  });
});

describe("sortedTemplateSections", () => {
  it("ordena por `order` sin mutar el arreglo original", () => {
    const sections = [
      { key: "b", label: "B", order: 2 },
      { key: "a", label: "A", order: 1 },
    ];
    const sorted = sortedTemplateSections(sections);
    expect(sorted.map((s) => s.key)).toEqual(["a", "b"]);
    expect(sections[0].key).toBe("b");
  });
});

describe("updateNoteSectionContent", () => {
  const note: ClinicalNoteJson = {
    summary: "Resumen",
    sections: [
      {
        key: "motivo_consulta",
        label: "Motivo de consulta",
        content: "Cefalea de 3 días.",
        confidence: 0.92,
        evidence: "cefalea de tres días",
      },
      { key: "plan", label: "Plan", content: "Reposo.", confidence: 0.8 },
    ],
    warnings: ["aviso"],
    missing_required_sections: [],
  };

  it("actualiza solo content y preserva key/label/confidence/evidence", () => {
    const next = updateNoteSectionContent(note, "motivo_consulta", "Cefalea intensa.");
    const edited = next.sections[0];
    expect(edited.content).toBe("Cefalea intensa.");
    expect(edited.key).toBe("motivo_consulta");
    expect(edited.label).toBe("Motivo de consulta");
    expect(edited.confidence).toBe(0.92);
    expect(edited.evidence).toBe("cefalea de tres días");
    // Las demás secciones y metadatos quedan intactos; la original no se muta.
    expect(next.sections[1]).toEqual(note.sections[1]);
    expect(next.warnings).toEqual(["aviso"]);
    expect(note.sections[0].content).toBe("Cefalea de 3 días.");
  });
});

/* ------------------------------------------------------------------ */
/* Construcción de requests y errores                                  */
/* ------------------------------------------------------------------ */

describe("buildClinicalRequest", () => {
  it("agrega Authorization Bearer y arma la URL con query", () => {
    const { url, init } = buildClinicalRequest(
      "https://backend.example.com/",
      "/api/clinical/templates",
      "token-123",
      { query: { specialty: "medicina-general" } },
    );
    expect(url).toBe(
      "https://backend.example.com/api/clinical/templates?specialty=medicina-general",
    );
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer token-123",
    );
    expect(init.body).toBeUndefined();
  });

  it("serializa el body como JSON con Content-Type", () => {
    const { url, init } = buildClinicalRequest(
      "http://localhost:3000",
      "/api/clinical/encounters",
      "tok",
      { method: "POST", body: { consent: true } },
    );
    expect(url).toBe("http://localhost:3000/api/clinical/encounters");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
    expect(init.body).toBe(JSON.stringify({ consent: true }));
  });

  it("omite query params vacíos", () => {
    const { url } = buildClinicalRequest("http://x", "/api/clinical/templates", "t", {
      query: { specialty: undefined },
    });
    expect(url).toBe("http://x/api/clinical/templates");
  });
});

describe("parseClinicalErrorPayload", () => {
  it("lee el envelope estable { error: { code, message } }", () => {
    expect(
      parseClinicalErrorPayload(400, {
        error: { code: "CONSENT_REQUIRED", message: "Falta consentimiento." },
      }),
    ).toEqual({ code: "CONSENT_REQUIRED", message: "Falta consentimiento." });
  });

  it("mapea el formato legacy del middleware de auth a UNAUTHORIZED", () => {
    expect(parseClinicalErrorPayload(401, { error: "Missing token" })).toEqual({
      code: "UNAUTHORIZED",
      message: "Missing token",
    });
  });

  it("usa códigos por defecto según el status cuando no hay envelope", () => {
    expect(parseClinicalErrorPayload(429, null).code).toBe("RATE_LIMITED");
    expect(parseClinicalErrorPayload(500, "boom").code).toBe("INTERNAL_ERROR");
  });
});

describe("ClinicalApiError / friendlyClinicalMessage", () => {
  it("expone el mensaje amigable del código", () => {
    const error = new ClinicalApiError("TRANSCRIPT_REQUIRED", 400);
    expect(error.friendlyMessage).toBe(CLINICAL_ERROR_MESSAGES.TRANSCRIPT_REQUIRED);
    expect(friendlyClinicalMessage(error)).toBe(
      CLINICAL_ERROR_MESSAGES.TRANSCRIPT_REQUIRED,
    );
  });

  it("cae a INTERNAL_ERROR para códigos desconocidos y errores ajenos", () => {
    expect(new ClinicalApiError("ALGO_RARO", 500).friendlyMessage).toBe(
      CLINICAL_ERROR_MESSAGES.INTERNAL_ERROR,
    );
    expect(friendlyClinicalMessage(new Error("x"))).toBe(
      CLINICAL_ERROR_MESSAGES.INTERNAL_ERROR,
    );
  });
});

/* ------------------------------------------------------------------ */
/* Funciones del API client (fetch + sesión simulados)                 */
/* ------------------------------------------------------------------ */

const fetchMock = vi.fn();

function jsonResponse(status: number, payload: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

describe("API client (requests reales al contrato)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://backend.test");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "jwt-abc" } },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("getClinicalTemplates llama la ruta del contrato con Bearer y desanida templates", () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { templates: [{ id: "t1", name: "X", specialty: "s", sections: [] }] }),
    );
    return getClinicalTemplates({ specialty: "medicina-general" }).then((templates) => {
      expect(templates).toHaveLength(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(
        "https://backend.test/api/clinical/templates?specialty=medicina-general",
      );
      expect((init.headers as Record<string, string>).Authorization).toBe(
        "Bearer jwt-abc",
      );
    });
  });

  it("createClinicalEncounter envía template_id real y consent", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(201, { encounter_id: "enc_1", status: "created", template: {} }),
    );
    const result = await createClinicalEncounter({
      patient_id: null,
      consultation_type: "presencial",
      template_id: "tpl-uuid-real",
      consent: true,
    });
    expect(result.encounter_id).toBe("enc_1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://backend.test/api/clinical/encounters");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      patient_id: null,
      consultation_type: "presencial",
      template_id: "tpl-uuid-real",
      consent: true,
    });
  });

  it("saveEditedClinicalNote manda el note_json completo por PUT", async () => {
    const note: ClinicalNoteJson = {
      summary: "Resumen",
      sections: [
        { key: "plan", label: "Plan", content: "Reposo.", confidence: 1 },
      ],
      warnings: [],
      missing_required_sections: [],
    };
    fetchMock.mockResolvedValue(
      jsonResponse(200, { encounter_id: "enc_1", status: "completed", note_json: note }),
    );
    const result = await saveEditedClinicalNote("enc_1", note);
    expect(result.status).toBe("completed");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://backend.test/api/clinical/encounters/enc_1/note");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ note_json: note });
  });

  it("convierte errores del backend en ClinicalApiError con mensaje amigable", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: { code: "CONSENT_REQUIRED", message: "consent debe ser true" },
      }),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const promise = createClinicalEncounter({
        patient_id: null,
        consultation_type: "presencial",
        template_id: "tpl",
        consent: false,
      });
      await expect(promise).rejects.toMatchObject({
        code: "CONSENT_REQUIRED",
        friendlyMessage: CLINICAL_ERROR_MESSAGES.CONSENT_REQUIRED,
      });
    } finally {
      consoleError.mockRestore();
    }
  });

  it("marca ENCOUNTER_COMPLETED cuando el backend responde 409", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        error: { code: "ENCOUNTER_INVALID", message: "encounter completado" },
      }),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(
        saveEditedClinicalNote("enc_1", {
          summary: "",
          sections: [],
          warnings: [],
          missing_required_sections: [],
        }),
      ).rejects.toMatchObject({ code: "ENCOUNTER_COMPLETED", status: 409 });
    } finally {
      consoleError.mockRestore();
    }
  });

  it("sin sesión lanza UNAUTHORIZED sin llamar al backend", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    await expect(getClinicalTemplates()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sin NEXT_PUBLIC_API_BASE_URL lanza API_NOT_CONFIGURED", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    await expect(getClinicalTemplates()).rejects.toMatchObject({
      code: "API_NOT_CONFIGURED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("respuestas sin JSON no rompen la UI: error normalizado", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(getClinicalTemplates()).rejects.toMatchObject({
        code: "INTERNAL_ERROR",
        status: 502,
      });
    } finally {
      consoleError.mockRestore();
    }
  });

  it("errores de red se reportan como NETWORK_ERROR amigable", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(getClinicalTemplates()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      friendlyMessage: CLINICAL_ERROR_MESSAGES.NETWORK_ERROR,
    });
  });
});
