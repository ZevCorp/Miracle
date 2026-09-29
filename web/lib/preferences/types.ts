// Preferencias personales del médico: el contrato que comparten el servidor, el
// contexto de cliente y la pantalla de Configuración.
//
// Aquí solo vive lo que es personal Y portátil entre computadores (tabla
// public.user_preferences). Lo que depende del aparato —el tema y el micrófono
// preferido— vive en localStorage y tiene su propio módulo: meterlo aquí sería
// prometer que viaja con la cuenta cuando no lo hace.

/** Qué plantilla queda preseleccionada al iniciar una consulta. */
export type TemplateStartMode = "last" | "fixed" | "manual";

/** Cómo se dirige el asistente al médico. */
export type AssistantAddress = "tu" | "usted";

/** Cuánto se extiende el asistente al responder. */
export type AssistantDetail = "breve" | "equilibrado" | "detallado";

export interface UserPreferences {
  templateStartMode: TemplateStartMode;
  /** Servicio con el que nacen sus consultas. null = usar el de la institución. */
  defaultServicio: string | null;
  assistantAddress: AssistantAddress;
  assistantDetail: AssistantDetail;
  assistantUseName: boolean;
}

/**
 * Lo que ve un médico que nunca ha entrado a Configuración.
 *
 * `templateStartMode: "last"` y `assistantDetail: "equilibrado"` reproducen el
 * comportamiento que la app ya tenía, así que estrenar la pantalla no le cambia
 * nada a nadie por debajo. (A quien ya tenía un pin de plantilla la migración lo
 * dejó en "fixed" por el mismo motivo.)
 */
export const PREFERENCIAS_POR_DEFECTO: UserPreferences = {
  templateStartMode: "last",
  defaultServicio: null,
  assistantAddress: "usted",
  assistantDetail: "equilibrado",
  assistantUseName: true,
};

export interface UserPreferencesRow {
  template_start_mode: string | null;
  default_servicio: string | null;
  assistant_address: string | null;
  assistant_detail: string | null;
  assistant_use_name: boolean | null;
}

export const USER_PREFERENCES_COLUMNS =
  "template_start_mode, default_servicio, assistant_address, assistant_detail, assistant_use_name";

function unaDe<T extends string>(valor: unknown, opciones: readonly T[], porDefecto: T): T {
  return opciones.includes(valor as T) ? (valor as T) : porDefecto;
}

/**
 * Fila → preferencias, cayendo al valor por defecto ante cualquier sorpresa.
 *
 * Los CHECK de la tabla ya acotan estos valores, pero la fila también puede
 * llegar de un despliegue anterior o de una columna añadida después; un valor
 * que no reconocemos nunca debe romper la pantalla ni, peor, viajar al prompt
 * del asistente.
 */
export function rowToPreferences(row: UserPreferencesRow | null): UserPreferences {
  if (!row) return PREFERENCIAS_POR_DEFECTO;
  return {
    templateStartMode: unaDe(
      row.template_start_mode,
      ["last", "fixed", "manual"] as const,
      PREFERENCIAS_POR_DEFECTO.templateStartMode,
    ),
    defaultServicio: row.default_servicio?.trim() || null,
    assistantAddress: unaDe(
      row.assistant_address,
      ["tu", "usted"] as const,
      PREFERENCIAS_POR_DEFECTO.assistantAddress,
    ),
    assistantDetail: unaDe(
      row.assistant_detail,
      ["breve", "equilibrado", "detallado"] as const,
      PREFERENCIAS_POR_DEFECTO.assistantDetail,
    ),
    assistantUseName: row.assistant_use_name ?? PREFERENCIAS_POR_DEFECTO.assistantUseName,
  };
}

/**
 * Nombre con el que el asistente puede llamar al médico: el de pila.
 *
 * "Juan Camilo Restrepo Vélez" -> "Juan". Un asistente que dice el nombre
 * completo suena a formulario, no a colega. Devuelve null si no hay nombre
 * cargado o si el usuario apagó la preferencia.
 */
export function nombreDePila(fullName: string | null | undefined): string | null {
  const primero = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  // Se descartan honoríficos: la cuenta suele venir cargada como "Dr. Pérez".
  if (/^(dr|dra|doc|doctor|doctora)\.?$/i.test(primero)) {
    const segundo = (fullName ?? "").trim().split(/\s+/)[1] ?? "";
    return segundo || null;
  }
  return primero || null;
}
