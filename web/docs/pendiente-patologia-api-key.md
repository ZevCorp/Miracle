# PENDIENTE: activar la lectura de fotos (patología) — falta `ANTHROPIC_API_KEY`

> Actualizado el 2026-07-17. Contexto general: [`../CONTEXTO.md`](../CONTEXTO.md) · cuentas: [`cuentas.md`](./cuentas.md)

## El problema en una línea

El módulo **Patología** (informes desde foto, solo para patólogos) está **terminado y
commiteado**, pero la IA que lee la hoja manuscrita **no se ha podido encender ni probar
nunca** porque no hay `ANTHROPIC_API_KEY` configurada en ningún lado.

## Qué funciona y qué no (hoy)

| | Estado |
|---|---|
| Entrar como patólogo y ver "Patología" (y que otros médicos NO lo vean) | ✅ probado |
| Elegir entre las plantillas de patología | ✅ probado |
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
2. Si **extrae las citas** → la key ya está en Vercel (entonces solo falta probar la foto de patología).
3. Si **ofrece meterlas a mano** → la key **no está**.

## Qué hay que hacer

1. **Conseguir la key** en console.anthropic.com (es de pago; ~centavos por foto).
2. **Producción:** Vercel → proyecto **`miracle-web`** (`prj_rFaM61JA8DwZJGkVYydTykXg6GrH`)
   → Settings → Environment Variables → `ANTHROPIC_API_KEY` (scope *Production*).
   Opcional: `ANTHROPIC_MODEL` (por defecto `claude-sonnet-4-6`).
3. **Local:** añadir `ANTHROPIC_API_KEY=sk-ant-...` a `.env.local` y reiniciar `npm run dev` (puerto 3100).
4. **Probar de verdad:** entrar con `patologo@miracle.app` / `MiraclePatologo2026!`
   → **Patología** → elegir plantilla → subir foto de una hoja de patología real
   → las casillas deben rellenarse solas.

## ⚠️ Ojo al probar

**Nunca se probó con una foto real.** El código sigue el contrato de la API de Anthropic y
reusa el patrón que ya funciona en la agenda, pero la letra médica manuscrita es difícil:
es bastante probable que haya que **ajustar el prompt** (constante `SYSTEM` en esa misma
ruta) un par de veces hasta que rellene bien las casillas. Eso es esperado, no un bug.

Diseño a respetar: **una sola llamada a la IA por foto**. El informe queda como datos
estructurados, así editar una casilla o volver a descargar el PDF **no gasta tokens**.

## Plantillas de patología (en la BD de producción)

`specialty_code = 'patologia'`, institucionales y activas. La predeterminada es
**"Histopatología · Macro / Micro / Diagnóstico"** (estilo formulario HGM: rótulo, nombre,
episodio, cédula, fecha de corte, procedimiento, macro, micro, diagnóstico). También:
Citología (Bethesda), Inmunohistoquímica (IHQ), Estudio intraoperatorio (congelación),
Informe de histopatología / biopsia, y las 3 base de patología del catálogo institucional.

## Estado de git y despliegue (LEER ANTES DE PUSHEAR)

- Rama **`test/miracle-notes`**. Los commits de patología van encima de los de bacteriología
  (el rename es un commit aparte). El primer push del módulo ya fue a `main` (producción).
- **Migraciones: YA aplicadas** en la Supabase de producción (CHECK `patologo`, plantillas
  re-scopeadas a `patologia`, cuentas migradas). **No hay que aplicar nada.**
- **Ojo con `main`:** `git push origin HEAD:main` **despliega producción** (itsmiracleai.com.co,
  ~1 min, con médicos usándolo).
- **TRAMPA:** `.vercel/project.json` apunta a `miracle-web-testing`, otro proyecto viejo y
  congelado. Producción es **`miracle-web`**.

## Cuenta de prueba

`patologo@miracle.app` / `MiraclePatologo2026!` — org "Hospital Demo Miracle", ve Patología.
`medico@miracle.app` / `MiracleMedico2026!` también quedó como patólogo (y ve todas las
plantillas). Las demás cuentas demo están en [`cuentas.md`](./cuentas.md).

## Otro pendiente, aparte (ya está en producción)

`create_org_member` deja en `NULL` los campos de token de GoTrue (`confirmation_token`,
`recovery_token`, `email_change_token_new`, `email_change`), y GoTrue los lee como texto →
revienta y responde "credenciales inválidas". **Consecuencia: todo médico creado desde la
consola de admin/superadmin no puede iniciar sesión** hasta normalizar esos campos a `''`.
Está reproducido. Golpea el alta B2B del piloto.
