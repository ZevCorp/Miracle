import { describe, expect, it } from "vitest";
import {
  MicSilentError,
  assertMicrophoneDelivers,
  probeMicrophoneSignal,
  watchMicrophoneDrop,
} from "@/lib/stt/mic-health";
import { dictationErrorMessage, DICTATION_MESSAGES } from "@/lib/stt/messages";

type FakeTrack = {
  readyState: "live" | "ended";
  muted: boolean;
  listeners: Record<string, Array<() => void>>;
  addEventListener(type: string, fn: () => void): void;
  removeEventListener(type: string, fn: () => void): void;
  emit(type: string): void;
};

function makeTrack(overrides: Partial<Pick<FakeTrack, "readyState" | "muted">> = {}): FakeTrack {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    readyState: overrides.readyState ?? "live",
    muted: overrides.muted ?? false,
    listeners,
    addEventListener(type, fn) {
      (listeners[type] ??= []).push(fn);
    },
    removeEventListener(type, fn) {
      listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn);
    },
    emit(type) {
      for (const fn of listeners[type] ?? []) fn();
    },
  };
}

function makeStream(track: FakeTrack | null): MediaStream {
  return { getAudioTracks: () => (track ? [track] : []) } as unknown as MediaStream;
}

/** AudioContext falso cuyo analizador rellena el buffer con `sample`. */
function makeContext(sample: number, state: AudioContextState = "running") {
  let closed = false;
  const ctx = {
    get state() {
      return state;
    },
    resume: async () => {},
    close: async () => {
      closed = true;
    },
    createMediaStreamSource: () => ({ connect() {}, disconnect() {} }),
    createAnalyser: () => ({
      fftSize: 2048,
      getFloatTimeDomainData(buf: Float32Array) {
        buf.fill(sample);
      },
    }),
    wasClosed: () => closed,
  };
  return ctx as unknown as AudioContext & { wasClosed: () => boolean };
}

// Reloj virtual: avanza sólo cuando la sonda espera, para que el test no dure
// los 600 ms reales de la ventana de análisis.
function fakeClock() {
  let t = 0;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      t += ms;
    },
  };
}

describe("probeMicrophoneSignal", () => {
  it("acepta un micrófono con señal, aunque sea muy baja", async () => {
    const clock = fakeClock();
    const result = await probeMicrophoneSignal(makeStream(makeTrack()), 600, {
      createAudioContext: () => makeContext(0.00001),
      ...clock,
    });
    expect(result.ok).toBe(true);
    expect(result.reason).toBe("ok");
    expect(result.peak).toBeGreaterThan(0);
  });

  it("rechaza un micrófono que abre pero entrega silencio digital exacto", async () => {
    const clock = fakeClock();
    const result = await probeMicrophoneSignal(makeStream(makeTrack()), 600, {
      createAudioContext: () => makeContext(0),
      ...clock,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no_signal");
    expect(result.windows).toBeGreaterThanOrEqual(3);
  });

  it("detecta la pista ya muerta o silenciada sin abrir contexto de audio", async () => {
    const ended = await probeMicrophoneSignal(makeStream(makeTrack({ readyState: "ended" })));
    expect(ended).toMatchObject({ ok: false, reason: "track_ended" });

    const muted = await probeMicrophoneSignal(makeStream(makeTrack({ muted: true })));
    expect(muted).toMatchObject({ ok: false, reason: "track_muted" });

    const none = await probeMicrophoneSignal(makeStream(null));
    expect(none).toMatchObject({ ok: false, reason: "no_track" });
  });

  it("NO bloquea la grabación cuando la sonda no puede concluir", async () => {
    const clock = fakeClock();
    // Contexto suspendido (política de autoplay): sin veredicto fiable.
    const suspended = await probeMicrophoneSignal(makeStream(makeTrack()), 600, {
      createAudioContext: () => makeContext(0, "suspended"),
      ...clock,
    });
    expect(suspended).toMatchObject({ ok: true, reason: "inconclusive" });

    // WebAudio que revienta al construirse: tampoco debe impedir grabar.
    const broken = await probeMicrophoneSignal(makeStream(makeTrack()), 600, {
      createAudioContext: () => {
        throw new Error("sin WebAudio");
      },
      ...clock,
    });
    expect(broken).toMatchObject({ ok: true, reason: "inconclusive" });
  });

  it("libera el AudioContext al terminar", async () => {
    const clock = fakeClock();
    const ctx = makeContext(0.5);
    await probeMicrophoneSignal(makeStream(makeTrack()), 600, {
      createAudioContext: () => ctx,
      ...clock,
    });
    expect(ctx.wasClosed()).toBe(true);
  });
});

describe("assertMicrophoneDelivers", () => {
  it("lanza MicSilentError que se traduce al mensaje clínico de micrófono mudo", async () => {
    const clock = fakeClock();
    const failing = assertMicrophoneDelivers(makeStream(makeTrack()), 600, {
      createAudioContext: () => makeContext(0),
      ...clock,
    });
    await expect(failing).rejects.toBeInstanceOf(MicSilentError);

    const error = await failing.catch((e: unknown) => e);
    expect(dictationErrorMessage(error)).toBe(DICTATION_MESSAGES.micSilent);
  });

  it("no lanza cuando hay señal", async () => {
    const clock = fakeClock();
    await expect(
      assertMicrophoneDelivers(makeStream(makeTrack()), 600, {
        createAudioContext: () => makeContext(0.2),
        ...clock,
      }),
    ).resolves.toMatchObject({ ok: true });
  });
});

describe("watchMicrophoneDrop", () => {
  it("avisa si la pista enmudece o muere en mitad de la grabación", () => {
    const track = makeTrack();
    const seen: string[] = [];
    const detach = watchMicrophoneDrop(makeStream(track), (reason) => seen.push(reason));

    track.emit("mute");
    track.emit("ended");
    expect(seen).toEqual(["track_muted", "track_ended"]);

    detach();
    track.emit("mute");
    expect(seen).toHaveLength(2);
  });

  it("es inocuo si el stream no tiene pistas", () => {
    expect(() => watchMicrophoneDrop(makeStream(null), () => {})()).not.toThrow();
  });
});
