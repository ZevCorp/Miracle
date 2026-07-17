# PENDIENTE: activar la lectura de fotos (bacteriología) — falta `ANTHROPIC_API_KEY`

> Escrito el 2026-07-17 para que otra persona pueda cerrarlo sin preguntar nada.
> Contexto general del proyecto: [`../CONTEXTO.md`](../CONTEXTO.md) · cuentas: [`cuentas.md`](./cuentas.md)

## El problema en una línea

El módulo **Laboratorio** (notas desde foto, solo para bacteriólogos) está **terminado y
commiteado**, pero la IA que lee la hoja manuscrita **no se ha podido encender ni probar
nunca** porque no hay `ANTHROPIC_API_KEY` configurada en ningún lado.

## Qué funciona y qué no (hoy)

| | Estado |
|---|---|
| Entrar como bacteriólogo y ver "Laboratorio" (y que otros médicos NO lo vean) | ✅ probado |
| Elegir entre las 5 plantillas de laboratorio | ✅ probado |
| Llenar las casillas a mano, guardar y descargar el PDF del informe | ✅ probado |
| **Subir foto → que la IA rellene las casillas** | ❌ **nunca ejecutado** |

No está roto: sin la key la app **no se cae**, simplemente ofrece "Rellenar sin foto".

## Por qué

En [`app/api/clinical/note-from-photo/route.ts`](../app/api/clinical/note-from-photo/route.ts) (~línea 172):

```ts
const apiKey = process.env.ANTHROPIC_API_KEY;
// Sin clave: el cliente ofrece rellenar la plantilla manualmente.
if (!apiKey) {
  return NextResponse.json({ connected: false });
}
```

Sin la clave la ruta **ni intenta** llamar a la IA. Es el mismo patrón (y la **misma key**)
que usa `app/api/parse-schedule/route.ts`, la importación de agenda por foto.

## Paso 0 — averiguar si la key YA está en producción (1 min, sin tocar nada)

Como la agenda por foto usa la misma key, sirve de sonda:

1. Entrar a **itsmiracleai.com.co** → agenda del día → **Importar agenda** (foto).
2. Si **extrae las citas** → la key ya está en Vercel (entonces solo falta probar la foto de laboratorio).
3. Si **ofrece meterlas a mano** → la key **no está**.

## Qué hay que hacer

1. **Conseguir la key** en console.anthropic.com (es de pago; ~centavos por foto).
2. **Producción:** Vercel → proyecto **`miracle-web`** (`prj_rFaM61JA8DwZJGkVYydTykXg6GrH`)
   → Settings → Environment Variables → `ANTHROPIC_API_KEY` (scope *Production*).
   Opcional: `ANTHROPIC_MODEL` (por defecto `claude-sonnet-4-6`).
3. **Local:** añadir `ANTHROPIC_API_KEY=sk-ant-...` a `.env.local` y reiniciar `npm run dev` (puerto 3100).
4. **Probar de verdad:** entrar con `bacteriologo@miracle.app` / `MiracleBacterio2026!`
   → **Laboratorio** → elegir plantilla → subir foto de una hoja de laboratorio real
   → las casillas deben rellenarse solas.

## ⚠️ Ojo al probar

**Nunca se probó con una foto real.** El código sigue el contrato de la API de Anthropic y
reusa el patrón que ya funciona en la agenda, pero la letra médica manuscrita es difícil:
es bastante probable que haya que **ajustar el prompt** (constante `SYSTEM` en esa misma
ruta) un par de veces hasta que rellene bien las casillas. Eso es esperado, no un bug.

Diseño a respetar: **una sola llamada a la IA por foto**. La nota queda como datos
estructurados, así editar una casilla o volver a descargar el PDF **no gasta tokens**.
No lo conviertas en dos llamadas ni regeneres la nota al descargar.

## Estado de git y despliegue (LEER ANTES DE PUSHEAR)

- Rama **`test/miracle-notes`**. Hay **3 commits sin pushear**:
  `4ecdec2` (bacteriología/laboratorio) · `64e0e49` (onboarding/superadmin) · `81f1a7d` (transcripción).
- **Migraciones: YA aplicadas** en la Supabase de producción (CHECK `bacteriologo` + 5 plantillas
  sembradas). **No hay que aplicar nada.**
- **NO pushear a main hasta que la foto funcione.** `git push origin HEAD:main` **despliega
  producción** (itsmiracleai.com.co, ~1 min, con médicos usándolo). Si se despliega sin la key,
  el bacteriólogo ve el módulo y la foto no hace nada.
- **TRAMPA:** `.vercel/project.json` apunta a `miracle-web-testing`, que es **otro** proyecto,
  viejo y congelado. Producción es **`miracle-web`**. No lo uses para verificar deploys.
- `git push` a secas va a `origin/test/miracle-notes` (seguro, no despliega producción).

## Cuenta de prueba

`bacteriologo@miracle.app` / `MiracleBacterio2026!` — org "Hospital Demo Miracle", ve Laboratorio.
Las demás cuentas demo están en [`cuentas.md`](./cuentas.md).

## Otro pendiente, aparte (ya está en producción)

`create_org_member` deja en `NULL` los campos de token de GoTrue (`confirmation_token`,
`recovery_token`, `email_change_token_new`, `email_change`), y GoTrue los lee como texto →
revienta y responde "credenciales inválidas". **Consecuencia: todo médico creado desde la
consola de admin/superadmin no puede iniciar sesión.** Está reproducido. El arreglo es
setear esos campos a `''` en el `INSERT` de la función. Golpea el alta B2B del piloto.
