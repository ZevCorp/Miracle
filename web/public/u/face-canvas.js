/**
 * La carita de Ü dibujada en canvas 2D.
 *
 * Existe para poder meter la carita DENTRO de la escena 3D: un canvas se puede
 * usar como `CanvasTexture` de Three.js, un SVG del DOM no. Comparte la geometría
 * con la versión SVG a través de `face-geometry.js`, así que las dos caritas son
 * literalmente la misma — si divergen, es un bug.
 */

import * as G from "./face-geometry.js";

/**
 * Dibuja la carita en un contexto 2D, centrada y escalada al tamaño pedido.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size lado del cuadrado en px del canvas
 * @param {object} state
 * @param {boolean} [state.dark=true]
 * @param {boolean} [state.thinking=false]
 * @param {number}  [state.blink=0]      0 abierto, 1 cerrado
 * @param {number}  [state.eyeShift=0]   unidades del viewBox
 * @param {boolean} [state.transparent=false] sin relleno: solo los rasgos
 * @param {boolean} [state.clear=true] limpiar antes de dibujar. Poner en false
 *        cuando la carita se compone DENTRO de otro dibujo: si no, el clearRect
 *        se aplica sobre el contexto ya trasladado y abre un hueco transparente.
 */
export function drawFace(ctx, size, state = {}) {
  const {
    dark = true,
    thinking = false,
    blink = 0,
    eyeShift = 0,
    transparent = false,
    clear = true,
  } = state;

  const pal = G.palette(dark);
  const p = G.params(thinking);

  // unidades del viewBox (-75..75) → px del canvas
  const s = size / (G.VIEW * 2);

  ctx.save();
  if (clear) ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);
  ctx.scale(s, s);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const traceSquircle = (r) => {
    const pts = G.squirclePoints(r);
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
  };

  if (!transparent) {
    // Relleno del rostro: degradado diagonal, esquina sup-izq → inf-der.
    const grad = ctx.createLinearGradient(-G.R, -G.R, G.R, G.R);
    grad.addColorStop(0, pal.fillTop);
    grad.addColorStop(1, pal.fillBottom);
    traceSquircle(G.R);
    ctx.fillStyle = grad;
    ctx.fill();

    traceSquircle(G.R - pal.borderInset);
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = pal.borderWidth;
    ctx.stroke();
  }

  // Los rasgos van rotados -2°, igual que en Android y WPF.
  ctx.rotate((G.TILT * Math.PI) / 180);
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = G.STROKE;

  // Cejas
  for (const [bx, bh, c] of [
    [-30, p.browL, p.curveL],
    [30, p.browR, p.curveR],
  ]) {
    const b = G.brow(bx, bh, c);
    ctx.beginPath();
    ctx.moveTo(b.start[0], b.start[1]);
    ctx.quadraticCurveTo(b.ctrl[0], b.ctrl[1], b.end[0], b.end[1]);
    ctx.stroke();
  }

  // Ojos: líneas verticales
  const len = G.eyeLength(p.eyeOpen, p.squint, blink);
  for (const ex of [-30, 30]) {
    const e = G.eyeSegment(ex, eyeShift, len);
    ctx.beginPath();
    ctx.moveTo(e.x, e.y1);
    ctx.lineTo(e.x, e.y2);
    ctx.stroke();
  }

  // Boca
  const m = G.mouth(p);
  ctx.beginPath();
  ctx.moveTo(m.start[0], m.start[1]);
  ctx.bezierCurveTo(m.c1[0], m.c1[1], m.c2[0], m.c2[1], m.end[0], m.end[1]);
  ctx.stroke();

  ctx.restore();
}

/**
 * Carita autoanimada sobre su propio canvas, lista para `THREE.CanvasTexture`.
 * Reproduce los mismos gestos y tiempos del cliente Windows.
 */
export class FaceTexture {
  constructor({ size = 512, dark = true } = {}) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvas.height = size;
    this.ctx = this.canvas.getContext("2d");
    this.size = size;
    this.state = { dark, thinking: false, blink: 0, eyeShift: 0 };
    this._blinkUntil = 0;
    this._blinkTimes = 1;
    this._look = null;
    this._nextIdle = performance.now() + 3000 + Math.random() * 4000;
    this.dirty = true;
    this.draw();
  }

  draw() {
    drawFace(this.ctx, this.size, this.state);
    this.dirty = true;
  }

  set thinking(v) {
    if (this.state.thinking === !!v) return;
    this.state.thinking = !!v;
    this.draw();
  }
  get thinking() { return this.state.thinking; }

  /** Parpadea `times` veces. Onda triangular, 340 ms por parpadeo. */
  blink(times = 1) {
    this._blinkTimes = times;
    this._blinkStart = performance.now();
    this._blinkUntil = this._blinkStart + 340 * times;
  }

  /** Corre los ojos a un lado, aguanta, y vuelve al centro. */
  lookAround(target) {
    const to = target ?? (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 1.5);
    this._look = { from: this.state.eyeShift, to, t0: performance.now() };
  }

  /** Avanza las animaciones. Llamar una vez por frame desde el loop de render. */
  update(now = performance.now()) {
    let changed = false;
    const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

    if (this._blinkUntil && now < this._blinkUntil) {
      const p = (now - this._blinkStart) / (340 * this._blinkTimes);
      const local = (p * this._blinkTimes) % 1;
      this.state.blink = local < 0.5 ? local * 2 : (1 - local) * 2;
      changed = true;
    } else if (this._blinkUntil) {
      this._blinkUntil = 0;
      this.state.blink = 0;
      changed = true;
    }

    if (this._look) {
      const ms = now - this._look.t0;
      const { from, to } = this._look;
      let v;
      if (ms < 450) v = from + (to - from) * ease(ms / 450);
      else if (ms < 1250) v = to;                                  // se queda mirando
      else if (ms < 1800) v = to + (0 - to) * ease((ms - 1250) / 550);
      else { v = 0; this._look = null; }
      this.state.eyeShift = v;
      changed = true;
    }

    // Gestos casuales de reposo: uno cada 8–18 s, como en el cliente.
    if (now > this._nextIdle) {
      const pick = Math.random() * 100;
      if (pick < 65) this.blink(Math.random() < 0.2 ? 2 : 1);
      else if (pick < 92) this.lookAround();
      this._nextIdle = now + 8000 + Math.random() * 10000;
    }

    if (changed) this.draw();
    return changed;
  }
}
