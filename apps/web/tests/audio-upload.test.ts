import { describe, expect, it } from "vitest";
import { MAX_AUDIO_UPLOAD_BYTES, validateAudioUpload } from "@/lib/stt/transcribe-audio-file";

describe("carga de grabaciones", () => {
  it("acepta los formatos clínicos habituales por MIME o extensión", () => {
    expect(validateAudioUpload({ name: "consulta.m4a", size: 32_000, type: "" })).toBeNull();
    expect(validateAudioUpload({ name: "consulta.bin", size: 32_000, type: "audio/wav" })).toBeNull();
  });

  it("rechaza archivos vacíos, desconocidos o demasiado grandes", () => {
    expect(validateAudioUpload({ name: "consulta.mp3", size: 0, type: "audio/mpeg" })).toContain("vacío");
    expect(validateAudioUpload({ name: "consulta.pdf", size: 32_000, type: "application/pdf" })).toContain("Formato");
    expect(validateAudioUpload({ name: "consulta.mp3", size: MAX_AUDIO_UPLOAD_BYTES + 1, type: "audio/mpeg" })).toContain("100 MB");
  });
});
