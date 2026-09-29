/**
 * La carita de Ü en SVG, para el DOM.
 *
 * Port fiel de `FaceControl.cs` (WPF), que a su vez porta `FaceView.kt` (Android).
 * La geometría vive en `face-geometry.js` y la comparte con `face-canvas.js`,
 * que dibuja la misma carita sobre canvas para meterla como textura en el 3D.
 *
 * Igual que el original: solo dibuja y anima, no decide nada.
 */

import * as G from "./face-geometry.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const el = (name, attrs) => {
  const n = document.createElementNS(SVG_NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

let uid = 0;

export class Face {
  /**
   * @param {object} opts
   * @param {'light'|'dark'} [opts.theme='light']
   * @param {number} [opts.size=160] lado en px
   * @param {boolean} [opts.idle=true] gestos casuales de reposo
   */
  constructor(opts = {}) {
    this.theme = opts.theme || "light";
    this._eyeShift = 0;
    this._thinking = false;
    this._blink = 0;            // 0 = ojos abiertos, 1 = cerrados
    this._gradId = "uface" + ++uid;

    const svg = el("svg", {
      viewBox: `${-G.VIEW} ${-G.VIEW} ${G.VIEW * 2} ${G.VIEW * 2}`,
      width: opts.size || 160,
      height: opts.size || 160,
      role: "img",
      "aria-label": "Ü",
    });
    svg.style.overflow = "visible";
    svg.style.display = "block";
    this.node = svg;

    const defs = el("defs");
    // Relleno del rostro: degradado diagonal, esquina sup-izq → inf-der.
    const grad = el("linearGradient", { id: this._gradId, x1: "0", y1: "0", x2: "1", y2: "1" });
    this._stopTop = el("stop", { offset: "0" });
    this._stopBottom = el("stop", { offset: "1" });
    grad.append(this._stopTop, this._stopBottom);
    defs.append(grad);
    svg.append(defs);

    this._fill = el("path", { d: G.squirclePath(G.R), fill: `url(#${this._gradId})` });
    this._border = el("path", { fill: "none" });
    svg.append(this._fill, this._border);

    // Los rasgos van rotados -2°, igual que en Android y WPF.
    this._features = el("g", {
      transform: `rotate(${G.TILT})`,
      fill: "none",
      "stroke-width": G.STROKE,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    });
    this._browL = el("path");
    this._browR = el("path");
    this._eyeL = el("line");
    this._eyeR = el("line");
    this._mouth = el("path");
    this._features.append(this._browL, this._browR, this._eyeL, this._eyeR, this._mouth);
    svg.append(this._features);

    this._applyTheme();
    this.render();

    if (opts.idle !== false) this.startIdle();
  }

  /* ---------------- propiedades ---------------- */

  get thinking() { return this._thinking; }
  set thinking(v) { this._thinking = !!v; this.render(); }

  get eyeShift() { return this._eyeShift; }
  set eyeShift(v) { this._eyeShift = v; this.render(); }

  setTheme(theme) { this.theme = theme; this._applyTheme(); this.render(); }

  _applyTheme() {
    const pal = G.palette(this.theme === "dark");
    this._stopTop.setAttribute("stop-color", pal.fillTop);
    this._stopBottom.setAttribute("stop-color", pal.fillBottom);
    this._features.setAttribute("stroke", pal.line);
    this._border.setAttribute("d", G.squirclePath(G.R - pal.borderInset));
    this._border.setAttribute("stroke", pal.border);
    this._border.setAttribute("stroke-width", pal.borderWidth);
  }

  /* ---------------- dibujo ---------------- */

  render() {
    const p = G.params(this._thinking);

    const brow = (bx, bh, c) => {
      const b = G.brow(bx, bh, c);
      return `M${b.start[0]} ${b.start[1]} Q${b.ctrl[0]} ${b.ctrl[1]} ${b.end[0]} ${b.end[1]}`;
    };
    this._browL.setAttribute("d", brow(-30, p.browL, p.curveL));
    this._browR.setAttribute("d", brow(30, p.browR, p.curveR));

    const len = G.eyeLength(p.eyeOpen, p.squint, this._blink);
    for (const [node, ex] of [[this._eyeL, -30], [this._eyeR, 30]]) {
      const e = G.eyeSegment(ex, this._eyeShift, len);
      node.setAttribute("x1", e.x);
      node.setAttribute("x2", e.x);
      node.setAttribute("y1", e.y1);
      node.setAttribute("y2", e.y2);
    }

    const m = G.mouth(p);
    this._mouth.setAttribute(
      "d",
      `M${m.start[0]} ${m.start[1]} C${m.c1[0]} ${m.c1[1]} ${m.c2[0]} ${m.c2[1]} ${m.end[0]} ${m.end[1]}`
    );
  }

  /* ---------------- animaciones ---------------- */

  /** Parpadea `times` veces (onda triangular: abre→cierra→abre), 340 ms cada uno. */
  blink(times = 1) {
    if (times <= 0) return;
    const dur = 340 * times;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      const local = (p * times) % 1;
      this._blink = p >= 1 ? 0 : local < 0.5 ? local * 2 : (1 - local) * 2;
      this.render();
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** Pulso de vida: encoge a 0.84 y rebota. Señal de acción sin coordenadas. */
  pulse() {
    this.node.animate(
      [
        { transform: "scale(1)", offset: 0 },
        { transform: "scale(0.84)", offset: 110 / 290 },
        { transform: "scale(1)", offset: 1 },
      ],
      { duration: 290, easing: "cubic-bezier(.2,.9,.3,1)" }
    );
  }

  /** Corre los ojos a un lado, los deja un momento y los devuelve al centro. */
  lookAround(target) {
    const to = target ?? (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 1.5);
    const t0 = performance.now();
    const from = this._eyeShift;
    const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
    const step = (now) => {
      const ms = now - t0;
      let v;
      if (ms < 450) v = from + (to - from) * ease(ms / 450);
      else if (ms < 1250) v = to;                                   // se queda mirando
      else if (ms < 1800) v = to + (0 - to) * ease((ms - 1250) / 550);
      else v = 0;
      this.eyeShift = v;
      if (ms < 1800) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /**
   * Gestos casuales en reposo — la señal sutil de "está viva".
   * Un gesto cada 8–18 s: ~65% parpadeo, ~27% mirar a un lado, ~8% pulso.
   * (Más seguido se ve ansiosa; ese comentario está en el código original.)
   */
  startIdle() {
    if (this._idle) return;
    const schedule = () => {
      this._idle = setTimeout(() => {
        const pick = Math.random() * 100;
        if (pick < 65) this.blink(Math.random() < 0.2 ? 2 : 1);
        else if (pick < 92) this.lookAround();
        else this.pulse();
        schedule();
      }, 8000 + Math.random() * 10000);
    };
    schedule();
  }

  stopIdle() { clearTimeout(this._idle); this._idle = null; }
}
