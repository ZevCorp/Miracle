/**
 * Texturas y ruido generados en runtime.
 *
 * La escena no descarga un solo asset: ni modelos, ni HDR, ni imágenes. Todo lo
 * que parece "material fotografiado" sale de acá — value noise para las rugosidades,
 * alphas circulares para el polvo, manchas para el vidrio, gradientes para las
 * sombras de contacto. Son unos pocos kilobytes de JS en vez de megas de texturas.
 */

import * as THREE from "three";

/** PRNG reproducible. El desorden de la escena tiene que ser el mismo siempre. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Value noise suavizado, en escala de grises. Es el que mata el look de plástico. */
export function makeRoughnessMap(size = 512, seed = 0x51ee7) {
  const rnd = mulberry32(seed);
  const cell = 8;                       // celdas del retículo base
  const grid = new Float32Array((cell + 1) * (cell + 1));
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();

  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(size, size);

  const smooth = (t) => t * t * (3 - 2 * t);
  const sample = (gx, gy) => grid[(gy % (cell + 1)) * (cell + 1) + (gx % (cell + 1))];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // dos octavas bastan: la superficie no necesita detalle fractal profundo
      let v = 0, amp = 0.65, freq = cell;
      for (let o = 0; o < 3; o++) {
        const fx = (x / size) * freq, fy = (y / size) * freq;
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = smooth(fx - x0), ty = smooth(fy - y0);
        const n = lerp(
          lerp(sample(x0, y0), sample(x0 + 1, y0), tx),
          lerp(sample(x0, y0 + 1), sample(x0 + 1, y0 + 1), tx),
          ty
        );
        v += n * amp;
        amp *= 0.5;
        freq *= 2;
      }
      const g = Math.max(0, Math.min(255, Math.round(120 + v * 135)));
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const lerp = (a, b, t) => a + (b - a) * t;

/** Punto circular difuminado: el alpha de cada mota de polvo. */
export function makeDustAlpha(size = 32) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(cv);
}

/** Mancha radial para las sombras de contacto en el piso. */
export function makeContactShadow(size = 256) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(0,0,0,0.85)");
  g.addColorStop(0.45, "rgba(0,0,0,0.35)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(cv);
}

/**
 * Huellas y polvo del vidrio del monitor. Sin esto el vidrio se ve como un
 * plano perfecto, que es justo lo que delata un render.
 */
export function makeGlassSmudge(size = 256, seed = 0xf1e5) {
  const rnd = mulberry32(seed);
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);

  // tres huellas de dedo, elípticas y suaves
  for (let i = 0; i < 3; i++) {
    const x = size * (0.25 + rnd() * 0.5);
    const y = size * (0.3 + rnd() * 0.5);
    const r = size * (0.05 + rnd() * 0.05);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 1.5);
    ctx.translate(-x, -y);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // polvo fino
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(255,255,255,${(0.05 + rnd() * 0.12).toFixed(3)})`;
    ctx.fillRect(rnd() * size, rnd() * size, 1, 1);
  }
  return new THREE.CanvasTexture(cv);
}

/** Alpha de una hoja, para la planta. Dos curvas y una nervadura. */
export function makeLeafAlpha(size = 128) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.02);
  ctx.bezierCurveTo(size * 0.95, size * 0.30, size * 0.86, size * 0.80, size * 0.5, size * 0.99);
  ctx.bezierCurveTo(size * 0.14, size * 0.80, size * 0.05, size * 0.30, size * 0.5, size * 0.02);
  ctx.fill();
  return new THREE.CanvasTexture(cv);
}

/** Veta de madera barata: franjas longitudinales de bajo contraste. */
export function makeWoodMap(size = 512, base = "#B98D5F", seed = 0x77D4) {
  const rnd = mulberry32(seed);
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // vetas: franjas horizontales onduladas apenas más oscuras/claras
  for (let i = 0; i < 26; i++) {
    const y = rnd() * size;
    const alto = 2 + rnd() * 7;
    const tono = rnd() < 0.5 ? "rgba(90,60,30," : "rgba(255,235,205,";
    ctx.fillStyle = tono + (0.04 + rnd() * 0.07).toFixed(3) + ")";
    ctx.beginPath();
    for (let x = 0; x <= size; x += 16) {
      const yy = y + Math.sin(x * 0.02 + i) * 4;
      x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
    }
    for (let x = size; x >= 0; x -= 16) {
      const yy = y + alto + Math.sin(x * 0.02 + i) * 4;
      ctx.lineTo(x, yy);
    }
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Terrazo sutil para piso: moteado fino de bajo contraste. */
export function makeTerrazzoMap(size = 512, base = "#D9CEC0", seed = 0x7E22) {
  const rnd = mulberry32(seed);
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const tonos = ["rgba(160,148,130,", "rgba(255,252,246,", "rgba(120,110,96,", "rgba(200,188,170,"];
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = tonos[i % 4] + (0.10 + rnd() * 0.16).toFixed(3) + ")";
    const r = 0.8 + rnd() * 2.6;
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
