# Contexto de sesión — Miracle (web + plataforma)

> Documento de traspaso. Estado real a la fecha. Última actualización: 20 jun 2026.

---

## 1. Qué es

**Miracle** — plataforma de **inteligencia clínica-operativa** para hospitales/clínicas/IPS en Colombia.
Posicionamiento: NO es "dictado médico"; es la capa que **documenta, estructura, codifica (CIE-10/CUPS), audita y se adapta** al flujo del hospital. Diferencial = **CIE-10 + CUPS + RIPS + auditoría + "no cambie su sistema"**.

- **Carpeta local:** `C:\Users\Jose David Jaramillo\Documents\Pagina-web-clientes-final`
- **Repo:** `github.com/joseph1356k/Pagina-web-clientes-final` (rama `main`).
- NO confundir con `...\Documents\miracle` (repo viejo "Graph").

## 2. Stack

Next.js 16 (App Router) + TS + **Tailwind v4** (tokens en `app/globals.css` con `@theme`, sin `tailwind.config`) + `next/font` (Geist + Inter) + `lucide-react` + **`@supabase/ssr` + `@supabase/supabase-js`**. Deploy objetivo: Vercel.

```bash
cd "C:/Users/Jose David Jaramillo/Documents/Pagina-web-clientes-final"
npm install
npm run dev      # http://localhost:3000  (preview de Claude: puerto 3100)
npm run build    # pasa: 24 rutas + middleware
```

## 3. Marca
Logo = **esfera azul perlada** + "MIRACLE", tagline *"The clinical intelligence of tomorrow"* (`Downloads/Branding Miracle.jpeg`). `components/brand/BrandMark.tsx` + `Logo.tsx`. Paleta (tokens en `app/globals.css`): Deep `#0F172A`, Ice `#DCEFFD`, Mint `#B7F0D8`, Pearl `#F8FAFC`, Mist `#CBD5E1`, accent `#1F6FEB`. Tema claro; sidebar de app oscuro.

## 4. Qué está construido

### A) Landing pública (`app/(marketing)/`)
Home (13 secciones) + `demo`, `como-funciona`, `seguridad`, `casos-de-uso`, `piloto`, `recursos`, `contacto` (form→WhatsApp), `login`. CTA = WhatsApp `wa.me/573172550953`. Claims seguros.

### B) Plataforma privada (`app/app/`) — navegable con datos mock
- Datos en `lib/mock/` (pacientes, médicos, 6 consultas con nota por secciones/transcript/resumen/códigos CIE-10+CUPS/auditoría, plantillas, métricas). Ficticios.
- **Store de sesión cliente:** `app/app/providers.tsx` (React Context + `localStorage`): consultas + mutadores (approve/export/markReviewed/setCodeStatus/addConsultation) + toasts. Acciones cambian estado real y persisten.
- Pantalla núcleo `consultas/[id]`: pestañas Historia clínica (acordeón) · Codificación (CIE-10/CUPS + confianza + aceptar/descartar + checklist RIPS) · Resumen · Transcripción · Auditoría (timeline). Aprobar/Exportar cambian estado.
- Flujo `consultas/nueva` → `en-vivo` (waveform + transcript) → genera consulta → `[id]`.
- Módulos: `dashboard` (por rol), `consultas` (filtros), `pacientes` + `[id]`, `notas`, `auditoria`, `reportes` (charts SVG en `components/app/Charts.tsx`), `plantillas`, `configuracion`, `usuarios`.

### C) Capa de autenticación Supabase (EN PROGRESO — ya en el repo)
> Construida fuera de la sesión principal (parece otro agente/tool). **Compila** pero **NO está conectada**.
- `lib/supabase/{client,server,proxy}.ts` — clientes SSR (usan `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
- `lib/auth/roles.ts` — roles **`admin` / `supervisor` / `medico`** + `canAccessPath()` (gating por ruta: médico NO ve usuarios/configuración/auditoría/reportes; `consultas/nueva` solo médico).
- `lib/auth/server.ts` — `getCurrentProfile()` (lee tabla `profiles` por claims) + `requireRole()`.
- **Middleware/Proxy** activo (build muestra "ƒ Proxy (Middleware)"): sin sesión → `/login`; sin perfil válido → `/login?error=account-not-ready`; sin permiso → `/app/dashboard?error=forbidden`.
- `app/auth/callback` (OAuth), `app/login` (**Acceso con Google**), `app/app/usuarios` lee `profiles` + acción `updateUserRole`.

## 5. Estado real (CONECTADO y funcional)

- **Supabase conectado:** proyecto `zyvfamlhlmztliexvmej` (`https://zyvfamlhlmztliexvmej.supabase.co`). `.env.local` con URL + publishable key (gitignored). Esquema `profiles` + roles + RLS (`private.is_admin`) + trigger (`private.handle_new_user`, primer usuario = admin) aplicados. Hardening de funciones SECURITY DEFINER hecho.
- **Auth funcional:** middleware gatea `/app/*`; redirige a `/login` sin sesión; nav y vistas por rol. Verificado en preview (login, logout, médico vs admin, lectura de `profiles`). Sin errores de consola.
- **Login:** Google (principal, **PENDIENTE configurar credenciales en Google Cloud + Supabase**) + email/contraseña (fallback, ya funciona).
  - **Usuarios de prueba:** `admin@miracle.app` / `MiracleAdmin2026!` · `medico@miracle.app` / `MiracleMedico2026!`.
- **Vista del médico LIMPIA (hecho):** hero "Iniciar consulta" + "Por revisar y firmar" + "Consultas de hoy" + "Pacientes recientes". Sin métricas de gerencia, sin selector de rol. Menú del médico = Inicio, Consultas, Pacientes, Notas, Plantillas.
- **Pendiente real:** (a) credenciales Google; (b) habilitar "leaked password protection" en Supabase Auth (advisor WARN); (c) los datos clínicos siguen mock (store cliente) — solo auth/perfiles están en Supabase; (d) deploy a Vercel.

## 6. Decisiones pendientes (antes de ejecutar)
- **Método de login:** Google (necesita setup tuyo en Google Cloud) vs **email magic-link** (lo dejo funcionando ya).
- **Proyecto Supabase:** crear uno nuevo para esta app, o reusar el existente de Miracle (ref `nzccbfccuvyfxujymizr`).
- Confirmar que **nadie más está editando estos archivos en paralelo** (para no chocar).

## 7. Gotchas
- Preview de Claude en `localhost:3100` vía `../miracle/.claude/launch.json` (la sesión tiene cwd en `miracle`). El **screenshot del preview se cuelga** por el websocket HMR → verificar con `preview_snapshot`/`preview_logs`.
- `.gitignore` excluye `node_modules`, `.next`, `.env*`. Avisos LF→CRLF al commitear: normales en Windows.
- **OJO:** los comandos de exploración por defecto corren con cwd en `miracle` (repo viejo), no en este repo — usar rutas absolutas.

## 8. Próximos pasos
1. Conectar Supabase (proyecto + esquema `profiles` + RLS + env) → auth real.
2. Definir login (Google o email) y dejar entrar de verdad.
3. **Rehacer la vista del médico limpia** (UX real de médico).
4. Verificar que todos los botones hacen algo o se ocultan.
5. Deploy a Vercel.
