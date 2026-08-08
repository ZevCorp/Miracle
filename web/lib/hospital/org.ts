// Ajustes de la institución: un solo contrato para leerlos y para aplicarlos.
//
// Los consumen la Configuración institucional (que los escribe), la nota clínica
// impresa y el informe de laboratorio (que imprimen el encabezado), el puente de
// encounters (servicio por defecto) y el filtro de Consultas (lista de
// servicios). Vive aquí para que ninguno de esos sitios vuelva a escribir a mano
// un dato de la institución — que es exactamente cómo terminó apareciendo
// "Hospital General de Medellín" en las notas de todo el mundo.

import { SERVICIOS } from "@/lib/mock";

/** Columnas a pedir en cualquier SELECT de la organización. */
export const ORG_SETTINGS_COLUMNS =
  "name, nit, address, city, phone, servicios, default_responsable_label, use_hospital_templates";

export type OrgSettings = {
  name: string;
  nit: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  /** null = no configurado; la app cae a la lista por defecto. */
  servicios: string[] | null;
  defaultResponsableLabel: string | null;
  useHospitalTemplates: boolean;
};

/** Fila cruda de `organizations` tal como la devuelve PostgREST. */
export type OrgSettingsRow = {
  name: string | null;
  nit: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  servicios: string[] | null;
  default_responsable_label: string | null;
  use_hospital_templates: boolean | null;
};

export const ORG_SETTINGS_VACIOS: OrgSettings = {
  name: "",
  nit: null,
  address: null,
  city: null,
  phone: null,
  servicios: null,
  defaultResponsableLabel: null,
  useHospitalTemplates: true,
};

export function rowToOrgSettings(row: OrgSettingsRow | null): OrgSettings {
  if (!row) return ORG_SETTINGS_VACIOS;
  return {
    name: row.name ?? "",
    nit: limpiar(row.nit),
    address: limpiar(row.address),
    city: limpiar(row.city),
    phone: limpiar(row.phone),
    // Un array vacío se trata como "sin configurar": guardar cero servicios no
    // es una decisión útil, y dejaría el selector de Consultas en blanco.
    servicios: row.servicios && row.servicios.length ? row.servicios : null,
    defaultResponsableLabel: limpiar(row.default_responsable_label),
    useHospitalTemplates: row.use_hospital_templates ?? true,
  };
}

function limpiar(valor: string | null | undefined): string | null {
  const texto = (valor ?? "").trim();
  return texto === "" ? null : texto;
}

/**
 * Servicios que ofrece la institución.
 *
 * Sin configurar cae a la lista de la app, que es lo que se venía usando. Así
 * una institución que nunca entre a Configuración sigue viendo exactamente lo
 * mismo que antes.
 */
export function serviciosDe(org: OrgSettings): string[] {
  return org.servicios ?? [...SERVICIOS];
}

/**
 * Servicio con el que nacen las consultas nuevas.
 *
 * Hasta ahora era la cadena "Consulta externa" escrita en el puente de
 * encounters, así que TODAS las consultas de la base quedaron con ese servicio
 * independientemente de la institución.
 */
export function servicioPorDefecto(org: OrgSettings): string {
  return serviciosDe(org)[0] ?? "Consulta externa";
}

/**
 * Líneas del encabezado institucional, en orden de impresión.
 *
 * Devuelve solo las que tienen dato: una institución que no cargó teléfono no
 * imprime una línea vacía ni un "Tel. —".
 */
export function letterheadLines(org: OrgSettings): string[] {
  const lineas: string[] = [];
  if (org.nit) lineas.push(`NIT ${org.nit}`);

  // Dirección y ciudad van juntas: son un solo dato para quien lee el documento.
  const lugar = [org.address, org.city].filter(Boolean).join(" · ");
  if (lugar) lineas.push(lugar);

  if (org.phone) lineas.push(`Tel. ${org.phone}`);
  return lineas;
}

/** true si hay algo institucional que imprimir (más allá del nombre). */
export function tieneEncabezado(org: OrgSettings): boolean {
  return Boolean(org.name) || letterheadLines(org).length > 0;
}

/**
 * Etiqueta de responsable para el bloque de firma.
 *
 * La del profesional manda: su cargo real en la institución es más preciso que
 * el valor por defecto. El de la organización solo rellena cuando el perfil no
 * lo tiene, que es el caso de casi todo el equipo.
 */
export function responsableLabelDe(
  org: OrgSettings,
  perfil: string | null | undefined,
): string | null {
  return limpiar(perfil) ?? org.defaultResponsableLabel;
}

/**
 * Parsea la lista de servicios que el admin escribe en Configuración.
 *
 * Acepta separación por coma o por salto de línea, recorta, descarta vacíos y
 * quita duplicados sin distinguir mayúsculas ni tildes de más. Devuelve null si
 * no queda nada, para volver al valor "sin configurar".
 */
export function parseServicios(entrada: string): string[] | null {
  const vistos = new Set<string>();
  const lista: string[] = [];
  for (const bruto of entrada.split(/[,\n]/)) {
    const servicio = bruto.trim().replace(/\s+/g, " ");
    if (!servicio) continue;
    const clave = servicio.toLocaleLowerCase("es-CO");
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    lista.push(servicio);
  }
  return lista.length ? lista : null;
}
