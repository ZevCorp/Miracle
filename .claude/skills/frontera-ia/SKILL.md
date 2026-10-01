---
name: frontera-ia
description: Guarda la frontera entre los datos clínicos y los proveedores de IA (OpenAI, Anthropic, Gemini, Deepgram, Soniox, OpenRouter, Azure, TypeSafe) en Graph y en el portal — todo texto clínico sale por el escudo de privacidad, toda excepción queda declarada con su código, ningún log lleva contenido, y la UI solo afirma lo que el servidor certificó. Úsala ANTES de escribir cualquier llamada nueva a un modelo o a un servicio de voz, al añadir un proveedor o un SDK, al tocar LLMProvider, el escudo, liveVoiceProxy, lib/ai/anthropic.ts o una ruta app/api que llame a IA, y cuando el usuario diga "llama a GPT/Claude/Gemini", "usa otro modelo", "manda esto a la IA", "privacidad", "datos del paciente".
---

# La frontera hacia la IA

Datos de pacientes de hospitales, en un repo público, saliendo hacia terceros. Lo que ya pasó: el
portal decía «protegido» con su redactor apagado desde julio (D21, 2026-09-07), y cuatro arreglos en
Graph por claves, cuerpos de OpenAI o `device_id` en logs. La regla: **el texto clínico sale por el
escudo; lo que no puede, se declara como excepción, con código y decisión pendiente.**

## 1. ¿Qué sale, y hacia dónde?

Antes de escribir código, contesta en una línea: qué datos (texto, audio, imagen, capturas,
etiquetas), desde dónde (Graph, el navegador, un cliente Ü) y hacia qué proveedor. Si no lo sabes
contestar, no escribas la llamada todavía.

## 2. En Graph (`services/graph`)

**Texto → siempre por `LLMProvider`** (`src/infrastructure/LLMProvider.js`). El escudo va dentro:
protege, manda la copia enmascarada, restaura. Tres instancias por prefijo de entorno (`GRAPH`,
`MIRACLE_ASSISTANT`, `MIRACLE_BIOPSY`), y el contexto del encuentro llega por `PrivacyContext`
(AsyncLocalStorage) desde el servicio que lo conoce. Los modos: `PRIVACY_SHIELD_MODE` y
`PRIVACY_SHIELD_MODE_<FEATURE>` = `off` | `shadow` (por defecto) | `enforce`.

Si hay que llamar al Python (`miracle_runtime.py`), el salto Node → Python pasa por
`privacyShield.protectTexts` / `restoreText`, como en `registerPublicApiRoutes.js` y
`registerMedicalRoutes.js`.

**Lo que no puede ir por `LLMProvider`** (audio, imagen, un WebSocket, un SDK propio) es una
**excepción**, y se declara en dos sitios en el mismo commit:

1. `scripts/verify-egress-gateway.js` → `TRANSPORTS`:
   `'src/…/MiTransporte.js': { shielded: false, kind: 'audio', exception: 'E14' }`
   (`NON_EGRESS` es solo para archivos que **nombran** un proveedor sin mandarle nada: precios,
   configuración).
2. `docs/privacy-egress-gateway.md` → «Registro de excepciones»: una fila
   `| **E14** | <qué sale, desde qué archivo, hacia quién> | <estado> | <decisión pendiente> |`.
   El siguiente código libre es el mayor de la tabla + 1 (hoy E13).

El juez de esto es la **promesa 13**: escanea `src/`, `web/api/` y `web/server.js` buscando hosts de
proveedores, y un archivo que nombra uno sin estar registrado la pone roja. Córrelo:
`npm run test:privacy` (y `npm test` para el veredicto).

## 3. En el portal (`apps/web`)

- **Texto clínico → a Graph** (`lib/api/clinical.ts`, con el token del médico), que lo pasa por su
  escudo. El portal no protege en el navegador: ya no hay redactor local, y no se vuelve a poner.
- **Llamada directa a Anthropic** (solo para lo ya declarado: horario, plantilla desde foto,
  categorizar atajos): únicamente con `callAnthropicJson` de `lib/ai/anthropic.ts`, que antepone
  `DATA_NOT_INSTRUCTIONS`, usa temperatura 0 y plazo de 55 s, y registra el consumo sin loguear la
  salida.
- **La ruta** (`app/api/**/route.ts`): `export const runtime = "nodejs"`, `maxDuration = 60`,
  `requireEntitledApiUser()` (401/402) y `rateLimit(key, n)` antes de gastar; valida el cuerpo; limita
  la salida.
- **Declárala** en `docs/privacidad-frontera-ia.md`, tabla «Qué sale de esta web hacia fuera, hoy»
  (canal, qué sale, hacia, protección) y, si no hay protección posible, en «Lo que NO cubre».
- **La pantalla dice solo lo certificado**: `describePrivacySummary(privacy)` de
  `lib/clinical/privacy-summary.ts` y `PrivacyShieldBadge`. Nunca un «protegido» escrito a mano
  (`tests/privacy-claims.test.ts` lo vigila).

## 4. En los clientes Ü

Android llama a Gemini directo desde `app/platform/` y la voz va por el proxy de Graph
(`/api/android-live-session`, E12). Un egreso nuevo desde un cliente pasa por Graph salvo que haya
una razón medida para no hacerlo, y entonces es una excepción en el registro de Graph igual.

## 5. Los logs y los errores

- Nada de contenido: ni transcripciones, ni notas, ni `req.body`, ni prompts, ni respuestas del
  modelo, ni claves, ni `device_id`. Metadatos sí: longitudes, códigos, ids, duraciones.
- Graph: `redactUrlForLog` (`web/api/logRedaction.js`) para URLs con parámetros.
- Portal: `reportError(err, ctx)` de `lib/observability.ts`, con `ctx` sin datos de salud.
- `python3 .claude/skills/revisa/scripts/higiene.py --clase log-con-datos-clinicos,host-de-ia-directo`
  sobre tu rama.

## 6. Comprobar

| Dónde | Comando | Tiene que salir |
|---|---|---|
| Graph | `npm run test:privacy` y `npm test` | la 13 en verde |
| Portal | `npm run test` (incluye `privacy-claims`) | verde |
| Los dos | `higiene.py` en la rama | 0 ✘, y cada ⚠ de `host-de-ia-directo` explicado |

Y en el PR, una línea: «Egreso nuevo: <qué> hacia <quién>, por el escudo» o «declarado como E14».
