# CONTEXTO — Miracle (web) · documento de traspaso

> Léeme para entender TODO el proyecto y poder continuar en un chat nuevo.
> Última actualización: **junio 2026**. Estado: la web ya corre sobre Supabase
> (datos reales, multi-tenant). Falta encender la IA con una API key y el audio real.

---

## 1. Qué estamos construyendo (visión)

**Miracle** = un **scribe clínico ("ambient scribe")** para profesionales de la salud en
Colombia, al estilo de **Telepatía / Nabla / Heidi**. El médico atiende, el sistema
**escucha → transcribe → la IA arma la nota clínica estructurada → el médico la edita y
aprueba**, con sugerencia de **CIE-10 / CUPS** y trazabilidad para **RIPS**.

Hay **DOS productos separados**:

| Producto | Qué es | Estado |
|---|---|---|
| **Miracle (web)** | La app web (este repo). Scribe clínico. Funciona **sola**. | En desarrollo activo |
| **Milagro** | Extensión de Chrome que **toma control del PC** y, leyendo la interfaz (como un *clawbot*), copia la nota al **HIS** del hospital o donde el médico indique. | Aparte (NO se desarrolla en este repo) |

**Modelo de negocio:**
- **B2C** (médico independiente): se vende **solo la web**, por **mensualidad** (pagos: pendientes).
- **B2B** (hospitales): se vende **web + Milagro** (Milagro automatiza el copiar al HIS).

**Regla de oro:** la **web debe funcionar 100% independiente** de Milagro. Milagro va
*encima*; como lee toda la interfaz, la web solo debe ser **clara, ordenada y estable**
(no necesita "zonas especiales" para Milagro).

---

## 2. Repos, carpetas y despliegue (¡importante, hay confusión típica!)

| | Repo GitHub | Carpeta local | Qué es |
|---|---|---|---|
| 🟢 **LA WEB (este)** | `github.com/joseph1356k/Pagina-web-clientes-final` | `…\Documents\pagina web clientes final\Pagina-web-clientes-final` | El producto. **Aquí se trabaja.** |
| ⚪ "Graph" | `github.com/joseph1356k/Graph` | `…\Documents\miracle` | Repo viejo/aparte (backend de la extensión + cosas antiguas). **No es la web.** |

- **Rama de trabajo de la web:** `main` (se commitea y pushea directo).
- **Supabase:** proyecto **`miracle-app`** · ref **`zyvfamlhlmztliexvmej`** · `https://zyvfamlhlmztliexvmej.supabase.co`.
- **Vercel:** proyecto **`miracle-web`** (auto-deploy desde `main`). NO confundir con `miracle-zeta` (backend de la extensión).
- **GOTCHA de sesión:** las sesiones de Claude Code se han abierto con cwd en `…\miracle`
  (repo Graph). Por eso la barra de la app muestra "Graph" y la rama vieja
  `feature/web-definitiva-usuarios`. **El trabajo real NO está ahí**; cada comando hace
  `cd` a la carpeta de la web. Para evitar la confusión, **abrir Claude desde la carpeta de la web**.

---

## 3. Stack

Next.js 16 (App Router) · TypeScript · **Tailwind v4** (tokens en `app/globals.css` con
`@theme`, sin `tailwind.config`) · `next/font` (Schibsted Grotesk + Inter + Geist Mono) ·
`lucide-react` · **Supabase** (`@supabase/ssr`, `@supabase/supabase-js`).

```bash
cd "…/pagina web clientes final/Pagina-web-clientes-final"
npm install
npm run dev      # local; preview de Claude usa puerto 3100
npm run build    # debe pasar (27 rutas)
```

`.env.local` (gitignored) necesita:
```
NEXT_PUBLIC_SUPABASE_URL=https://zyvfamlhlmztliexvmej.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_qroW231Ts7UYAEgr_f5cnQ_3SrW2ZrI
NEXT_PUBLIC_SITE_URL=http://localhost:3100
# ANTHROPIC_API_KEY=sk-ant-...   <- pendiente, enciende la IA
# ANTHROPIC_MODEL=claude-sonnet-4-6
```

---

## 4. Cómo funcionan las CUENTAS y la arquitectura de DATOS (el corazón)

### Modelo multi-tenant por organización
Decisión clave: **cada usuario pertenece a UNA organización.**
- **B2C** = organización `personal` (de una persona). Al registrarse, se crea su org y
  queda como **admin de la suya**.
- **B2B** = organización `institution` (hospital) con varios miembros.
- **Todos los datos clínicos cuelgan de la organización** → aislamiento total entre clientes.

### Roles (3, dentro de una organización)
- **medico** — atiende, ve **lo suyo** (sus pacientes/consultas/notas). Único que inicia consultas.
- **supervisor** — ve **todo lo de su org** + Auditoría + Reportes.
- **admin** — lo del supervisor + gestiona Usuarios/roles + Configuración.
- ⚠️ **NO existe** un "super-admin" de plataforma (para que Miracle gestione todos los
  hospitales) ni un flujo de "invitar miembros a mi hospital". Hoy agrupar gente en un
  hospital es manual en la base. Son los dos huecos pendientes del B2B.

### Tablas en Supabase (`public`)
- `organizations` (id, name, kind `personal|institution`, nit…)
- `profiles` (id=auth.users, email, full_name, **role** TEXT, **organization_id**, specialty…)
- `patients` (organization_id, created_by, nombre, documento, edad, sexo, eps, antecedentes/alergias/medicamentos…)
- `consultations` (organization_id, medico_id, patient_id, estado, tipo, motivo, plantilla,
  resumen, **note**/​**codigos**/​**transcript** como JSONB, **firma** JSONB…)
- `audit_events` (organization_id, consultation_id, actor_name, accion, detalle, fecha) — append-only.

### Seguridad (RLS)
- Aislada por organización. **medico ve lo suyo; supervisor/admin ven lo de su org.**
- Helpers en schema `private` (SECURITY DEFINER): `current_org()`, `current_app_role()`, `is_admin()`.
- Trigger `private.handle_new_user()` crea la org personal al registrarse.
- El **rol vive en la base** (no en el navegador) → nadie se auto-asciende.
- Migraciones en `supabase/migrations/` (la grande: `20260628000000_multi_tenant_organizations.sql`).

### El store (puente app ↔ Supabase)
`app/app/providers.tsx` (`useStore`) es el **único punto** que habla con Supabase:
- Al montar, **carga** patients/consultations/audit/profiles desde Supabase.
- Las mutaciones (crear paciente/consulta, editar nota, aceptar código, aprobar/firmar…)
  **escriben en Supabase** + auditoría, con actualización optimista local.
- Las ~15 pantallas **no cambian** (misma interfaz `useStore`).
- Ya **no usa localStorage** para datos (solo el tema oscuro usa localStorage, y eso está bien).

---

## 5. La IA (arquitectura lista, falta la key)

Todo agnóstico del modelo, vía **rutas server** (`fetch` a la API de Anthropic), con
**fallback** si no hay `ANTHROPIC_API_KEY`:
- **`/api/chat`** → el **chatbot clínico flotante** (abajo-izquierda en toda la app).
- **`/api/generate-note`** → al finalizar la consulta, **la IA arma la nota** (hoy, sin key,
  usa un borrador base; con key, genera de verdad).
- **Recomendador de diagnósticos** (planeado): debe sugerir diagnósticos **mientras habla el
  médico**, analizando el contexto (no instantáneo). Se integra en la pestaña Codificación.
- ⚠️ Antes de poner la key: **las rutas `/api/*` NO están autenticadas** → asegurarlas
  (verificar sesión + rate-limit) para que nadie queme la cuenta de Claude.

---

## 6. Qué está HECHO (funciona y verificado)

- **Sitio público** (`app/(marketing)/`): landing premium + demo/cómo-funciona/seguridad/
  casos-de-uso/piloto/recursos/contacto (form → WhatsApp). Login.
- **Auth real** con Supabase: roles, gating por ruta (middleware `proxy.ts`), onboarding médico.
- **Plataforma** (`app/app/`): dashboard por rol, consultas + detalle (Historia/Codificación/
  Resumen/Transcripción/Auditoría), pacientes, notas, auditoría, **reportes (datos reales)**,
  plantillas, configuración, usuarios.
- **Núcleo clínico (web):** nueva consulta → captura "en vivo" (simulada) → genera nota →
  detalle. **Nota editable** por sección con **autoguardado**. **Códigos CIE-10/CUPS** manual
  con **autocompletar** (catálogo en `lib/clinical/codes.ts`). **Firma electrónica** al aprobar.
  **Exportar a PDF** (imprimir). **"Regrabar"** reinicia captura.
- **Datos en Supabase** (multi-tenant, sección 4) — **verificado**: crear paciente/consulta
  cae en la base con la org y el médico correctos; mutaciones persisten; sobrevive recarga.
- **UX:** **modo oscuro** (toggle, sin parpadeo, scopeado a la app), **buscador global Cmd+K**,
  **campana de notificaciones** (notas por revisar), **dictado por voz** (Web Speech API),
  `error.tsx`, contraste accesible.
- **Plantillas** propias del médico en Supabase (`clinical_templates`).
- Deploy real en Vercel (`miracle-web`).

**Cuentas de prueba** (todas en la org "Hospital Demo Miracle"):
`admin@miracle.app` / `MiracleAdmin2026!` · `medico@miracle.app` / `MiracleMedico2026!`
(supervisor existe también; primer usuario fue admin).

---

## 7. Qué FALTA (pendientes, en orden sugerido)

1. **Asegurar las rutas `/api/*`** (auth + límites) — barato, antes de la key.
2. **Activar la IA** con la `ANTHROPIC_API_KEY` → enciende chatbot + generación de notas +
   construir el **recomendador de diagnósticos** (mientras habla el médico).
3. **Audio real**: grabar (MediaRecorder) + transcribir (proveedor por decidir: Deepgram/
   Whisper). Hoy la captura es **simulada** (guion fijo). "Subir audio" no abre selector aún.
4. **B2B:** flujo de **invitar miembros** a un hospital; y un **super-admin** de plataforma.
5. **Cobros B2C** (Stripe u otro) — más adelante.
6. **Cumplimiento legal Colombia** (antes de pacientes reales): consentimiento (datos + grabar
   audio), retención de historia clínica (mín. 15 años), contrato Responsable/Encargado con
   cada hospital, transferencia internacional (Supabase está en EE. UU.), posible RNBD ante la
   SIC. (Habeas Data, Ley 1581/2012; Res. 1995/1999 y 839/2017; Ley 2015/2020.) **Requiere abogado.**
7. **Config institucional** sigue siendo maqueta (no guarda) — conectar a la org.
8. **Observabilidad** (Sentry) + **backups** de Supabase + **tests** automatizados + **CI**.

---

## 8. Gotchas (lecciones que costaron caro)

- **`loading.tsx` en `/app` ROMPE la hidratación** en Next 16 + Turbopack (los handlers no
  enganchan, sin error en consola). Se quitó. `error.tsx` sí es seguro.
- El esquema **EN VIVO de Supabase divergió** de los archivos de migración: `profiles.role`
  es **TEXT** (no enum), el helper es `is_admin()` (no `current_app_role`). **Verificar el
  esquema vivo con SQL antes de migrar.**
- El store antes marcaba `hydrated` con `requestAnimationFrame` → no persistía en pestañas en
  segundo plano. Arreglado.
- **Modo oscuro** scopeado a `.app-shell`; script anti-flash en `app/layout.tsx` +
  `suppressHydrationWarning` en `<html>`.
- Avisos `LF → CRLF` al commitear: normales en Windows.
- El **detalle de consulta** resuelve el nombre del médico desde `profiles` (`getMedicoName`),
  no desde datos mock.

---

## 9. Estructura rápida del repo

```
app/(marketing)/   → sitio público
app/app/           → plataforma (dashboard, consultas, pacientes, notas, reportes, usuarios…)
app/app/providers.tsx → STORE (puente a Supabase) ← el archivo más importante
app/api/chat, app/api/generate-note → rutas de IA
app/login, app/onboarding, app/auth/callback
components/app/     → UI de la plataforma (AppShell, MedicalChat, CommandPalette, NoteSectionView…)
components/marketing, components/brand, components/ui
lib/mock/          → tipos + helpers + (semilla ya no usada como fuente)
lib/clinical/codes.ts → catálogo CIE-10/CUPS
lib/auth/, lib/supabase/ → auth y clientes Supabase
supabase/migrations/ → esquema (multi-tenant aplicado)
```

---

*Si retomas: lo más probable es seguir por (1) asegurar `/api/*` o (2) activar la IA con la
key. El store (`app/app/providers.tsx`) es el centro de todo.*
