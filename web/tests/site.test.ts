import { describe, it, expect } from "vitest";
import { whatsappLink, visibleAppNav, SITE, WHATSAPP_BASE } from "@/lib/site";

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

describe("visibleAppNav · cuenta demo comercial", () => {
  it("muestra el menú del médico, no el del administrador", () => {
    const hrefs = visibleAppNav("admin", "medico_especialista", true).map(
      (item) => item.href,
    );
    expect(hrefs).toEqual([
      "/app/dashboard",
      "/app/consultas",
      "/app/pacientes",
      "/app/notas",
      "/app/plantillas",
    ]);
  });

  it("un admin normal sigue viendo sus secciones", () => {
    const hrefs = visibleAppNav("admin").map((item) => item.href);
    expect(hrefs).toContain("/app/usuarios");
    expect(hrefs).toContain("/app/reportes");
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
