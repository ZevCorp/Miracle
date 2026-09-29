import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mismo stub de sesión Supabase que en clinical-api.test.ts.
const getSessionMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getSession: getSessionMock } }),
}));

import {
  adjustNoteWithAssistant,
  CLINICAL_ERROR_MESSAGES,
  sendAssistantChat,
  type ClinicalNoteJson,
} from "@/lib/api/clinical";
import { dictationErrorMessage, DICTATION_MESSAGES } from "@/lib/stt/messages";

const fetchMock = vi.fn();

function jsonResponse(status: number, payload: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

describe("cliente del asistente clínico", () => {
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

  it("sendAssistantChat llama la ruta del contrato con Bearer y payload completo", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { answer: "Respuesta clínica", mode: "clinical_chat" }),
    );
    const result = await sendAssistantChat({
      message: "¿Dosis de amoxicilina?",
      history: [{ role: "user", content: "hola" }],
      screen_context: { route: "/app/dashboard" },
    });
    expect(result.answer).toBe("Respuesta clínica");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://backend.test/api/clinical/assistant/chat");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer jwt-abc",
    );
    expect(JSON.parse(init.body as string)).toEqual({
      message: "¿Dosis de amoxicilina?",
      history: [{ role: "user", content: "hola" }],
      screen_context: { route: "/app/dashboard" },
    });
  });

  it("adjustNoteWithAssistant envía encounter_id + instruction y devuelve la propuesta", async () => {
    const proposed: ClinicalNoteJson = {
      summary: "Resumen ajustado",
      sections: [{ key: "plan", label: "Plan", content: "Nuevo plan." }],
      warnings: [],
      missing_required_sections: [],
    };
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        proposed_note_json: proposed,
        changed_sections: ["plan"],
        explanation: "Se ajustó el plan.",
        requires_physician_review: true,
      }),
    );
    const result = await adjustNoteWithAssistant({
      encounter_id: "enc-1",
      instruction: "Haz el plan más conciso",
    });
    expect(result.proposed_note_json).toEqual(proposed);
    expect(result.changed_sections).toEqual(["plan"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://backend.test/api/clinical/assistant/note-adjustment");
    expect(JSON.parse(init.body as string)).toEqual({
      encounter_id: "enc-1",
      instruction: "Haz el plan más conciso",
    });
  });

  it("mapea LLM_NOT_CONFIGURED a error amigable", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(503, {
        error: { code: "LLM_NOT_CONFIGURED", message: "no llm" },
      }),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(
        sendAssistantChat({ message: "hola" }),
      ).rejects.toMatchObject({
        code: "LLM_NOT_CONFIGURED",
        friendlyMessage: CLINICAL_ERROR_MESSAGES.LLM_NOT_CONFIGURED,
      });
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("dictationErrorMessage", () => {
  it("mapea errores de permisos de micrófono", () => {
    const err = Object.assign(new Error("denied"), { name: "NotAllowedError" });
    expect(dictationErrorMessage(err)).toBe(DICTATION_MESSAGES.micDenied);
  });

  it("mapea micrófono ausente y ocupado", () => {
    expect(
      dictationErrorMessage(Object.assign(new Error("x"), { name: "NotFoundError" })),
    ).toBe(DICTATION_MESSAGES.micMissing);
    expect(
      dictationErrorMessage(Object.assign(new Error("x"), { name: "NotReadableError" })),
    ).toBe(DICTATION_MESSAGES.micBusy);
  });

  it("mapea fallos de sesión a 'servicio no disponible'", () => {
    expect(
      dictationErrorMessage(new Error("No fue posible iniciar la sesión de transcripción.")),
    ).toBe(DICTATION_MESSAGES.serviceUnavailable);
    expect(
      dictationErrorMessage(new Error("La transcripción en vivo no está configurada.")),
    ).toBe(DICTATION_MESSAGES.serviceUnavailable);
  });

  it("mapea cierres de stream del motor (dicen 'Deepgram' hardcodeado) a conexión perdida", () => {
    expect(
      dictationErrorMessage(new Error("El stream de Deepgram se cerro antes de tiempo.")),
    ).toBe(DICTATION_MESSAGES.connectionLost);
    expect(
      dictationErrorMessage(new Error("No fue posible abrir el stream en Deepgram.")),
    ).toBe(DICTATION_MESSAGES.connectionLost);
  });

  it("desconocidos caen al mensaje genérico", () => {
    expect(dictationErrorMessage(undefined)).toBe(DICTATION_MESSAGES.generic);
    expect(dictationErrorMessage("¿?")).toBe(DICTATION_MESSAGES.generic);
  });
});
