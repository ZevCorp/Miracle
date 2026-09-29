// Dónde está el cursor dentro de un <textarea>, en píxeles.
//
// POR QUÉ HACE FALTA. La lista de atajos se anclaba al contenedor de la sección
// (`top-full`), y las secciones de una nota crecen hasta 22 filas: escribir "/"
// en la línea 2 de una sección larga hacía aparecer la lista 500 px más abajo,
// a veces fuera de la pantalla. El razonamiento original —seguir el caret obliga
// a clonar el campo en un div espejo y volver a medirlo con cada scroll, zoom o
// teclado móvil— es correcto para un campo corto y falla en uno largo.
//
// CÓMO SE EVITA ESA FRAGILIDAD. No se mide continuamente: mientras la lista está
// abierta la "/" no se mueve, así que basta medir al abrir. El que la abre se
// encarga de cerrarla si hay scroll o cambio de tamaño, en vez de re-medir.
//
// Y el problema es más pequeño de lo que parecía: el popup ya vive dentro del
// mismo contenedor `relative` que envuelve al textarea, así que solo hace falta
// una coordenada VERTICAL relativa al campo, no posicionar en viewport.

/**
 * Propiedades que afectan a dónde cae cada carácter. Si falta una, el espejo
 * parte las líneas en otro sitio y la coordenada sale de otra línea.
 */
export const COPIED_STYLE_PROPS: readonly string[] = [
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontVariant",
  "letterSpacing",
  "wordSpacing",
  "lineHeight",
  "textIndent",
  "textTransform",
  "tabSize",
  "whiteSpace",
  "wordWrap",
  "overflowWrap",
];

export interface CaretPosition {
  /** Distancia del borde superior del campo a la línea del cursor, ya con scroll. */
  top: number;
  lineHeight: number;
}

/**
 * Alto de línea del campo, con reserva si `lineHeight` viene como "normal".
 */
function resolveLineHeight(style: CSSStyleDeclaration): number {
  const declared = Number.parseFloat(style.lineHeight);
  if (Number.isFinite(declared) && declared > 0) return declared;
  const size = Number.parseFloat(style.fontSize);
  return Number.isFinite(size) && size > 0 ? size * 1.2 : 16;
}

/**
 * Posición vertical del carácter `index`, relativa al borde superior del campo.
 * Devuelve null si no se puede medir: quien llama debe caer al anclaje de antes.
 */
export function caretPosition(
  textarea: HTMLTextAreaElement,
  index: number,
): CaretPosition | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  try {
    const style = window.getComputedStyle(textarea);
    const mirror = document.createElement("div");
    const declaration = mirror.style as unknown as Record<string, string>;
    for (const prop of COPIED_STYLE_PROPS) {
      declaration[prop] = style.getPropertyValue(
        prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
      );
    }
    // Fuera de pantalla pero MEDIBLE: display:none no tiene layout.
    mirror.style.position = "absolute";
    mirror.style.visibility = "hidden";
    mirror.style.left = "-9999px";
    mirror.style.top = "0";
    mirror.style.height = "auto";
    mirror.style.overflow = "hidden";
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordWrap = "break-word";

    const clamped = Math.max(0, Math.min(index, textarea.value.length));
    mirror.textContent = textarea.value.slice(0, clamped);
    const marker = document.createElement("span");
    // Un carácter real: un span vacío no siempre tiene caja.
    marker.textContent = textarea.value.slice(clamped) || ".";
    mirror.appendChild(marker);

    document.body.appendChild(mirror);
    const offsetTop = marker.offsetTop;
    document.body.removeChild(mirror);

    const lineHeight = resolveLineHeight(style);
    const top = offsetTop - textarea.scrollTop;
    if (!Number.isFinite(top) || !Number.isFinite(lineHeight)) return null;
    return { top, lineHeight };
  } catch {
    return null;
  }
}

export interface LadoInput {
  /** Top del cursor dentro del campo. */
  caretTop: number;
  lineHeight: number;
  /** Alto que va a ocupar la lista. */
  altoLista: number;
  /** Alto visible del campo. */
  altoCampo: number;
}

/**
 * Debajo de la línea del cursor, salvo que no quepa. Puro: es lo testeable.
 */
export function decidirLado({
  caretTop,
  lineHeight,
  altoLista,
  altoCampo,
}: LadoInput): "arriba" | "abajo" {
  const espacioDebajo = altoCampo - (caretTop + lineHeight);
  return espacioDebajo >= altoLista ? "abajo" : "arriba";
}
