import { afterEach, describe, expect, it, vi } from "vitest";
import { createDictation, type VoiceStreamSession } from "@/lib/stt";
import { createSpeakerLabeler, joinDictation } from "@/lib/stt/speaker-turns";
import { transcribeAudioFile } from "@/lib/stt/transcribe-audio-file";

// Spec 070 — quién dijo qué. Soniox marca cada token con su hablante; hasta
// esta spec la web lo guardaba solo para telemetría, separado del texto, y la
// nota recibía un único bloque sin voces. Promesas 604-606.

// ── Un Soniox de mentira: socket que abre solo y deja inyectar mensajes ─────
class FakeSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static last: FakeSocket | null = null;
  readyState = 0;
  bufferedAmount = 0;
  sent: unknown[] = [];
  onSend: ((data: unknown) => void) | null = null;
  private listeners = new Map<string, Array<(event: unknown) => void>>();
  constructor(public url: string) {
    FakeSocket.last = this;
    queueMicrotask(() => {
      this.readyState = FakeSocket.OPEN;
      this.emit("open", {});
    });
  }
  addEventListener(type: string, fn: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  removeEventListener() {}
  send(data: unknown) {
    this.sent.push(data);
    this.onSend?.(data);
  }
  close() {
    this.readyState = FakeSocket.CLOSED;
    this.emit("close", { code: 1000, wasClean: true });
  }
  emit(type: string, event: unknown) {
    for (const fn of this.listeners.get(type) ?? []) fn(event);
  }
  tokens(tokens: object[]) {
    this.emit("message", { data: JSON.stringify({ tokens }) });
  }
}

const SESSION: VoiceStreamSession = {
  provider: "soniox",
  access_token: "tmp",
  auth_scheme: "message",
  expires_in: 60,
  websocket_url: "wss://soniox.test",
  model: "stt-rt-v5",
  language: "es",
  timeslice_ms: 250,
  endpointing_ms: 0,
  start_message: { api_key: "tmp", enable_speaker_diarization: true },
};

// Una consulta de dos voces, partida en tokens como los manda Soniox.
const CONSULTA = [
  { text: "¿Qué ", speaker: "1", is_final: true, start_ms: 0, end_ms: 200 },
  { text: "le pasa?", speaker: "1", is_final: true, start_ms: 200, end_ms: 600 },
  { text: " Me duele", speaker: "2", is_final: true, start_ms: 900, end_ms: 1300 },
  { text: " la cabeza.", speaker: "2", is_final: true, start_ms: 1300, end_ms: 1800 },
  { text: "<end>", is_final: true },
];

afterEach(() => {
  vi.unstubAllGlobals();
  FakeSocket.last = null;
});

describe("604. el motor de dictado entrega los turnos con su texto", () => {
  it("cada frase final de Soniox trae sus turnos {speaker, text}, y el texto de siempre", async () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: async () => ({ active: true, getTracks: () => [], getAudioTracks: () => [] }) },
    });
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported = () => true;
        state = "inactive";
        addEventListener() {}
        start() {
          this.state = "recording";
        }
      },
    );

    const finales: Array<{ transcript: string; turns?: unknown }> = [];
    const engine = createDictation({
      createStreamSession: async () => SESSION,
      onFinalTranscript: (segment) => finales.push(segment),
    });
    await engine.start();
    FakeSocket.last!.tokens(CONSULTA);

    expect(finales).toHaveLength(1);
    expect(finales[0].turns).toEqual([
      { speaker: "1", text: "¿Qué le pasa?" },
      { speaker: "2", text: "Me duele la cabeza." },
    ]);
    // El texto plano no cambia: Graph y la extensión lo siguen leyendo igual.
    expect(finales[0].transcript).toBe("¿Qué le pasa? Me duele la cabeza.");
  });
});

describe("605. el etiquetador marca solo los cambios de voz", () => {
  it("pone [Hablante N] al cambiar de voz, y no repite la etiqueta si sigue la misma", () => {
    const etiquetar = createSpeakerLabeler();
    let texto = "";
    texto = joinDictation(texto, etiquetar([{ speaker: "1", text: "¿Qué le pasa?" }, { speaker: "2", text: "Me duele." }], 0, "x"));
    texto = joinDictation(texto, etiquetar([{ speaker: "2", text: "Desde ayer." }], 0, "x"));
    texto = joinDictation(texto, etiquetar([{ speaker: "1", text: "Vamos a revisar." }], 0, "x"));
    expect(texto).toBe("[Hablante 1] ¿Qué le pasa?\n[Hablante 2] Me duele. Desde ayer.\n[Hablante 1] Vamos a revisar.");
  });

  it("numera por orden de aparición, no con el número de Soniox", () => {
    const etiquetar = createSpeakerLabeler();
    expect(joinDictation("", etiquetar([{ speaker: "3", text: "Hola." }], 0, "x"))).toBe("[Hablante 1] Hola.");
  });

  it("un socket nuevo no se funde con el anterior: Soniox renumera al reconectar", () => {
    const etiquetar = createSpeakerLabeler();
    let texto = joinDictation("", etiquetar([{ speaker: "1", text: "Antes del corte." }], 0, "x"));
    texto = joinDictation(texto, etiquetar([{ speaker: "1", text: "Después del corte." }], 1, "x"));
    expect(texto).toBe("[Hablante 1] Antes del corte.\n[Hablante 2] Después del corte.");
  });

  it("sin diarización (Deepgram, o un motor viejo) el texto va tal cual, sin etiquetas", () => {
    const etiquetar = createSpeakerLabeler();
    expect(etiquetar(undefined, 0, "texto plano")).toBe("texto plano");
    expect(etiquetar([{ speaker: "", text: "texto plano" }], 0, "texto plano")).toBe("texto plano");
    expect(joinDictation("uno", "dos")).toBe("uno dos");
  });
});

describe("606. el archivo subido también lleva sus hablantes", () => {
  it("la transcripción de un audio sale separada por voces", async () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify(SESSION), { status: 200 }));
    const original = globalThis.WebSocket as unknown as typeof FakeSocket;
    vi.stubGlobal(
      "WebSocket",
      class extends original {
        constructor(url: string) {
          super(url);
          // Al recibir el finalize, Soniox suelta lo que tiene.
          this.onSend = (data) => {
            if (typeof data === "string" && data.includes("finalize")) queueMicrotask(() => this.tokens(CONSULTA));
          };
        }
      },
    );

    const archivo = new File([new Uint8Array(1024)], "consulta.webm", { type: "audio/webm" });
    const texto = await transcribeAudioFile(archivo);
    expect(texto).toBe("[Hablante 1] ¿Qué le pasa?\n[Hablante 2] Me duele la cabeza.");
  }, 15_000);
});
