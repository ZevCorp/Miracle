/* Rerenderiza el video de la película de Ü.
 *
 *   node scripts/render-u.mjs                 # 1920x1200, cola de 320 ms
 *   node scripts/render-u.mjs --cola 500      # más aire entre frases
 *   node scripts/render-u.mjs --w 1280 --h 800 --crf 23
 *
 * Necesita ffmpeg en el PATH y playwright-core:
 *   npm i --no-save playwright-core      (usa el Chrome del sistema, no baja nada)
 *
 * QUÉ HACE
 * --------
 * La película de Ü sigue existiendo como DOM —13 escenas y 13 mp3, en
 * public/u/dentro.js—, pero ya no es lo que ve nadie: es el MÁSTER. Este
 * script abre /u/?render=1 (la página se queda solo con el escritorio, a
 * pantalla completa, sin cabecera ni 3D), graba el resultado con el screencast
 * de CDP y monta el MP4 que sí se publica.
 *
 * La voz NO se graba de la página. Se monta aparte, colocando cada mp3 en el
 * milisegundo en el que arranca su escena, para que quede en UNA sola pista.
 * Es la razón de ser de todo esto: 13 `Audio.play()` encadenados se oían como
 * cortes ("con voz se corta mucho", que fue el reporte).
 *
 * Y los tiempos no se copian a mano: `ajustarACola` mide la duración REAL de
 * cada mp3 y le suma la cola. Al regenerar las voces, se vuelve a correr esto
 * y los tiempos se recalculan solos.
 *
 * SALIDA (en public/u/assets/peli/)
 *   u-trabajando.mp4   el video con su voz
 *   u-trabajando.jpg   el póster
 *   capitulos.json     los arranques de escena. Dato del montaje: la barra
 *                      NO los pinta (doce marcas se leen como una pieza
 *                      dividida en etapas, y de eso se venía)
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLICO = join(RAIZ, 'public');
const DESTINO = join(PUBLICO, 'u', 'assets', 'peli');

const arg = (n, d) => {
  const i = process.argv.indexOf('--' + n);
  return i > -1 ? process.argv[i + 1] : d;
};
const W = +arg('w', 1920);
const H = +arg('h', 1200);
const COLA = +arg('cola', 320);
const CRF = +arg('crf', 21);
const FPS = +arg('fps', 30);
const PUERTO = +arg('puerto', 4788);
const TMP = join(tmpdir(), 'u-render-frames');

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error('Falta playwright-core.  npm i --no-save playwright-core');
  process.exit(1);
}

/* ----------------------------- servidor estático ----------------------------
 * La página se sirve desde public/ y no desde `next dev` a propósito: el
 * escritorio es HTML plano y no hace falta levantar la app entera para grabar
 * un video. Además así el render no depende de que el dev server esté arriba. */
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.hdr': 'application/octet-stream', '.glb': 'model/gltf-binary',
  '.css': 'text/css; charset=utf-8', '.ico': 'image/x-icon',
};
const servidor = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(PUBLICO, p);
    if (!f.startsWith(PUBLICO)) { res.writeHead(403).end(); return; }
    const cuerpo = await readFile(f);
    res.writeHead(200, { 'content-type': TIPOS[extname(f)] || 'application/octet-stream' });
    res.end(cuerpo);
  } catch { res.writeHead(404).end('no'); }
});
await new Promise((ok) => servidor.listen(PUERTO, ok));

/* -------------------------------- la captura ------------------------------- */
if (existsSync(TMP)) await rm(TMP, { recursive: true });
await mkdir(TMP, { recursive: true });

const navegador = await chromium.launch({
  channel: 'chrome',
  args: [
    '--hide-scrollbars', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--force-color-profile=srgb', '--font-render-hinting=none',
  ],
});
const pagina = await navegador.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const fallos = [];
pagina.on('pageerror', (e) => fallos.push(String(e)));
pagina.on('console', (m) => { if (m.type() === 'error') fallos.push(m.text()); });

const ff = (args, etiqueta) => new Promise((ok, mal) => {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args, '-y'], { stdio: ['ignore', 'ignore', 'inherit'] });
  p.on('error', () => mal(new Error('ffmpeg no está en el PATH')));
  p.on('close', (c) => (c === 0 ? ok() : mal(new Error(`ffmpeg falló en ${etiqueta} (${c})`))));
});

/* ------------------------ dónde suena de verdad cada mp3 -------------------
 * Los archivos traen aire: unos 130 ms antes de la primera sílaba y otro tanto
 * después de la última. Contar ese aire como frase deja el DOBLE de pausa de
 * la pedida — y una pausa de casi un segundo, doce veces seguidas, es
 * exactamente lo que se oye como "se corta mucho".
 *
 * No se adivina con parseos: se recorta de verdad a un wav, se le devuelve un
 * margen corto por los dos lados y se mide el resultado. Ese wav es el que
 * entra al montaje y esa duración es la que usa la página para repartir el
 * tiempo de las escenas, así que imagen y voz salen del mismo número. */
const RECORTE = 'silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:detection=peak'
  + ',areverse,' + 'silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:detection=peak'
  + ',areverse,adelay=40|40,apad=pad_dur=0.08';

async function duracion(archivo) {
  const txt = await new Promise((ok, mal) => {
    const p = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', archivo]);
    let t = '';
    p.stdout.on('data', (d) => (t += d));
    p.on('error', () => mal(new Error('ffprobe no está en el PATH')));
    p.on('close', () => ok(t));
  });
  return parseFloat(txt);
}

async function recortar(pista, i) {
  const salida = join(TMP, `voz-${String(i).padStart(2, '0')}.wav`);
  await ff(['-i', join(PUBLICO, 'u', 'assets', 'voz', pista + '.mp3'),
    '-af', RECORTE, '-ar', '48000', '-ac', '1', salida], 'el recorte de ' + pista);
  return { archivo: salida, dur: await duracion(salida) };
}

console.log(`· abriendo /u/?render=1 a ${W}x${H}`);
await pagina.goto(`http://localhost:${PUERTO}/u/?render=1`, { waitUntil: 'load' });
await pagina.waitForFunction(() => window.__dentro, null, { timeout: 60000 });
await pagina.waitForTimeout(2500);

const orden = await pagina.evaluate(() => window.__dentro.orden());
const voces = [];
for (let i = 0; i < orden.length; i++) voces.push(orden[i] ? await recortar(orden[i], i) : null);
const info = await pagina.evaluate(async ([cola, medidas]) => {
  const t = await window.__dentro.ajustarACola(cola, medidas);
  return { ...t, orden: window.__dentro.orden() };
}, [COLA, voces.map((v) => (v ? v.dur : null))]);
console.log(`· ${info.DURS.length} escenas, ${(info.TOTAL / 1000).toFixed(2)} s con cola de ${COLA} ms`);

/* El reloj de la barra de tareas se congela: si no, el video lleva grabada la
 * hora y la fecha del día del render. Se sustituye el nodo — el intervalo del
 * sitio sigue escribiendo, pero sobre uno ya desconectado del documento. */
await pagina.evaluate(() => {
  for (const [id, txt] of [['d-reloj', '9:07'], ['d-fecha', '']]) {
    const el = document.getElementById(id);
    if (!el) continue;
    const c = el.cloneNode(false);
    c.textContent = txt;
    el.replaceWith(c);
  }
});

const cdp = await pagina.context().newCDPSession(pagina);
const brutos = [];
cdp.on('Page.screencastFrame', async (f) => {
  brutos.push({ t: f.metadata.timestamp, data: f.data });
  try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
await pagina.waitForTimeout(600);

console.log('· grabando…');
const t0 = await pagina.evaluate(() => {
  window.__dentro.arrancar(false);        // sin sonido: la voz se monta aparte
  return Date.now() / 1000;
});
await pagina.waitForTimeout(info.TOTAL + 900);
await cdp.send('Page.stopScreencast');
await pagina.waitForTimeout(200);
await navegador.close();
servidor.close();

const DUR = info.TOTAL / 1000;
console.log(`· ${brutos.length} frames (${(brutos.length / DUR).toFixed(0)} fps medios)`);
if (fallos.length) console.log('  ojo, la página reportó:', fallos.slice(0, 4));

/* Los tiempos del screencast son de reloj de pared, no un múltiplo de nada:
 * se escriben como duraciones por frame y ffmpeg los lleva a 30 fps constantes.
 * Volcarlos a un fps fijo aquí sería inventarse el movimiento. */
const utiles = brutos.filter((f) => f.t - t0 >= -0.2).map((f) => ({ t: Math.max(0, f.t - t0), data: f.data }));
if (!utiles.length) throw new Error('no se capturó ni un frame después de arrancar');
utiles[0].t = 0;

let lista = '', ultimo = null;
for (let i = 0; i < utiles.length; i++) {
  const n = String(i).padStart(5, '0') + '.jpg';
  await writeFile(join(TMP, n), Buffer.from(utiles[i].data, 'base64'));
  const fin = i + 1 < utiles.length ? Math.min(utiles[i + 1].t, DUR) : DUR;
  lista += `file '${join(TMP, n)}'\nduration ${Math.max(0.001, fin - utiles[i].t).toFixed(4)}\n`;
  ultimo = n;
  if (utiles[i].t >= DUR) break;
}
lista += `file '${join(TMP, ultimo)}'\n`;
await writeFile(join(TMP, 'lista.txt'), lista);

/* ------------------------------- el montaje -------------------------------- */
console.log('· codificando video…');
const mudo = join(TMP, 'mudo.mp4');
await ff(['-f', 'concat', '-safe', '0', '-i', join(TMP, 'lista.txt'),
  '-fps_mode', 'cfr', '-r', String(FPS), '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
  '-crf', String(CRF), '-preset', 'slow', '-profile:v', 'high', '-level', '4.1',
  '-movflags', '+faststart', mudo], 'el video');

console.log('· montando la voz en una sola pista…');
const t0Escena = (i) => (i === 0 ? 0 : info.INICIOS[i - 1]);
const entradas = [], filtros = [];
info.orden.forEach((pista, i) => {
  if (!pista) return;
  const n = filtros.length;
  // Ya recortado: adelay solo lo coloca en el arranque de SU escena.
  entradas.push('-i', voces[i].archivo);
  filtros.push(`[${n}]adelay=${t0Escena(i)}|${t0Escena(i)}[a${n}]`);
});
const n = filtros.length;
const voz = join(TMP, 'voz.m4a');
await ff([...entradas, '-filter_complex',
  `${filtros.join(';')};${filtros.map((_, i) => `[a${i}]`).join('')}amix=inputs=${n}:normalize=0:dropout_transition=0,apad[out]`,
  '-map', '[out]', '-t', String(DUR), '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', voz], 'la voz');

await mkdir(DESTINO, { recursive: true });
console.log('· mezclando…');
await ff(['-i', mudo, '-i', voz, '-c:v', 'copy', '-c:a', 'copy', '-movflags', '+faststart',
  join(DESTINO, 'u-trabajando.mp4')], 'la mezcla');
await ff(['-ss', '2.2', '-i', join(DESTINO, 'u-trabajando.mp4'), '-frames:v', '1', '-q:v', '3',
  join(DESTINO, 'u-trabajando.jpg')], 'el póster');
await writeFile(join(DESTINO, 'capitulos.json'),
  JSON.stringify({ inicios: info.orden.map((_, i) => +(t0Escena(i) / 1000).toFixed(3)) }) + '\n');

const bytes = (await readdir(DESTINO)).length;
await rm(TMP, { recursive: true });
console.log(`\nlisto → public/u/assets/peli/ (${bytes} archivos), ${DUR.toFixed(2)} s`);
