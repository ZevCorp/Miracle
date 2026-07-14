# Propuesta backend — Áreas médicas y creación asistida de plantillas

> Estado: **propuesta** para una fase siguiente. Hoy NO está implementado en el
> backend. El frontend funciona con el contrato actual (`/api/clinical/*`) usando
> un catálogo de presentación en `lib/clinical/medical-areas.ts`.

## Contexto

La página de plantillas ahora navega **Área médica → Especialidad → Plantillas**.
La agrupación de las 49 especialidades en 9 áreas vive **solo en el frontend**
(`lib/clinical/medical-areas.ts`), como metadata de presentación:

- No contiene plantillas ni las duplica.
- Su clave es el `specialty_code` (acepta guiones o guion_bajo).
- El backend sigue siendo la fuente oficial de plantillas (`/api/clinical/templates`).

Esto es suficiente y no rompe el contrato. Pero si el producto quiere que el
área sea **dato oficial** (para reportería, filtros server-side, o consistencia
con otros clientes), conviene moverla al backend.

## Clasificación propuesta (fuente de verdad si se migra)

| Área (`area_code`) | Especialidades |
|---|---|
| `medicina-clinica` | medicina_general, medicina_familiar, medicina_interna, geriatria, cardiologia, dermatologia, endocrinologia, gastroenterologia, hematologia, infectologia, nefrologia, neumologia, neurologia, oncologia, reumatologia, alergologia |
| `materno-infantil` | pediatria, neonatologia, ginecologia_obstetricia, cirugia_pediatrica |
| `urgencias-critico` | urgencias, anestesiologia |
| `quirurgicas` | cirugia_general, cirugia_cardiovascular, cirugia_torax, cirugia_vascular, neurocirugia, cirugia_plastica, coloproctologia, ortopedia, oftalmologia, otorrinolaringologia, urologia, cirugia_maxilofacial |
| `salud-mental` | psiquiatria, psicologia |
| `diagnostico-apoyo` | radiologia, patologia, medicina_nuclear, genetica |
| `rehabilitacion-paliativos` | rehabilitacion, dolor_paliativos |
| `odontologia` | odontologia_general, endodoncia, periodoncia, ortodoncia, rehabilitacion_oral |
| `laboral-legal` | medicina_laboral, medicina_legal |

Cobertura: 49/49 especialidades, sin solapamientos (verificado en
`tests/clinical-templates.test.ts`).

## Opción A — Catálogo de especialidades con área (recomendada)

Tabla ligera de metadata de especialidades (sin plantillas):

```sql
create table clinical_specialties (
  code         text primary key,          -- 'medicina_general'
  name         text not null,             -- 'Medicina general'
  area_code    text not null,             -- 'medicina-clinica'
  area_name    text not null,             -- 'Medicina clínica'
  sort_order   int  not null default 0
);
```

Endpoint nuevo:

```http
GET /api/clinical/specialties
→ { "areas": [ { "code": "medicina-clinica", "name": "Medicina clínica",
     "specialties": [ { "code": "medicina_general", "name": "Medicina general" } ] } ] }
```

**Impacto frontend:** reemplazar `lib/clinical/medical-areas.ts` por una carga
desde este endpoint (con el mismo shape). El resto de la UI no cambia.

**Por qué vale la pena:** una sola fuente para todos los clientes, permite
reportería por área, y evita mantener la clasificación en el frontend.

## Opción B — `area_code` embebido en cada plantilla

Agregar `area_code` / `area_name` a la respuesta de `templateResponse`. Más
simple pero acopla el área a la plantilla (se repite por plantilla) y no da un
índice de especialidades independiente. Menos recomendable.

## Creación asistida por IA (opcional, futura)

La tercera forma de crear plantilla ("describe qué necesitas y Miracle propone la
estructura") requiere un endpoint que **hoy no existe**. Propuesta de contrato:

```http
POST /api/clinical/templates/suggest
{ "specialty": "medicina_general",
  "prompt": "Plantilla para control de hipertensión con adherencia, presión y plan" }
→ { "name": "Control de hipertensión",
    "description": "...",
    "sections": [ { "label": "...", "required": true, "instruction": "..." } ] }
```

- Devuelve un **borrador editable** con el MISMO shape de secciones que
  `POST /templates` (label/order/required/instruction) — el médico lo revisa y
  guarda con el flujo normal. No crea nada por sí mismo.
- Reusa el proveedor LLM ya configurado en el backend (`GRAPH_LLM_*`).
- **Impacto frontend:** el `TemplateBuilderPanel` ya está preparado; solo habría
  que añadir un modo "asistido" que llame este endpoint y precargue los bloques.
  Hoy se muestra como "próximamente" (`AssistedHint`), sin botón falso.

## Nada de esto bloquea la fase actual

La experiencia nueva (áreas, constructor por bloques, "usar como base", editar,
archivar, contadores correctos) funciona 100% con el contrato actual. Estas
propuestas son mejoras para una fase posterior y deben ir en ramas separadas del
backend, sin merge ni deploy automáticos.
