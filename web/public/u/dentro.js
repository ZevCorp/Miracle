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
  const voz = $("#d-voz");
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
    { esc: 3, icono: "#3776E3", app: "Ü", texto: "Aprendí <b>tu sistema</b> mirándote trabajar" },
    { esc: 6, icono: "#3776E3", app: "Ü", texto: "Aprendido: <b>los datos van primero</b>" },
    { esc: 9, icono: "#F5B93E", app: "Ü", texto: "<b>Motivo de consulta</b> escrito — solo escuchando" },
    { esc: 10, icono: "#F5B93E", app: "Ü", texto: "<b>Examen y diagnóstico</b> escritos" },
    { esc: 11, icono: "#2E9E5B", app: "Ü", clase: "ok", texto: "<b>Historia lista</b> para que la firmes" },
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

  /* Un helper para no repetir el mismo bloque siete veces. Cada escena dice
   * qué pestaña está activa, qué campos ya están escritos y cuál se señala. */
  const TABS = [...dentro.querySelectorAll(".p-tab")];
  const CAMPOS = { doc: ".c-doc", motivo: ".c-motivo", examen: ".c-examen", dx: ".c-dx" };

  /* Lo que se escribe. Con barras grises y un check, lo que se ve es "algo se
   * marcó"; con esto, lo que se ve es el trabajo hecho. Son valores de una
   * consulta real, coherentes con lo que dicen las voces. */
  const VALORES = {
    doc:    "CC 1.020.345.678",
    motivo: "Cefalea de 3 días de evolución",
    examen: "TA 130/85 · sin signos de alarma",
    dx:     "R51 — Cefalea",
  };
  const tecleando = {};
  function teclear(el, clave) {
    const txt = el.querySelector(".txt");
    const valor = VALORES[clave] || "";
    if (txt.textContent === valor) return;            // ya estaba escrito
    clearInterval(tecleando[clave]);
    if (REDUCED) { txt.textContent = valor; return; }
    txt.textContent = "";
    el.classList.add("tecleando");
    let i = 0;
    tecleando[clave] = setInterval(() => {
      txt.textContent = valor.slice(0, ++i);
      if (i >= valor.length) { clearInterval(tecleando[clave]); el.classList.remove("tecleando"); }
    }, 34);
  }

  function montarForm({ tab = null, escritos = [], senala = null }) {
    explorador.classList.remove("abierta", "leyendo", "atras");
    vform.classList.add("abierta");
    vform.classList.remove("pausada");
    tabExp.classList.remove("on"); tabHis.classList.add("on");
    dFinal.classList.remove("on");
    TABS.forEach((t) => {
      // La clave de cada pestaña es SU propia clase, no la de la escena: con
      // `senala === "tab:" + tab` la condición era la misma para las dos y se
      // resaltaban las dos a la vez.
      const clave = t.classList.contains("nuevo") ? "nuevo" : "conocida";
      t.classList.toggle("activa", clave === tab);
      t.classList.toggle("senalado", senala === "tab:" + clave);
    });
    for (const [k, sel] of Object.entries(CAMPOS)) {
      const el = dentro.querySelector(".v-form " + sel);
      if (!el) continue;
      const toca = escritos.includes(k);
      el.classList.toggle("escrito", toca);
      el.classList.toggle("senalado", senala === k);
      if (toca) teclear(el, k);
      else { clearInterval(tecleando[k]); el.classList.remove("tecleando"); el.querySelector(".txt").textContent = ""; }
    }
  }

  /* ------------------------------- el guion -------------------------------
   * DOS ACTOS, y nada más.
   *
   *   1. El médico le ENSEÑA: señala con el mouse y dice una frase corta.
   *      Cuatro frases y ya está entrenada. Es el gesto que hace memorable la
   *      pieza, porque es exactamente como se le enseña a una persona nueva.
   *   2. Ü TRABAJA SOLA: sin cursor y sin dictado, llenando la historia con lo
   *      que se habla en la consulta.
   *
   * El acto 2 va dentro de la misma película a propósito: hay quien llega
   * directo por el botón sin haber visto el 3D, y tiene que salir de aquí
   * sabiendo no solo cómo se le enseña sino para qué sirve. */

  const cita = $("#d-cita");

  /* Ü se planta AL LADO de lo que señala, no en una esquina fija.
   * Es como se señala de verdad: uno se para junto a la cosa y apunta. Y de
   * paso resuelve lo que se veía raro antes — el cursor iba por un lado y la
   * voz salía por otro, así que no parecía que Ü estuviera manejando nada. */
  function junto(sel, lado = -1) {
    const el = dentro.querySelector(sel);
    if (!el) return centro(0.5, 0.5);
    const r = rectEsc(), b = el.getBoundingClientRect(), t = RID();
    const x = lado < 0 ? (b.left - r.left) - t - 22 : (b.right - r.left) + 22;
    const y = (b.top - r.top) + b.height / 2 - t / 2;
    return {
      x: Math.max(10, Math.min(r.width - t - 10, x)),
      y: Math.max(10, Math.min(r.height - t - 80, y)),
    };
  }

  function presentando(si) {
    rider.classList.toggle("presentando", si);
    escritorio.classList.toggle("presentacion", si);
  }
  function hablaEnCita(quien) {
    cita.querySelectorAll(".quien").forEach((q) => q.classList.toggle("hablando", q.classList.contains(quien)));
  }

  /* ------------------------------- el guion -------------------------------
   * Ü NARRA. Ese fue el hallazgo de la reunión: viéndolo, cualquiera asume
   * que la que habla y mueve el mouse es Ü — no un médico invisible. Así que
   * la voz es suya y el cursor va pegado a ella.
   *
   * Tres actos:
   *   1. Se presenta en el centro y dice a qué vino.
   *   2. Abre el sistema y enseña lo que aprendió, señalando.
   *   3. Atiende una cita real: entra la conversación y Ü escribe sola.
   * Y se despide bajando ella misma hasta el botón de registro. */

  const ESCENAS = [
    {
      titulo: "Hola, soy Ü.",
      texto: "El asistente que escribe la historia clínica mientras tú atiendes.",
      set() {
        explorador.classList.remove("abierta", "leyendo", "atras");
        vform.classList.remove("abierta", "pausada");
        tabExp.classList.remove("on"); tabHis.classList.remove("on");
        dFinal.classList.remove("on"); cita.classList.remove("on");
        presentando(true); face.thinking = false;
      },
      u: () => centro(0.5, 0.38),
      cursor: () => null,
      voz: { de: "u", dice: "Hola, soy Ü. Soy el asistente de inteligencia artificial para médicos.", pista: "u-01-hola", dur: 6350 },
    },
    {
      titulo: "Para que sueltes el teclado.",
      texto: "La idea es simple: que mires al paciente y no a la pantalla.",
      set() { presentando(true); face.thinking = false; },
      u: () => centro(0.5, 0.38),
      cursor: () => null,
      voz: { de: "u", dice: "Mi objetivo es que puedas dejar de usar el computador y concentrarte en tu paciente.", pista: "u-02-objetivo", dur: 6250 },
    },
    {
      titulo: "Primero miro cómo trabajas.",
      texto: "Unos días observando tu pantalla. Nadie tiene que enseñarme nada aparte.",
      set() { presentando(true); face.thinking = true; },
      u: () => centro(0.5, 0.38),
      cursor: () => null,
      voz: { de: "u", dice: "Para eso, primero miro tu pantalla unos días y aprendo cómo trabajas.", pista: "u-03-aprendo", dur: 6400 },
    },
    {
      titulo: "Y abro tu sistema.",
      texto: "El mismo de siempre. No hay que instalar ni cambiar nada.",
      set() {
        presentando(false);
        montarForm({ tab: "nuevo" });
        face.thinking = false;
      },
      u: () => junto(".iconos .icono:nth-child(3)", -1),
      cursor: () => punto(".iconos .icono:nth-child(3)", 0.5, 0.5),
      clic: true,
      voz: { de: "u", dice: "Cuando ya aprendí, abro tu sistema. El mismo que usas todos los días.", pista: "u-04-abro", dur: 6300 },
    },
    {
      titulo: "Aquí va el paciente nuevo.",
      texto: "Lo aprendí mirándote: cada tipo de paciente entra por su lado.",
      set() { montarForm({ tab: "nuevo", senala: "tab:nuevo" }); face.thinking = false; },
      u: () => junto(".p-tab.nuevo", -1),
      cursor: () => punto(".p-tab.nuevo", 0.5, 0.6),
      voz: { de: "u", dice: "Aquí registras al paciente que viene por primera vez.", pista: "u-05-nuevo", dur: 4350 },
    },
    {
      titulo: "Y aquí el que ya conoces.",
      texto: "Entramos por este, que es el caso de hoy.",
      set() { montarForm({ tab: "conocida", senala: "tab:conocida" }); face.thinking = false; },
      u: () => junto(".p-tab.conocida", 1),
      cursor: () => punto(".p-tab.conocida", 0.5, 0.6),
      clic: true,
      voz: { de: "u", dice: "Y aquí al que ya tiene historia contigo. Entremos por este.", pista: "u-06-conocido", dur: 4450 },
    },
    {
      titulo: "Los datos van primero.",
      texto: "En el orden en que tú los pides, no en el que se me ocurra.",
      set() { montarForm({ tab: "conocida", escritos: ["doc"], senala: "doc" }); face.thinking = false; },
      u: () => junto(".v-form .c-doc .caja", -1),
      cursor: () => punto(".v-form .c-doc .caja", 0.3, 0.5),
      voz: { de: "u", dice: "Primero van los datos, cuando el paciente te los confirma.", pista: "u-07-datos", dur: 4500 },
    },
    {
      titulo: "Después el examen físico.",
      texto: "Ese es tu orden. Es el que aprendí.",
      set() { montarForm({ tab: "conocida", escritos: ["doc"], senala: "examen" }); face.thinking = false; },
      u: () => junto(".v-form .c-examen .caja", -1),
      cursor: () => punto(".v-form .c-examen .caja", 0.3, 0.5),
      voz: { de: "u", dice: "Después, el examen físico.", pista: "u-08-examen", dur: 2650 },
    },
    {
      titulo: "Atendamos una cita real.",
      texto: "Tú habla con tu paciente. Del teclado me encargo yo.",
      set() {
        montarForm({ tab: "conocida", escritos: ["doc"] });
        cita.classList.add("on"); hablaEnCita("ninguno");
        face.thinking = false;
      },
      u: () => junto("#d-cita", 1),
      cursor: () => null,
      voz: { de: "u", dice: "Ahora atendamos una cita de verdad. Tú habla con tu paciente; yo escribo.", pista: "u-09-cita", dur: 5750 },
    },
    {
      titulo: "Escuchando.",
      texto: "Lo que dice el paciente entra al motivo de consulta.",
      set() {
        montarForm({ tab: "conocida", escritos: ["doc", "motivo"] });
        cita.classList.add("on"); hablaEnCita("paciente");
        face.thinking = true;
      },
      u: () => junto(".v-form .c-motivo .caja", -1),
      cursor: () => null,
      voz: { de: "paciente", dice: "Vengo por un dolor de cabeza hace tres días.", pista: "c-01-paciente", dur: 4200 },
    },
    {
      titulo: "Y lo que dices tú.",
      texto: "La tensión, los signos, el diagnóstico. Cada cosa en su campo.",
      set() {
        montarForm({ tab: "conocida", escritos: ["doc", "motivo", "examen", "dx"] });
        cita.classList.add("on"); hablaEnCita("medico");
        face.thinking = true;
      },
      u: () => junto(".v-form .c-examen .caja", -1),
      cursor: () => null,
      voz: { de: "medico", dice: "¿Y la tensión cómo va? Ciento treinta sobre ochenta y cinco. Sin signos de alarma.", pista: "c-02-medico", dur: 5900 },
    },
    {
      titulo: "Y no tocaste el teclado.",
      texto: "La historia queda completa, lista para que la firmes.",
      set() {
        montarForm({ tab: "conocida", escritos: ["doc", "motivo", "examen", "dx"] });
        cita.classList.remove("on"); hablaEnCita("ninguno");
        face.thinking = false;
      },
      u: () => junto(".v-form .c-dx .caja", -1),
      cursor: () => null,
      voz: { de: "u", dice: "Listo. La historia quedó completa y tú no tocaste el teclado.", pista: "u-10-listo", dur: 5000 },
    },
    {
      titulo: "Pruébame.",
      texto: "Te bajo yo hasta el botón.",
      set() {
        explorador.classList.remove("abierta", "atras", "leyendo");
        vform.classList.remove("abierta", "pausada");
        tabExp.classList.remove("on"); tabHis.classList.remove("on");
        cita.classList.remove("on");
        dFinal.classList.add("on");
        presentando(false); face.thinking = false;
      },
      u: () => centro(0.5, 0.26),
      cursor: () => punto(".d-final .cta", 0.72, 0.55),
      voz: { de: "u", dice: "Si quieres probarme, regístrate aquí abajo.", pista: "u-11-registrate", dur: 3700 },
      alFinal: true,
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
  /* Ü mira desde una esquina fija, abajo a la izquierda. Antes se colocaba
   * junto a la ventana y el globo de voz le caía encima: la única cara de la
   * marca salía decapitada en cuatro de los siete planos. */
  function rincon() {
    const r = rectEsc(), s2 = RID();
    return { x: Math.max(14, r.width * 0.06), y: r.height - s2 - (MOVIL() ? 96 : 108) };
  }

  function punto(sel, fx, fy) {
    const el = dentro.querySelector(sel);
    if (!el) return centro(0.5, 0.5);
    const r = rectEsc(), b = el.getBoundingClientRect();
    return { x: (b.left - r.left) + b.width * fx - 11, y: (b.top - r.top) + b.height * fy - 11 };
  }

  /* ------------------------------- el montaje ------------------------------- */

  const posU = { x: 0, y: 0 };
  let escalaU = 1;                    // se suaviza igual que la posición
  const posC = { x: 0, y: 0 };
  let escena = -1;
  let yaBajo = false;                 // el auto-scroll del final, una sola vez
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

    /* El globo de voz. Se apaga siempre y se vuelve a encender un poco después,
     * para que se lea como una frase NUEVA y no como un texto que cambia: el
     * gesto que estamos vendiendo es alguien hablando, no un subtítulo. */
    voz.classList.remove("on");
    const linea = ESCENAS[i].voz;
    if (linea) {
      setTimeout(() => {
        voz.querySelector("p").textContent = linea.dice;
        // Tres voces distintas y hay que poder distinguirlas de un vistazo:
        // Ü narrando, el paciente y el médico.
        voz.classList.toggle("paciente", linea.de === "paciente");
        voz.classList.toggle("medico", linea.de === "medico");
        voz.classList.toggle("es-u", linea.de === "u");
        const eti = voz.querySelector(".quien");
        if (eti) eti.textContent = linea.de === "paciente" ? "Paciente" : linea.de === "medico" ? "Médico" : "Ü";
        voz.classList.add("on");
      }, REDUCED ? 60 : 420);
    }

    /* Al final, Ü baja ella misma hasta el botón de registro. Es el remate que
     * pidió Dani: "baja hasta la parte baja, hace clic y desliza él solito".
     * Se suelta el scroll antes, claro, y solo se hace UNA vez: si el usuario
     * ya se movió por su cuenta, no se le pelea la página. */
    if (ESCENAS[i].alFinal && !yaBajo) {
      yaBajo = true;
      setTimeout(() => {
        bloquear(false);
        const destino = document.getElementById("registro");
        if (destino) destino.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "center" });
      }, REDUCED ? 200 : 2600);
    }

    // El clic del cursor llega medio segundo después de que aterriza.
    if (ESCENAS[i].clic && !REDUCED) {
      const pulsa = (t) => setTimeout(() => {
        cursor.classList.remove("clic");
        void cursor.offsetWidth;
        cursor.classList.add("clic");
      }, t);
      pulsa(900);
      // Abrir el sistema es DOBLE clic, como en cualquier escritorio: con uno
      // solo no se lee que está abriendo un programa.
      if (ESCENAS[i].u && String(ESCENAS[i].voz && ESCENAS[i].voz.pista).includes("abro")) pulsa(1160);
    }
  }

  /* ------------------------------ el autoplay ------------------------------ */
  // El escritorio se REPRODUCE SOLO: al engancharse el sticky arranca un reloj
  // que recorre las 5 escenas como una película. El scroll ya no manda las
  // escenas; solo decide cuándo entra y sale el escritorio. Hay barra de
  // progreso, botón de saltar, y en reduced-motion todo se acelera.

  /* Cada escena dura lo que dura SU frase, no una cifra fija. Con 3.2 s para
   * todas, dos de las locuciones (4.2 s) se cortaban a media palabra. */
  const DUR_FINAL = 4200;                             // el cierre, que no habla
  const DURS = ESCENAS.map((e) => Math.round(((e.voz && e.voz.dur) || DUR_FINAL) * (REDUCED ? 0.4 : 1)));
  const INICIOS = DURS.reduce((a, d) => (a.push((a.at(-1) || 0) + d), a), []);
  const TOTAL = INICIOS.at(-1);
  const t0Escena = (i) => (i === 0 ? 0 : INICIOS[i - 1]);
  const DUR_ESCENA = DURS[0];                         // solo para la API de consola
  let tInicio = -1;                                   // cuándo empezó la película
  let terminada = false;

  /* ------------------------------ el sonido ------------------------------
   * La pieza es una conversación: el médico ENSEÑA hablando. Sin audio se
   * entiende a medias, así que se pide antes de arrancar en vez de intentar
   * un autoplay que el navegador va a bloquear igual.
   * `arrancado` es la compuerta: hasta que el usuario elija, el escritorio se
   * queda desenfocado y el reloj no corre. */
  const PISTAS = {};
  for (const e of ESCENAS) {
    if (!e.voz || !e.voz.pista) continue;
    // Relativo al MÓDULO, no a la página. En local el sitio se sirve desde la
    // raíz del proyecto, pero en producción cuelga de /u/ y una ruta relativa
    // a la página daría 404. import.meta.url resuelve bien en los dos.
    const a = new Audio(new URL(`assets/voz/${e.voz.pista}.mp3`, import.meta.url));
    a.preload = "auto";
    PISTAS[e.voz.pista] = a;
  }
  let conSonido = false;
  let arrancado = false;

  function sonar(i) {
    if (!conSonido) return;
    for (const a of Object.values(PISTAS)) { a.pause(); a.currentTime = 0; }
    const v = ESCENAS[i].voz;
    if (!v || !v.pista) return;
    const a = PISTAS[v.pista];
    // Si el navegador lo rechaza, la película sigue: los globos de texto ya
    // cuentan lo mismo. Nunca se rompe la reproducción por el audio.
    a.play().catch(() => {});
  }

  const capaAudio = $("#d-audio");
  /* El scroll se bloquea mientras corre la película.
   * Sin esto la pieza estaba rota de verdad: la pista solo tiene 1080 px de
   * recorrido y un flick normal de trackpad se los come en 1,2 segundos, así
   * que el usuario aterrizaba en el fondo absoluto de la página con 24 de los
   * 29 segundos por delante, sin nada debajo y sin manera de volver.
   * La salida sigue existiendo y ahora se ve: el botón "Saltar ›", que ya no
   * está debajo de la barra de marca. */
  /* El bloqueo, en tres capas, porque con menos NO aguanta.
   *
   * 1. `overflow:hidden` se descartó: quita la barra de scroll, cambia el
   *    ancho del layout y el navegador reajusta la posición — la página
   *    pegaba un salto justo en el instante del clic.
   * 2. Cortar los eventos tampoco basta por sí solo. Corta la rueda y el
   *    touch, pero se lo salta todo lo demás: la inercia del trackpad, el
   *    arrastre de la barra de scroll, y cualquier scroll programático.
   *    Medido: con solo eventos, la página se movía 1500 px durante la
   *    película, la sección salía de vista y el tramo se ABORTABA a medias.
   * 3. Lo que sí aguanta es ANCLAR la posición: se recuerda dónde estaba y
   *    se vuelve ahí en cada scroll, venga de donde venga. Sin tocar el
   *    layout, así que sigue sin haber salto. */
  let bloqueado = false;
  let yAncla = 0;
  const comer = (e) => { if (bloqueado) e.preventDefault(); };
  function bloquear(si) {
    if (si && !bloqueado) yAncla = window.scrollY;
    bloqueado = si;
  }
  addEventListener("scroll", () => {
    if (bloqueado && Math.abs(window.scrollY - yAncla) > 1) window.scrollTo(0, yAncla);
  }, { passive: true });
  addEventListener("wheel", comer, { passive: false });
  addEventListener("touchmove", comer, { passive: false });
  addEventListener("keydown", (e) => {
    // Las teclas que hacen scroll también, pero dejando escapar con Escape.
    if (!bloqueado) return;
    if (e.key === "Escape") { btnSaltar.click(); return; }
    if ([" ", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) e.preventDefault();
  });

  function arrancar(sonido) {
    conSonido = sonido;
    arrancado = true;
    escritorio.classList.remove("esperando");
    escritorio.classList.add("corriendo");
    bloquear(true);
    tInicio = performance.now();
    escena = -1;                       // fuerza el montaje de la escena 0
    // NO se llama a sonar(0) aquí: el frame siguiente monta la escena 0 y ya
    // la suena. Llamándolo en los dos sitios, la primera frase arrancaba dos
    // veces con 19 ms de diferencia y se oía un tartamudeo.
  }
  $("#d-audio-si").addEventListener("click", () => arrancar(true));
  $("#d-audio-no").addEventListener("click", () => arrancar(false));

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
  btnSaltar.addEventListener("click", () => {
    irATiempo(TOTAL);
    for (const a of Object.values(PISTAS)) a.pause();
    bloquear(false);
  });
  escritorio.appendChild(btnSaltar);

  // Los cinco puntos de capítulo: clic para ir a una escena concreta.
  const caps = document.createElement("div");
  caps.id = "d-capitulos";
  ESCENAS.forEach((e, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.title = e.titulo;
    b.setAttribute("aria-label", "Escena " + (i + 1) + ": " + e.titulo);
    b.addEventListener("click", () => { irATiempo(t0Escena(i)); sonar(i); });
    caps.appendChild(b);
  });
  escritorio.appendChild(caps);

  function frame(now) {
    const dt = Math.min((now - ultimo) / 1000, 0.05);
    ultimo = now;

    /* Seguro contra el bloqueo colgado. Un scroll anclado que no se suelte deja
     * la página congelada para siempre, que es mucho peor que el problema que
     * resuelve. Si está bloqueado y NO hay una película corriendo a la vista,
     * se suelta pase lo que pase. */
    if (bloqueado && !(arrancado && !terminada && dentro.getBoundingClientRect().top <= 4)) bloquear(false);

    const rd = dentro.getBoundingClientRect();
    const enganchado = rd.top <= 4 && rd.bottom > innerHeight * 0.5;
    const dentroVista = rd.top < innerHeight && rd.bottom > 0;
    // Con el escritorio en pantalla, la barra de marca estorba: tapaba los
    // controles de la película y se comía sus toques.
    document.body.classList.toggle("viendo-dentro", enganchado);
    rider.style.opacity = enganchado ? "1" : "0";
    if (!enganchado) { cursor.style.opacity = "0"; voz.classList.remove("on"); }
    const hud = document.getElementById("hud");
    if (hud) {
      // También se apaga sobre la tercera sección: ahí ya no hay recorrido 3D
      // que medir, y el contador quedaba flotando sobre la landing.
      const marcha = document.getElementById("marcha");
      const enLanding = marcha && marcha.getBoundingClientRect().top < innerHeight * 0.6;
      hud.style.opacity = enganchado || enLanding ? "0" : "";
      // Ya no se invierte la barra: la landing volvió al azul y su tratamiento
      // oscuro de siempre vuelve a funcionar.
    }

    if (enganchado) {
      /* Ya no arranca sola al engancharse: primero se pregunta por el sonido.
         Mientras tanto el escritorio se queda desenfocado detrás del cartel. */
      if (!arrancado) {
        /* El cartel NO puede salir durante el empalme. Ahí .d-sticky es fixed
         * y JS le está aplicando un transform que lo escala y lo desplaza para
         * encajarlo sobre la pantalla del iMac: el cartel salía gigante y
         * recortado, y el botón se movía bajo el cursor mientras intentabas
         * pulsarlo. Se espera a que el empalme suelte el transform. */
        const empalmando = dentro.classList.contains("empalmando");
        escritorio.classList.toggle("esperando", !empalmando);
        /* Con el cartel puesto NO se bloquea. El bloqueo es para que nadie
         * scrollee DURANTE la película, no para retener a quien todavía no ha
         * decidido verla. Desde que hay una tercera sección debajo, bloquear
         * aquí dejaba encerrado a quien no pulsara ningún botón: la landing se
         * volvía inalcanzable. Bloquear ya no da salto —solo se cortan
         * eventos— así que hacerlo en el clic no mueve nada. */
        bloquear(false);
        requestAnimationFrame(frame);
        return;
      }
      const t = Math.min(now - tInicio, TOTAL);
      let objetivo = 0;
      while (objetivo < ESCENAS.length - 1 && t >= INICIOS[objetivo]) objetivo++;
      if (objetivo !== escena) { irAEscena(objetivo); sonar(objetivo); }

      barra.firstElementChild.style.width = ((t / TOTAL) * 100).toFixed(2) + "%";
      [...caps.children].forEach((b, i) => b.classList.toggle("on", i <= objetivo));
      if (t >= TOTAL && !terminada) {
        terminada = true;
        escritorio.classList.add("terminada");
        bloquear(false);                 // terminó: se devuelve el scroll
      }

      const oU = ESCENAS[escena].u();
      /* En el segundo acto NO hay cursor: nadie está señalando nada, que es
       * justo el punto. cursor() devuelve null y la flecha se retira. */
      const oC = ESCENAS[escena].cursor();
      cursor.style.opacity = oC ? "1" : "0";
      const k = REDUCED ? 1 : 1 - Math.exp(-dt / 0.18);
      const kc = REDUCED ? 1 : 1 - Math.exp(-dt / 0.10);
      posU.x += (oU.x - posU.x) * k;
      posU.y += (oU.y - posU.y) * k;
      if (oC) {
        posC.x += (oC.x - posC.x) * kc;
        posC.y += (oC.y - posC.y) * kc;
      }

      const vx = oU.x - posU.x;
      face.eyeShift = Math.max(-3.2, Math.min(3.2, vx / 55));
      const tilt = Math.max(-8, Math.min(8, vx / 32));
      /* La escala se compone AQUÍ, junto al translate. Si se pone en CSS, pisa
       * el translate y Ü se queda en la esquina. Y se suaviza en JS, no con
       * una transición CSS: el bucle reescribe el transform en cada frame y
       * una transición encima se pelearía con este mismo suavizado. */
      const escalaObj = rider.classList.contains("presentando") ? 1.9 : 1;
      escalaU += (escalaObj - escalaU) * (REDUCED ? 1 : 1 - Math.exp(-dt / 0.22));
      rider.style.transform = `translate(${posU.x}px, ${posU.y}px) rotate(${tilt}deg) scale(${escalaU.toFixed(3)})`;
      cursor.style.transform = `translate(${posC.x}px, ${posC.y}px)`;

      /* El globo se cuelga de quien habla: del cursor cuando el médico está
       * señalando, y de Ü cuando ya no señala nadie. Se sujeta a los bordes
       * del escritorio para que no se salga por la derecha. */
      if (voz.classList.contains("on")) {
        /* El globo va PEGADO a lo que el dedo señala, no en la otra punta.
         *
         * Estuvo a la izquierda de la ventana y fue peor por dos motivos: en
         * escritorio separaba la causa del efecto 550 px —se rompía el "señalo
         * ESTO y digo ESTO", que es el único gesto que hay que recordar— y en
         * móvil, donde la ventana va de borde a borde, no había hueco a su
         * izquierda: la fórmula daba −354, el clamp lo pegaba en x=10 y el
         * globo tapaba el 100 % de la pestaña señalada y hasta el cursor.
         *
         * Ahora cuelga DEBAJO del elemento resaltado, alineado a su izquierda.
         * Si no cabe debajo, se pone encima. Nunca sobre el propio elemento. */
        const r = rectEsc(), vb = voz.getBoundingClientRect();
        const dia = dentro.querySelector(".p-tab.senalado, .campo.senalado");
        let x, y;
        if (dia) {
          const b = dia.getBoundingClientRect();
          x = (b.left - r.left);
          const debajo = (b.bottom - r.top) + 12;
          const encima = (b.top - r.top) - vb.height - 12;
          y = debajo + vb.height < r.height - 64 ? debajo : encima;
        } else if (escritorio.classList.contains("presentacion")) {
          // Ü presentándose en el centro: el globo va justo debajo de ella.
          x = r.width / 2 - vb.width / 2;
          y = r.height * 0.38 + RID() * 1.35;
        } else {
          // Nadie señala nada: el globo se pone bajo la ventana, en el azul
          // libre, que es donde no estorba a los campos llenándose.
          const v = vform.getBoundingClientRect();
          x = (v.left - r.left);
          y = (v.bottom - r.top) + 14;
        }
        x = Math.max(10, Math.min(r.width - vb.width - 10, x));
        y = Math.max(10, Math.min(r.height - vb.height - 64, y));
        voz.style.left = x + "px";
        voz.style.top = y + "px";
      }
    } else if (!enganchado && !arrancado) {
      // Fuera del punto de anclaje no hay cartel ni bloqueo.
      escritorio.classList.remove("esperando");
      bloquear(false);
    }
    if (!dentroVista && arrancado && !terminada) {
      // Si el usuario se va antes de que termine, la película se reinicia al
      // volver — y se calla, que si no sigue sonando fuera de pantalla.
      tInicio = -1;
      arrancado = false;
      escritorio.classList.remove("corriendo");
      bloquear(false);
      for (const a of Object.values(PISTAS)) { a.pause(); a.currentTime = 0; }
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__dentro = {
    escena: () => escena,
    irA: (i) => { irATiempo(t0Escena(i)); sonar(i); },
    saltar: () => btnSaltar.click(),
    arrancar,                       // arrancar(true|false) sin tocar el cartel
    DURS, INICIOS, TOTAL,
  };

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
