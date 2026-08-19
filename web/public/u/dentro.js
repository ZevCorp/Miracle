/**
 * El escritorio fijo: el scroll dirige la obra sin mover el escenario.
 *
 * Cinco escenas sobre una pista de 520vh. Ü (la carita SVG real) y un cursor
 * recorren el escritorio: abren el explorador, leen archivos, llenan el HIS,
 * se detienen en la duda y celebran la firma. Todo pasa "ahí mismo", como
 * pidió el guion: la interactividad es el montaje.
 */

import { Face } from "./face.js";

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const dentro = document.getElementById("dentro");
if (dentro) montar();

function montar() {
  const $ = (s) => dentro.querySelector(s);
  const explorador = $(".v-explorador");
  const vform = $(".v-form");
  const notifs = $("#notifs");
  const dFinal = $(".d-final");
  const caption = $(".d-caption");
  const capTitulo = $("#cap-titulo");
  const capTexto = $("#cap-texto");
  const tabExp = $(".explorador-tab");
  const tabHis = $(".his-tab");
  const cursor = $("#d-cursor");
  const escritorio = $(".escritorio");

  /* ------------------------------ Ü, el actor ------------------------------ */

  const rider = document.createElement("div");
  rider.id = "u-rider";
  rider.style.cssText = `
    position:absolute; z-index:7; pointer-events:none;
    width:96px; height:96px; left:0; top:0; opacity:0; transition:opacity .4s ease;
    filter:drop-shadow(0 12px 26px rgba(8,20,50,.4));
  `;
  escritorio.appendChild(rider);
  const face = new Face({ theme: "light", size: 96, idle: true });
  rider.appendChild(face.node);

  /* --------------------- notificaciones del sistema --------------------- */
  // Acumulativas: cada escena puede sumar una. Las viejas se apilan atenuadas.

  const NOTIFS = [
    { esc: 1, icono: "#F5B93E", app: "Explorador", texto: "<b>HC_43208771.pdf</b> abierto por Ü" },
    { esc: 2, icono: "#3776E3", app: "HIS", texto: "<b>3 campos</b> diligenciados y validados" },
    { esc: 3, icono: "#F5A623", app: "Ü", clase: "ambar", texto: "<b>CUPS ambiguo.</b> Requiere confirmación médica" },
    { esc: 4, icono: "#2E9E5B", app: "Ü", clase: "ok", texto: "<b>Firmado</b> — Dra. Ramírez · 9:14 a.m." },
  ];

  function pintarNotifs(escena) {
    const visibles = NOTIFS.filter((n) => n.esc <= escena).slice(-3);
    notifs.innerHTML = "";
    const ahora = new Date();
    visibles.forEach((n, i) => {
      const el = document.createElement("div");
      el.className = "notif " + (n.clase || "");
      const hace = (visibles.length - 1 - i) * 2;
      el.innerHTML = `
        <div class="n-cab">
          <span class="n-icono" style="background:${n.icono}"></span>
          ${n.app}
          <time>${hace === 0 ? "ahora" : `hace ${hace} min`}</time>
          <span class="n-x">✕</span>
        </div>
        <p>${n.texto}</p>`;
      if (i < visibles.length - 1) el.classList.add("vieja");
      notifs.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("on")));
    });
  }

  /* ------------------------------- el guion ------------------------------- */
  // Cada escena: qué se ve, qué dice el caption, dónde están Ü y el cursor.

  const ESCENAS = [
    {
      titulo: "Entra al computador.",
      texto: "El mismo escritorio que tu equipo usa todos los días. Sin migraciones, sin integraciones.",
      set() {
        explorador.classList.remove("abierta", "leyendo", "atras");
        vform.classList.remove("abierta", "pausada");
        tabExp.classList.remove("on"); tabHis.classList.remove("on");
        dFinal.classList.remove("on");
        face.thinking = false;
      },
      u: () => centro(0.5, 0.42),
      cursor: () => punto(".iconos .icono", 0.5, 0.85),
    },
    {
      titulo: "Abre y lee los archivos.",
      texto: "Ü recorre el explorador como un usuario: encuentra la historia, la abre, entiende qué falta.",
      set() {
        explorador.classList.add("abierta", "leyendo");
        explorador.classList.remove("atras");
        vform.classList.remove("abierta", "pausada");
        tabExp.classList.add("on"); tabHis.classList.remove("on");
        dFinal.classList.remove("on");
        face.thinking = false;
      },
      u: () => alLado(explorador, 1.06, 0.35),
      cursor: () => punto(".archivos li:nth-child(2)", 0.7, 0.5),
      clic: true,
    },
    {
      titulo: "Llena el HIS, campo por campo.",
      texto: "Documento, motivo, CIE-10. Cada valor se escribe y se valida antes del siguiente.",
      set() {
        explorador.classList.add("abierta", "atras");
        explorador.classList.remove("leyendo");
        vform.classList.add("abierta");
        vform.classList.remove("pausada");
        tabExp.classList.add("on"); tabHis.classList.add("on");
        dFinal.classList.remove("on");
        face.thinking = false;
      },
      u: () => alLado(vform, -0.18, 0.4),
      cursor: () => punto(".v-form .campo.ultimo .caja", 0.35, 0.5),
      clic: true,
    },
    {
      titulo: "Y cuando duda, se detiene.",
      texto: "El CUPS no es inequívoco: Ü marca el campo y espera la confirmación del médico. La pausa es la función.",
      set() {
        explorador.classList.add("abierta", "atras");
        explorador.classList.remove("leyendo");
        vform.classList.add("abierta", "pausada");
        tabExp.classList.add("on"); tabHis.classList.add("on");
        dFinal.classList.remove("on");
        face.thinking = true;
      },
      u: () => alLado(vform, -0.18, 0.75),
      cursor: () => punto(".v-form .campo.ultimo .caja", 0.88, 0.5),
    },
    {
      titulo: "El médico firma. Ü archiva.",
      texto: "Nada entra a la historia sin revisión humana. El criterio siempre es del médico.",
      set() {
        explorador.classList.remove("abierta", "atras", "leyendo");
        vform.classList.remove("abierta", "pausada");
        tabExp.classList.remove("on"); tabHis.classList.remove("on");
        dFinal.classList.add("on");
        face.thinking = false;
      },
      u: () => centro(0.5, 0.30),
      cursor: () => punto(".d-final .cta", 0.5, 1.35),
    },
  ];

  /* --------------------------- geometría de escena --------------------------- */

  function rectEsc() { return escritorio.getBoundingClientRect(); }
  function centro(fx, fy) {
    const r = rectEsc(), s = RID();
    return { x: r.width * fx - s / 2, y: r.height * fy - s / 2 };
  }
  const MOVIL = () => innerWidth <= 760;
  const RID = () => (MOVIL() ? 64 : 96);          // tamaño del rider
  function alLado(ventana, fx, fy) {
    const r = rectEsc(), v = ventana.getBoundingClientRect(), s = RID();
    if (MOVIL()) {
      // Posado en la esquina inferior derecha de la ventana, medio afuera.
      const x = (v.right - r.left) - s * 0.72;
      const y = (v.bottom - r.top) - s * 0.62;
      return { x: Math.max(8, Math.min(r.width - s - 8, x)), y: Math.max(8, Math.min(r.height - s - 56, y)) };
    }
    const x = (v.left - r.left) + v.width * fx - s / 2;
    const y = (v.top - r.top) + v.height * fy - s / 2;
    return { x: Math.max(8, Math.min(r.width - s - 8, x)), y: Math.max(8, Math.min(r.height - 160, y)) };
  }
  function punto(sel, fx, fy) {
    const el = dentro.querySelector(sel);
    if (!el) return centro(0.5, 0.5);
    const r = rectEsc(), b = el.getBoundingClientRect();
    return { x: (b.left - r.left) + b.width * fx - 11, y: (b.top - r.top) + b.height * fy - 11 };
  }

  /* ------------------------------- el montaje ------------------------------- */

  const posU = { x: 0, y: 0 };
  const posC = { x: 0, y: 0 };
  let escena = -1;
  let ultimo = performance.now();

  function irAEscena(i) {
    escena = i;
    ESCENAS[i].set();
    pintarNotifs(i);
    escritorio.classList.toggle("tiene-ventana", explorador.classList.contains("abierta") || vform.classList.contains("abierta"));
    if (!REDUCED) { face.pulse(); face.blink(1); }

    // Caption con fundido.
    caption.classList.add("cambiando");
    setTimeout(() => {
      capTitulo.textContent = ESCENAS[i].titulo;
      capTexto.textContent = ESCENAS[i].texto;
      caption.classList.remove("cambiando");
    }, 240);

    // El clic del cursor llega medio segundo después de que aterriza.
    if (ESCENAS[i].clic && !REDUCED) {
      setTimeout(() => {
        cursor.classList.remove("clic");
        void cursor.offsetWidth;
        cursor.classList.add("clic");
      }, 900);
    }
  }

  /* ------------------------------ el autoplay ------------------------------ */
  // El escritorio se REPRODUCE SOLO: al engancharse el sticky arranca un reloj
  // que recorre las 5 escenas como una película. El scroll ya no manda las
  // escenas; solo decide cuándo entra y sale el escritorio. Hay barra de
  // progreso, botón de saltar, y en reduced-motion todo se acelera.

  const DUR_ESCENA = REDUCED ? 1200 : 3200;          // ms por escena
  const TOTAL = DUR_ESCENA * ESCENAS.length;
  let tInicio = -1;                                   // cuándo empezó la película
  let terminada = false;

  const barra = document.createElement("div");
  barra.id = "d-progreso";
  barra.innerHTML = '<i></i>';
  escritorio.appendChild(barra);

  const btnSaltar = document.createElement("button");
  btnSaltar.id = "d-saltar";
  btnSaltar.type = "button";
  btnSaltar.textContent = "Saltar ›";
  function irATiempo(ms) {
    tInicio = performance.now() - ms;
    if (ms < TOTAL) { terminada = false; escritorio.classList.remove("terminada"); }
  }
  btnSaltar.addEventListener("click", () => irATiempo(TOTAL));
  escritorio.appendChild(btnSaltar);

  // Los cinco puntos de capítulo: clic para ir a una escena concreta.
  const caps = document.createElement("div");
  caps.id = "d-capitulos";
  ESCENAS.forEach((e, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.title = e.titulo;
    b.setAttribute("aria-label", "Escena " + (i + 1) + ": " + e.titulo);
    b.addEventListener("click", () => irATiempo(i * DUR_ESCENA));
    caps.appendChild(b);
  });
  escritorio.appendChild(caps);

  function frame(now) {
    const dt = Math.min((now - ultimo) / 1000, 0.05);
    ultimo = now;

    const rd = dentro.getBoundingClientRect();
    const enganchado = rd.top <= 4 && rd.bottom > innerHeight * 0.5;
    const dentroVista = rd.top < innerHeight && rd.bottom > 0;
    rider.style.opacity = enganchado ? "1" : "0";
    cursor.style.opacity = rider.style.opacity;
    const hud = document.getElementById("hud");
    if (hud) hud.style.opacity = enganchado ? "0" : "";

    if (enganchado) {
      // Arranca la película la primera vez que el escritorio queda enganchado.
      if (tInicio < 0) tInicio = now;
      const t = Math.min(now - tInicio, TOTAL);
      const objetivo = Math.min(ESCENAS.length - 1, Math.floor(t / DUR_ESCENA));
      if (objetivo !== escena) irAEscena(objetivo);

      barra.firstElementChild.style.width = ((t / TOTAL) * 100).toFixed(2) + "%";
      [...caps.children].forEach((b, i) => b.classList.toggle("on", i <= objetivo));
      if (t >= TOTAL && !terminada) { terminada = true; escritorio.classList.add("terminada"); }

      const oU = ESCENAS[escena].u();
      const oC = ESCENAS[escena].cursor();
      const k = REDUCED ? 1 : 1 - Math.exp(-dt / 0.18);
      const kc = REDUCED ? 1 : 1 - Math.exp(-dt / 0.10);
      posU.x += (oU.x - posU.x) * k;
      posU.y += (oU.y - posU.y) * k;
      posC.x += (oC.x - posC.x) * kc;
      posC.y += (oC.y - posC.y) * kc;

      const vx = oU.x - posU.x;
      face.eyeShift = Math.max(-3.2, Math.min(3.2, vx / 55));
      const tilt = Math.max(-8, Math.min(8, vx / 32));
      rider.style.transform = `translate(${posU.x}px, ${posU.y}px) rotate(${tilt}deg)`;
      cursor.style.transform = `translate(${posC.x}px, ${posC.y}px)`;
    } else if (!dentroVista && tInicio >= 0 && !terminada) {
      // Si el usuario se va antes de que termine, la película se reinicia al volver.
      tInicio = -1;
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__dentro = { escena: () => escena, irA: (i) => irATiempo(i * DUR_ESCENA), saltar: () => btnSaltar.click(), DUR_ESCENA, TOTAL };

  /* ------------------------------ el reloj vivo ------------------------------ */

  const reloj = $("#d-reloj");
  const fecha = $("#d-fecha");
  function tictac() {
    const d = new Date();
    reloj.textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
    if (fecha) fecha.textContent = d.toLocaleDateString("es-CO", { day: "numeric", month: "numeric", year: "numeric" });
  }
  tictac();
  setInterval(tictac, 30000);
}
