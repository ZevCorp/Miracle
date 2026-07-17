// División de cuenta "patólogo" y el gating de sus funcionalidades exclusivas.
//
// Un único punto de verdad para decidir qué cuentas ven la generación de informes desde FOTO
// (patología: histopatología, citología, inmunohistoquímica). Hoy la habilita el tipo
// profesional 'patologo'; si mañana hay más divisiones, se extienden aquí sin tocar la UI.
//
// La especialidad canónica es 'patologia' (ya existe en el catálogo clínico); las plantillas
// y el flujo de audio se filtran por ese specialty_code.
//
// Módulo puro (sin server-only): se usa igual en Server Components, rutas /api y la
// navegación cliente.

/** professional_type que marca una cuenta como patólogo. */
export const PATOLOGO_TYPE = "patologo" as const;

/** specialty_code canónico de patología (casa con specialties.ts y el seed). */
export const PATOLOGIA_SPECIALTY_CODE = "patologia" as const;

/** specialty_name legible por defecto. */
export const PATOLOGIA_SPECIALTY_NAME = "Patología" as const;

/** true si el tipo profesional corresponde a una cuenta patólogo. */
export function isPathologist(
  professionalType: string | null | undefined,
): boolean {
  return professionalType === PATOLOGO_TYPE;
}

/**
 * ¿La cuenta puede generar informes a partir de una foto de la hoja manuscrita?
 * Exclusivo de patólogos: el resto de médicos no lo ve ni lo puede usar.
 */
export function canUsePhotoNotes(
  professionalType: string | null | undefined,
): boolean {
  return isPathologist(professionalType);
}
