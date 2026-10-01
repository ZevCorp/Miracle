---
name: verifica-web
description: Verifica una rama del portal Miracle Notes (apps/web) antes del PR — corre localmente exactamente lo que corre web-ci.yml (lint, typecheck, test, build con las variables del CI), recorre las pantallas tocadas en móvil y escritorio, claro y oscuro, con capturas y medidas (errores de consola, desborde horizontal, objetivos táctiles de menos de 44 px), y deja la tabla de evidencia. Úsala cuando una rama toque apps/web y el usuario diga "verifica el portal", "¿pasa el CI?", "¿se ve bien en el celular?", "revisa las pantallas", "listo para PR", o antes de /a-main con cambios en el portal.
---

# Verificar el portal

El portal no numera promesas (decisión del dueño) y **no tiene portero local**: lo juzga
`web-ci.yml` en el PR. Sin esto, el primer lint, typecheck y build de la rama es el del CI.

## 1. Lo que hará el CI, aquí

```bash
bash .claude/skills/verifica-web/scripts/ci_local.sh               # install, lint, typecheck, test, build
bash .claude/skills/verifica-web/scripts/ci_local.sh --sin-install # si node_modules ya está al día
```

Usa las mismas variables de mentira que el workflow y aparta `.env.local` durante el build: un build
que solo pasa con tus claves de verdad no es el que va a correr el CI. Tarda ~1,5 min con
`node_modules` instalado. El CI usa Node 20; si algo solo falla allí, empieza por la versión.

Antes de leer cualquier API de Next en el código: es **Next 16** (`proxy.ts` en vez de
`middleware.ts`, `searchParams` y `cookies()` asíncronos). Su documentación está en
`apps/web/node_modules/next/dist/docs/` una vez instalado; `AGENTS.md` del portal lo exige.

## 2. Las pantallas, en el teléfono y de noche

```bash
cd apps/web
npm i --no-save playwright-core          # --no-save: no toca package.json ni el lock (se genera en Windows)
npm run dev                              # en otra terminal: puerto 3100
node scripts/dev-session.mjs medico      # cookie de una cuenta de PRUEBA (demo, medico, patologo, supervisor, admin, superadmin)
node ../../.claude/skills/verifica-web/scripts/pantallas.mjs \
     --rutas /app/consultas,/app/pacientes --cookie "<la cookie>" --salida /tmp/pantallas
```

Por cada ruta: móvil (390×844) y escritorio (1280×800), claro y oscuro. Mide y dice:

| Medida | Por qué |
|---|---|
| a dónde redirigió | sin sesión, `/app/*` acaba en `/login`: si no pasaste cookie, eso no es un fallo |
| excepciones y errores de consola | una excepción es ✘ |
| desborde horizontal | en un teléfono, la página se mueve de lado: ✘ (`tests/mobile-first.test.ts` vigila lo mismo en el código) |
| objetivos táctiles < 44 px en móvil | la regla de `components/ui` es `min-h-11` |
| el tema oscuro no se pintó | `lib/theme.ts` sigue al sistema cuando no hay nada guardado |

Deja las capturas y una hoja de contactos (`index.html`). **Mira las capturas** (léelas como
imágenes) de las rutas que tocó la rama: las medidas no ven un texto encima de otro ni un color
que no se lee.

Qué rutas: las que la rama toca (`git diff --name-only origin/main...HEAD -- apps/web/app`), más la
pantalla que las enlaza. Con los roles a los que afecta: un cambio de permisos se mira con el rol
que gana acceso **y** con el que no debería tenerlo.

## 3. Lo que el CI no mira

- `python3 .claude/skills/revisa/scripts/higiene.py apps/web`: datos clínicos en logs, `fetch` sin
  plazo, «protegido» sin certificar, migraciones.
- Si la rama añade una migración, `/migracion`: el código se despliega antes que ella.
- Si la rama añade una llamada a IA, `/frontera-ia`.

## 4. La evidencia

```markdown
| Nivel | Resultado | Detalle |
|---|---|---|
| lint · typecheck · test · build (ci_local.sh) | ✅ | 23 s · 17 s · 5 s · 40 s |
| Pantallas | ✅ | /app/consultas y /app/pacientes, móvil y escritorio, claro y oscuro, rol medico: 8 capturas, sin desborde ni errores |
| Rol sin acceso | ✅ | supervisor → redirige a /app |
| higiene | ✅ | 0 ✘ |
```

Lo no corrido va como **⚪ no corrido, y por qué**, nunca como ✅. Después, `/a-main`.
