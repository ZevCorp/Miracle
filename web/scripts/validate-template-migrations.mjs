// Validador de las migraciones de renovación del catálogo de plantillas
// (2026-08-11). Verifica ANTES de aplicar a producción que:
//  - cada UPDATE apunta a un id de fábrica del inventario, exactamente una vez;
//  - ningún statement toca ids protegidos (b1…, c0ca5d00…); b2…0001 solo admite
//    el ajuste de description;
//  - cada INSERT usa el new_id asignado a su especialidad, con
//    scope=institutional, is_default=false, status=active;
//  - el JSON de sections cumple el contrato (6–12 secciones, keys snake_case
//    únicas, order consecutivo, label ≤90, instruction presente ≤400) y los
//    límites de name/description.
// Uso: node scripts/validate-template-migrations.mjs
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const INVENTORY_PATH = join(ROOT, "scripts", "template-inventory-2026-08-11.json");
const FILE_PATTERN = /^20260811\d{6}_templates_area_.+\.sql$/;

const PEDIATRIA_INTEGRAL_ID = "b2000000-0000-4000-8000-000000000001";
const MIN_SECTIONS = 6;
const MAX_SECTIONS = 12;
const MAX_LABEL = 90;
const MAX_INSTRUCTION = 400;
const MAX_NAME = 120;
const MAX_DESCRIPTION = 400;

const inventory = JSON.parse(readFileSync(INVENTORY_PATH, "utf8"));
const factoryIdToSpecialty = new Map();
const expectedInserts = new Map(); // specialty_code -> new_id
for (const [code, entry] of Object.entries(inventory.specialties)) {
  for (const id of Object.values(entry.factory)) factoryIdToSpecialty.set(id, code);
  if (entry.new_id) expectedInserts.set(code, entry.new_id);
}
const protectedIds = new Set(Object.values(inventory.protected_ids).flat());

/** Quita comentarios SQL y separa statements respetando literales de texto. */
function splitStatements(sql) {
  const statements = [];
  let current = "";
  let inString = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inString) {
      current += ch;
      if (ch === "'") {
        if (sql[i + 1] === "'") {
          current += "'";
          i++;
        } else {
          inString = false;
        }
      }
      continue;
    }
    if (ch === "'") {
      inString = true;
      current += ch;
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      current += "\n";
      continue;
    }
    if (ch === "/" && sql[i + 1] === "*") {
      i += 2;
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i++;
      continue;
    }
    if (ch === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

/** Literales '…' del statement en orden, ya des-escapados ('' → '). */
function stringLiterals(statement) {
  const literals = [];
  let i = 0;
  while (i < statement.length) {
    if (statement[i] !== "'") {
      i++;
      continue;
    }
    let value = "";
    i++;
    while (i < statement.length) {
      if (statement[i] === "'") {
        if (statement[i + 1] === "'") {
          value += "'";
          i += 2;
          continue;
        }
        i++;
        break;
      }
      value += statement[i];
      i++;
    }
    literals.push(value);
  }
  return literals;
}

const errors = [];
const warnings = [];

function validateSections(context, rawJson) {
  let sections;
  try {
    sections = JSON.parse(rawJson);
  } catch (cause) {
    errors.push(`${context}: sections no es JSON válido (${cause.message})`);
    return;
  }
  if (!Array.isArray(sections)) {
    errors.push(`${context}: sections no es un array`);
    return;
  }
  if (sections.length < MIN_SECTIONS || sections.length > MAX_SECTIONS) {
    errors.push(`${context}: ${sections.length} secciones (esperado ${MIN_SECTIONS}–${MAX_SECTIONS})`);
  }
  const keys = new Set();
  sections.forEach((section, index) => {
    const where = `${context} sección ${index + 1}`;
    if (typeof section.key !== "string" || !/^[a-z0-9_]+$/.test(section.key)) {
      errors.push(`${where}: key inválida (${JSON.stringify(section.key)})`);
    } else if (keys.has(section.key)) {
      errors.push(`${where}: key duplicada "${section.key}"`);
    } else {
      keys.add(section.key);
    }
    if (typeof section.label !== "string" || !section.label.trim() || section.label.length > MAX_LABEL) {
      errors.push(`${where}: label ausente o >${MAX_LABEL} chars`);
    }
    if (section.order !== index + 1) {
      errors.push(`${where}: order ${section.order}, esperado ${index + 1}`);
    }
    if (typeof section.instruction !== "string" || !section.instruction.trim()) {
      errors.push(`${where}: instruction ausente`);
    } else if (section.instruction.length > MAX_INSTRUCTION) {
      errors.push(`${where}: instruction de ${section.instruction.length} chars (máx ${MAX_INSTRUCTION})`);
    }
    if (section.required !== undefined && typeof section.required !== "boolean") {
      errors.push(`${where}: required debe ser boolean`);
    }
  });
}

function validateNameAndDescription(context, name, description) {
  if (!name?.trim() || name.length > MAX_NAME) {
    errors.push(`${context}: name ausente o >${MAX_NAME} chars`);
  }
  if (!description?.trim() || description.length > MAX_DESCRIPTION) {
    errors.push(`${context}: description ausente o >${MAX_DESCRIPTION} chars`);
  }
}

const files = readdirSync(MIGRATIONS_DIR).filter((file) => FILE_PATTERN.test(file)).sort();
if (!files.length) {
  console.error(`No hay migraciones que casen con ${FILE_PATTERN} en ${MIGRATIONS_DIR}`);
  process.exit(1);
}

const seenUpdates = new Map(); // factory id -> file
const seenInserts = new Map(); // new_id -> file
let pediatriaDescriptionUpdates = 0;

for (const file of files) {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  let updates = 0;
  let inserts = 0;
  for (const statement of splitStatements(sql)) {
    const normalized = statement.toLowerCase().replace(/\s+/g, " ");
    const literals = stringLiterals(statement);
    const context = `${file}`;

    if (normalized.startsWith("update public.clinical_templates")) {
      if (!normalized.includes("owner_id is null")) {
        errors.push(`${context}: UPDATE sin "owner_id is null" → ${statement.slice(0, 80)}…`);
      }
      const id = literals.at(-1);
      if (normalized.includes("sections =")) {
        // Reescritura completa: name, description, sections, id.
        if (literals.length !== 4) {
          errors.push(`${context}: UPDATE con ${literals.length} literales (esperado 4: name, description, sections, id) → id ${id}`);
          continue;
        }
        const [name, description, sectionsJson] = literals;
        const specialty = factoryIdToSpecialty.get(id);
        if (protectedIds.has(id)) {
          errors.push(`${context}: UPDATE a id PROTEGIDO ${id}`);
        } else if (!specialty) {
          errors.push(`${context}: UPDATE a id desconocido ${id} (no está en el inventario de fábrica)`);
        } else if (seenUpdates.has(id)) {
          errors.push(`${context}: id ${id} ya actualizado en ${seenUpdates.get(id)}`);
        } else {
          seenUpdates.set(id, file);
          updates++;
        }
        const label = `${context} [${specialty ?? "?"} ${id.slice(0, 8)} "${name?.slice(0, 40)}"]`;
        validateNameAndDescription(label, name, description);
        validateSections(label, sectionsJson);
        if (!normalized.includes("updated_at = now()")) {
          errors.push(`${label}: falta updated_at = now()`);
        }
      } else if (id === PEDIATRIA_INTEGRAL_ID && normalized.includes("description =")) {
        pediatriaDescriptionUpdates++;
        const description = literals[0];
        if (!description?.trim() || description.length > MAX_DESCRIPTION) {
          errors.push(`${context}: description de la integral de pediatría ausente o >${MAX_DESCRIPTION}`);
        }
      } else {
        errors.push(`${context}: UPDATE con forma inesperada → ${statement.slice(0, 100)}…`);
      }
      continue;
    }

    if (normalized.startsWith("insert into public.clinical_templates")) {
      if (literals.length !== 8) {
        errors.push(`${context}: INSERT con ${literals.length} literales (esperado 8) → ${statement.slice(0, 100)}…`);
        continue;
      }
      const [id, name, description, specialtyCode, specialtyName, scope, status, sectionsJson] = literals;
      const label = `${context} [${specialtyCode} INSERT "${name?.slice(0, 40)}"]`;
      const expectedId = expectedInserts.get(specialtyCode);
      if (protectedIds.has(id)) {
        errors.push(`${label}: INSERT con id PROTEGIDO ${id}`);
      } else if (!expectedId) {
        errors.push(`${label}: especialidad sin new_id asignado en el inventario`);
      } else if (id !== expectedId) {
        errors.push(`${label}: id ${id} ≠ new_id asignado ${expectedId}`);
      } else if (seenInserts.has(id)) {
        errors.push(`${label}: new_id ${id} ya insertado en ${seenInserts.get(id)}`);
      } else {
        seenInserts.set(id, file);
        inserts++;
      }
      if (scope !== "institutional") errors.push(`${label}: scope "${scope}" ≠ institutional`);
      if (status !== "active") errors.push(`${label}: status "${status}" ≠ active`);
      if (!specialtyName?.trim()) errors.push(`${label}: specialty_name vacío`);
      if (!/'institutional',\s*false,\s*'active'/i.test(statement)) {
        errors.push(`${label}: is_default debe ir en false (los defaults se asignan en su propia migración)`);
      }
      if (!normalized.includes("on conflict (id) do update")) {
        errors.push(`${label}: falta on conflict (id) do update (idempotencia)`);
      }
      validateNameAndDescription(label, name, description);
      validateSections(label, sectionsJson);
      continue;
    }

    errors.push(`${file}: statement inesperado (solo se admiten UPDATE/INSERT a clinical_templates) → ${statement.slice(0, 80)}…`);
  }
  console.log(`${file}: ${updates} updates, ${inserts} inserts`);
}

const missingUpdates = [...factoryIdToSpecialty.keys()].filter((id) => !seenUpdates.has(id));
if (missingUpdates.length) {
  errors.push(
    `Faltan UPDATEs para ${missingUpdates.length} plantillas de fábrica: ` +
      missingUpdates.map((id) => `${factoryIdToSpecialty.get(id)}:${id.slice(0, 8)}`).join(", "),
  );
}
const missingInserts = [...expectedInserts.entries()].filter(([, id]) => !seenInserts.has(id));
if (missingInserts.length) {
  errors.push(`Faltan INSERTs para: ${missingInserts.map(([code]) => code).join(", ")}`);
}
if (pediatriaDescriptionUpdates !== 1) {
  errors.push(
    `Se esperaba exactamente 1 UPDATE de description a la integral de pediatría (${PEDIATRIA_INTEGRAL_ID}); hay ${pediatriaDescriptionUpdates}`,
  );
}

console.log(
  `\nTotal: ${seenUpdates.size}/${factoryIdToSpecialty.size} updates de fábrica · ` +
    `${seenInserts.size}/${expectedInserts.size} inserts nuevos · ` +
    `${pediatriaDescriptionUpdates} ajuste de description (pediatría integral)`,
);
for (const warning of warnings) console.warn(`⚠ ${warning}`);
if (errors.length) {
  console.error(`\n✗ ${errors.length} errores:`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log("✓ Migraciones de plantillas válidas.");
