# El despliegue: Graph y el portal, desde el monorepo

Diseñado y aplicado el 2026-09-29 con `/architect`: dos diseños independientes, uno con el sesgo «lo
mínimo seguro para lanzar ya» y otro con «lo que aguanta miles de usuarios y un equipo de 8», y una
síntesis. Este documento es esa síntesis.

## Problema

Graph y el portal tienen que desplegarse desde el monorepo, en una cuenta nueva de Vercel, **sin tocar
la producción de hoy**: `graph-eight-pied.vercel.app` e `itsmiracleai.com.co` siguen saliendo de los
repos viejos (`joseph1356k/Graph`, `joseph1356k/Pagina-web-clientes-final`) hasta el corte, y se les
siguen empujando arreglos. Lo que hizo la forma no obvia:

- **15 variables de producción de Graph son *sensitive*: Vercel no deja leerlas**, ni al dueño. Entre
  ellas la clave de servicio de Supabase y las de Neo4j, OpenAI Realtime, Typesafe y Resend.
- **Una sola base de Supabase para todos.** Dos Graph contra ella duplicarían el cron diario (rescata
  consultas con un LLM, purga datos, manda alertas).
- **Graph se reconfigura a sí mismo**: Provider Studio escribe las API keys en las variables de SU
  proyecto de Vercel (`GRAPH_VERCEL_*`) y dispara releases de Windows (`WINDOWS_APP_GITHUB_*`).
  Copiadas tal cual, el Graph nuevo reescribiría la producción vieja o sacaría una release real.
- Los clientes nativos llevan escrita la URL de Graph (`graph-eight-pied.vercel.app`, en Windows, Mac
  y Android): el corte de Graph pasa por un dominio propio y una versión de cada cliente.

## Uso (cómo despliega un dev)

```text
merge a main de un PR que toca services/graph/   →  graph-ci.yml: npm test
                                                  →  vercel-desplegar.yml: deploy --prod, prueba de
                                                     humo contra miracle-graph.vercel.app, y rollback
                                                     automático si no responde sano
```

- **Redesplegar sin cambiar código** (por ejemplo, tras cambiar una variable en Vercel): Actions →
  *Graph · CI* (o *Web · CI*) → *Run workflow* en `main`.
- **Cambiar una variable**: en Vercel, proyecto → Settings → Environment Variables, y redesplegar.
  Los secretos van como *sensitive*.
- **Volver atrás**: el rollback es automático si la prueba de humo falla. A mano: en Vercel,
  Deployments → la versión buena → *Promote*, o revertir el PR.
- **Nadie necesita cuenta en Vercel para desplegar**: se despliega mergeando.

## Forma

| | Graph | Portal (web) |
|---|---|---|
| Proyecto Vercel | `graph`, equipo `the-world-changers` | `miracle-web`, mismo equipo |
| Carpeta | `services/graph` (su `vercel.json`) | `apps/web` (Next.js) |
| Dominio | `miracle-graph.vercel.app` | `miracle-notes.vercel.app` |
| Runtime | Node 24.x, fluid compute, región `iad1` (junto a Supabase us-east-1) | igual |
| Git | sin conectar: despliega el CI | igual |

**Variables, por grupos (solo Production):**

1. **Copiadas del proyecto viejo** (las 44 que se pueden leer), con los secretos marcados
   *sensitive* también en la cuenta nueva.
2. **Cambiadas:** `PUBLIC_BASE_URL` es la URL nueva; `ALLOWED_ORIGINS` suma el portal nuevo;
   `MIRACLE_API_KEYS` suma una clave propia para el portal nuevo (`web-cuenta-nueva`), que es su
   `MIRACLE_API_KEY`.
3. **Sustituidas por una equivalente legible**, porque la original es *sensitive*: `OPENAI_API_KEY`
   (la del LLM de Graph), `OPENAI_REALTIME_KEY` y `OPENAI_LIVE_KEY` (la del cerebro consciente). Si
   prefieres las originales, se cambian en Vercel.
4. **Fuera a propósito:** `GRAPH_VERCEL_API_TOKEN` y `WINDOWS_APP_GITHUB_*` (un Graph de pruebas no
   debe poder sacar una release para todas las Ü instaladas). Sin ellas, Provider Studio no crea claves
   ni distribuye versiones desde la cuenta nueva: se ponen en el corte. `GRAPH_VERCEL_PROJECT_ID`,
   `_TEAM_ID` y `_PROJECT_NAME` sí están, con los datos del proyecto **nuevo**: sin el token no hacen
   nada, y sin ellas el código cae a los valores por defecto, que son los de la producción vieja
   (`VercelProjectEnvService.js`). `GRAPH_VERCEL_DEPLOY_HOOK_URL` no hace falta: un proyecto sin Git no
   tiene deploy hooks, y Graph redespliega por la API.
5. **Faltan, y solo las tiene el dueño:** `SUPABASE_SERVICE_ROLE_KEY` (imprescindible: sin ella Graph no
   llega a la base), `NEO4J_URI`/`USER`/`PASSWORD`/`DATABASE` (los workflows; sin ellas `/api/health`
   dice *degraded*), `TYPESAFE_API_KEY` (el decisor de Android; sin ella responde apagado),
   `RESEND_API_KEY` y `ALERT_EMAIL_*` (las alertas; sin ellas no se envían) y
   `GRAPH_NOTE_EXPORT_WORKFLOW_ID`.
6. **`CRON_SECRET` no se pone hasta el corte.** Sin él, el cron del Graph nuevo responde 503 y no toca
   la base: el mantenimiento diario lo sigue haciendo solo la producción vieja.
7. **Nuevas de la cuenta nueva:** `GRAPH_USAGE_INGEST_KEY`, un secreto interno que comparten Graph y el
   portal. Con él y `GRAPH_BASE_URL`, el portal le reporta a Graph el consumo de IA
   (`/api/internal/usage/events`).

**Las del portal.** Tiene siete: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_BASE_URL`, `MIRACLE_API_KEY`, `GRAPH_BASE_URL` y
`GRAPH_USAGE_INGEST_KEY`. Las `NEXT_PUBLIC_*` se graban al compilar: cambiarlas pide redesplegar. Le
faltan, y solo las tiene el dueño:

| Variable | Qué enciende | Sin ella |
|---|---|---|
| `ANTHROPIC_API_KEY` | leer la agenda y la hoja de patología desde una foto | esas pantallas piden rellenar a mano |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO`, `SUPABASE_SECRET_KEY` | el cobro | la página de suscripción dice que los pagos no están configurados |
| `NEXT_PUBLIC_SENTRY_DSN` | el registro de errores | no se reportan |

Las de Stripe van en el corte: el webhook de Stripe apunta a un dominio, y el dominio se mueve entonces.

**La prueba de humo** mira lo que indica un despliegue roto, no una dependencia caída: en Graph, que el
servidor conteste y que la autenticación **no** esté desactivada (`TEMPORARY_DISABLE_AUTH` se respeta
en cualquier entorno); en el portal, que la portada responda.

## Síntesis

- **Base: el diseño mínimo.** Dos proyectos sin Git, variables solo de producción, despliegue desde el
  CI de cada proyecto después de sus tests. Es lo que se puede tener en producción hoy.
- **Del diseño de crecimiento se injertó:** la prueba de humo con rollback (una versión rota sirve
  ~1 minuto, no hasta que alguien lo note), el apagado de `GRAPH_VERCEL_*`, y el plan de corte con
  dominio propio.
- **Se dejó para después:** los previews por PR con una base de staging (necesitan otro proyecto de
  Supabase; con datos clínicos, un preview contra producción no es opción) y un workflow de rollback
  manual (Vercel ya lo tiene en su panel).

## Tradeoffs aceptados

- Sin previews por PR: se prueba en local y en el CI, a cambio de no mantener otra base.
- Un solo token de Vercel en GitHub (`VERCEL_TOKEN`) despliega los dos proyectos, a cambio de que
  ningún dev necesite cuenta en Vercel.
- El Graph nuevo usa la misma base que la producción vieja, a cambio de no migrar datos: el corte es
  mover dominios, no datos.

## Alternativas descartadas

- **La integración Git de Vercel.** Despliega en paralelo al CI, sin esperar a los tests, y exige
  instalar la GitHub App con el OAuth del dueño.
- **Transferir los proyectos viejos a la cuenta nueva.** Conservaría los 15 secretos ilegibles y el
  dominio `graph-eight-pied`, pero mueve la producción de la demo de golpe y sin ensayo. Puede ser el
  camino del corte, no el de hoy.

## Riesgos y preguntas

- **El plan Hobby es para uso personal y no comercial**, con un solo miembro, rollback solo a la
  versión anterior, logs de 1 hora y un tope mensual de cómputo que, con sesiones de voz de 300 s,
  alcanza para unas 2.000 al mes. **Antes de mandar usuarios reales a esta cuenta, pasarla a Pro.**
- **Las API keys viven en variables de entorno**: un rollback vuelve a las variables de la versión
  anterior y puede resucitar una clave revocada. Pasarlas a Supabase es trabajo de la fase 2.
- **El DNS de `itsmiracleai.com.co` lo sirve Vercel** (`ns1` y `ns2.vercel-dns.com`): la zona vive en
  la cuenta vieja. Mover el dominio es una operación entre cuentas de Vercel, no un cambio en un
  registrador.
- **Provider Studio escribe variables como *encrypted* en Production y Preview**; las de la cuenta
  nueva son *sensitive* y solo de Production. Hay que probar en el corte que crear una API key desde
  Provider Studio reemplaza `MIRACLE_API_KEYS` y no choca con ella.

## Lo que falta para estar completo (auditado el 2026-10-01)

Lo que ya está: los dos proyectos despliegan solos desde `main` tras sus tests; `services/graph` es el
mismo código que el repo viejo y `apps/web` va por delante (trae la diarización, que no pide
migración); el Graph nuevo acepta al portal nuevo como origen (CORS).

La base no necesita nada por este despliegue: es la misma de la producción vieja, y las migraciones de
septiembre y octubre están aplicadas. **No correr `supabase db push` desde el monorepo:** las
migraciones se aplicaron a mano, la base guarda la hora en que se aplicó cada una y no la del archivo,
y 11 archivos de junio a agosto ni siquiera coinciden por nombre. Para la CLI, todo estaría sin aplicar.

**Para que la cuenta nueva funcione entera, sin tocar la producción de hoy:**

1. `SUPABASE_SERVICE_ROLE_KEY` en el proyecto `graph` (Production, *sensitive*). Supabase → Project
   Settings → API Keys → una *secret key* nueva (`sb_secret_…`), para poder revocarla sin tocar la de
   la producción vieja. Sin ella Graph no lee ni escribe en la base: es lo único imprescindible.
2. `https://miracle-notes.vercel.app/**` en Supabase → Authentication → URL Configuration → Redirect
   URLs. **No cambiar el Site URL.** Sin esto, entrar con Google, confirmar el registro o recuperar la
   contraseña desde el portal nuevo devuelve al usuario al portal viejo. Entrar con contraseña no
   depende de esto.
3. `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` y `NEO4J_DATABASE` en `graph`, de la consola de Neo4j
   Aura. Con ellas `/api/health` pasa de *degraded* a *ok*.
4. `ANTHROPIC_API_KEY` en `miracle-web`, y en `graph` las opcionales: `TYPESAFE_API_KEY`,
   `RESEND_API_KEY`, `ALERT_EMAIL_FROM`, `ALERT_EMAIL_TO`, `GRAPH_NOTE_EXPORT_WORKFLOW_ID`.
5. Redesplegar: Actions → *Graph · CI* y *Web · CI* → *Run workflow* en `main`.

**No conectar el repositorio en Vercel** («Connect Git Repository»): desplegaría cada push en paralelo
al CI, sin esperar a los tests y sin la prueba de humo.

**`apps/windows/backend` no se despliega en la cuenta nueva.** Es el backend anterior a Graph: el
cliente de Windows ya habla con Graph y solo vuelve a él con `U_BACKEND_URL`. Sigue en la cuenta vieja,
con su cron de recordatorios, hasta que no queden versiones instaladas que lo usen.

## El corte (cuando se decida, después de la demo)

1. **Pasar la cuenta nueva a Pro.** Hobby no admite uso comercial.
2. Última pasada de `tools/monorepo/importar.sh`: el monorepo tiene todo lo de los repos viejos. Desde
   aquí, los repos viejos no reciben más cambios.
3. Lo que falte de la lista de arriba, y `/api/health` en *ok*. Copiar `MIRACLE_API_KEYS` de la
   producción vieja otra vez: trae las claves creadas desde la primera copia.
4. **`api.itsmiracleai.com.co` para Graph.** Se puede adelantar sin riesgo: añadirlo hoy al Graph
   **viejo** (es un alias más) y sacar las versiones de Windows, Mac y Android que lo usan. Así el
   corte de Graph es mover ese subdominio al proyecto nuevo, y deshacerlo es devolverlo. Los clientes
   llevan escrito `graph-eight-pied.vercel.app` en `Config.cs`, `GraphConfig.cs`, `Claves.cs`,
   `GraphClient.swift` y `GraphApp.kt`.
5. `itsmiracleai.com.co` y `www` al portal nuevo: en la cuenta vieja, Domains → mover el dominio al
   equipo `the-world-changers`, y añadirlo al proyecto `miracle-web`. Después, `NEXT_PUBLIC_SITE_URL` con el
   dominio y redesplegar. Las de Stripe se ponen aquí.
6. `CRON_SECRET`: quitarlo del proyecto viejo y ponerlo en el nuevo, fuera de 11:00-13:59 UTC. Nunca en
   los dos a la vez.
7. `GRAPH_VERCEL_API_TOKEN` (un token del equipo nuevo, solo para eso) y `WINDOWS_APP_GITHUB_TOKEN` con
   `WINDOWS_APP_GITHUB_REPO=ZevCorp/Miracle`, en el proyecto nuevo.
8. El Graph viejo queda en pie hasta que deje de recibir tráfico; luego se archivan los repos viejos.
