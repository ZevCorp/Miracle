// Verificación de que el micrófono ENTREGA audio, no solo de que "abre".
//
// Por qué existe: `getUserMedia` resuelve, la pista queda `live` y `unmuted`, y
// aun así el dispositivo puede no entregar ni una muestra. Pasa con micrófonos
// USB cuyo driver acepta el stream y nunca bombea datos (verificado en un
// USB2.0 Device secuestrado por Intel Smart Sound: 0 frames en 8 s tanto en modo
// compartido como exclusivo, mientras el micro interno daba 99,8 % de cobertura).
// Sin esta comprobación el motor grababa una consulta entera contra el vacío y
// el médico solo se enteraba a los 45 s por el watchdog de inactividad.
//
// Regla de decisión: un micrófono vivo en una sala en silencio SIEMPRE tiene
// suelo de ruido (pico > 0). El pico exactamente 0.0 sostenido durante cientos
// de milisegundos significa "no llegan muestras", no "hay silencio". Por eso
// solo bloqueamos ante silencio digital exacto y nunca ante nivel bajo.

/** Motivo por el que la sonda dio por bueno o por malo el micrófono. */
export type MicProbeReason =
  | "ok"
  | "no_signal"
  | "no_track"
  | "track_muted"
  | "track_ended"
  | "inconclusive";

export interface MicProbeResult {
  ok: boolean;
  reason: MicProbeReason;
  /** Muestra absoluta más alta observada (0 = silencio digital). */
  peak: number;
  /** Número de ventanas de análisis leídas. */
  windows: number;
}

/** Error tipado para que `dictationErrorMessage` lo distinga de un fallo de permisos. */
export class MicSilentError extends Error {
  readonly reason: MicProbeReason;
  readonly peak: number;

  constructor(reason: MicProbeReason, peak: number) {
    super(`El micrófono no entrega audio (${reason}, pico=${peak}).`);
    this.name = "MicSilentError";
    this.reason = reason;
    this.peak = peak;
  }
}

export interface MicProbeDeps {
  /** Constructor de AudioContext; inyectable para test. */
  createAudioContext?: () => AudioContext;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Se consulta a través de una función para que TypeScript no estreche
// `readyState` a "live" tras la guarda inicial: la pista puede morir durante la
// ventana de análisis, que es justo el caso del USB que se re-enumera.
function isTrackEnded(track: MediaStreamTrack): boolean {
  return track.readyState === "ended";
}

function resolveAudioContextCtor(): (() => AudioContext) | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? () => new Ctor() : null;
}

/**
 * Escucha la pista durante `durationMs` y devuelve el pico observado.
 *
 * Nunca lanza: si la sonda no puede ejecutarse (sin WebAudio, contexto
 * suspendido por política de autoplay, etc.) devuelve `inconclusive` con
 * `ok: true`. Un fallo de la sonda jamás debe impedir grabar.
 */
export async function probeMicrophoneSignal(
  stream: MediaStream,
  durationMs = 600,
  deps: MicProbeDeps = {},
): Promise<MicProbeResult> {
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? (() => Date.now());

  const track = stream?.getAudioTracks?.()[0] ?? null;
  if (!track) return { ok: false, reason: "no_track", peak: 0, windows: 0 };
  if (isTrackEnded(track)) return { ok: false, reason: "track_ended", peak: 0, windows: 0 };
  if (track.muted) return { ok: false, reason: "track_muted", peak: 0, windows: 0 };

  const createContext = deps.createAudioContext ?? resolveAudioContextCtor();
  if (!createContext) return { ok: true, reason: "inconclusive", peak: 0, windows: 0 };

  let ctx: AudioContext | null = null;
  try {
    ctx = createContext();
    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => {});
    }
    if (ctx.state !== "running") {
      return { ok: true, reason: "inconclusive", peak: 0, windows: 0 };
    }

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    // Deliberadamente NO se conecta a ctx.destination: eso devolvería el
    // micrófono por los altavoces y provocaría acople en la consulta.

    const buffer = new Float32Array(analyser.fftSize);
    let peak = 0;
    let windows = 0;
    const deadline = now() + durationMs;
    while (now() < deadline) {
      analyser.getFloatTimeDomainData(buffer);
      windows += 1;
      for (let i = 0; i < buffer.length; i += 1) {
        const v = Math.abs(buffer[i]);
        if (v > peak) peak = v;
      }
      await sleep(20);
    }

    source.disconnect();
    if (isTrackEnded(track)) {
      return { ok: false, reason: "track_ended", peak, windows };
    }
    // Se exige haber leído varias ventanas: con una sola no hay evidencia
    // suficiente para acusar al dispositivo.
    if (peak === 0 && windows >= 3) {
      return { ok: false, reason: "no_signal", peak, windows };
    }
    return { ok: true, reason: peak > 0 ? "ok" : "inconclusive", peak, windows };
  } catch {
    return { ok: true, reason: "inconclusive", peak: 0, windows: 0 };
  } finally {
    await ctx?.close().catch(() => {});
  }
}

/**
 * Igual que `probeMicrophoneSignal` pero lanza `MicSilentError` si el micrófono
 * está conectado y mudo, para cortar el `start()` antes de abrir el socket.
 */
export async function assertMicrophoneDelivers(
  stream: MediaStream,
  durationMs?: number,
  deps?: MicProbeDeps,
): Promise<MicProbeResult> {
  const result = await probeMicrophoneSignal(stream, durationMs, deps);
  if (!result.ok) throw new MicSilentError(result.reason, result.peak);
  return result;
}

/**
 * Vúmetro en vivo: llama a `onLevel` con el pico (0..1) unas 20 veces por
 * segundo hasta que se invoque el desuscriptor que devuelve.
 *
 * Comparte el mismo montaje que `probeMicrophoneSignal` —fuente → analizador,
 * sin conectar a `ctx.destination` para no devolver el micrófono por los
 * altavoces— pero en vez de emitir un veredicto al final va reportando, que es
 * lo que necesita la pantalla de "Probar micrófono": el médico habla y ve la
 * barra moverse. Un veredicto de texto no convence a nadie de que su micrófono
 * está vivo; una barra que responde a su voz, sí.
 *
 * Nunca lanza: si WebAudio no está disponible simplemente no reporta nada.
 */
export function createMicLevelMeter(
  stream: MediaStream,
  onLevel: (peak: number) => void,
  deps: MicProbeDeps = {},
): () => void {
  const createContext = deps.createAudioContext ?? resolveAudioContextCtor();
  if (!createContext) return () => {};

  let cerrado = false;
  let ctx: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  try {
    ctx = createContext();
    void ctx.resume().catch(() => {});
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const buffer = new Float32Array(analyser.fftSize);
    timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buffer);
      let peak = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const v = Math.abs(buffer[i]);
        if (v > peak) peak = v;
      }
      onLevel(peak);
    }, 50);

    return function stop() {
      if (cerrado) return;
      cerrado = true;
      if (timer) clearInterval(timer);
      try {
        source.disconnect();
      } catch {
        /* el contexto ya podía estar cerrándose */
      }
      void ctx?.close().catch(() => {});
    };
  } catch {
    if (timer) clearInterval(timer);
    void ctx?.close().catch(() => {});
    return () => {};
  }
}

/**
 * Avisa si la pista muere o enmudece EN MITAD de la grabación (típico de un USB
 * que se re-enumera). Devuelve el desuscriptor.
 */
export function watchMicrophoneDrop(
  stream: MediaStream,
  onLost: (reason: "track_muted" | "track_ended") => void,
): () => void {
  const track = stream?.getAudioTracks?.()[0] ?? null;
  if (!track) return () => {};
  const onMute = () => onLost("track_muted");
  const onEnded = () => onLost("track_ended");
  track.addEventListener("mute", onMute);
  track.addEventListener("ended", onEnded);
  return () => {
    track.removeEventListener("mute", onMute);
    track.removeEventListener("ended", onEnded);
  };
}
