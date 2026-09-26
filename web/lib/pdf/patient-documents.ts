/**
 * Los papeles de la consulta: la nota clínica, la fórmula médica y las
 * indicaciones para el paciente — UN modelo, dos pintores.
 *
 * POR QUÉ UN MODELO Y NO HTML DIRECTO
 * El mismo papel se imprime desde la web y desde U (Windows). Si cada lado
 * armara su propio documento, el paciente se llevaría papeles distintos según
 * dónde se imprimieron. Aquí se decide QUÉ dice el documento; el HTML de la web
 * (patient-documents-html.ts) y el FlowDocument de Windows solo deciden cómo se
 * ve. Windows porta esta función y el contrato le exige la misma salida, campo
 * a campo, sobre los mismos casos.
 *
 * LA FÓRMULA NUNCA INVENTA
 * El Decreto 2200 de 2005 pide en la prescripción: lugar y fecha, nombre y
 * documento del paciente, el medicamento con su concentración y forma
 * farmacéutica, vía, dosis y frecuencia, duración, cantidad total en números y
 * letras, indicaciones, y nombre, firma y registro del prescriptor. Lo que la
 * nota no trae se deja EN BLANCO (valor "") para que el médico lo escriba a
 * mano. Un «N/A» o un valor por defecto en una receta es peor que un espacio.
 *
 * BLOQUES PLANOS, a propósito: cada bloque trae todos sus campos (vacíos si no
 * aplican). Es más feo en TypeScript y muchísimo más fácil de comparar contra
 * el puerto en C#, que es lo que protege al paciente de dos papeles distintos.
 */

import {
  ensureClinicalDischarge,
  type ClinicalDischarge,
  type ClinicalMedicationPlanItem,
} from "@/lib/api/clinical";

export type TipoDeDocumento = "nota" | "formula" | "indicaciones";

export interface DocumentoInput {
  tipo: TipoDeDocumento;
  /** Hora LOCAL de pared, "AAAA-MM-DDTHH:MM". La convierte quien llama: así el
   *  papel dice la hora del consultorio en cualquier máquina. */
  fecha: string;
  org: {
    name?: string | null;
    nit?: string | null;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
  };
  medico: {
    nombre?: string | null;
    documento?: string | null;
    registro?: string | null;
    especialidad?: string | null;
    /** Para el sello del hospital ("Dr", "Dra"). Sin él no hay sello. */
    honorifico?: string | null;
    /** Etiqueta de responsable ya resuelta (perfil o institución). */
    responsable?: string | null;
  };
  paciente: {
    nombre?: string | null;
    documento?: string | null;
    edad?: number | null;
    sexo?: string | null;
    eps?: string | null;
  };
  nota: {
    summary?: string | null;
    sections?: readonly { label?: string | null; content?: string | null }[] | null;
    discharge?: ClinicalDischarge | null;
  };
  codigos?: readonly { sistema: string; codigo: string; descripcion: string }[];
  adendas?: readonly { autor: string; fecha: string; contenido: string }[];
  demo?: boolean;
}

export type TipoDeBloque = "parrafo" | "lista" | "medicamento" | "alarma" | "tabla" | "aviso";

export interface Bloque {
  tipo: TipoDeBloque;
  titulo: string;
  texto: string;
  items: string[];
  numero: number;
  nombre: string;
  /** En la fórmula: cada dato del medicamento. valor "" = espacio para escribir a mano. */
  campos: { etiqueta: string; valor: string }[];
  /** Solo en alarma: "emergency" | "priority" | "monitor" | "". */
  nivel: string;
  columnas: string[];
  filas: string[][];
}

export interface Documento {
  tipo: TipoDeDocumento;
  titulo: string;
  membrete: { nombre: string; lineas: string[] };
  datos: { etiqueta: string; valor: string }[];
  bloques: Bloque[];
  firma: { nombre: string; lineas: string[] };
  /** El sello del hospital, solo en la nota y solo si el perfil lo tiene completo. */
  sello: string[];
  pie: string;
  demo: boolean;
}

const TITULOS: Record<TipoDeDocumento, string> = {
  nota: "Nota clínica",
  formula: "Fórmula médica",
  indicaciones: "Indicaciones para el paciente",
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Un dato de texto: recortado, y nulo/indefinido como vacío. Nunca "undefined". */
function t(valor: string | null | undefined): string {
  return (valor ?? "").trim();
}

function bloque(parcial: Partial<Bloque> & { tipo: TipoDeBloque }): Bloque {
  return {
    titulo: "",
    texto: "",
    items: [],
    numero: 0,
    nombre: "",
    campos: [],
    nivel: "",
    columnas: [],
    filas: [],
    ...parcial,
  };
}

/** "2026-09-26T14:30" → "26 de septiembre de 2026, 2:30 p. m.". Sin fecha válida, "". */
export function fechaLarga(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(t(fecha));
  if (!m) return "";
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return "";
  const dia = `${Number(m[3])} de ${MESES[mes - 1]} de ${m[1]}`;
  if (m[4] === undefined) return dia;
  const h24 = Number(m[4]);
  const h = h24 % 12 || 12;
  return `${dia}, ${h}:${m[5]} ${h24 >= 12 ? "p. m." : "a. m."}`;
}

/** "DD/MM/AAAA, HH:MM a. m." — el formato del sello del hospital. */
function fechaDelSello(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(t(fecha));
  if (!m) return "";
  const h24 = Number(m[4]);
  const h = String(h24 % 12 || 12).padStart(2, "0");
  return `${m[3]}/${m[2]}/${m[1]}, ${h}:${m[5]} ${h24 >= 12 ? "p. m." : "a. m."}`;
}

const UNIDADES = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete",
  "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés",
  "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = [
  "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos",
];

function menorDeMil(n: number): string {
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (resto > 0) {
    if (resto < 30) partes.push(UNIDADES[resto]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`);
    }
  }
  return partes.join(" ");
}

/** Un entero de 0 a 999 999 en letras («quince», «ciento veinte», «dos mil»). */
export function numeroEnLetras(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999) return "";
  if (n < 1000) return n === 0 ? "cero" : menorDeMil(n);
  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  const cabeza = miles === 1 ? "mil" : `${menorDeMil(miles)} mil`;
  return resto === 0 ? cabeza : `${cabeza} ${menorDeMil(resto)}`;
}

/**
 * La cantidad total en números y letras, como la pide la fórmula:
 * "15 tabletas" → "15 tabletas (quince)". Sin número al principio, tal cual.
 */
export function cantidadEnNumerosYLetras(cantidad: string | null | undefined): string {
  const texto = t(cantidad);
  const m = /^(\d{1,6})(?!\d)/.exec(texto);
  if (!m) return texto;
  const letras = numeroEnLetras(Number(m[1]));
  return letras ? `${texto} (${letras})` : texto;
}

/** "Acetaminofén 500 mg/tableta · 1 tableta · oral · cada 8 horas · 5 días". */
export function lineaDeMedicamento(m: ClinicalMedicationPlanItem): string {
  return [m.name, m.concentration, m.dose, m.route, m.frequency, m.duration]
    .map((x) => t(x))
    .filter(Boolean)
    .join(" · ");
}

const NIVELES: { nivel: string; titulo: string }[] = [
  { nivel: "emergency", titulo: "Acuda a urgencias de inmediato si presenta" },
  { nivel: "priority", titulo: "Consulte pronto, en las próximas 24 horas, si presenta" },
  { nivel: "monitor", titulo: "Esté atento y consulte si presenta" },
  { nivel: "", titulo: "Consulte si presenta" },
];

function alarmasPorNivel(d: ClinicalDischarge): Bloque[] {
  const fuera: Bloque[] = [];
  for (const { nivel, titulo } of NIVELES) {
    const items = d.alarm_signs
      .filter((a) => {
        const u = t(a.urgency);
        return nivel === "" ? !["emergency", "priority", "monitor"].includes(u) : u === nivel;
      })
      .map((a) => t(a.text))
      .filter(Boolean);
    if (items.length) fuera.push(bloque({ tipo: "alarma", titulo, items, nivel }));
  }
  return fuera;
}

function textos(items: readonly { text?: string | null }[]): string[] {
  return items.map((i) => t(i.text)).filter(Boolean);
}

function bloquesDeLaNota(input: DocumentoInput, d: ClinicalDischarge): Bloque[] {
  const fuera: Bloque[] = [];
  const resumen = t(input.nota.summary);
  if (resumen) fuera.push(bloque({ tipo: "parrafo", titulo: "Resumen", texto: resumen }));
  for (const s of input.nota.sections ?? []) {
    const texto = t(s.content);
    if (texto) fuera.push(bloque({ tipo: "parrafo", titulo: t(s.label) || "Sección", texto }));
  }
  const meds = d.plan.medications.map(lineaDeMedicamento).filter(Boolean);
  if (meds.length) fuera.push(bloque({ tipo: "lista", titulo: "Plan farmacológico", items: meds }));
  const listas: [string, string[]][] = [
    ["Medidas no farmacológicas", textos(d.plan.non_pharmacological)],
    ["Seguimiento", textos(d.plan.follow_up)],
    ["Recomendaciones", textos(d.recommendations)],
  ];
  for (const [titulo, items] of listas) if (items.length) fuera.push(bloque({ tipo: "lista", titulo, items }));
  const alarmas = textos(d.alarm_signs);
  if (alarmas.length) fuera.push(bloque({ tipo: "lista", titulo: "Signos de alarma", items: alarmas }));
  const codigos = input.codigos ?? [];
  if (codigos.length)
    fuera.push(bloque({
      tipo: "tabla",
      titulo: "Codificación",
      columnas: ["Sistema", "Código", "Descripción"],
      filas: codigos.map((c) => [t(c.sistema), t(c.codigo), t(c.descripcion)]),
    }));
  for (const a of input.adendas ?? [])
    fuera.push(bloque({ tipo: "parrafo", titulo: `Adenda · ${t(a.autor)} · ${fechaLarga(a.fecha)}`, texto: t(a.contenido) }));
  return fuera;
}

function bloquesDeLaFormula(d: ClinicalDischarge): Bloque[] {
  const meds = d.plan.medications.filter((m) => t(m.name));
  if (!meds.length)
    return [bloque({ tipo: "aviso", texto: "No hay medicamentos en el plan de esta consulta." })];
  return meds.map((m, i) =>
    bloque({
      tipo: "medicamento",
      numero: i + 1,
      nombre: t(m.name),
      campos: [
        { etiqueta: "Concentración y forma", valor: t(m.concentration) },
        { etiqueta: "Dosis", valor: t(m.dose) },
        { etiqueta: "Vía", valor: t(m.route) },
        { etiqueta: "Frecuencia", valor: t(m.frequency) },
        { etiqueta: "Duración del tratamiento", valor: t(m.duration) },
        { etiqueta: "Cantidad total", valor: cantidadEnNumerosYLetras(m.quantity) },
        { etiqueta: "Indicaciones", valor: t(m.instructions) },
      ],
    }),
  );
}

function bloquesDeLasIndicaciones(d: ClinicalDischarge): Bloque[] {
  const fuera: Bloque[] = [];
  const meds = d.plan.medications
    .map((m) => [lineaDeMedicamento(m), t(m.instructions)].filter(Boolean).join(" — "))
    .filter(Boolean);
  if (meds.length) fuera.push(bloque({ tipo: "lista", titulo: "Sus medicamentos", items: meds }));
  const listas: [string, string[]][] = [
    ["Recomendaciones", textos(d.recommendations)],
    ["Cuidados en casa", textos(d.plan.non_pharmacological)],
    ["Sus próximos controles", textos(d.plan.follow_up)],
  ];
  for (const [titulo, items] of listas) if (items.length) fuera.push(bloque({ tipo: "lista", titulo, items }));
  fuera.push(...alarmasPorNivel(d));
  if (!fuera.length)
    fuera.push(bloque({ tipo: "aviso", texto: "Esta consulta no dejó indicaciones registradas." }));
  return fuera;
}

/** El documento, listo para pintar. Puro: sin red, sin reloj, sin navegador. */
export function construirDocumento(input: DocumentoInput): Documento {
  const d = ensureClinicalDischarge(input.nota.discharge ?? undefined);
  const org = input.org ?? {};
  const med = input.medico ?? {};
  const pac = input.paciente ?? {};

  const lugar = [t(org.address), t(org.city)].filter(Boolean).join(" · ");
  const lineasOrg = [t(org.nit) ? `NIT ${t(org.nit)}` : "", lugar, t(org.phone) ? `Tel. ${t(org.phone)}` : ""].filter(Boolean);

  const edad = typeof pac.edad === "number" && pac.edad > 0 ? `${pac.edad} años` : "";
  const sexo = t(pac.sexo) === "F" ? "Femenino" : t(pac.sexo) === "M" ? "Masculino" : t(pac.sexo);
  const datos = [
    { etiqueta: "Paciente", valor: t(pac.nombre) || "Paciente sin identificar" },
    { etiqueta: "Documento", valor: t(pac.documento) },
    { etiqueta: "Edad y sexo", valor: [edad, sexo].filter(Boolean).join(" · ") },
    { etiqueta: "EPS", valor: t(pac.eps) },
    { etiqueta: "Fecha", valor: fechaLarga(input.fecha) },
    { etiqueta: "Lugar", valor: t(org.city) },
    { etiqueta: "Profesional", valor: t(med.nombre) },
    { etiqueta: "Especialidad", valor: t(med.especialidad) },
  ].filter((x) => x.valor);

  const bloques =
    input.tipo === "formula"
      ? bloquesDeLaFormula(d)
      : input.tipo === "indicaciones"
        ? bloquesDeLasIndicaciones(d)
        : bloquesDeLaNota(input, d);

  const firma = {
    nombre: t(med.nombre),
    lineas: [
      t(med.especialidad),
      t(med.documento) ? `CC ${t(med.documento)}` : "",
      t(med.registro) ? `Registro médico ${t(med.registro)}` : "",
    ].filter(Boolean),
  };

  // El sello del sistema del hospital, igual que el del papel anterior:
  // solo en la nota y solo con los cuatro datos personales del profesional.
  const sello =
    input.tipo === "nota" && t(med.honorifico) && t(med.responsable) && t(med.documento) && t(med.registro)
      ? [
          `Nota realizada por: ${t(med.honorifico)}. ${t(med.nombre)}${t(org.name) ? ` Empresa: ${t(org.name)}` : ""} Fecha y hora: ${fechaDelSello(input.fecha)}`,
          `Responsable: ${t(med.responsable)}`,
          `Identificación: CC${t(med.documento)}`,
          `Reg. Med.: ${t(med.registro)}`,
          `Especialidad: ${t(med.especialidad).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()}`,
        ]
      : [];

  return {
    tipo: input.tipo,
    titulo: TITULOS[input.tipo],
    membrete: { nombre: t(org.name), lineas: lineasOrg },
    datos,
    bloques,
    firma,
    sello,
    pie: `${t(org.name) ? `${t(org.name)} · ` : ""}Documento generado con asistencia de IA y revisado por el profesional de salud. Generado con Miracle.`,
    demo: Boolean(input.demo),
  };
}
