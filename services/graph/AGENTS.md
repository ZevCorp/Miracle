# Graph — guía para trabajar en `services/graph`

Graph es el cerebro de Ü: la API a la que llaman los tres clientes y el portal, con el LLM, la
memoria, el catálogo de workflows y Provider Studio. Node (Express) en el borde, con una parte en
Python; se despliega en Vercel. Las reglas comunes del monorepo (ramas, commits, qué toca cada
máquina) están en el [`AGENTS.md`](../../AGENTS.md) de la raíz.

Todos los comandos de aquí se corren **desde esta carpeta** (`cd services/graph`).

## El ciclo

Es el del monorepo ([`docs/monorepo/metodo.md`](../../docs/monorepo/metodo.md)), con las
herramientas de Graph:

```
1.  rama <persona>/<que-hace> desde main fresco
2.  la spec:      docs/specs/NNN-<slug>.md, con la tabla «| # | Promesa | Juez |»
3.  la promesa:   scripts/verify-<slug>.js, con scripts/lib/promesas.js, y verla ROJA
4.  el código, hasta que salga verde
5.  ROMPE el código a propósito: si la promesa no se pone roja, no vale nada
6.  pruébalo contra el servidor en marcha (npm start), con una llamada real
7.  git push: el portero decide (~5 s)
8.  PR con la evidencia → squash merge
```

| Qué | Dónde |
|---|---|
| Specs | `docs/specs/NNN-*.md`. La spec NNN numera sus promesas desde NNN×100+1 |
| Promesas | `scripts/verify-*.js`. Las nuevas usan `scripts/lib/promesas.js`; el enunciado va literal |
| El juez | `npm test` (`node scripts/contrato.js`) → `CONTRATO INTACTO: N promesas.` |
| Iterar sobre un juez | `node scripts/contrato.js <trozo-del-nombre>`: parcial, no vale como veredicto |
| El portero | `.githooks/pre-push`: contrato intacto, y la rama que cambia código trae su promesa |
| El CI | [`graph-ci.yml`](../../.github/workflows/graph-ci.yml): el mismo `npm test` |
| Lo heredado | [`docs/specs/000-lo-heredado.md`](docs/specs/000-lo-heredado.md): las 34 verificaciones que ya había |

Qué cuenta como código para el portero: `src/`, `api/`, `web/api/`, `web/server.js` y
`supabase/migrations/`. La interfaz estática (`web/public/`) no pide promesa: se prueba a mano.

## Compilar y correr

```bash
npm ci                  # una vez, y cada vez que cambie package-lock.json
npm start               # node web/server.js
npm test                # el contrato entero
```

Las variables van en un `.env` que no se versiona; las que existen están en `.env.example`.

## Dónde vive cada cosa

| Carpeta | Qué es |
|---|---|
| `src/domain/` | reglas sin red ni base: clínica, privacidad, consumo, el agente |
| `src/application/use-cases/` | los casos de uso: un servicio por archivo |
| `src/infrastructure/` | repositorios, proveedores de LLM, el cerebro consciente |
| `web/server.js`, `web/api/` | Express y sus rutas |
| `api/` | las entradas de Vercel |
| `supabase/migrations/` | el esquema; una migración nueva no edita una vieja |
| `scripts/lib/` | los dobles para verificar sin red: Supabase falso, LLM falso |

## Lo que hay que saber antes de tocar

- **Se despliega solo al mergear a `main`**, después de `npm test`, con prueba de humo y rollback
  ([`docs/monorepo/despliegue.md`](../../docs/monorepo/despliegue.md)). No hay paso manual que
  frene un cambio roto: lo frena el contrato.
- **Los clientes llevan escrita la forma de las respuestas.** Cambiar `POST /api/v1/agent/turn` sin
  cambiar Windows, Android y Mac en la misma rama los rompe. La promesa 2 fija la respuesta a
  Windows byte a byte.
- **El texto clínico sale por el escudo de privacidad.** Una ruta nueva hacia un proveedor de IA
  que no pase por los transportes conocidos pone roja la promesa 13.
- **Una verificación que no puede correr lo dice, no se calla.** La 22 necesita Postgres; sin él
  sale `⏭` y el veredicto la nombra. No se cuenta como cumplida.
- **Nada secreto en el repo: es público.**
