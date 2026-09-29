import type { VoiceStreamSession } from "./index";

export const MAX_AUDIO_UPLOAD_BYTES = 100 * 1024 * 1024;

const ACCEPTED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
]);

const ACCEPTED_AUDIO_EXTENSIONS = /\.(mp3|m4a|mp4|wav|webm|ogg)$/i;

export function validateAudioUpload(file: Pick<File, "name" | "size" | "type">): string | null {
  if (!file.size) return "El archivo está vacío.";
  if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
    return "La grabación supera 100 MB. Divide el archivo o usa una versión más liviana.";
  }
  if (!ACCEPTED_AUDIO_TYPES.has(file.type.toLowerCase()) && !ACCEPTED_AUDIO_EXTENSIONS.test(file.name)) {
    return "Formato no compatible. Usa MP3, M4A, MP4, WAV, WebM u OGG.";
  }
  return null;
}

async function fetchStreamSession(): Promise<VoiceStreamSession> {
  const response = await fetch("/api/stt/session", { method: "POST" });
  const payload = (await response.json().catch(() => null)) as
    | (VoiceStreamSession & { error?: string })
    | null;
  if (!response.ok || !payload || typeof payload.websocket_url !== "string") {
    throw new Error(payload?.error ?? "No fue posible iniciar la transcripción del archivo.");
  }
  return payload;
}

function isSonioxSession(session: VoiceStreamSession): boolean {
  return session.provider === "soniox" || session.auth_scheme === "message";
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new DOMException("Carga cancelada", "AbortError"));
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Carga cancelada", "AbortError"));
    };
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Envía una grabación al mismo stream temporal usado por el micrófono.
 * El archivo nunca se persiste en Miracle Web: solo viaja al proveedor STT
 * mediante la URL efímera y la página conserva únicamente la transcripción.
 */
export async function transcribeAudioFile(
  file: File,
  options: { signal?: AbortSignal; onProgress?: (progress: number) => void } = {},
): Promise<string> {
  const validationError = validateAudioUpload(file);
  if (validationError) throw new Error(validationError);

  const session = await fetchStreamSession();
  const soniox = isSonioxSession(session);
  const socket = soniox
    ? new WebSocket(session.websocket_url)
    : new WebSocket(session.websocket_url, [session.auth_scheme || "bearer", session.access_token]);

  const finalSegments: string[] = [];
  let sonioxBuffer = "";
  let latestPartial = "";
  let lastMessageAt = Date.now();
  let providerError: string | null = null;

  const closeSocket = () => {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
  };
  const abort = () => closeSocket();
  options.signal?.addEventListener("abort", abort, { once: true });

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("La conexión de transcripción tardó demasiado.")), 20_000);
      socket.addEventListener(
        "open",
        () => {
          window.clearTimeout(timeout);
          if (soniox) {
            if (!session.start_message) {
              reject(new Error("La sesión de transcripción no incluyó su configuración."));
              return;
            }
            socket.send(JSON.stringify(session.start_message));
          }
          resolve();
        },
        { once: true },
      );
      socket.addEventListener(
        "error",
        () => {
          window.clearTimeout(timeout);
          reject(new Error("No fue posible conectar con el servicio de transcripción."));
        },
        { once: true },
      );
    });

    socket.addEventListener("message", (event) => {
      lastMessageAt = Date.now();
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(String(event.data)) as Record<string, unknown>;
      } catch {
        return;
      }

      if (soniox) {
        if (payload.error_message) {
          providerError = "El proveedor no pudo procesar esta grabación.";
          return;
        }
        const tokens = Array.isArray(payload.tokens) ? payload.tokens : [];
        let nonFinal = "";
        let boundary = false;
        for (const rawToken of tokens) {
          const token = rawToken as { text?: unknown; is_final?: unknown };
          const text = typeof token.text === "string" ? token.text : "";
          if (!text) continue;
          if (token.is_final) {
            if (text === "<end>" || text === "<fin>") boundary = true;
            else sonioxBuffer += text;
          } else nonFinal += text;
        }
        latestPartial = `${sonioxBuffer}${nonFinal}`.trim();
        if (boundary && sonioxBuffer.trim()) {
          finalSegments.push(sonioxBuffer.trim());
          sonioxBuffer = "";
          latestPartial = "";
        }
        return;
      }

      const channel = payload.channel as { alternatives?: Array<{ transcript?: unknown }> } | undefined;
      const transcript = channel?.alternatives?.[0]?.transcript;
      if (typeof transcript !== "string" || !transcript.trim()) return;
      latestPartial = transcript.trim();
      if (payload.is_final) {
        finalSegments.push(transcript.trim());
        latestPartial = "";
      }
    });

    const chunkSize = 64 * 1024;
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      if (options.signal?.aborted) throw new DOMException("Carga cancelada", "AbortError");
      // Backpressure: el chequeo de readyState va DENTRO del while — si el
      // socket se cierra con el buffer lleno, bufferedAmount no drena y el
      // bucle giraría para siempre sin esta guarda.
      while (socket.bufferedAmount > chunkSize * 8) {
        if (socket.readyState !== WebSocket.OPEN) {
          throw new Error("La conexión se cerró durante la carga.");
        }
        await delay(15, options.signal);
      }
      const chunk = await file.slice(offset, Math.min(offset + chunkSize, file.size)).arrayBuffer();
      if (socket.readyState !== WebSocket.OPEN) throw new Error("La conexión se cerró durante la carga.");
      socket.send(chunk);
      options.onProgress?.(Math.min(90, Math.round(((offset + chunk.byteLength) / file.size) * 90)));
      await delay(2, options.signal);
    }

    options.onProgress?.(94);
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: soniox ? "finalize" : "Finalize" }));
      if (soniox) socket.send(new ArrayBuffer(0));
    }

    // El proveedor transcribe a ~tiempo real: un audio largo deja un backlog
    // que puede tardar minutos en drenar tras el finalize. El tope fijo de 20 s
    // truncaba silenciosamente esos casos. Ahora la ventana es proporcional al
    // tamaño (≈32 kB/s ⇒ file.size/32 ms) y se corta por silencio de mensajes.
    const maxWaitMs = Math.min(240_000, Math.max(60_000, Math.floor(file.size / 32)));
    const finalizeStartedAt = Date.now();
    while (Date.now() - finalizeStartedAt < maxWaitMs) {
      if (providerError) throw new Error(providerError);
      if (Date.now() - lastMessageAt > 2_500 && Date.now() - finalizeStartedAt > 1_500) break;
      await delay(150, options.signal);
    }
    if (sonioxBuffer.trim()) finalSegments.push(sonioxBuffer.trim());
    options.onProgress?.(100);
    const transcript = finalSegments.join(" ").replace(/\s+/g, " ").trim() || latestPartial.trim();
    if (!transcript) throw new Error("No se detectó voz en la grabación. Verifica el archivo e inténtalo de nuevo.");
    return transcript;
  } finally {
    options.signal?.removeEventListener("abort", abort);
    closeSocket();
  }
}
