// Métricas ilustrativas para los reportes de gerencia (datos de ejemplo).

export const adoptionByService = [
  { servicio: "Consulta externa", notas: 124 },
  { servicio: "Urgencias", notas: 86 },
  { servicio: "Hospitalización", notas: 52 },
  { servicio: "Pediatría", notas: 38 },
];

// Minutos promedio de documentación por nota.
export const timeBeforeAfter = [
  { label: "Medicina interna", antes: 11, despues: 4 },
  { label: "Medicina general", antes: 9, despues: 3 },
  { label: "Urgencias", antes: 7, despues: 3 },
  { label: "Pediatría", antes: 10, despues: 4 },
];

// Tendencia semanal de notas generadas.
export const weeklyNotes = [
  { semana: "S1", notas: 42 },
  { semana: "S2", notas: 58 },
  { semana: "S3", notas: 73 },
  { semana: "S4", notas: 91 },
  { semana: "S5", notas: 104 },
  { semana: "S6", notas: 118 },
];

export const managementKpis = {
  notasGeneradas: 300,
  medicosActivos: 14,
  medicosTotales: 18,
  tiempoAhorradoHoras: 96,
  completitudPromedio: 0.93,
};

export const qualityByService = [
  { servicio: "Medicina interna", completitud: 0.96 },
  { servicio: "Medicina general", completitud: 0.92 },
  { servicio: "Urgencias", completitud: 0.88 },
  { servicio: "Pediatría", completitud: 0.94 },
];
