import type { Doctor, Patient } from "./types";

// Pacientes ficticios (sin datos reales).
export const patients: Patient[] = [
  {
    id: "p1",
    nombre: "María González",
    documento: "CC 1.018.xxx.221",
    edad: 28,
    sexo: "F",
    eps: "Nueva EPS",
    telefono: "+57 3xx xxx 1180",
    antecedentes: ["Asma bronquial en la infancia"],
    alergias: ["Sin alergias conocidas"],
    medicamentos: ["Salbutamol inhalador a demanda"],
  },
  {
    id: "p2",
    nombre: "Carlos Ramírez",
    documento: "CC 79.xxx.654",
    edad: 54,
    sexo: "M",
    eps: "Sura EPS",
    telefono: "+57 3xx xxx 7745",
    antecedentes: ["Hipertensión arterial", "Diabetes mellitus tipo 2"],
    alergias: ["Penicilina"],
    medicamentos: ["Losartán 50 mg", "Metformina 850 mg"],
  },
  {
    id: "p3",
    nombre: "Laura Martínez",
    documento: "CC 1.090.xxx.310",
    edad: 18,
    sexo: "F",
    eps: "Sanitas EPS",
    telefono: "+57 3xx xxx 2093",
    antecedentes: ["Niega antecedentes patológicos relevantes"],
    alergias: ["Sin alergias conocidas"],
    medicamentos: ["Ninguno"],
  },
  {
    id: "p4",
    nombre: "Jorge Pérez",
    documento: "CC 80.xxx.118",
    edad: 41,
    sexo: "M",
    eps: "Compensar EPS",
    telefono: "+57 3xx xxx 5521",
    antecedentes: ["Lumbalgia mecánica recurrente"],
    alergias: ["Sin alergias conocidas"],
    medicamentos: ["Acetaminofén a demanda"],
  },
  {
    id: "p5",
    nombre: "Ana Torres",
    documento: "CC 52.xxx.903",
    edad: 67,
    sexo: "F",
    eps: "Famisanar EPS",
    telefono: "+57 3xx xxx 8830",
    antecedentes: ["Hipotiroidismo", "Osteoartrosis de rodilla"],
    alergias: ["Sulfas"],
    medicamentos: ["Levotiroxina 75 mcg"],
  },
  {
    id: "p6",
    nombre: "Andrés Vargas",
    documento: "CC 1.032.xxx.477",
    edad: 9,
    sexo: "M",
    eps: "Nueva EPS",
    telefono: "+57 3xx xxx 4412",
    antecedentes: ["Dermatitis atópica"],
    alergias: ["Sin alergias conocidas"],
    medicamentos: ["Emolientes tópicos"],
  },
];

// Equipo médico ficticio.
export const doctors: Doctor[] = [
  {
    id: "d1",
    nombre: "Dra. Daniela Rincón",
    especialidad: "Medicina interna",
    rol: "medico",
    iniciales: "DR",
  },
  {
    id: "d2",
    nombre: "Dr. Felipe Castaño",
    especialidad: "Medicina general",
    rol: "medico",
    iniciales: "FC",
  },
  {
    id: "d3",
    nombre: "Dr. Mauricio Lozano",
    especialidad: "Auditoría médica",
    rol: "supervisor",
    iniciales: "ML",
  },
  {
    id: "d4",
    nombre: "Dra. Patricia Núñez",
    especialidad: "Dirección médica",
    rol: "admin",
    iniciales: "PN",
  },
];

export const SERVICIOS = [
  "Consulta externa",
  "Urgencias",
  "Hospitalización",
] as const;

export const ESPECIALIDADES = [
  "Medicina interna",
  "Medicina general",
  "Pediatría",
  "Ortopedia",
  "Ginecología",
] as const;

export function patientById(id: string, list: Patient[] = patients) {
  return list.find((p) => p.id === id);
}

export function doctorById(id: string, list: Doctor[] = doctors) {
  return list.find((d) => d.id === id);
}
