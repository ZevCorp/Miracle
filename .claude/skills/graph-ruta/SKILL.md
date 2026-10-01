---
name: graph-ruta
description: Añade o cambia un endpoint HTTP de Graph (services/graph) de punta a punta con las capas y convenciones del servicio — elegir prefijo y autenticación, caso de uso en src/application, registro de rutas en web/api, cableado en web/server.js, rate limit si llama a un LLM, entrada de Vercel si es larga o WebSocket — y su juez sin red (app de mentira + fakeSupabase) antes del código. Úsala cuando el usuario pida "un endpoint", "una ruta", "una API para…", "que Graph exponga…", "el cliente necesita llamar a…", o cuando una feature de Windows, Android, Mac o el portal necesite algo nuevo del servidor.
---

# Una ruta en Graph

Graph se despliega solo al mergear a `main` (con prueba de humo y rollback), y lo llaman tres
clientes y el portal. Lo que frena una ruta rota es su promesa, no una revisión manual.

Antes: la spec (`/especifica`) con el número de `/numera`, y su promesa en rojo (`/promesas`). Esta
skill es el «cómo» de las fases que tocan una ruta.

## 1. Elegir el prefijo: decide quién llama y cómo se autentica

| Prefijo | Quién llama | Autenticación (ya montada en `web/server.js`) |
|---|---|---|
| `/api/v1/*` | clientes Ü (Windows, Android, Mac), el ejecutor | `X-API-Key` → `requireApiKey` (línea ~609), pone `req.workflowAccess` |
| `/api/clinical/{templates,encounters,assistant,exports}` | el portal, con el JWT del médico | `requireClinicalAuth` → `req.clinicalUser` (nunca `req.user`) |
| `/api/voice`, `/api/usage`, `/api/clinical/diagnosis-suggestions` | sesión local o la demo médica | `requireAuth` + `attachWorkflowAccess` |
| `/api/windows/*`, `/api/providers/*` | el panel de administración | `requireProviderAdmin` en cada ruta |
| `/api/internal/*` | el cron de Vercel | `Bearer CRON_SECRET` o `x-graph-internal-token` |

Si ninguno encaja, **pregunta** antes de inventar un esquema de auth nuevo. Una ruta sin auth no
existe en este servicio.

## 2. Las capas, de dentro hacia fuera

1. **Dominio** (`src/domain/`): reglas puras, sin red ni base. Si la lógica se puede probar sin
   dobles, va aquí.
2. **Caso de uso** (`src/application/use-cases/<Algo>Service.js`): un servicio por archivo. Recibe
   sus dependencias en el constructor (`supabaseRestClient`, `now` para el reloj…). Errores de
   entrada: `const e = new Error('…'); e.statusCode = 400; throw e;` con un mensaje que describe el
   paso que falló, no una conclusión.
3. **Rutas** (`web/api/register<Algo>Routes.js`):
   ```js
   function registerAlgoRoutes(app, deps = {}) {
     const algoService = deps.algoService;
     if (!app || !algoService) throw new Error('registerAlgoRoutes requiere app y algoService');
     app.post('/api/v1/algo', async (req, res) => {
       try {
         res.json(await algoService.hacer(req.body || {}));
       } catch (error) {
         console.error(`[algo] hacer: ${error.message}`);            // el mensaje, nunca req.body
         res.status(error.statusCode || 500).json({ ok: false, error: error.message });
       }
     });
   }
   module.exports = registerAlgoRoutes;
   ```
   Alternativa ya usada: el servicio devuelve `{ status, json }` y la ruta lo escribe tal cual
   (`registerWindowsAgentRoutes.js`). Sigue la del archivo vecino.
4. **Cableado** (`web/server.js`): instancia el servicio junto a los demás (~línea 290) y llama a
   `registerAlgoRoutes(app, { algoService })` en el bloque de registros (~líneas 1178-1250).
5. **Si llama a un LLM**: `app.use('/api/…', costlyLimiter)` junto a los demás (~líneas 493-510), y
   el LLM **solo** a través de `LLMProvider` (si no, la promesa 13 se pone roja: es `/frontera-ia`).
6. **Vercel**: todo `/api/*` entra por `api/index.js` (60 s). Solo si la ruta es WebSocket o tarda
   más, necesita su propio `api/<nombre>.js` en `functions` de `vercel.json` y su rewrite **antes**
   del catch-all. Ojo: en un upgrade WebSocket los rewrites no aplican, el cliente tiene que llamar
   a la ruta real (los dos `fix(voice)` de septiembre fueron eso).

Qué cuenta como código para el portero: `src/`, `api/`, `web/api/`, `web/server.js`,
`supabase/migrations/`. Tocar cualquiera exige promesa en la rama.

## 3. El juez, sin red

`scripts/verify-<slug>.js`, con `scripts/lib/promesas.js`. El patrón del juez de la spec 001
(`scripts/verify-telemetria-windows.js`) monta la **ruta real** sobre una `app` de mentira:

```js
const assert = require('assert');
const createFakeSupabase = require('./lib/fakeSupabase');
const { promesa, pendiente, cerrar } = require('./lib/promesas');

function appDeMentira() {
  const rutas = {};
  const recoger = (ruta, ...manejadores) => { rutas[ruta] = manejadores[manejadores.length - 1]; };
  return { rutas, get: recoger, post: recoger, all: recoger };
}
function respuesta() {
  const r = { codigo: 200, cuerpo: null };
  r.status = (c) => { r.codigo = c; return r; };
  r.json = (b) => { r.cuerpo = b; return r; };
  return r;
}

(async () => {
  await promesa(301, '<el enunciado, LITERAL como en la spec>', async () => {
    let Servicio;
    try { Servicio = require('../src/application/use-cases/AlgoService'); } catch { pendiente('AlgoService'); }
    const db = createFakeSupabase();
    const app = appDeMentira();
    require('../web/api/registerAlgoRoutes')(app, { algoService: new Servicio({ supabaseRestClient: db }) });
    const res = respuesta();
    await app.rutas['/api/v1/algo']({ body: { … } }, res);
    assert.strictEqual(res.codigo, 200, 'la ruta contesta 200 con un cuerpo válido');
  });
  cerrar('verify-algo');
})();
```

- La fila de la spec nombra al juez: `| 301 | <enunciado> | \`verify-algo.js\` |`. Un
  `verify-*.js` que no es juez de ninguna fila hace salir a `npm test` con 99.
- `pendiente('Nombre')` cuando la pieza aún no existe: sale `⧗ PENDIENTE`, que cuenta como
  incumplida (es el rojo de `/promesas`).
- `createFakeSupabase()` entiende `eq`, `in`, `gte`, `lt`, `col->>key`, `order`, `limit`; un filtro
  que no entiende **lanza**: añádelo al doble en la misma rama.
- Un LLM se finge con `scripts/lib/fakeChatCompletions.js` (un servidor HTTP de verdad: `start()`,
  `state.handler`, `lastRequest()`).
- Iterar: `node scripts/contrato.js <trozo>` (~1 s). El veredicto: `npm test`.

## 4. Probarla de verdad

```bash
cd services/graph && npm start        # .env con lo de .env.example
curl -s -X POST localhost:3000/api/v1/algo -H "X-API-Key: <una de MIRACLE_API_KEYS>" \
     -H 'content-type: application/json' -d '{…}' -w '\n%{http_code} en %{time_total}s\n'
```

Una llamada real con su respuesta y su tiempo va a la evidencia del PR. Si un cliente la va a
llamar, cambia ese cliente **en la misma rama** (y si toca el turno del agente, `/contrato-cliente`).
