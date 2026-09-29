/**
 * Geometría de la carita de Ü — la fuente única de verdad.
 *
 * Portada literalmente de `windows-client/src/Ui/FaceControl.cs` (WPF), que a su
 * vez porta `FaceView.kt` (Android). Se conserva el sistema de coordenadas
 * original del SVG (viewBox -75..75), así que TODAS las constantes de acá son
 * exactamente las del cliente Windows.
 *
 * Este módulo no dibuja: solo calcula. Lo consumen `face.js` (SVG, para el DOM)
 * y `face-canvas.js` (canvas 2D, para usar la carita como textura dentro del 3D).
 * Si algún día cambia la carita en el cliente, se cambia acá y los dos renderers
 * quedan al día solos.
 */

export const VIEW = 75;            // el viewBox va de -75 a 75
export const R = VIEW - 1;         // r = min(w,h)/2 - s, con s = min/150
export const STROKE = 4;           // grosor del trazo de los rasgos
export const TILT = -2;            // los rasgos van rotados -2°

const SQUIRCLE_N = 4;
const SQUIRCLE_STEPS = 72;

/** Squircle: superelipse |x|^n+|y|^n=1 con n≈4 — el "cuadrado con curva de Euler". */
export function squirclePoints(r) {
  const pts = [];
  for (let i = 0; i <= SQUIRCLE_STEPS; i++) {
    const t = (2 * Math.PI * i) / SQUIRCLE_STEPS;
    const ct = Math.cos(t), st = Math.sin(t);
    pts.push([
      r * Math.sign(ct) * Math.abs(ct) ** (2 / SQUIRCLE_N),
      r * Math.sign(st) * Math.abs(st) ** (2 / SQUIRCLE_N),
    ]);
  }
  return pts;
}

export function squirclePath(r) {
  return squirclePoints(r)
    .map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(3) + " " + p[1].toFixed(3))
    .join("") + "Z";
}

/** Los dos juegos de parámetros faciales: reposo y "pensando". */
export function params(thinking) {
  return {
    browL: thinking ? -1 : 2,
    browR: thinking ? 4 : 2.5,
    curveL: thinking ? 0.1 : 0.3,
    curveR: thinking ? 0.5 : 0.4,
    eyeOpen: thinking ? 0.75 : 0.85,
    squint: thinking ? 0.2 : 0.15,
    mouthCurve: 0.7,
    mouthWidth: 34 * (thinking ? 0.95 : 1.1),
    cornerL: thinking ? 0.2 : 0.3,
    cornerR: thinking ? 0.1 : 0.5,
  };
}

/** Ceja: bezier cuadrática sobre cada ojo. bx = -30 (izq) o 30 (der). */
export function brow(bx, bh, c) {
  return {
    start: [bx - 10, -34 - bh],
    ctrl: [bx, -34 - bh - c * 15],
    end: [bx + 10, -34 - bh],
  };
}

/** Largo del ojo (línea vertical). blink: 0 abierto, 1 cerrado. */
export function eyeLength(eyeOpen, squint, blink) {
  return 25 * eyeOpen * (1 - squint * 0.4) * (1 - blink * 0.92);
}

/** Los dos ojos son líneas verticales centradas en y = -14, en x = ±30 + eyeShift. */
export function eyeSegment(ex, eyeShift, len) {
  return { x: ex + eyeShift, y1: -14 - len / 2, y2: -14 + len / 2 };
}

/** Boca: bezier cúbica asimétrica. */
export function mouth(p) {
  const base = p.mouthCurve * 15;
  const half = p.mouthWidth / 2;
  const shift = (p.cornerR - p.cornerL) * 10;
  const midY = 34 - p.mouthCurve * 12;
  return {
    start: [-half, 34 - base - p.cornerL * 8],
    c1: [-half * 0.3 + shift, midY],
    c2: [half * 0.3 + shift, midY],
    end: [half, 34 - base - p.cornerR * 8],
  };
}

/** Paleta por tema — mismos valores que `Palette.kt` de Android. */
export function palette(dark) {
  return dark
    ? {
        line: "#ffffff",
        fillTop: "#1A1A1A",
        fillBottom: "#000000",
        border: "rgba(255,255,255,0.2)",
        borderWidth: 0.35,
        borderInset: 0.35 * 1.5,   // la hairline se mete hacia adentro lo mismo que su grosor
      }
    : {
        line: "#000000",
        fillTop: "#ffffff",
        fillBottom: "#ffffff",
        border: "rgba(0,0,0,0.12)",
        borderWidth: 1.5,
        borderInset: 0,
      };
}
