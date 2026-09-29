// Catálogo reducido de códigos clínicos frecuentes (demo).
// CIE-10 = diagnósticos · CUPS = procedimientos (Colombia).

export type CatalogCode = {
  sistema: "CIE-10" | "CUPS";
  codigo: string;
  descripcion: string;
};

export const CODE_CATALOG: CatalogCode[] = [
  // ---- CIE-10 (diagnósticos) ----
  { sistema: "CIE-10", codigo: "I10", descripcion: "Hipertensión esencial (primaria)" },
  { sistema: "CIE-10", codigo: "E11", descripcion: "Diabetes mellitus tipo 2" },
  { sistema: "CIE-10", codigo: "E66.9", descripcion: "Obesidad, no especificada" },
  { sistema: "CIE-10", codigo: "J00", descripcion: "Rinofaringitis aguda (resfriado común)" },
  { sistema: "CIE-10", codigo: "J02.9", descripcion: "Faringitis aguda, no especificada" },
  { sistema: "CIE-10", codigo: "J06.9", descripcion: "Infección aguda de vías respiratorias superiores" },
  { sistema: "CIE-10", codigo: "J45", descripcion: "Asma" },
  { sistema: "CIE-10", codigo: "A09", descripcion: "Diarrea y gastroenteritis de presunto origen infeccioso" },
  { sistema: "CIE-10", codigo: "K29", descripcion: "Gastritis y duodenitis" },
  { sistema: "CIE-10", codigo: "R10.4", descripcion: "Dolor abdominal, otro y no especificado" },
  { sistema: "CIE-10", codigo: "N39.0", descripcion: "Infección de vías urinarias, sitio no especificado" },
  { sistema: "CIE-10", codigo: "R51", descripcion: "Cefalea" },
  { sistema: "CIE-10", codigo: "G43.9", descripcion: "Migraña, no especificada" },
  { sistema: "CIE-10", codigo: "M54.5", descripcion: "Lumbago no especificado" },
  { sistema: "CIE-10", codigo: "R50.9", descripcion: "Fiebre, no especificada" },
  { sistema: "CIE-10", codigo: "B34.9", descripcion: "Infección viral, no especificada" },
  { sistema: "CIE-10", codigo: "F41.9", descripcion: "Trastorno de ansiedad, no especificado" },
  { sistema: "CIE-10", codigo: "F32.9", descripcion: "Episodio depresivo, no especificado" },
  { sistema: "CIE-10", codigo: "H66.9", descripcion: "Otitis media, no especificada" },
  { sistema: "CIE-10", codigo: "L20.9", descripcion: "Dermatitis atópica, no especificada" },
  { sistema: "CIE-10", codigo: "Z00.0", descripcion: "Examen médico general" },

  // ---- CUPS (procedimientos) ----
  { sistema: "CUPS", codigo: "890205", descripcion: "Consulta de primera vez por medicina general" },
  { sistema: "CUPS", codigo: "890305", descripcion: "Consulta de control o seguimiento por medicina general" },
  { sistema: "CUPS", codigo: "890201", descripcion: "Consulta de primera vez por medicina especializada" },
  { sistema: "CUPS", codigo: "890301", descripcion: "Consulta de control o seguimiento por medicina especializada" },
  { sistema: "CUPS", codigo: "902210", descripcion: "Hemograma (hemoglobina, hematocrito, recuento, índices)" },
  { sistema: "CUPS", codigo: "903841", descripcion: "Glucosa en suero u otro fluido" },
  { sistema: "CUPS", codigo: "901235", descripcion: "Uroanálisis (parcial de orina)" },
  { sistema: "CUPS", codigo: "871060", descripcion: "Radiografía de tórax (PA o AP y lateral)" },
  { sistema: "CUPS", codigo: "904509", descripcion: "Creatinina en suero u otros" },
  { sistema: "CUPS", codigo: "993102", descripcion: "Aplicación de medicamentos vía intramuscular" },
];

export function searchCodes(
  sistema: "CIE-10" | "CUPS",
  query: string,
  limit = 6,
): CatalogCode[] {
  const q = query.trim().toLowerCase();
  const base = CODE_CATALOG.filter((c) => c.sistema === sistema);
  if (!q) return base.slice(0, limit);
  return base
    .filter(
      (c) =>
        c.codigo.toLowerCase().includes(q) ||
        c.descripcion.toLowerCase().includes(q),
    )
    .slice(0, limit);
}
