# Diagnóstico — Miracle (web)

> Auditoría verificada del codebase (junio 2026). Cada hallazgo está citado a su archivo y
> fue verificado adversarialmente. Se corrigieron falsos positivos usando el estado real de
> la base viva (ver "Correcciones" al final).

## 🔝 Las 7 prioridades reales

1. **Rutas `/api/*` sin auth, sin rate‑limit, sin validación** → abuso/coste de Anthropic.
2. **Escrituras clínicas "a ciegas" (fire‑and‑forget)** → pérdida silenciosa de datos en un registro legal.
3. **Sin consentimiento del paciente** (datos + grabación + envío a Anthropic en EE. UU.) → bloqueante legal.
4. **Sin tests, sin CI, sin observabilidad** → los cambios pueden romper auth/RLS sin avisar.
5. **Rendimiento a escala**: 4 índices FK faltantes + cargas de tablas completas sin paginación.
6. **Salida del LLM sin validar** (JSON sin esquema) → notas/códigos corruptos.
7. **Features "maqueta"** que parecen reales: config no guarda, captura simulada, "subir audio" no existe.

---

## 🔐 A. Seguridad / abuso

| Sev | Problema | Dónde | Cómo mejorar |
|---|---|---|---|
| 🔴 Alta | `/api/chat` y `/api/generate-note` **sin verificación de sesión ni rate‑limit** | `app/api/chat/route.ts`, `app/api/generate-note/route.ts` | Verificar sesión Supabase dentro del handler + límite por usuario/IP + tamaño de payload |
| 🟠 Media | `safeNext()` valida el redirect de forma básica (bloquea `//` pero no refina paths) | `app/auth/callback/route.ts:4` | Validar contra lista blanca de rutas o parsear con `URL()` |
| 🟠 Media | **PHI en logs**: `console.error` imprime respuesta de Anthropic / trozos de transcripción | `api/chat:70`, `api/generate-note:69,87` | Loguear solo código/estado; redactar datos del paciente |
| 🟡 Baja | `create_org_member` auto‑confirma email (`email_confirmed_at=now()`) sin verificación | `migrations/20260630010000:86` | Es el modelo admin‑invita (diseño); opcional: verificación de email |
| 🟡 Baja | Política de contraseña = solo longitud ≥8 | `migrations/20260630010000:63` | Añadir complejidad / rechazar comunes |
| 🟡 Baja | Un JWT de usuario borrado/baneado sigue válido hasta expirar (el rol sí es inmediato) | `lib/supabase/proxy.ts:37` | Forzar refresh o TTL corto para revocación de sesión |

## 💾 B. Integridad de datos / fiabilidad

| Sev | Problema | Dónde | Cómo mejorar |
|---|---|---|---|
| 🔴 Alta | **`persist()` / `remoteAudit()` fire‑and‑forget**: si falla, solo log; se pierde al recargar | `app/app/providers.tsx` (~209‑246) | `await` + confirmar con `.select()`; avisar y reintentar/rollback |
| 🔴 Alta | **Optimista sin rollback**: `addConsultation`/`addPatient` dejan "fantasmas" si el insert falla | `providers.tsx` (~288‑373) | Revertir el estado local en el `catch` |
| 🟠 Media | **Salida del LLM sin esquema**: `JSON.parse` crudo → códigos/nota parciales en JSONB | `api/generate-note:85`, `en-vivo/page.tsx` (`aiToConsultation`) | Validar con Zod antes de persistir |
| 🟠 Media | **FK de paciente sin chequeo de organización** (difícil de explotar: UUID no visibles + lecturas bajo RLS) | `migrations/20260628000000:130` | Constraint compuesto o trigger de validación |
| 🟠 Media | **Sin unique `(organization_id, documento)`** → pacientes duplicados | `migrations/20260628000000:98‑111` | `UNIQUE (organization_id, documento) WHERE documento IS NOT NULL` |
| 🟡 Baja | Audit inmutable "por omisión de GRANT"; `actor_name` nullable; consultas sin `updated_at` | `migrations/20260628000000:157‑171` | Trigger que rechaza UPDATE/DELETE; `actor_name NOT NULL`; `updated_at` |
| 🟡 Baja | IDs con `Date.now()` (toast, audit `a-`, code `k-`) pueden colisionar | `providers.tsx:147,265,439` | `crypto.randomUUID()` |

## ⚡ C. Rendimiento / escalabilidad

| Sev | Problema | Dónde | Cómo mejorar |
|---|---|---|---|
| 🟠 Alta | **4 índices FK faltantes**: `audit_events.organization_id`, `consultations.medico_id`, `patients.created_by`, `profiles.organization_id` | migraciones | Crear los 4 índices |
| 🟠 Alta | **Carga inicial de tablas completas** `select("*")` sin paginación | `providers.tsx:154‑159` | Acotar + paginar (RSC) |
| 🟠 Alta | **Proxy lee `profiles` en cada request** | `lib/supabase/proxy.ts:47` | Llevar el rol en el JWT (`app_metadata`/hook) |
| 🟠 Alta | **Consola super‑admin carga tablas enteras solo para contar** | `superadmin/page.tsx:19‑28`, `organizaciones/page.tsx` | Agregar con `count`/RPC; paginar |
| 🟠 Media | Sin **streaming** en las rutas de IA | `api/*/route.ts` | `stream:true` + SSE |
| 🟡 Baja | N+1 `countFor` por paciente; sin `React.memo` en vistas de dashboard | `pacientes/page.tsx:22`, `dashboard/page.tsx` | `useMemo`/mapa de conteos; memoizar |

## ⚖️ D. Cumplimiento legal (Colombia)

| Sev | Problema | Dónde | Cómo mejorar |
|---|---|---|---|
| 🔴 Crítica | **Sin registro de consentimiento** (datos + grabación + transferencia a Anthropic) | esquema (sin columnas) | Tablas/campos de consentimiento + UI antes del audio |
| 🟠 Alta | **Sin soft‑delete ni política de retención** (historia clínica 15 años) | migraciones | `deleted_at` + filtro RLS + política de borrado |
| 🟠 Alta | **Residencia de datos en EE. UU.** sin consentimiento de transferencia | Supabase us‑east‑1 | Abogado + consentimiento de transferencia / región |
| 🟠 Alta | **Sin derechos del titular** (exportar/borrar/revocar) | (no existe) | Endpoints de export/borrado |
| 🟠 Media | **Sin contrato Responsable/Encargado** con gating por organización | (no existe) | Tabla de contratos + activación condicionada |
| 🟡 Baja | Sin **Política de Privacidad / Términos** públicos; RNBD sin definir; cifrado sin verificar | `app/(marketing)/` | Páginas legales + verificar settings Supabase |

## 🧰 E. Calidad de ingeniería / operabilidad

| Sev | Problema | Dónde | Cómo mejorar |
|---|---|---|---|
| 🟠 Alta | **Cero tests** | todo el repo | Vitest + tests de `lib/` puro, luego auth/RLS |
| 🟠 Alta | **Sin CI/CD** | falta `.github/workflows/` | Pipeline lint + `tsc --noEmit` + build |
| 🟠 Alta | **Sin observabilidad** (Sentry) | todo el repo | Añadir `@sentry/nextjs` |
| 🟠 Media | **Sin validación de entrada** (Zod) en rutas/acciones | `api/*`, `*/actions.ts` | Esquemas Zod |
| 🟠 Media | **Sin error boundaries** en marketing/superadmin (solo `app/app/error.tsx`) | esas secciones | Añadir `error.tsx` |
| 🟡 Baja | `any` en `rowToPatient`/`rowToConsultation`; strings de rol hardcodeados; README genérico; sin pre‑commit; deps sin usar | varios | Generar tipos Supabase; centralizar roles; husky; `npm prune` |

## 🚧 F. Features incompletas / maqueta

| Sev | Problema | Dónde | Cómo mejorar |
|---|---|---|---|
| 🟠 Alta | **Configuración no guarda** — el botón solo muestra un toast | `configuracion/page.tsx:141` | Persistir (columnas en `organizations`) + acción de servidor |
| 🟠 Alta | **Captura simulada**: guion fijo `SCRIPT`, ignora el tipo de consulta | `consultas/en-vivo/page.tsx:21` | Audio real (MediaRecorder) + transcripción (futuro); etiquetar como demo |
| 🟠 Alta | **"Subir audio" no hace nada** (no abre selector, no procesa) | `consultas/nueva/page.tsx:27` | Deshabilitar hasta que exista transcripción |
| 🟠 Media | **Toggle de consentimiento decorativo** (sin efecto en BD/flujo) | `configuracion/page.tsx:85` | Persistir + gate en creación de consulta |

## 🎨 G. UX / accesibilidad

| Sev | Problema | Dónde | Cómo mejorar |
|---|---|---|---|
| 🟠 Media | **Contraseña visible** (`type="text"`) al crear cuenta | `usuarios/page.tsx:93`, `superadmin/usuarios/page.tsx:95` | `type="password"` + botón ver/ocultar |
| 🟠 Media | Errores no mostrados al usuario (fallo al cargar plantillas, carga inicial) | `nueva/page.tsx:92`, `providers.tsx:199` | Toast/estado de error visible |
| 🟠 Media | `Tabs` sin navegación por flechas; `select` sin anillo de foco visible | `components/app/Tabs.tsx`, forms | `onKeyDown` de flechas; `focus-visible:ring` |
| 🟡 Baja | Botón PDF sin `aria-label`; onboarding sin spinner | `consultas/[id]/page.tsx:201`, `ClinicalOnboardingForm.tsx` | `aria-label`; spinner en `pending` |

## 🗄️ H. Deuda de esquema / migraciones

| Sev | Problema | Dónde | Cómo mejorar |
|---|---|---|---|
| 🟠 Media | **Migraciones no reproducibles**: los archivos referencian `private.is_admin()` que solo existe en la base viva (creado a mano); replay limpio fallaría | `migrations/20260628000000` | Migración que defina `is_admin()` y alinee el esquema |
| 🟡 Baja | Políticas RLS **permisivas múltiples** por tabla/acción (coste menor) | migración superadmin | Consolidar si crece el volumen |

---

## Correcciones (falsos positivos descartados)

- ❌ *"`private.is_admin()` no existe → RLS falla"* → **existe en la base viva** (verificado por SQL); el RLS funciona. El problema real es de reproducibilidad de migraciones (H).
- ❌ *"El RPC `create_org_member` no es atómico → usuarios huérfanos"* → **falso**: las funciones plpgsql corren en una sola transacción.
- ❌ *"Cambio de rol tarda hasta 1h (JWT TTL)"* → **falso**: el proxy lee el rol de la BD en cada request; el cambio es inmediato.
- ❌ *"Usa mock data en las páginas"* → **falso**: ya lee datos reales de Supabase (`lib/mock` es solo tipos/semilla).

---

*En una frase: la arquitectura es sólida; lo que falla es **madurez de producción** —
asegurar `/api/*`, guardados confiables, cumplimiento legal, tests/CI/observabilidad, y
escalabilidad. Estado de avance en [`roadmap.md`](./roadmap.md).*
