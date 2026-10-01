---
name: pantalla-web
description: Construye o cambia una pantalla del portal Miracle Notes (apps/web, Next 16 + Supabase) con sus convenciones — las tres puertas de permisos que deben coincidir (canAccessPath, requireRole, el menú en lib/site.ts), la consulta en el servidor con su QueryErrorBanner, el loading.tsx, el rescate ensureX cuando se lee del store, tokens de diseño, móvil primero con objetivos de 44 px, tema oscuro, y los tests de invariantes que lo vigilan. Úsala cuando el usuario pida "una pantalla", "una página", "una vista", "una sección en el menú", "un listado de…", "una ficha de…", "una página de configuración", o cambie quién puede ver una ruta de /app o /superadmin.
---

# Una pantalla del portal

Lo que ya rompió, con su test guardián: la pantalla aparecía en el menú y al entrar rebotaba
(`route-guards.test.ts`), una caída de la base se veía igual que «no tienes nada pendiente»
(`QueryErrorBanner`), el store desactualizado decía «Consulta no encontrada» (`store-foto-vieja.test.ts`),
algo que en el teléfono se salía de lado (`mobile-first.test.ts`), y colores que no se leían de noche
(`dark-theme.test.ts`).

Es **Next 16**: `searchParams` y `params` son `Promise` (se hace `await`), `cookies()` también, y el
middleware es `proxy.ts`. Ante la duda sobre una API, la documentación está en
`node_modules/next/dist/docs/`.

## 1. Las tres puertas tienen que decir lo mismo

| Puerta | Dónde | Qué hace |
|---|---|---|
| `canAccessPath(role, pathname, isDemo)` | `lib/auth/roles.ts` | gobierna navegación y proxy. Por defecto permisiva; la secretaría y la demo son listas blancas |
| `await requireRole(...)` | `layout.tsx` o `page.tsx` de la ruta | la que de verdad redirige en el servidor |
| `{ label, href, icon, roles, group }` | `APP_NAV` en `lib/site.ts` | el menú (`AppSidebar` y `MobileBottomNavigation` lo leen con `visibleAppNav`) |

Si la pantalla es de un subconjunto de roles, toca las tres en el mismo commit. El ícono va en
`components/app/nav-icons.ts` por la clave `icon`. Y la base: si la pantalla lee una tabla, la RLS
es la defensa real (la UI nunca lo fue); si hace falta una política nueva, es `/migracion`.

## 2. La página

Patrón de `app/app/pacientes/page.tsx`:

```tsx
export default async function AlgoPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page } = await searchParams;
  const supabase = await createClient();                         // lib/supabase/server.ts
  const { data, count, error } = await supabase
    .from("tabla")
    .select("id, nombre, organizations!tabla_organization_id_fkey(name)", { count: "exact" })  // FK nombrada en el embed
    .range(from, to);
  if (error) return <AppPage><QueryErrorBanner reintentarHref={`/app/algo?q=${q ?? ""}`} /></AppPage>;
  if (!data?.length) return <EmptyState … />;                     // vacío de verdad, no un error tragado
  …
}
```

- **Un error de lectura nunca se pinta como lista vacía**: `QueryErrorBanner` (warning, «no
  sabemos»), y `reportError(error, { ruta: "/app/algo" })` sin datos del paciente.
- **`loading.tsx`** al lado, con el mismo ritmo visual que la página (ver `app/app/pacientes/loading.tsx`).
- **Mutaciones**: server action en `actions.ts` (`"use server"`): `getCurrentProfile()`, validar,
  hacer, `revalidatePath`, y `redirect('?error=…')` con un mensaje amable. Una ruta en `app/api/` solo
  para IA de pago, webhooks o exportaciones (y la IA es `/frontera-ia`).
- **Un componente de cliente que lee del store** (`useStore()` de `app/app/providers.tsx`): la
  «foto» del store es parcial y puede estar vieja. Antes de decir «no encontrado», `ensureConsultation(id)`
  / `ensurePatient(id)`, que devuelven `"ok" | "missing" | "error"`; y `"error"` no es `"missing"`.
- **Una columna nueva** que el código lee antes de que su migración esté aplicada: consulta aparte y
  tolerante (el código se despliega antes que la migración).

## 3. Cómo se ve

- Solo **tokens** de `app/globals.css` (`@theme`: `canvas`, `ink`, `muted`, `line`, `surface`,
  `accent`, `success|warning|danger` con `-soft` e `-ink`). Nada de hex sueltos: el tema oscuro
  (`:root.dark`) los redefine, y un hex no.
- Componentes de `components/ui` (`Button`, `Card`, `Badge`, `ConfirmDialog`…) antes que uno nuevo;
  íconos de `lucide-react`; animación con `motion`.
- **Móvil primero**: objetivos táctiles `min-h-11` (44 px), nada con ancho fijo que desborde a 390 px.
- Textos en español, de usted o tú según la pantalla vecina, y los errores dicen qué pasó y qué
  hacer, sin culpar.

## 4. Comprobar

```bash
cd apps/web
npx vitest run tests/route-guards.test.ts tests/store-foto-vieja.test.ts tests/mobile-first.test.ts tests/dark-theme.test.ts tests/privacy-claims.test.ts
```

Si cambiaste quién entra, añade el caso a `tests/route-guards.test.ts` o a `tests/roles.test.ts`. Y
después `/verifica-web`: el CI local y las capturas en móvil y escritorio, claro y oscuro, con el rol
que entra **y** con uno que no debería.
