import { describe, it, expect } from "vitest";
import { whatsappLink, SITE, WHATSAPP_BASE } from "@/lib/site";

describe("whatsappLink", () => {
  it("arma el enlace con el mensaje codificado", () => {
    const link = whatsappLink("Hola, quiero un piloto");
    expect(link.startsWith(`${WHATSAPP_BASE}?text=`)).toBe(true);
    expect(link).toContain(encodeURIComponent("Hola, quiero un piloto"));
  });

  it("codifica caracteres especiales", () => {
    expect(whatsappLink("a b&c")).toContain(encodeURIComponent("a b&c"));
  });

  it("usa el número de WhatsApp del sitio", () => {
    expect(WHATSAPP_BASE).toContain(SITE.whatsappNumber);
  });
});

describe("datos de contacto del sitio", () => {
  it("expone un correo real (dominio propio, no un placeholder)", () => {
    expect(SITE.email).toBe("dev@itsmiracleai.com");
    expect(SITE.email).not.toContain("miracle.health");
  });

  it("expone una URL de sitio válida", () => {
    expect(() => new URL(SITE.url)).not.toThrow();
  });
});
