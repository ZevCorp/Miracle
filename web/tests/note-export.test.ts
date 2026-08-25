// Exportación de nota a historia clínica — lado Miracle Notes.
//
// Lo que estas pruebas protegen (y que un cambio descuidado rompería en silencio):
//   · Pedir la exportación NUNCA se anuncia como "exportada".
//   · Un doble clic (o dos pestañas) termina en UN trabajo, no en un error ni en
//     dos escrituras en la historia clínica.
//   · La consulta sigue en `aprobada` hasta que hay confirmación de éxito.
//   · Los textos de estado dicen la verdad en cada fase.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// El API client lee la sesión de Supabase; aquí se sustituye por un stub.
const getSessionMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getSession: getSessionMock } }),
}));

import {
  CLINICAL_ERROR_MESSAGES,
  ClinicalApiError,
  cancelNoteExport,
  createNoteExport,
  getNoteExport,
  isNoteExportRetryable,
  isNoteExportTerminal,
  retryNoteExport,
  type NoteExport,
  type NoteExportStatus,
} from "@/lib/api/clinical";
import {
  NOTE_EXPORT_DETAIL_MESSAGES,
  noteExportLabel,
  STALE_PENDING_MS,
} from "@/lib/hooks/useNoteExport";

const CONSULTATION_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddd01";
const EXPORT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01";

function job(overrides: Partial<NoteExport> = {}): NoteExport {
  return {
    id: EXPORT_ID,
    consultation_id: CONSULTATION_ID,
    status: "pending",
    attempts: 0,
    workflow_id: "wf-sap-hc",
    error_code: null,
    hash_source: "firma",
    result_summary: null,
    claimed_by: null,
    lease_expires_at: null,
    created_at: new Date().toISOString(),
    claimed_at: null,
    finished_at: null,
    updated_at: null,
    attempt_history: [],
    ...overrides,
  };
}

const fetchMock = vi.fn();

function jsonResponse(status: number, payload: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

describe("estados terminales y reintentables", () => {
  const cases: Array<[NoteExportStatus, boolean, boolean]> = [
    // status, terminal, reintentable
    ["pending", false, false],
    ["claimed", false, false],
    ["completed", true, false],
    ["failed", true, true],
    ["needs_doctor", true, true],
    ["cancelled", true, true],
  ];

  it.each(cases)("%s → terminal=%s reintentable=%s", (status, terminal, retryable) => {
    expect(isNoteExportTerminal(status)).toBe(terminal);
    expect(isNoteExportRetryable(status)).toBe(retryable);
  });

  it("un trabajo completado NO es reintentable (reintentarlo duplicaría la nota en el HIS)", () => {
    expect(isNoteExportRetryable("completed")).toBe(false);
  });

  it("sin trabajo, nada es terminal ni reintentable", () => {
    expect(isNoteExportTerminal(null)).toBe(false);
    expect(isNoteExportRetryable(undefined)).toBe(false);
  });
});

describe("textos de estado", () => {
  it("sin trabajo no afirma nada sobre la historia clínica", () => {
    const { badge, detail } = noteExportLabel(null);
    expect(badge).toBe("Sin enviar");
    expect(detail).not.toMatch(/exportada a la historia/i);
  });

  it("en cola dice que se está enviando, NUNCA que ya se exportó", () => {
    const { badge, tone, detail } = noteExportLabel(job({ status: "pending" }));
    expect(badge).toBe("En cola");
    expect(tone).toBe("info");
    expect(detail).toMatch(/enviando/i);
    expect(detail).not.toMatch(/exportada/i);
  });

  it("si lleva demasiado en cola, sugiere que el asistente no está encendido", () => {
    const stale = job({
      status: "pending",
      created_at: new Date(Date.now() - STALE_PENDING_MS - 1000).toISOString(),
    });
    expect(noteExportLabel(stale).detail).toMatch(/encendido/i);
  });

  it("en proceso habla del asistente registrando, no de un hecho consumado", () => {
    const { badge, detail } = noteExportLabel(job({ status: "claimed" }));
    expect(badge).toBe("En proceso");
    expect(detail).toMatch(/registrando/i);
    expect(detail).not.toMatch(/^Exportada/);
  });

  it("solo completed dice 'Exportada', y muestra el folio si vino", () => {
    const done = job({
      status: "completed",
      result_summary: { outcome: "ok", folio: "HC-2026-001", unresolved_fields: [], detail_code: null },
    });
    const { badge, tone, detail } = noteExportLabel(done);
    expect(badge).toBe("Exportada");
    expect(tone).toBe("success");
    expect(detail).toContain("HC-2026-001");
  });

  it("needs_doctor enumera los campos que faltaron", () => {
    const needs = job({
      status: "needs_doctor",
      result_summary: {
        outcome: "needs_doctor",
        folio: null,
        unresolved_fields: ["Servicio", "Fecha de egreso"],
        detail_code: null,
      },
    });
    const { badge, tone, detail } = noteExportLabel(needs);
    expect(badge).toBe("Requiere acción");
    expect(tone).toBe("warning");
    expect(detail).toContain("Servicio");
    expect(detail).toContain("Fecha de egreso");
  });

  it("failed ofrece reintentar e incluye el código de error (sin PHI)", () => {
    const { badge, tone, detail } = noteExportLabel(
      job({ status: "failed", error_code: "HIS_LOGIN_FAILED" }),
    );
    expect(badge).toBe("Error");
    expect(tone).toBe("danger");
    expect(detail).toContain("HIS_LOGIN_FAILED");
    expect(detail).toMatch(/reintentar/i);
  });

  // El fallo del 2026-08-25: el ejecutor sabía que SAP no tenía sesión activa y el
  // portal solo enseñaba «EXECUTOR_ERROR». El detalle YA venía en el payload.
  it("un fallo con detail_code explica QUÉ falló, no solo que falló", () => {
    const { detail } = noteExportLabel(job({
      status: "failed",
      error_code: "EXECUTOR_ERROR",
      result_summary: {
        outcome: "error", folio: null, unresolved_fields: [], detail_code: "NAVEGACION_FALLIDA",
      },
    }));
    // El código sigue visible (es lo que se busca en el log del equipo)...
    expect(detail).toContain("NAVEGACION_FALLIDA");
    // ...y ya no se queda en el genérico del servidor.
    expect(detail).not.toBe("La exportación falló (EXECUTOR_ERROR). Puedes reintentarla.");
    expect(detail).toMatch(/sesión iniciada/i);
  });

  it("un detail_code desconocido se enseña en crudo en vez de perderse", () => {
    const { detail } = noteExportLabel(job({
      status: "failed",
      error_code: "EXECUTOR_ERROR",
      result_summary: {
        outcome: "error", folio: null, unresolved_fields: [], detail_code: "ALGO_NUEVO",
      },
    }));
    expect(detail).toContain("ALGO_NUEVO");
  });

  it("sin detail_code se conserva el comportamiento de antes", () => {
    const { detail } = noteExportLabel(job({ status: "failed", error_code: "HIS_LOGIN_FAILED" }));
    expect(detail).toContain("HIS_LOGIN_FAILED");
    expect(detail).toMatch(/reintentar/i);
  });

  it("needs_doctor sin lista de campos usa el detalle del ejecutor si lo hay", () => {
    const { badge, detail } = noteExportLabel(job({
      status: "needs_doctor",
      result_summary: {
        outcome: "needs_doctor", folio: null, unresolved_fields: [], detail_code: "PANTALLA_INESPERADA",
      },
    }));
    expect(badge).toBe("Requiere acción");
    expect(detail).toContain("PANTALLA_INESPERADA");
  });

  it("ningún texto de detalle afirma que la nota quedó exportada", () => {
    for (const mensaje of Object.values(NOTE_EXPORT_DETAIL_MESSAGES)) {
      expect(mensaje).not.toMatch(/exportad/i);
    }
  });

  it("ningún estado no-completado usa la palabra 'Exportada' como badge", () => {
    const noTerminados: NoteExportStatus[] = ["pending", "claimed", "needs_doctor", "failed", "cancelled"];
    for (const status of noTerminados) {
      expect(noteExportLabel(job({ status })).badge).not.toBe("Exportada");
    }
  });
});

describe("cliente de exportación (contra el contrato de Graph)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://graph.test");
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

  it("createNoteExport pide el trabajo con el JWT del médico y devuelve pending", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { export: job() }));

    const result = await createNoteExport(CONSULTATION_ID);

    expect(result.duplicate).toBe(false);
    expect(result.export.status).toBe("pending");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.test/api/clinical/exports");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jwt-abc");
    expect(JSON.parse(init.body as string)).toEqual({ consultation_id: CONSULTATION_ID });
  });

  it("DOBLE CLIC: el 409 de duplicado se resuelve al MISMO trabajo, no a un error", async () => {
    // Primer clic ya creó el trabajo; el segundo recibe 409.
    fetchMock
      .mockResolvedValueOnce(jsonResponse(409, {
        error: { code: "EXPORT_ALREADY_EXISTS", message: "Ya existe una exportación." },
        export: job({ status: "claimed" }),
      }))
      // …y el cliente relee el estado real del trabajo existente.
      .mockResolvedValueOnce(jsonResponse(200, {
        export: job({ status: "claimed", attempts: 1 }),
        consultation_estado: "aprobada",
      }));

    const result = await createNoteExport(CONSULTATION_ID);

    expect(result.duplicate).toBe(true);
    expect(result.export.id).toBe(EXPORT_ID);
    expect(result.export.status).toBe("claimed");
    // Dos llamadas: el POST rechazado y el GET de reconciliación. Nunca un
    // segundo POST que crearía otro trabajo.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].method).toBe("GET");
  });

  it("si el 409 llega y el trabajo ya no existe, el error se propaga (no se inventa éxito)", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(409, {
        error: { code: "EXPORT_ALREADY_EXISTS", message: "Ya existe." },
      }))
      .mockResolvedValueOnce(jsonResponse(200, { export: null, consultation_estado: "aprobada" }));

    await expect(createNoteExport(CONSULTATION_ID)).rejects.toBeInstanceOf(ClinicalApiError);
  });

  it("un hash que no coincide con la firma se propaga con mensaje claro", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(422, {
      error: { code: "SIGNATURE_HASH_MISMATCH", message: "no coincide" },
    }));

    await expect(createNoteExport(CONSULTATION_ID)).rejects.toMatchObject({
      code: "SIGNATURE_HASH_MISMATCH",
      friendlyMessage: CLINICAL_ERROR_MESSAGES.SIGNATURE_HASH_MISMATCH,
    });
    // Un solo POST: no se reintenta ni se consulta estado tras un rechazo de validación.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("una nota no aprobada no se exporta y el mensaje lo explica", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(409, {
      error: { code: "CONSULTATION_NOT_APPROVED", message: "no aprobada" },
    }));

    await expect(createNoteExport(CONSULTATION_ID)).rejects.toMatchObject({
      code: "CONSULTATION_NOT_APPROVED",
      friendlyMessage: CLINICAL_ERROR_MESSAGES.CONSULTATION_NOT_APPROVED,
    });
  });

  it("getNoteExport recupera el estado tras recargar, incluido el de la consulta", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      export: job({
        status: "completed",
        result_summary: { outcome: "ok", folio: "HC-9", unresolved_fields: [], detail_code: null },
      }),
      consultation_estado: "exportada",
    }));

    const state = await getNoteExport(CONSULTATION_ID);

    expect(state.export?.status).toBe("completed");
    expect(state.consultation_estado).toBe("exportada");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://graph.test/api/clinical/exports?consultation_id=${CONSULTATION_ID}`);
    expect(init.method).toBe("GET");
  });

  it("una consulta sin exportación devuelve export null y sigue aprobada", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      export: null,
      consultation_estado: "aprobada",
    }));

    const state = await getNoteExport(CONSULTATION_ID);
    expect(state.export).toBeNull();
    expect(state.consultation_estado).toBe("aprobada");
  });

  it("retryNoteExport reencola el MISMO trabajo por su id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      export: job({ status: "pending", attempts: 1 }),
      idempotent: false,
    }));

    const result = await retryNoteExport(EXPORT_ID);

    expect(result.export.status).toBe("pending");
    // attempts se conserva: es historia, no se resetea.
    expect(result.export.attempts).toBe(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://graph.test/api/clinical/exports/${EXPORT_ID}/retry`);
    expect(init.method).toBe("POST");
  });

  it("no se puede reintentar un trabajo ya completado", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(409, {
      error: { code: "EXPORT_NOT_RETRYABLE", message: "ya exportada" },
    }));

    await expect(retryNoteExport(EXPORT_ID)).rejects.toMatchObject({
      code: "EXPORT_NOT_RETRYABLE",
    });
  });

  it("cancelNoteExport llama a la ruta de cancelación del trabajo", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      export: job({ status: "cancelled" }),
      idempotent: false,
    }));

    const result = await cancelNoteExport(EXPORT_ID);

    expect(result.export.status).toBe("cancelled");
    expect(fetchMock.mock.calls[0][0]).toBe(`https://graph.test/api/clinical/exports/${EXPORT_ID}/cancel`);
  });

  it("un fallo de red no se confunde con un fallo de exportación", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));

    await expect(createNoteExport(CONSULTATION_ID)).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });

  it("todos los códigos de exportación tienen mensaje amigable", () => {
    const codigos = [
      "CONSULTATION_NOT_FOUND",
      "CONSULTATION_NOT_APPROVED",
      "CONSULTATION_NOT_SIGNED",
      "CONSULTATION_ALREADY_EXPORTED",
      "CONSULTATION_IS_DEMO",
      "SIGNATURE_HASH_MISMATCH",
      "EXPORT_FORBIDDEN",
      "EXPORT_NOT_FOUND",
      "EXPORT_ALREADY_EXISTS",
      "EXPORT_NOT_RETRYABLE",
      "EXPORT_NOT_CANCELLABLE",
      "EXPORT_INVALID",
      "WORKFLOW_NOT_CONFIGURED",
    ];
    for (const code of codigos) {
      expect(CLINICAL_ERROR_MESSAGES[code], `falta mensaje para ${code}`).toBeTruthy();
      // Ningún mensaje de error puede afirmar que la nota quedó exportada.
      expect(CLINICAL_ERROR_MESSAGES[code]).not.toMatch(/se exportó correctamente/i);
    }
  });
});
