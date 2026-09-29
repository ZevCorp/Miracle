/* Verifica la página de Ü: el video, el sonido y el encaje del scroll.
 *
 *   node scripts/verificar-u.mjs            # 1440x900
 *   node scripts/verificar-u.mjs --movil    # 390x844
 *   node scripts/verificar-u.mjs --fotos /tmp/u   # además, capturas
 *
 * Necesita playwright-core:  npm i --no-save playwright-core
 *
 * No hay assertions de librería a propósito: imprime una línea por prueba con
 * OK/FALLA y sale con código 1 si algo falla, que es lo que necesita el bucle
 * de revisión. Cada prueba dice qué se midió, no solo si pasó.
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, resolve } from 'node:path';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLICO = join(RAIZ, 'public');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const MOVIL = process.argv.includes('--movil');
const FOTOS = arg('fotos', null);
const PUERTO = +arg('puerto', 4791);
const W = MOVIL ? 390 : +arg('w', 1440);
const H = MOVIL ? 844 : +arg('h', 900);

let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch { console.error('Falta playwright-core.  npm i --no-save playwright-core'); process.exit(1); }

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
    if (!f.startsWith(PUBLICO)) return res.writeHead(403).end();
    const cuerpo = await readFile(f);
    const tipo = TIPOS[extname(f)] || 'application/octet-stream';
    /* Rangos. Sin esto el <video> no puede buscar: pedir el segundo 34 de un
     * MP4 es una petición Range, y un servidor que siempre responde 200 con el
     * archivo entero deja el `currentTime` donde estaba. La prueba de la barra
     * fallaba por el servidor de pruebas, no por la página. */
    const r = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (r) {
      const fin = r[2] ? Math.min(+r[2], cuerpo.length - 1) : cuerpo.length - 1;
      const ini = r[1] ? +r[1] : Math.max(0, cuerpo.length - fin);
      res.writeHead(206, {
        'content-type': tipo, 'accept-ranges': 'bytes',
        'content-range': `bytes ${ini}-${fin}/${cuerpo.length}`,
        'content-length': fin - ini + 1,
      });
      return res.end(cuerpo.subarray(ini, fin + 1));
    }
    res.writeHead(200, { 'content-type': tipo, 'accept-ranges': 'bytes', 'content-length': cuerpo.length });
    res.end(cuerpo);
  } catch { res.writeHead(404).end('no'); }
});
await new Promise((ok) => servidor.listen(PUERTO, ok));

const fallos = [];
let n = 0;
const prueba = (nombre, bien, detalle = '') => {
  n++;
  if (!bien) fallos.push(nombre);
  console.log(`${bien ? ' OK ' : 'FALLA'}  ${nombre}${detalle ? '  — ' + detalle : ''}`);
};

const navegador = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const pagina = await navegador.newPage({
  viewport: { width: W, height: H }, deviceScaleFactor: 1,
  // `hasTouch` siempre: la prueba del arrastre con el dedo tiene que correr
  // también en escritorio. La página no consulta `pointer:coarse` ni `hover`,
  // así que no cambia nada más.
  isMobile: MOVIL, hasTouch: true,
});
const consola = [];
const pedidos = [];
pagina.on('request', (r) => pedidos.push(new URL(r.url()).pathname));
pagina.on('pageerror', (e) => consola.push('pageerror: ' + e.message));
pagina.on('console', (m) => { if (m.type() === 'error') consola.push('console: ' + m.text()); });
pagina.on('requestfailed', (r) => {
  /* Un <video> pide el MP4 por rangos y cancela la petición anterior cada vez
   * que busca: ERR_ABORTED sobre el propio video es el funcionamiento normal,
   * no un fallo. Cualquier otra cosa sí cuenta. */
  const err = r.failure()?.errorText || '';
  if (err.includes('ERR_ABORTED') && /\.(mp4|mp3)$/.test(new URL(r.url()).pathname)) return;
  consola.push('red: ' + r.url().split('/').pop() + ' ' + err);
});

if (FOTOS) await mkdir(FOTOS, { recursive: true });
const foto = async (nombre) => { if (FOTOS) await pagina.screenshot({ path: join(FOTOS, nombre + '.png') }); };

console.log(`\n=== ${MOVIL ? 'MÓVIL' : 'ESCRITORIO'} ${W}x${H} ===\n`);
await pagina.goto(`http://localhost:${PUERTO}/u/`, { waitUntil: 'load' });
await pagina.waitForFunction(() => window.__peli && window.__encaje, null, { timeout: 60000 }).catch(() => {});
await pagina.waitForTimeout(6000);

/* ─────────────────────────── 1. carga y módulos ─────────────────────────── */
const base = await pagina.evaluate(() => ({
  peli: !!window.__peli, encaje: !!window.__encaje, dentro: !!window.__dentro,
  build: window.__u && window.__u.build,
  paradas: window.__encaje ? window.__encaje.paradas() : null,
  dentroTop: document.getElementById('dentro').offsetTop,
  cartel: !!document.getElementById('d-audio'),
  domVisible: getComputedStyle(document.querySelector('.escritorio')).display !== 'none',
}));
prueba('el reproductor se carga', base.peli);
prueba('el encaje del riel se carga', base.encaje);
prueba('la película en DOM NO se carga en modo normal', !base.dentro && !base.domVisible);
prueba('no queda ni rastro del cartel de sonido', !base.cartel);
prueba('sin errores de consola ni de red', consola.length === 0, consola.slice(0, 3).join(' | '));
/* La voz vive dentro del MP4. Si alguien vuelve a cargar `dentro.js` en modo
 * normal, el sitio se baja otra vez medio mega de mp3 que ya no suena. */
const mp3 = pedidos.filter((p) => p.endsWith('.mp3'));
prueba('no se descarga ni un mp3 suelto', mp3.length === 0, mp3.slice(0, 3).join(', '));
prueba('no se carga la película en DOM', !pedidos.some((p) => p.endsWith('/dentro.js')));

/* ───────────────────────────── 2. el video ──────────────────────────────── */
await pagina.evaluate((y) => window.scrollTo(0, y), base.dentroTop);
await pagina.waitForTimeout(2600);
await foto('video');
const v1 = await pagina.evaluate(() => window.__peli.estado());
prueba('el video existe y trae metadatos', v1.dur > 30, `${v1.dur}s`);
prueba('arranca solo al llegar (y mudo)', !v1.pausado && v1.mudo, `t=${v1.t.toFixed(1)}s`);
prueba('avanza de verdad', v1.t > 0.8, `t=${v1.t.toFixed(2)}s`);

const caja = await pagina.evaluate(() => {
  const p = document.getElementById('v-pantalla').getBoundingClientRect();
  const c = document.querySelector('.v-controles').getBoundingClientRect();
  const hud = document.getElementById('hud');
  return {
    p: { x: p.x, y: p.y, w: p.width, h: p.height },
    c: { x: c.x, y: c.y, w: c.width, h: c.height },
    vw: innerWidth, vh: innerHeight,
    hudOpacidad: hud ? +getComputedStyle(hud).opacity : 0,
    barra: (() => { const b = document.getElementById('v-barra').getBoundingClientRect(); return { w: b.width, x: b.x }; })(),
    controles: [...document.querySelectorAll('.v-controles button, .v-controles #v-barra, .v-controles #v-tiempo')]
      .map((e) => { const r = e.getBoundingClientRect(); return { que: e.id || e.className, x: r.x, y: r.y, w: r.width, h: r.height }; }),
  };
});
prueba('el monitor cabe entero en pantalla',
  caja.p.y >= -1 && caja.p.y + caja.p.h <= caja.vh + 1,
  `arriba ${caja.p.y.toFixed(0)} abajo ${(caja.p.y + caja.p.h).toFixed(0)} de ${caja.vh}`);
prueba('los controles caben debajo del monitor',
  caja.c.y >= caja.p.y + caja.p.h && caja.c.y + caja.c.h <= caja.vh + 1,
  `controles en ${caja.c.y.toFixed(0)}–${(caja.c.y + caja.c.h).toFixed(0)}`);
prueba('el HUD del riel no pinta sobre el video', caja.hudOpacidad < 0.02, `opacidad ${caja.hudOpacidad}`);
/* Contra el ancho de SU fila, no del viewport: la fila mide lo que mide el
 * monitor, y en apaisado eso es la mitad de la pantalla. Un tercio de la fila
 * es el mínimo para poder arrastrar sin pelearse. */
prueba('la barra de avance es arrastrable de verdad',
  caja.barra.w >= Math.max(110, caja.c.w * 0.33),
  `${Math.round(caja.barra.w)} px de ${Math.round(caja.c.w)} de fila`);
prueba('nada de la fila de controles se sale de la pantalla',
  caja.controles.every((c) => c.x >= -1 && c.x + c.w <= caja.vw + 1 && c.y + c.h <= caja.vh + 1),
  JSON.stringify(caja.controles.filter((c) => c.x < -1 || c.x + c.w > caja.vw + 1 || c.y + c.h > caja.vh + 1)));

/* pausa / play */
await pagina.click('#v-play');
await pagina.waitForTimeout(500);
const pausado = await pagina.evaluate(() => window.__peli.estado());
await pagina.click('#v-play');
await pagina.waitForTimeout(700);
const reanudado = await pagina.evaluate(() => window.__peli.estado());
prueba('el botón de play pausa y reanuda', pausado.pausado && !reanudado.pausado);

/* sonido */
const antes = await pagina.evaluate(() => window.__peli.estado().mudo);
const { antesXBarra, antesAnchoBarra } = await pagina.evaluate(() => {
  const b = document.getElementById('v-barra').getBoundingClientRect();
  return { antesXBarra: b.x, antesAnchoBarra: b.width };
});
await pagina.click('#v-sonido');
await pagina.waitForTimeout(400);
const despues = await pagina.evaluate(() => {
  const b = document.getElementById('v-barra').getBoundingClientRect();
  const vis = [...document.querySelectorAll('#v-sonido b')]
    .find((e) => getComputedStyle(e).display !== 'none');
  return { ...window.__peli.estado(), etiqueta: vis ? vis.textContent : null,
           xBarra: b.x, anchoBarra: b.width };
});
prueba('el botón de sonido lo activa', antes && !despues.mudo);
prueba('y al activarlo cambia a "Silenciar"', despues.etiqueta === 'Silenciar', despues.etiqueta);
prueba('sin mover nada de la fila al pulsarlo',
  Math.abs(despues.xBarra - antesXBarra) <= 1 && Math.abs(despues.anchoBarra - antesAnchoBarra) <= 1,
  `la barra estaba en ${Math.round(antesXBarra)}/${Math.round(antesAnchoBarra)} y quedó en ${Math.round(despues.xBarra)}/${Math.round(despues.anchoBarra)}`);
await pagina.click('#v-sonido');
await pagina.waitForTimeout(300);
prueba('y también lo vuelve a callar', await pagina.evaluate(() => window.__peli.estado().mudo));

/* barra: se puede arrastrar a otro punto */
const salto = await pagina.evaluate(async () => {
  const b = document.getElementById('v-barra').getBoundingClientRect();
  const ev = (t, x) => new PointerEvent(t, { clientX: x, clientY: b.y + b.height / 2, bubbles: true, pointerId: 1 });
  const el = document.getElementById('v-barra');
  el.setPointerCapture = () => {}; el.releasePointerCapture = () => {};
  el.dispatchEvent(ev('pointerdown', b.x + b.width * 0.7));
  el.dispatchEvent(ev('pointerup', b.x + b.width * 0.7));
  await new Promise((r) => setTimeout(r, 400));
  return { t: document.getElementById('v-peli').currentTime, dur: document.getElementById('v-peli').duration };
});
prueba('la barra lleva el video a donde se pincha',
  Math.abs(salto.t / salto.dur - 0.7) < 0.08, `quedó en ${(salto.t / salto.dur * 100).toFixed(0)}%`);

/* el cierre: botón de verdad, no el dibujo del último fotograma */
await pagina.evaluate(() => { const v = document.getElementById('v-peli'); v.currentTime = v.duration - 0.3; });
await pagina.waitForTimeout(2200);
const cierre = await pagina.evaluate(() => {
  const f = document.getElementById('v-fin');
  const cta = f && f.querySelector('[data-agendar]');
  const r = cta && cta.getBoundingClientRect();
  return {
    visible: !!f && getComputedStyle(f).display !== 'none',
    cta: !!cta, ancho: r ? Math.round(r.width) : 0,
    // ¿el clic aterriza en el botón, o hay algo encima?
    encima: r ? (document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === cta) : false,
  };
});
prueba('al terminar sale el cierre con su botón', cierre.visible && cierre.cta, JSON.stringify(cierre));
prueba('y el botón del cierre recibe el clic', cierre.encima);
await pagina.click('#v-otra');
await pagina.waitForTimeout(900);
const otraVez = await pagina.evaluate(() => window.__peli.estado());
prueba('"ver otra vez" reinicia', otraVez.t < 3 && !otraVez.pausado, `t=${otraVez.t.toFixed(1)}s`);

/* pantalla completa: que se lleve los controles y que no recorte */
await pagina.click('#v-full');
await pagina.waitForTimeout(900);
const pantallaCompleta = await pagina.evaluate(() => {
  const fs = document.fullscreenElement;
  const c = document.querySelector('.v-controles');
  const r = c.getBoundingClientRect();
  return {
    hay: !!fs, id: fs && fs.id,
    controles: !!(fs && fs.contains(c)) && r.width > 0 && r.bottom <= innerHeight + 1,
    ajuste: getComputedStyle(document.getElementById('v-peli')).objectFit,
  };
});
prueba('la pantalla completa se lleva los controles',
  !pantallaCompleta.hay || (pantallaCompleta.id === 'v-escena' && pantallaCompleta.controles),
  JSON.stringify(pantallaCompleta));
prueba('el video no se recorta nunca', pantallaCompleta.ajuste === 'contain', pantallaCompleta.ajuste);
/* Salir de verdad: en headless el Escape no siempre llega al navegador, y
 * quedarse en pantalla completa falsea todo lo que viene detrás (el video no
 * sale nunca de vista y el scroll no mueve la página). */
await pagina.evaluate(() => (document.fullscreenElement ? document.exitFullscreen() : null));
await pagina.waitForTimeout(900);
prueba('y se puede salir de la pantalla completa', !(await pagina.evaluate(() => !!document.fullscreenElement)));

/* se pausa al salir de vista y sigue por donde iba al volver */
await pagina.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await pagina.waitForTimeout(1200);
const fuera = await pagina.evaluate(() => window.__peli.estado());
await pagina.evaluate((y) => window.scrollTo(0, y), base.dentroTop);
await pagina.waitForTimeout(1500);
const vuelta = await pagina.evaluate(() => window.__peli.estado());
prueba('se pausa al perderlo de vista', fuera.pausado);
prueba('y al volver sigue por donde iba', !vuelta.pausado && vuelta.t >= fuera.t - 0.1,
  `salió en ${fuera.t.toFixed(1)}s, volvió en ${vuelta.t.toFixed(1)}s`);

/* ───────────────────── 3. el scroll no se secuestra ─────────────────────── */
const libre = await pagina.evaluate(async () => {
  const y0 = scrollY;
  window.scrollBy(0, 300);
  await new Promise((r) => setTimeout(r, 60));
  const y1 = scrollY;
  return { y0, y1 };
});
prueba('el scroll nunca se bloquea', libre.y1 !== libre.y0, `${libre.y0} → ${libre.y1}`);

/* ─────────────────────── 4. el encaje a las paradas ─────────────────────── */
const paradas = base.paradas;
prueba('hay paradas definidas', Array.isArray(paradas) && paradas.length >= 3, JSON.stringify(paradas));

async function textoVisible() {
  return pagina.evaluate(() => {
    const cajas = [];
    const mira = (el) => {
      if (!el) return;
      const cs = getComputedStyle(el);
      if (+cs.opacity < 0.35 || cs.visibility === 'hidden' || cs.display === 'none') return;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight || r.width < 40) return;
      cajas.push({ que: el.id || el.className, alto: Math.round(r.height) });
    };
    mira(document.querySelector('#hero-fijo .copy'));
    for (const c of document.querySelectorAll('#relato .copy')) mira(c);
    const dentro = document.getElementById('dentro').getBoundingClientRect();
    const enVideo = dentro.top <= 2 && dentro.bottom > innerHeight * 0.5;
    return { cajas, enVideo, y: scrollY };
  });
}

const muestras = [];
const paso = Math.max(60, Math.round(base.dentroTop / 22));
for (let y = 0; y <= base.dentroTop + 60; y += paso) muestras.push(y);

let huerfanos = [];
for (const y of muestras) {
  await pagina.evaluate((yy) => {
    // Un scroll de verdad, con su evento: es lo que dispara el encaje.
    window.scrollTo(0, yy);
    dispatchEvent(new Event('scroll'));
  }, y);
  await pagina.waitForTimeout(1150);            // 160 ms de espera + la animación
  const t = await textoVisible();
  /* "Nunca entre escenas" quiere decir: o en una parada con su texto, o ya
   * dentro del video. Exigir SIEMPRE parada marcaba como huérfano el tramo de
   * unos pocos píxeles en el que el pin del video ya manda. */
  const enParada = paradas.some((p) => Math.abs(p - t.y) <= 26);
  if (!(enParada || t.enVideo) || (!t.cajas.length && !t.enVideo)) {
    huerfanos.push({ pedido: y, quedó: t.y, textos: t.cajas.length, video: t.enVideo, enParada });
  }
}
prueba('soltar el scroll en cualquier punto acaba en una parada con texto',
  huerfanos.length === 0,
  huerfanos.length ? JSON.stringify(huerfanos.slice(0, 4)) : `${muestras.length} posiciones probadas`);

/* Con rueda de verdad, no con `scrollTo`: es donde el encaje se puede pelear
 * con el gesto, y donde ya falló una vez —los listeners de `wheel` son pasivos,
 * así que Chrome ya movió la página cuando corre el manejador—. Lo que se
 * comprueba NO es "acabó en alguna parada" (eso lo cumple también quedarse
 * quieto): es que cada empujón AVANCE una parada, que es lo que se pidió.
 */
await pagina.evaluate(() => { window.scrollTo(0, 0); dispatchEvent(new Event('scroll')); });
await pagina.waitForTimeout(1300);
const rueda = [];
for (let i = 0; i < 3; i++) {
  await pagina.mouse.move(Math.round(W / 2), Math.round(H / 2));
  await pagina.mouse.wheel(0, Math.round(H * 0.45));       // un empujón corto
  await pagina.waitForTimeout(1500);
  rueda.push(await pagina.evaluate(() => Math.round(scrollY)));
}
const esperadas = paradas.slice(1, 4);
prueba('un empujón corto avanza UNA parada', JSON.stringify(rueda) === JSON.stringify(esperadas),
  `dio ${JSON.stringify(rueda)}, se esperaba ${JSON.stringify(esperadas)}`);

/* y hacia atrás igual: el gesto manda, no la cercanía */
await pagina.mouse.wheel(0, -Math.round(H * 0.45));
await pagina.waitForTimeout(1600);
const atras = await pagina.evaluate(() => Math.round(scrollY));
prueba('y hacia atrás retrocede UNA parada', atras === paradas[2], `quedó en ${atras}, se esperaba ${paradas[2]}`);

/* Con el teclado. Las flechas mueven ~40 px, menos que el umbral del gesto, y
 * el encaje las leía como "no te has movido": pulsar ↓ tres veces dejaba la
 * página donde estaba. Para quien navega con teclado la sección era una pared.
 */
await pagina.evaluate(() => { window.scrollTo(0, 0); dispatchEvent(new Event('scroll')); });
await pagina.waitForTimeout(1300);
/* Se suelta el foco: viene de pulsar botones del reproductor, y hay que
 * comprobar la flecha con el foco donde queda de verdad, no en un sitio
 * conveniente. */
await pagina.evaluate(() => document.activeElement && document.activeElement.blur());
const teclas = [];
for (let i = 0; i < 3; i++) {
  await pagina.keyboard.press('ArrowDown');
  await pagina.waitForTimeout(1400);
  teclas.push(await pagina.evaluate(() => Math.round(scrollY)));
}
prueba('la flecha abajo avanza de parada', JSON.stringify(teclas) === JSON.stringify(paradas.slice(1, 4)),
  `dio ${JSON.stringify(teclas)}, se esperaba ${JSON.stringify(paradas.slice(1, 4))}`);
await pagina.keyboard.press('ArrowUp');
await pagina.waitForTimeout(1500);
const arriba = await pagina.evaluate(() => Math.round(scrollY));
prueba('y la flecha arriba retrocede', arriba === paradas[2], `quedó en ${arriba}`);

/* Y dentro del reproductor las flechas buscan en el video, no mueven la página. */
await pagina.evaluate((y) => window.scrollTo(0, y), base.dentroTop);
await pagina.waitForTimeout(1600);
const busca = await pagina.evaluate(async () => {
  const v = document.getElementById('v-peli');
  v.pause(); v.currentTime = 10;
  document.getElementById('v-barra').focus();
  return { antes: v.currentTime, y: scrollY };
});
await pagina.keyboard.press('ArrowRight');
await pagina.waitForTimeout(700);
const buscado = await pagina.evaluate(() => ({ t: document.getElementById('v-peli').currentTime, y: scrollY }));
prueba('en el reproductor las flechas buscan, no scrollean',
  buscado.t > busca.antes + 3 && buscado.y === busca.y,
  `${busca.antes.toFixed(1)}s → ${buscado.t.toFixed(1)}s, scroll ${busca.y}→${buscado.y}`);
await pagina.evaluate(() => { const v = document.getElementById('v-peli'); v.currentTime = 0; v.play().catch(() => {}); });
await pagina.waitForTimeout(500);

/* Con el dedo apoyado, la página no se mueve sola.
 *
 * `cancelar` corta el encaje en marcha, pero un arrastre lento no vuelve a
 * disparar `touchstart`: bastaba con parar el dedo 160 ms —sin levantarlo—
 * para que la página se fuera sola casi 900 px por debajo. Se prueba con
 * eventos táctiles de verdad (CDP), no con `scrollTo`. */
{
  const cdp = await pagina.context().newCDPSession(pagina);
  const punto = (y) => [{ x: Math.round(W / 2), y: Math.round(y), radiusX: 5, radiusY: 5, force: 1, id: 1 }];
  await pagina.evaluate(() => { window.scrollTo(0, 0); dispatchEvent(new Event('scroll')); });
  await pagina.waitForTimeout(1300);
  let y = Math.round(H * 0.75);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punto(y) });
  for (let i = 0; i < 4; i++) {
    y -= 40;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: punto(y) });
    await pagina.waitForTimeout(60);
  }
  const conDedo = await pagina.evaluate(() => Math.round(scrollY));
  await pagina.waitForTimeout(700);                       // el dedo sigue abajo
  const trasEsperar = await pagina.evaluate(() => Math.round(scrollY));
  prueba('con el dedo apoyado la página no se mueve sola',
    Math.abs(trasEsperar - conDedo) <= 4, `${conDedo} → ${trasEsperar}`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pagina.waitForTimeout(1600);
  const alSoltar = await pagina.evaluate(() => Math.round(scrollY));
  prueba('y al soltar sí encaja', paradas.some((p) => Math.abs(p - alSoltar) <= 26),
    `quedó en ${alSoltar} de ${JSON.stringify(paradas)}`);
  await cdp.detach();
}

/* Descansar justo antes del pin del video no puede dejar el empalme a medias:
 * es invisible (la escala va en 1.0003) pero el 3D sigue dibujando detrás de
 * un canvas ya tapado. */
await pagina.evaluate((y) => { window.scrollTo(0, y); dispatchEvent(new Event('scroll')); }, base.dentroTop - 18);
await pagina.waitForTimeout(1500);
const bordeDelPin = await pagina.evaluate(() => ({
  y: Math.round(scrollY),
  empalmando: document.getElementById('dentro').classList.contains('empalmando'),
  canvas: getComputedStyle(document.querySelector('canvas')).display,
}));
prueba('no se descansa a 20 px del pin con el empalme a medias',
  !bordeDelPin.empalmando && bordeDelPin.canvas === 'none', JSON.stringify(bordeDelPin));

/* La salida hacia la landing.
 *
 * El escenario se desvanece, y por debajo asomaba el copy del riel: su ventana
 * llega a p=1.01, así que a q=1 seguía encendido detrás del video. Con el
 * escenario opaco no se veía; al desvanecerlo, "Aprende como tú trabajas."
 * reaparecía cruzado con la fila de controles del reproductor.
 */
const salida = [];
for (const f of [0.25, 0.5, 0.75]) {
  await pagina.evaluate((ff) => {
    const d = document.getElementById('dentro');
    window.scrollTo(0, Math.round(d.offsetTop + d.offsetHeight - innerHeight * (1 - ff)));
    dispatchEvent(new Event('scroll'));
  }, f);
  await pagina.waitForTimeout(500);
  salida.push(await pagina.evaluate(() => {
    const esc = +getComputedStyle(document.getElementById('v-escena')).opacity;
    /* La opacidad efectiva es la del bloque POR la de su contenedor: `#relato`
     * se apaga entero, y mirar solo el hijo da 1 aunque no se vea nada. */
    const opRelato = +getComputedStyle(document.getElementById('relato')).opacity;
    const vis = [...document.querySelectorAll('#relato .copy')].filter((c) => {
      const r = c.getBoundingClientRect();
      return opRelato * +getComputedStyle(c).opacity > 0.05 && r.bottom > 0 && r.top < innerHeight;
    }).length;
    return { esc: +esc.toFixed(2), copiasVisibles: vis };
  }));
}
prueba('al salir del video no reaparece el texto del riel',
  salida.every((s) => s.copiasVisibles === 0), JSON.stringify(salida));

/* Girar el teléfono estando en una parada no puede soltarte en otra parte:
 * el documento cambia de alto y el mismo scroll en píxeles ya no es el mismo
 * sitio. Se vuelve a la MISMA parada, medida de nuevo. */
await pagina.evaluate((y) => { window.scrollTo(0, y); dispatchEvent(new Event('scroll')); }, paradas[1]);
await pagina.waitForTimeout(1400);
const antesDeGirar = await pagina.evaluate(() => Math.round(scrollY));
await pagina.setViewportSize({ width: H, height: W });
await pagina.waitForTimeout(1500);
const trasGirar = await pagina.evaluate(() => ({
  y: Math.round(scrollY), paradas: window.__encaje.paradas(),
}));
await pagina.setViewportSize({ width: W, height: H });
await pagina.waitForTimeout(1200);
prueba('girar la pantalla te deja en la misma parada',
  Math.abs(trasGirar.y - trasGirar.paradas[1]) <= 26,
  `estaba en ${antesDeGirar}, giró a ${trasGirar.y}, la parada ahora es ${trasGirar.paradas[1]}`);

/* Y lo mismo SUBIENDO desde la landing, que es por donde volvió a colarse.
 *
 * El observer cruzaba su umbral antes de que la salida soltara los clics y
 * rearrancaba el video: 142 px de scroll con voz sonando y el ratón sin poder
 * callarla. La prueba de arriba no lo veía porque llega desde arriba y con el
 * video ya parado. Aquí se sube de verdad, con el sonido puesto, y se exige que
 * en TODA la franja sin clics el video esté parado. */
await pagina.evaluate(() => {
  const d = document.getElementById('dentro');
  const v = document.getElementById('v-peli');
  v.muted = false;                       // el caso que duele: sonando
  window.scrollTo(0, d.offsetTop + d.offsetHeight + innerHeight * 0.3);
  dispatchEvent(new Event('scroll'));
});
await pagina.waitForTimeout(900);
const subiendo = [];
for (let f = 0.25; f <= 0.75; f += 0.06) {
  await pagina.evaluate((ff) => {
    const d = document.getElementById('dentro');
    window.scrollTo(0, Math.round(d.offsetTop + d.offsetHeight - innerHeight * ff));
    dispatchEvent(new Event('scroll'));
  }, f);
  await pagina.waitForTimeout(650);
  subiendo.push(await pagina.evaluate(() => {
    const esc = document.getElementById('v-escena'), v = document.getElementById('v-peli');
    return { op: +(+getComputedStyle(esc).opacity).toFixed(2),
             clics: getComputedStyle(esc).pointerEvents, pausado: v.paused };
  }));
}
const sonandoSinTocar = subiendo.filter((m) => m.clics === 'none' && !m.pausado);
prueba('subiendo desde la landing no queda voz que no se pueda callar',
  sonandoSinTocar.length === 0, JSON.stringify(sonandoSinTocar.length ? sonandoSinTocar : subiendo));
await pagina.evaluate(() => { document.getElementById('v-peli').muted = true; });

/* Pantalla completa no puede heredar el fundido de salida.
 *
 * La opacidad del fundido es un estilo EN LÍNEA sobre `#v-escena`, así que en
 * pantalla completa se heredaba: el video se veía lavado al 50 % — justo el
 * botón cuyo trabajo es enseñarlo mejor. Y como en pantalla completa la rueda
 * ya no scrollea, no se recuperaba en toda la sesión.
 */
await pagina.evaluate(() => {
  const d = document.getElementById('dentro');
  window.scrollTo(0, Math.round(d.offsetTop + d.offsetHeight - innerHeight * 0.62));
  dispatchEvent(new Event('scroll'));
});
await pagina.waitForTimeout(700);
const antesDeFs = await pagina.evaluate(() => +getComputedStyle(document.getElementById('v-escena')).opacity);
await pagina.click('#v-full', { force: true });
await pagina.waitForTimeout(900);
const enFs = await pagina.evaluate(() => ({
  hay: !!document.fullscreenElement,
  op: +getComputedStyle(document.getElementById('v-escena')).opacity,
  clics: getComputedStyle(document.getElementById('v-escena')).pointerEvents,
}));
prueba('en pantalla completa el video se ve entero, sin el fundido de salida',
  !enFs.hay || (enFs.op > 0.99 && enFs.clics !== 'none'),
  `venía en ${antesDeFs.toFixed(2)} y en pantalla completa quedó ${JSON.stringify(enFs)}`);
/* Y en pantalla completa el fundido no puede volver por la puerta de atrás:
 * un `resize` o un `scroll` de después lo repintaba con la pantalla completa
 * todavía puesta. */
if (enFs.hay) {
  await pagina.evaluate(() => { dispatchEvent(new Event('resize')); dispatchEvent(new Event('scroll')); });
  await pagina.waitForTimeout(500);
  const tras = await pagina.evaluate(() => +getComputedStyle(document.getElementById('v-escena')).opacity);
  prueba('y un resize no le devuelve el fundido', tras > 0.99, `quedó en ${tras}`);
}
await pagina.evaluate(() => (document.fullscreenElement ? document.exitFullscreen() : null));
await pagina.waitForTimeout(800);

/* El escenario, cuando ya no se ve, tampoco recibe clics.
 *
 * Bajar la opacidad no quita los clics: a 0.19 el escenario era invisible y la
 * barra de avance seguía a media pantalla comiéndose el clic que iba a la
 * landing — y encima saltaba el video. Se comprueba pulsando de verdad donde
 * queda la barra y mirando si el video se movió.
 */
await pagina.evaluate(() => {
  const d = document.getElementById('dentro');
  const v = document.getElementById('v-peli');
  v.pause(); v.currentTime = 8;
  // ~0.19 de opacidad: k = (r.bottom/vh)^1.8  →  r.bottom = 0.4·vh
  window.scrollTo(0, Math.round(d.offsetTop + d.offsetHeight - innerHeight * 0.4));
  dispatchEvent(new Event('scroll'));
});
await pagina.waitForTimeout(700);
const fantasma = await pagina.evaluate(() => {
  const esc = document.getElementById('v-escena');
  const b = document.getElementById('v-barra').getBoundingClientRect();
  const x = Math.round(b.x + b.width * 0.8), y = Math.round(b.y + b.height / 2);
  const encima = (y >= 0 && y <= innerHeight) ? document.elementFromPoint(x, y) : null;
  return {
    opacidad: +getComputedStyle(esc).opacity,
    clics: getComputedStyle(esc).pointerEvents,
    // quién recibiría el clic donde está la barra
    quien: encima ? (encima.id || encima.className || encima.tagName) : 'fuera de pantalla',
    t: document.getElementById('v-peli').currentTime,
    pausado: document.getElementById('v-peli').paused,
  };
});
prueba('el escenario desvanecido no se come los clics',
  fantasma.clics === 'none' || fantasma.opacidad > 0.35,
  JSON.stringify(fantasma));
/* Y si no se puede tocar, tampoco puede seguir sonando: el corte de los clics
 * y la pausa tienen que venir del mismo sitio. Antes no, y quedaba una banda
 * de ~90 px con el video sonando y el ratón sin poder callarlo. */
prueba('y si no se puede tocar, tampoco sigue corriendo',
  fantasma.clics !== 'none' || fantasma.pausado, JSON.stringify(fantasma));

/* WCAG 2.5.3: el nombre accesible tiene que contener el texto visible, o quien
 * usa control por voz dice lo que lee y no pasa nada. */
const nombres = await pagina.evaluate(() => {
  const mal = [];
  for (const b of document.querySelectorAll('.v-controles button, #v-fin button')) {
    const visible = [...b.querySelectorAll('b, span')]
      .filter((e) => getComputedStyle(e).display !== 'none')
      .map((e) => e.textContent.trim()).join(' ').trim()
      || (b.children.length === 0 ? b.textContent.trim() : '');
    if (!visible) continue;                       // solo icono: el label manda
    const nombre = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase();
    if (!nombre.includes(visible.toLowerCase())) mal.push({ id: b.id, visible, nombre });
  }
  return mal;
});
prueba('el nombre accesible incluye el texto visible', nombres.length === 0, JSON.stringify(nombres));

/* Pasado el pin del video, el scroll es del usuario.
 *
 * El margen era `innerHeight * 0.12` —108 px en una pantalla de 900— y un
 * notch de rueda de Chrome son ~100: quien bajaba UN notch y se paraba veía
 * cómo la página se devolvía sola al video. Y otra vez. Quedaba encerrado.
 */
const escapes = [];
for (const delta of [60, 100, 140]) {
  await pagina.evaluate((y) => { window.scrollTo(0, y); dispatchEvent(new Event('scroll')); }, base.dentroTop);
  await pagina.waitForTimeout(1300);
  await pagina.mouse.move(Math.round(W / 2), Math.round(H / 2));
  await pagina.mouse.wheel(0, delta);
  await pagina.waitForTimeout(1400);
  escapes.push({ delta, y: await pagina.evaluate(() => Math.round(scrollY)) });
}
prueba('un empujón corto desde el video no te devuelve al video',
  escapes.every((e) => e.y > base.dentroTop + 2), JSON.stringify(escapes));

/* El velo no puede cortarse.
 *
 * Un gradiente radial se pinta DENTRO de su caja: si el radio es mayor que la
 * distancia del centro al borde, no llega a `transparent` y se corta — un
 * rectángulo gris de borde recto sobre la escena, con saltos de hasta 45
 * puntos de alfa en un píxel, y en el acto 3 recortando la cara de Ü con una
 * vertical perfecta. Se comprueba la geometría, que es donde está la verdad:
 * radio x última parada <= distancia del centro al borde.
 */
const velos = await pagina.evaluate(() => {
  const mal = [];
  for (const sel of ['#relato .copy', '#hero-fijo .copy']) {
    for (const el of document.querySelectorAll(sel)) {
      const bg = getComputedStyle(el, '::before').backgroundImage;
      if (!bg || !bg.includes('radial-gradient')) continue;
      const g = bg.slice(bg.indexOf('radial-gradient('));
      const radios = /radial-gradient\(\s*([\d.]+)%\s+([\d.]+)%/.exec(g);
      if (!radios) { mal.push({ sel, por: 'radios no expresados en %', bg: g.slice(0, 60) }); continue; }
      const centro = /\bat\s+([\d.]+)%\s+([\d.]+)%/.exec(g);
      const cx = centro ? +centro[1] : 50, cy = centro ? +centro[2] : 50;
      const paradas = [...g.matchAll(/([\d.]+)%/g)].map((m) => +m[1]);
      const ultima = paradas.at(-1);            // la parada del último color
      /* Y ese último color tiene que ser TRANSPARENTE. Sin esto, un velo que
       * acabara en `rgba(4,8,18,.15) 100%` pasaría la prueba de geometría y se
       * seguiría cortando igual: el radio cabría en la caja, pero el borde
       * saltaría de .15 a 0 de golpe. */
      const colores = [...g.matchAll(/rgba?\(([^)]+)\)/g)].map((m) => m[1].split(',').map(Number));
      const alfaFinal = colores.at(-1).length > 3 ? colores.at(-1)[3] : 1;
      if (alfaFinal > 0.001) { mal.push({ sel, cls: el.className, por: 'el último color no es transparente', alfaFinal }); continue; }
      const rx = +radios[1] * (ultima / 100), ry = +radios[2] * (ultima / 100);
      const holgX = Math.min(cx, 100 - cx) - rx, holgY = Math.min(cy, 100 - cy) - ry;
      if (holgX < -0.5 || holgY < -0.5) {
        mal.push({ sel, cls: el.className, holgX: +holgX.toFixed(1), holgY: +holgY.toFixed(1) });
      }
    }
  }
  return mal;
});
prueba('el velo del copy se apaga dentro de su caja (sin borde recto)',
  velos.length === 0, JSON.stringify(velos));

/* Contraste del texto en las paradas.
 *
 * El encaje OBLIGA a descansar en ellas, así que el texto de una parada ya no
 * es algo que se cruza de paso. En el acto 3 el riel encuadra la cara de Ü,
 * casi blanca, justo detrás del texto blanco: medido antes de ponerle velo,
 * 1.34:1. Y en el hero, sobre el bisel claro del iMac, 1.9:1.
 *
 * El fondo se fotografía SIN el texto encima. Separar letra y fondo en una
 * sola captura no funciona: el párrafo no es blanco puro, así que descartar
 * "lo casi blanco" acababa midiendo la propia letra, y descartar por cercanía
 * al color del texto recorta justo el rango de fondos malos. Con el texto
 * oculto lo que queda es exactamente el fondo, y el color sale del CSS.
 */
async function contrasteEn(y, selector, nombre) {
  await pagina.evaluate((yy) => { window.scrollTo(0, yy); dispatchEvent(new Event('scroll')); }, y);
  await pagina.waitForTimeout(1800);
  await foto('parada-' + nombre);
  const cajas = await pagina.evaluate((sel) => {
    const copy = [...document.querySelectorAll(sel)]
      .filter((c) => +getComputedStyle(c).opacity > 0.5)[0];
    if (!copy) return null;
    /* Las cajas de las LÍNEAS, no la del bloque. Un `<span>` de bloque ocupa
     * todo el ancho del contenedor aunque su texto acabe a la mitad: medir el
     * hueco vacío de la derecha penalizaba un sitio donde no hay ni una letra.
     * `Range.getClientRects()` devuelve exactamente lo que ocupa el texto. */
    const partes = [];
    for (const el of copy.querySelectorAll('h2, p, .eyebrow, span')) {
      if (!el.textContent.trim()) continue;
      const color = getComputedStyle(el).color;
      const rango = document.createRange();
      rango.selectNodeContents(el);
      for (const r of rango.getClientRects()) {
        if (r.width < 30 || r.height < 8) continue;
        if (r.y < -1 || r.y + r.height > innerHeight + 1) continue;
        partes.push({ que: el.tagName.toLowerCase(), color, x: r.x, y: r.y, w: r.width, h: r.height });
      }
    }
    if (!partes.length) return null;
    const st = document.createElement('style');
    st.id = 'sin-texto';
    st.textContent = sel.split(',').map((x) => x.trim())
      .flatMap((x) => ['h2', 'p', '.eyebrow', 'span'].map((t) => `${x} ${t}`))
      .join(',') + '{visibility:hidden}';
    document.head.appendChild(st);
    return partes;
  }, selector);
  if (!cajas) return null;
  await pagina.waitForTimeout(250);
  const fondoPng = (await pagina.screenshot()).toString('base64');
  await pagina.evaluate(() => document.getElementById('sin-texto')?.remove());

  return pagina.evaluate(async ([b64, partes]) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const esc = img.width / innerWidth;
    const cv = document.createElement('canvas');
    const cx = cv.getContext('2d', { willReadFrequently: true });
    const lum = (r, g, b) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    let peor = { ratio: Infinity, que: '' };
    for (const p of partes) {
      const col = p.color.match(/[\d.]+/g).map(Number);
      const alfa = col.length > 3 ? col[3] : 1;
      cv.width = Math.max(1, Math.round(p.w * esc));
      cv.height = Math.max(1, Math.round(p.h * esc));
      cx.drawImage(img, Math.round(p.x * esc), Math.round(p.y * esc), cv.width, cv.height, 0, 0, cv.width, cv.height);
      const d = cx.getImageData(0, 0, cv.width, cv.height).data;
      /* Por celdas: lo que rompe la lectura es una mancha clara detrás de MEDIA
       * línea, y cualquier promedio del bloque entero se la traga. */
      const filas = 1, cols = 6;   // cada parte YA es una línea
      for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) {
        const y0 = Math.floor((f * cv.height) / filas), y1 = Math.floor(((f + 1) * cv.height) / filas);
        const x0 = Math.floor((c * cv.width) / cols), x1 = Math.floor(((c + 1) * cv.width) / cols);
        const px = [];
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          const i = (y * cv.width + x) * 4;
          px.push([d[i], d[i + 1], d[i + 2]]);
        }
        if (px.length < 30) continue;
        px.sort((a, b) => lum(...a) - lum(...b));
        const fon = px[Math.floor(px.length * 0.9)];     // el fondo más claro de la celda
        /* Si el color del texto tiene alfa —el eyebrow del hero es blanco al
         * 72 %—, lo que se ve NO es ese color: es esa mezcla sobre el fondo.
         * Tomarlo como blanco puro daba más contraste del que hay. */
        const t = [0, 1, 2].map((k) => col[k] * alfa + fon[k] * (1 - alfa));
        const rr = ratio(lum(...t), lum(...fon));
        if (rr < peor.ratio) peor = { ratio: rr, que: `${p.que} fila ${f} col ${c}` };
      }
    }
    return isFinite(peor.ratio) ? peor : null;
  }, [fondoPng, cajas]);
}

for (const [y, sel, nombre] of [[paradas[2], '#relato .copy', 'acto3'], [0, '#hero-fijo .copy', 'hero']]) {
  const c = await contrasteEn(y, sel, nombre);
  prueba(`el texto de la parada "${nombre}" se lee sobre lo que tenga detrás`,
    c && c.ratio >= 4.5,
    c ? `peor ${c.ratio.toFixed(2)}:1 en ${c.que} (AA pide 4.5)` : 'no había copy visible');
}

/* el empalme no se queda a medias */
await pagina.evaluate((y) => { window.scrollTo(0, y); dispatchEvent(new Event('scroll')); }, base.dentroTop - 450);
await pagina.waitForTimeout(1400);
const medioEmpalme = await pagina.evaluate(() => ({
  y: scrollY, clase: document.getElementById('dentro').classList.contains('empalmando'),
}));
prueba('no se puede quedar a mitad del empalme', !medioEmpalme.clase,
  `quedó en ${medioEmpalme.y}`);
await foto('tras-empalme');

/* ───────────────────────────── 5. el cierre ─────────────────────────────── */
prueba('sin errores nuevos al final', consola.length === 0, consola.slice(0, 3).join(' | '));

await navegador.close();
servidor.close();
console.log(`\n${n - fallos.length}/${n} pruebas OK`);
if (fallos.length) { console.log('fallan: ' + fallos.join(', ')); process.exit(1); }
