# Arquitectura — Miracle (web)

Cómo está construido por dentro. Complementa [`../CONTEXTO.md`](../CONTEXTO.md).

## 1. Capas

```
Navegador (Next.js 16 App Router, client components)
   └─ useStore  (app/app/providers.tsx)  ← ÚNICO punto que habla con Supabase
        ├─ lee/escribe tablas (supabase-js)
        └─ llama rutas server /api/* para la IA
Supabase (Postgres + Auth + RLS)
Anthropic API (vía /api/chat y /api/generate-note)
```

Las ~15 pantallas consumen `useStore`; **no hablan con Supabase directamente**. Por eso,
cambiar de localStorage a Supabase fue (casi) un solo archivo: `providers.tsx`.

## 2. Modelo de datos (multi-tenant por organización)

Idea: **cada usuario pertenece a UNA organización**. Un médico independiente (B2C) es una
organización `personal` de una persona; un hospital (B2B) es una `institution` con varios.
Todo lo clínico cuelga de la organización → aislamiento total entre clientes.

### Tablas (`public`)
- **`organizations`** — `id, name, kind ('personal'|'institution'), nit, created_at`.
- **`profiles`** — `id (=auth.users), email, full_name, role (TEXT: admin|supervisor|medico),
  organization_id, specialty_*, onboarding_*`.
- **`patients`** — `id, organization_id, created_by, nombre, documento, edad, sexo, eps,
  telefono, antecedentes[], alergias[], medicamentos[]`.
- **`consultations`** — `id, organization_id, medico_id, patient_id, servicio, especialidad,
  tipo, estado, motivo, fecha, duracion_min, plantilla, resumen, **note** jsonb, **codigos**
  jsonb, **transcript** jsonb, **firma** jsonb`.
- **`audit_events`** — `id, organization_id, consultation_id, actor_id, actor_name, accion,
  detalle, fecha` (append-only).
- **`clinical_templates`** — plantillas de nota (catálogo + propias del médico).

> `note`, `codigos` y `transcript` se guardan como **JSONB** dentro de la consulta (mismo
> shape que el store) → refactor suave. La **auditoría** es tabla aparte (registro inmutable).

### RLS (seguridad por organización)
- Aislada por organización: nadie ve lo de otra org.
- **Médico ve lo suyo; supervisor y admin ven todo lo de su org.** Pacientes privados del médico.
- Helpers en schema `private` (SECURITY DEFINER, evitan recursión RLS):
  `current_org()`, `current_app_role()`, `is_admin()`.
- Trigger `private.handle_new_user()` → al registrarse crea la **org personal** y deja al
  usuario como **admin de la suya**.
- El **rol vive en la base** (no en `user_metadata`/navegador) → nadie se auto-asciende.
- Migraciones en `supabase/migrations/` (la grande: `20260628000000_multi_tenant_organizations.sql`).

## 3. El store (`app/app/providers.tsx`)

- **Al montar:** carga `patients`, `consultations`, `audit_events` y `profiles` (para los
  nombres de médicos) desde Supabase, mapea a los tipos de la app y muestra un spinner.
- **Mutaciones** (crear paciente/consulta, editar nota, aceptar código, aprobar/firmar,
  exportar…): actualización **optimista local** + escritura a Supabase + inserción de
  `audit_events`. Patrón `mutate(id, fn, accion, detalle)` con un ref a las consultas.
- **Ya no usa localStorage** para datos. (El tema oscuro sí usa localStorage, y eso es correcto.)
- Expone: `consultations, patients, role, loading, getConsultation, getPatient,
  getMedicoName, addPatient, addConsultation, updateNote, addCode, setCodeStatus,
  approveNote, exportNote, markReviewed, resetDemo, toast, showToast`.

## 4. Auth y gating

- Supabase Auth (Google + correo/contraseña). Sesión por cookies (SSR con `@supabase/ssr`).
- **Middleware `proxy.ts`** (matcher `/app/:path*`, `/onboarding`): sin sesión → `/login`;
  sin perfil válido → `/login?error=account-not-ready`; sin permiso → `/app/dashboard`.
- `lib/auth/roles.ts` → `canAccessPath()` (médico no entra a usuarios/config/auditoría/
  reportes; `consultas/nueva` solo médico). `lib/auth/server.ts` → `getCurrentProfile()`,
  `requireRole()`.
- ⚠️ El middleware **NO cubre `/api/*`** → esas rutas hoy están abiertas (ver `roadmap.md`).

## 5. IA (lista para la key)

- Agnóstica del modelo, vía **rutas server** con `fetch` a Anthropic y **fallback** sin key:
  - `app/api/chat/route.ts` → chatbot clínico flotante.
  - `app/api/generate-note/route.ts` → genera la nota desde transcripción + plantilla.
- La key va en `ANTHROPIC_API_KEY` (env, **solo servidor**). Modelo configurable con
  `ANTHROPIC_MODEL` (por defecto `claude-sonnet-4-6`).
- Planeado: **recomendador de diagnósticos** mientras habla el médico (en la pestaña Codificación).

## 6. Flujo de una consulta

`consultas/nueva` (elige paciente/plantilla) → `en-vivo` (captura **simulada** hoy; botón
Finalizar) → llama a `/api/generate-note` (o borrador base sin key) → `addConsultation()`
escribe en Supabase → navega a `consultas/[id]` → pestañas Historia (editable + autoguardado)
· Codificación (CIE-10/CUPS + autocompletar) · Resumen · Transcripción · Auditoría →
Aprobar/Firmar/Exportar PDF.

## 7. Estructura de carpetas

```
app/(marketing)/   sitio público          app/app/  plataforma
app/app/providers.tsx  ← el store          app/api/{chat,generate-note}
components/app/  UI plataforma             components/{marketing,brand,ui}
lib/mock/  tipos + helpers                 lib/clinical/codes.ts  catálogo CIE-10/CUPS
lib/{auth,supabase}/                       supabase/migrations/
```
