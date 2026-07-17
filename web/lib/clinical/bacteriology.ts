// División de cuenta "bacteriólogo" y el gating de sus funcionalidades exclusivas.
//
// Un único punto de verdad para decidir qué cuentas ven la generación de notas desde FOTO
// (informes de laboratorio). Hoy la habilita el tipo profesional 'bacteriologo'; si mañana
// hay más divisiones (p. ej. patólogo), se extienden aquí sin tocar la UI.
//
// Módulo puro (sin server-only): se usa igual en Server Components, rutas /api y la
// navegación cliente.

/** professional_type que marca una cuenta como bacteriólogo. */
export const BACTERIOLOGO_TYPE = "bacteriologo" as const;

/** specialty_code canónico de bacteriología (casa con specialties.ts y el seed). */
export const BACTERIOLOGIA_SPECIALTY_CODE = "bacteriologia" as const;

/** specialty_name legible por defecto. */
export const BACTERIOLOGIA_SPECIALTY_NAME = "Bacteriología" as const;

/** true si el tipo profesional corresponde a una cuenta bacteriólogo. */
export function isBacteriologist(
  professionalType: string | null | undefined,
): boolean {
  return professionalType === BACTERIOLOGO_TYPE;
}

/**
 * ¿La cuenta puede generar notas a partir de una foto de la hoja manuscrita?
 * Exclusivo de bacteriólogos: el resto de médicos no lo ve ni lo puede usar.
 */
export function canUsePhotoNotes(
  professionalType: string | null | undefined,
): boolean {
  return isBacteriologist(professionalType);
}
