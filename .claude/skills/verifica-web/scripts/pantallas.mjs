/* PANTALLAS — recorre rutas del portal en móvil y escritorio, claro y oscuro, y deja capturas y una
 * hoja de contactos. Por cada captura mide lo que se rompe sin que nadie lo vea en un monitor ancho:
 *
 *   - el código HTTP y a dónde redirigió (una ruta protegida sin sesión acaba en /login: se dice);
 *   - errores de consola y excepciones de la página;
 *   - desborde horizontal (scrollWidth > ancho): en un teléfono es una página que se mueve de lado;
 *   - objetivos táctiles de menos de 44 px en móvil (la regla de components/ui: min-h-11).
 *
 *   node .claude/skills/verifica-web/scripts/pantallas.mjs --base http://localhost:3100 \
 *        --rutas /login,/app,/app/consultas --salida /tmp/pantallas [--cookie "sb-…=…"] [--solo-movil]
 *
 * Necesita playwright-core (npm i --no-save playwright-core, desde apps/web) y un Chromium: el de
 * Playwright, o el Chrome/Edge instalado (lo intenta solo), o --navegador <ruta al ejecutable>.
 * La cookie sale de `node scripts/dev-session.mjs <rol>` (solo cuentas de prueba @miracle.app).
 *
 * Sale con 1 si alguna captura tiene errores de página o desborde; 0 si no.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://localhost:3100').replace(/\/$/, '');
const RUTAS = arg('rutas', '/login').split(',').map((r) => r.trim()).filter(Boolean);
const SALIDA = arg('salida', 'pantallas');
const COOKIE = arg('cookie', '');
const NAVEGADOR = arg('navegador', process.env.PW_CHROMIUM || '');
const SOLO_MOVIL = process.argv.includes('--solo-movil');

// El script vive en .claude/skills/, y Node resuelve los paquetes desde ahí: se buscan también desde
// la carpeta actual (apps/web, donde se instala playwright-core).
async function cargar(nombre) {
  try { return await import(nombre); } catch {}
  for (const desde of [process.cwd(), join(process.cwd(), 'apps', 'web')]) {
    try {
      const req = createRequire(join(desde, 'package.json'));
      return await import(pathToFileURL(req.resolve(nombre)).href);
    } catch {}
  }
  return null;
}
const pw = (await cargar('playwright-core')) || (await cargar('playwright'));
if (!pw) { console.error('Falta playwright-core. Desde apps/web:  npm i --no-save playwright-core'); process.exit(99); }
const chromium = pw.chromium || pw.default?.chromium;

async function lanzar() {
  const intentos = NAVEGADOR ? [{ executablePath: NAVEGADOR }] : [{}, { channel: 'chrome' }, { channel: 'msedge' }];
  let ultimo;
  for (const o of intentos) {
    try { return await chromium.launch({ headless: true, ...o }); } catch (e) { ultimo = e; }
  }
  console.error(`No pude abrir un Chromium: ${ultimo?.message?.split('\n')[0]}. Usa --navegador <ruta>.`);
  process.exit(99);
}

const VISTAS = [
  { nombre: 'movil', width: 390, height: 844, movil: true },
  ...(SOLO_MOVIL ? [] : [{ nombre: 'escritorio', width: 1280, height: 800, movil: false }]),
];
const TEMAS = ['light', 'dark'];

await mkdir(SALIDA, { recursive: true });
const navegador = await lanzar();
const filas = [];
let malas = 0;

for (const vista of VISTAS) {
  for (const tema of TEMAS) {
    const contexto = await navegador.newContext({
      viewport: { width: vista.width, height: vista.height },
      deviceScaleFactor: vista.movil ? 2 : 1,
      isMobile: vista.movil,
      hasTouch: vista.movil,
      colorScheme: tema,
    });
    if (COOKIE) {
      const url = new URL(BASE);
      const cookies = COOKIE.split(/;\s*/).filter(Boolean).map((par) => {
        const i = par.indexOf('=');
        return { name: par.slice(0, i), value: par.slice(i + 1), domain: url.hostname, path: '/' };
      });
      await contexto.addCookies(cookies);
    }
    for (const ruta of RUTAS) {
      const pagina = await contexto.newPage();
      const consola = [];
      pagina.on('console', (m) => { if (m.type() === 'error') consola.push(m.text().slice(0, 200)); });
      pagina.on('pageerror', (e) => consola.push(`EXCEPCIÓN: ${String(e.message).slice(0, 200)}`));
      let estado = '—', final = ruta;
      try {
        const r = await pagina.goto(BASE + ruta, { waitUntil: 'networkidle', timeout: 45000 });
        estado = r ? r.status() : 'sin respuesta';
        final = new URL(pagina.url()).pathname;
      } catch (e) {
        estado = `no cargó: ${e.message.split('\n')[0].slice(0, 80)}`;
      }
      await pagina.waitForTimeout(400);
      const medida = await pagina.evaluate((movil) => {
        const ancho = window.innerWidth;
        const desborde = document.documentElement.scrollWidth - ancho;
        let pequenos = 0;
        const ejemplos = [];
        if (movil) {
          for (const el of document.querySelectorAll('button, a[href], [role="button"], input:not([type=hidden]), select')) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            const st = getComputedStyle(el);
            if (st.visibility === 'hidden' || st.display === 'none') continue;
            if (r.height < 44 && r.width < 44) {
              pequenos++;
              if (ejemplos.length < 3) ejemplos.push((el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30));
            }
          }
        }
        return { desborde, pequenos, ejemplos, oscuro: document.documentElement.classList.contains('dark') };
      }, vista.movil).catch((e) => ({ desborde: 0, pequenos: 0, ejemplos: [], oscuro: false, fallo: String(e.message).slice(0, 80) }));
      const archivo = `${vista.nombre}-${tema}-${ruta.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'raiz'}.png`;
      const problemas = [];
      // Una captura que falla se dice: si no, la hoja de contactos muestra un hueco sin explicación.
      await pagina.screenshot({ path: join(SALIDA, archivo), fullPage: true })
        .catch((e) => problemas.push(`no se pudo capturar: ${String(e.message).split('\n')[0].slice(0, 80)}`));
      if (medida.fallo) problemas.push(`no se pudo medir: ${medida.fallo}`);
      if (final !== ruta) problemas.push(`redirigió a ${final}`);
      if (medida.desborde > 1) problemas.push(`desborde horizontal de ${medida.desborde}px`);
      if (medida.pequenos) problemas.push(`${medida.pequenos} objetivo(s) táctiles < 44px (${medida.ejemplos.join(', ')})`);
      if (tema === 'dark' && !medida.oscuro && final === ruta) problemas.push('no pintó el tema oscuro');
      if (consola.length) problemas.push(`${consola.length} error(es) de consola: ${consola[0]}`);
      const grave = consola.some((c) => c.startsWith('EXCEPCIÓN')) || medida.desborde > 1 || typeof estado !== 'number' || estado >= 500;
      if (grave) malas++;
      filas.push({ ruta, vista: vista.nombre, tema, estado, archivo, problemas, grave });
      console.log(`${grave ? '✘' : problemas.length ? '⚠' : '✔'} ${vista.nombre} ${tema} ${ruta} → ${estado}${problemas.length ? ' · ' + problemas.join(' · ') : ''}`);
      await pagina.close();
    }
    await contexto.close();
  }
}
await navegador.close();

const html = `<!doctype html><meta charset="utf-8"><title>Pantallas</title>
<style>body{font:14px system-ui;margin:16px;background:#f6f6f4}figure{display:inline-block;margin:8px;vertical-align:top;background:#fff;padding:8px;border:1px solid #ddd;max-width:420px}
img{max-width:400px;max-height:700px;display:block}figcaption{margin-top:6px}.m{color:#a30}.ok{color:#070}</style>
<h1>Pantallas · ${BASE}</h1>
${filas.map((f) => `<figure><img src="${f.archivo}" loading="lazy"><figcaption><b>${f.ruta}</b> · ${f.vista} · ${f.tema} · ${f.estado}<br>
<span class="${f.problemas.length ? 'm' : 'ok'}">${f.problemas.join('<br>') || 'sin problemas medidos'}</span></figcaption></figure>`).join('\n')}`;
await writeFile(join(SALIDA, 'index.html'), html);

console.log(`\n| Ruta | Vista | Tema | HTTP | Lo medido |\n|---|---|---|---|---|`);
for (const f of filas) console.log(`| ${f.ruta} | ${f.vista} | ${f.tema} | ${f.estado} | ${f.problemas.join('; ') || '✔'} |`);
console.log(`\n${filas.length} capturas en ${SALIDA}/ (hoja de contactos: ${join(SALIDA, 'index.html')}). ${malas ? `✘ ${malas} con problemas graves.` : 'Ninguna con problemas graves.'}`);
process.exit(malas ? 1 : 0);
