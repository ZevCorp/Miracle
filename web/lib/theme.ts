"use client";

// Tema claro / oscuro / el del sistema.
//
// El modelo de tres estados YA existía: el script del <head> (app/layout.tsx)
// distingue 'light', 'dark' y "no hay nada guardado" = seguir al sistema. Lo que
// no existía era forma de VOLVER a "sistema": el botón sol/luna de la cabecera
// solo alterna entre los dos explícitos, así que una vez tocado nunca más se
// seguía al sistema operativo.
//
// Estas funciones son la misma pareja de operaciones que estaba copiada en tres
// sitios (AppShell, la hoja "Más" del móvil y el script del <head>): escribir la
// clase, el data-attribute y el color-scheme, siempre los tres. Escribir solo
// uno deja el navegador pintando los controles nativos del color contrario.
//
// El script inline del <head> se queda como está y NO importa este módulo: es lo
// que evita el parpadeo, tiene que correr antes de la primera pintada y no puede
// esperar a que cargue un chunk de JavaScript.

export type ThemeMode = "light" | "dark" | "system";

/** La misma clave que lee el script pre-pintado del <head>. */
export const THEME_STORAGE_KEY = "miracle-theme";

/** true si el sistema operativo está en oscuro ahora mismo. */
export function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Qué eligió el médico. "system" es también el valor de una cuenta nueva: la
 * ausencia de la clave ES la elección por defecto, no un estado corrupto.
 */
export function readTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const guardado = window.localStorage.getItem(THEME_STORAGE_KEY);
    return guardado === "dark" || guardado === "light" ? guardado : "system";
  } catch {
    return "system";
  }
}

/** Pinta el tema en el <html>. No persiste nada: eso lo hace applyTheme. */
export function paintTheme(dark: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.dataset.theme = dark ? "dark" : "light";
  root.style.colorScheme = dark ? "dark" : "light";
}

/**
 * Aplica y persiste la elección.
 *
 * "system" BORRA la clave en vez de guardar la palabra "system": así el script
 * del <head> —que solo entiende 'light'/'dark'/ausente— sigue funcionando sin
 * cambios, y el navegador que reciba el tema del sistema lo hace desde la
 * primera pintada.
 */
export function applyTheme(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && systemPrefersDark());
  paintTheme(dark);
  try {
    if (mode === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* almacenamiento no disponible: el tema aplica igual, solo no se recuerda */
  }
}

/**
 * Suscribe la pestaña a los cambios del sistema operativo mientras el médico no
 * haya elegido un tema explícito. Devuelve el desuscriptor.
 */
export function watchSystemTheme(): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const alCambiar = (event: MediaQueryListEvent) => {
    if (readTheme() !== "system") return;
    paintTheme(event.matches);
  };
  media.addEventListener("change", alCambiar);
  return () => media.removeEventListener("change", alCambiar);
}
