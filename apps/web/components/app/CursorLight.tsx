"use client";

import { useEffect } from "react";

/**
 * La luz que sigue al cursor sobre las superficies marcadas con [data-light].
 *
 * UN solo listener de pointermove en el documento (delegación, nada por
 * elemento), acelerado con requestAnimationFrame: en cada frame como mucho se
 * escriben dos variables CSS (--mx/--my) en el elemento bajo el cursor, y el
 * ::after de [data-light] pinta un resplandor radial ahí. El rect del elemento
 * se mide solo cuando cambia el elemento (o tras un scroll), no por evento.
 *
 * Se desactiva entero donde no aporta: pantallas táctiles (hover:none),
 * usuarios con reduced-motion, y nunca toca las gráficas de la consola
 * (aquellas tienen su propia interacción de puntero y un test que la protege).
 * Render null: es un efecto, no un componente visual.
 */
export function CursorLight() {
  useEffect(() => {
    const fino = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fino || quieto) return;

    let actual: HTMLElement | null = null;
    let rect: DOMRect | null = null;
    let raf = 0;
    let ultimo: PointerEvent | null = null;

    function pintar() {
      raf = 0;
      const e = ultimo;
      if (!e) return;
      const objetivo =
        (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-light]") ??
        null;
      if (objetivo !== actual) {
        actual?.style.removeProperty("--mx");
        actual?.style.removeProperty("--my");
        actual = objetivo;
        rect = objetivo?.getBoundingClientRect() ?? null;
      }
      if (actual && rect) {
        actual.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        actual.style.setProperty("--my", `${e.clientY - rect.top}px`);
      }
    }

    function onMove(e: PointerEvent) {
      ultimo = e;
      if (!raf) raf = requestAnimationFrame(pintar);
    }

    // El rect cacheado muere con el scroll; se vuelve a medir al primer move.
    function onScroll() {
      rect = null;
      if (actual) rect = actual.getBoundingClientRect();
    }

    document.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll, { capture: true });
      if (raf) cancelAnimationFrame(raf);
      actual?.style.removeProperty("--mx");
      actual?.style.removeProperty("--my");
    };
  }, []);

  return null;
}
