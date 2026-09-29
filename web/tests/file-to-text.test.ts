import { describe, expect, it } from "vitest";
import {
  filenameToTitle,
  htmlToSnippetText,
  MAX_SNIPPET_FILE_BYTES,
  validateSnippetFile,
} from "@/lib/clinical/file-to-text";

function file(name: string, type = "", size = 1024) {
  return { name, type, size };
}

describe("validateSnippetFile", () => {
  it("acepta los formatos de la v1", () => {
    expect(validateSnippetFile(file("gastritis.txt", "text/plain"))).toBeNull();
    expect(validateSnippetFile(file("plan.md", "text/markdown"))).toBeNull();
    expect(
      validateSnippetFile(
        file(
          "nota.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
      ),
    ).toBeNull();
  });

  it("acepta por extensión cuando el sistema no reporta tipo", () => {
    expect(validateSnippetFile(file("gastritis.docx"))).toBeNull();
    expect(validateSnippetFile(file("gastritis.markdown"))).toBeNull();
  });

  it("rechaza el archivo vacío", () => {
    expect(validateSnippetFile(file("vacio.txt", "text/plain", 0))).toMatch(/vac/i);
  });

  it("rechaza lo que pasa de 2 MB", () => {
    expect(
      validateSnippetFile(
        file("grande.txt", "text/plain", MAX_SNIPPET_FILE_BYTES + 1),
      ),
    ).toMatch(/2 MB/);
  });

  it("explica qué hacer con un .doc antiguo", () => {
    expect(validateSnippetFile(file("viejo.doc", "application/msword"))).toMatch(
      /guárdalo como \.docx/i,
    );
  });

  it("rechaza PDF e imágenes", () => {
    expect(validateSnippetFile(file("nota.pdf", "application/pdf"))).toMatch(
      /no compatible/i,
    );
    expect(validateSnippetFile(file("foto.jpg", "image/jpeg"))).toMatch(
      /no compatible/i,
    );
  });
});

describe("htmlToSnippetText", () => {
  it("conserva los párrafos como líneas separadas", () => {
    expect(htmlToSnippetText("<p>Primero</p><p>Segundo</p>")).toBe(
      "Primero\n\nSegundo",
    );
  });

  it("convierte las viñetas de Word en líneas con guion", () => {
    expect(
      htmlToSnippetText("<ul><li>Omeprazol</li><li>Amoxicilina</li></ul>"),
    ).toBe("- Omeprazol\n- Amoxicilina");
  });

  it("respeta los saltos de línea manuales", () => {
    expect(htmlToSnippetText("<p>Uno<br />Dos</p>")).toBe("Uno\nDos");
  });

  it("conserva los títulos como texto", () => {
    expect(htmlToSnippetText("<h1>Plan</h1><p>Control en 8 días</p>")).toBe(
      "Plan\n\nControl en 8 días",
    );
  });

  it("separa las celdas de una tabla con tabulación", () => {
    expect(
      htmlToSnippetText(
        "<table><tr><td>Dosis</td><td>20 mg</td></tr><tr><td>Días</td><td>14</td></tr></table>",
      ),
    ).toBe("Dosis\t20 mg\n\nDías\t14");
  });

  it("decodifica entidades y quita el formato", () => {
    expect(
      htmlToSnippetText("<p><strong>Dolor</strong> &amp; n&aacute;usea &lt;leve&gt;</p>"),
    ).toBe("Dolor & n&aacute;usea <leve>");
    expect(htmlToSnippetText("<p>caf&#233; &#x41;</p>")).toBe("café A");
  });

  it("no deja tres o más saltos seguidos", () => {
    expect(htmlToSnippetText("<p>A</p><p></p><p></p><p>B</p>")).toBe("A\n\nB");
  });
});

describe("filenameToTitle", () => {
  it("quita la extensión y normaliza separadores", () => {
    expect(filenameToTitle("gastritis_cronica.docx")).toBe("Gastritis cronica");
    expect(filenameToTitle("plan-de-manejo-HTA.txt")).toBe("Plan de manejo HTA");
  });

  it("respeta acentos y mayúsculas propias", () => {
    expect(filenameToTitle("órdenes médicas.md")).toBe("Órdenes médicas");
  });

  it("da un nombre de reserva si no queda nada", () => {
    expect(filenameToTitle(".txt")).toBe("Texto importado");
  });
});
