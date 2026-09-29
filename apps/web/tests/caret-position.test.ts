import { describe, expect, it } from "vitest";
import { COPIED_STYLE_PROPS, decidirLado } from "@/lib/clinical/caret-position";

// La medición en sí necesita DOM y vitest corre en `environment: "node"`, así
// que aquí solo va la parte pura. La medición se comprueba en el navegador.

describe("decidirLado", () => {
  const base = { caretTop: 0, lineHeight: 20, altoLista: 250, altoCampo: 500 };

  it("va debajo cuando cabe", () => {
    expect(decidirLado({ ...base, caretTop: 40 })).toBe("abajo");
  });

  it("va arriba cuando no cabe debajo", () => {
    // Cursor en la línea de abajo de un campo alto: es el caso que hacía que la
    // lista saliera fuera de la pantalla.
    expect(decidirLado({ ...base, caretTop: 460 })).toBe("arriba");
  });

  it("en el límite exacto todavía cabe debajo", () => {
    // 230 + 20 = 250 de espacio, justo el alto de la lista.
    expect(decidirLado({ ...base, caretTop: 230 })).toBe("abajo");
    expect(decidirLado({ ...base, caretTop: 231 })).toBe("arriba");
  });

  it("en un campo corto siempre va arriba si la lista no cabe", () => {
    expect(decidirLado({ ...base, altoCampo: 120, caretTop: 0 })).toBe("arriba");
  });

  it("en un campo muy alto con el cursor arriba va debajo", () => {
    expect(decidirLado({ ...base, altoCampo: 900, caretTop: 20 })).toBe("abajo");
  });
});

describe("COPIED_STYLE_PROPS", () => {
  it("copia las propiedades sin las cuales el espejo parte las líneas en otro sitio", () => {
    // Si falta alguna de estas tres, la coordenada sale de otra línea y la
    // lista aparece donde no es.
    for (const prop of ["whiteSpace", "wordWrap", "lineHeight"]) {
      expect(COPIED_STYLE_PROPS).toContain(prop);
    }
  });

  it("copia también el ancho y la caja, que deciden dónde envuelve el texto", () => {
    for (const prop of ["width", "boxSizing", "paddingLeft", "paddingRight"]) {
      expect(COPIED_STYLE_PROPS).toContain(prop);
    }
  });

  it("copia la tipografía completa", () => {
    for (const prop of ["fontFamily", "fontSize", "fontWeight", "letterSpacing"]) {
      expect(COPIED_STYLE_PROPS).toContain(prop);
    }
  });
});
