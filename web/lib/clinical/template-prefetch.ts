// Catálogo de plantillas + preferencias, compartido entre el dock y la hoja
// de inicio rápido.
//
// POR QUÉ EXISTE: para que "Iniciar consulta" sea UN clic, el dock necesita
// saber la plantilla preseleccionada ANTES del clic — y getClinicalTemplates
// pega al backend sin ningún caché. Este módulo memoriza la respuesta cinco
// minutos y deduplica las promesas en vuelo: el dock precalienta al montar y
// la hoja, si se abre, encuentra el catálogo ya listo.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getClinicalTemplates, type ClinicalTemplate } from "@/lib/api/clinical";
import {
  getTemplatePreferences,
  type TemplatePreference,
} from "@/lib/clinical/template-preferences";

export interface TemplateContext {
  templates: ClinicalTemplate[];
  preferences: TemplatePreference[];
}

/** Cinco minutos: cubre una tanda de consultas sin servir un catálogo viejo. */
const TTL_MS = 5 * 60 * 1000;

let memo: { promise: Promise<TemplateContext>; at: number } | null = null;

export function getTemplateContext(
  supabase: SupabaseClient,
): Promise<TemplateContext> {
  if (memo && Date.now() - memo.at < TTL_MS) return memo.promise;

  const promise = Promise.all([
    getClinicalTemplates(),
    // Sin preferencias solo se pierde el pin; nunca bloquean el catálogo.
    getTemplatePreferences(supabase).catch(() => [] as TemplatePreference[]),
  ]).then(([items, preferences]) => ({
    templates: items.filter((t) => t.status !== "archived"),
    preferences,
  }));

  memo = { promise, at: Date.now() };
  // Un fallo no se cachea: el próximo intento vuelve a preguntar.
  promise.catch(() => {
    if (memo?.promise === promise) memo = null;
  });
  return promise;
}

/**
 * Tira el memo. Se llama al terminar de iniciar una grabación: el modo de
 * arranque por defecto es "la última que usé", así que sin esto el dock
 * seguiría anunciando la plantilla ANTERIOR a la que acaba de usarse.
 */
export function invalidateTemplateContext() {
  memo = null;
}
