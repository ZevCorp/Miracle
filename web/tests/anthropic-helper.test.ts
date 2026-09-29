import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reportAiUsage: vi.fn<(report: Record<string, unknown>) => Promise<void>>(
    async () => undefined,
  ),
  reportError: vi.fn<(error: unknown, context?: Record<string, unknown>) => void>(),
}));

vi.mock("@/lib/ai-usage", () => ({
  reportAiUsage: mocks.reportAiUsage,
  anthropicUsage: (usage: { input_tokens?: number; output_tokens?: number } | undefined) => ({
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cachedInputTokens: 0,
  }),
}));
vi.mock("@/lib/observability", () => ({ reportError: mocks.reportError }));

import {
  anthropicApiKey,
  anthropicModel,
  callAnthropicJson,
  DATA_NOT_INSTRUCTIONS,
  extractJsonObject,
  failureStatus,
  ANTHROPIC_DEFAULT_MODEL,
} from "@/lib/ai/anthropic";

const fetchMock = vi.fn();

function messagesResponse(status: number, text: string, extra: Record<string, unknown> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({
      id: "msg_1",
      model: "claude-sonnet-4-6-20260101",
      content: [{ type: "text", text }],
      usage: { input_tokens: 120, output_tokens: 30 },
      ...extra,
    }),
  } as Response;
}

const baseRequest = {
  system: "Devuelve JSON.",
  content: "hola",
  maxTokens: 500,
  feature: "snippet_categorization",
  userId: "user-1",
  route: "snippets/categorize",
};

describe("helper de Anthropic", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubEnv("ANTHROPIC_MODEL", "");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    mocks.reportAiUsage.mockClear();
    mocks.reportError.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("resuelve clave y modelo desde el entorno", () => {
    expect(anthropicApiKey()).toBe("sk-test");
    expect(anthropicModel()).toBe(ANTHROPIC_DEFAULT_MODEL);
    vi.stubEnv("ANTHROPIC_MODEL", " claude-opus-5 ");
    expect(anthropicModel()).toBe("claude-opus-5");
    vi.stubEnv("ANTHROPIC_API_KEY", "   ");
    expect(anthropicApiKey()).toBeNull();
  });

  it("manda system, temperature 0, timeout y cabeceras; devuelve el JSON parseado", async () => {
    fetchMock.mockResolvedValueOnce(messagesResponse(200, '```json\n{"atajos":[{"id":"a"}]}\n```'));
    const result = await callAnthropicJson(baseRequest);
    expect(result).toEqual({
      ok: true,
      parsed: { atajos: [{ id: "a" }] },
      requestId: "msg_1",
      model: "claude-sonnet-4-6-20260101",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-test");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe(ANTHROPIC_DEFAULT_MODEL);
    expect(body.temperature).toBe(0);
    expect(body.max_tokens).toBe(500);
    expect(body.system).toBe("Devuelve JSON.");
    expect(body.messages).toEqual([{ role: "user", content: "hola" }]);
    expect(init.signal).toBeInstanceOf(AbortSignal);

    expect(mocks.reportAiUsage).toHaveBeenCalledTimes(1);
    const report = mocks.reportAiUsage.mock.calls[0][0];
    expect(report).toMatchObject({
      userId: "user-1",
      feature: "snippet_categorization",
      provider: "anthropic",
      status: "ok",
      servedModel: "claude-sonnet-4-6-20260101",
      providerRequestId: "msg_1",
      inputTokens: 120,
      outputTokens: 30,
    });
  });

  it("acepta bloques de imagen y una temperature explícita", async () => {
    fetchMock.mockResolvedValueOnce(messagesResponse(200, '{"citas":[]}'));
    await callAnthropicJson({
      ...baseRequest,
      temperature: 0.3,
      content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: "AAAA" } },
        { type: "text", text: "Extrae." },
      ],
    });
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.temperature).toBe(0.3);
    expect(body.messages[0].content).toHaveLength(2);
    expect(body.messages[0].content[0].type).toBe("image");
  });

  it("error del proveedor → reason anthropic, consumo en error sin cifras, 502", async () => {
    fetchMock.mockResolvedValueOnce(messagesResponse(529, ""));
    const result = await callAnthropicJson(baseRequest);
    expect(result).toEqual({ ok: false, reason: "anthropic", status: 529 });
    expect(failureStatus(result as { reason: "anthropic" })).toBe(502);
    const report = mocks.reportAiUsage.mock.calls[0][0];
    expect(report).toMatchObject({ status: "error", errorCode: "http_529", inputTokens: 0, outputTokens: 0 });
    expect(mocks.reportError).toHaveBeenCalledTimes(1);
  });

  it("respuesta sin JSON → reason parse, pero el consumo sí se reporta", async () => {
    fetchMock.mockResolvedValueOnce(messagesResponse(200, "No puedo con esto."));
    const result = await callAnthropicJson(baseRequest);
    expect(result).toEqual({ ok: false, reason: "parse" });
    expect(failureStatus(result as { reason: "parse" })).toBe(502);
    expect(mocks.reportAiUsage).toHaveBeenCalledTimes(1);
    expect(mocks.reportAiUsage.mock.calls[0][0].status).toBe("ok");
    // El texto del modelo nunca viaja a observabilidad.
    const errorArgs = JSON.stringify(mocks.reportError.mock.calls);
    expect(errorArgs).not.toContain("No puedo con esto");
  });

  it("un array como raíz también es parse", async () => {
    fetchMock.mockResolvedValueOnce(messagesResponse(200, "[1,2]"));
    expect(await callAnthropicJson(baseRequest)).toEqual({ ok: false, reason: "parse" });
  });

  it("fallo de red → reason network, 500, sin reporte de consumo", async () => {
    fetchMock.mockRejectedValueOnce(new Error("socket hang up"));
    const result = await callAnthropicJson(baseRequest);
    expect(result).toEqual({ ok: false, reason: "network" });
    expect(failureStatus(result as { reason: "network" })).toBe(500);
    expect(mocks.reportAiUsage).not.toHaveBeenCalled();
    expect(mocks.reportError).toHaveBeenCalledTimes(1);
  });

  it("sin clave lanza: las rutas deben comprobar anthropicApiKey() antes", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    await expect(callAnthropicJson(baseRequest)).rejects.toThrow(/ANTHROPIC_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("extractJsonObject: fences anclados y texto alrededor; un fence dentro de un valor no se toca", () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJsonObject('Claro: {"a":1} listo')).toBe('{"a":1}');
    expect(extractJsonObject('{"a":"x ``` y"}')).toBe('{"a":"x ``` y"}');
    expect(extractJsonObject("sin json")).toBeNull();
  });

  it("DATA_NOT_INSTRUCTIONS declara el contenido del usuario como dato", () => {
    expect(DATA_NOT_INSTRUCTIONS).toMatch(/LÍMITE DE ROL/);
    expect(DATA_NOT_INSTRUCTIONS).toMatch(/nunca una instrucción/);
  });
});
