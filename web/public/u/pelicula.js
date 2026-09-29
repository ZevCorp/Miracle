/* El reproductor de la película de Ü.
 *
 * Sustituye a la película en DOM (`dentro.js`), que se quedó como máster para
 * el render. Aquí no hay escenas ni reloj: hay un <video> y sus controles.
 *
 * Las tres cosas que esto arregla, en orden de importancia:
 *
 * 1. La voz ya no se corta. Antes eran 13 `Audio` disparados uno por escena,
 *    con el arranque de cada uno oyéndose como un corte. Ahora es una sola
 *    pista dentro del MP4.
 * 2. Se lee como un video. Monitor, botón de play, barra que se puede arrastrar
 *    y tiempo — antes ocupaba la pantalla entera sin un solo control y parecía
 *    que la web se hubiera puesto a hacer cosas sola.
 * 3. El scroll ya no se bloquea. La pieza dura casi un minuto; retener a
 *    alguien un minuto contra su voluntad es peor que perderlo. Se pausa al
 *    salir de vista y se reanuda al volver, por donde iba.
 */

const $ = (s) => document.querySelector(s);
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

const escena = $("#v-escena");
const video = $("#v-peli");
if (escena && video) arrancar();

function arrancar() {
  const seccion = $("#dentro");
  const btnPlay = $("#v-play");
  const icoPlay = $("#v-play-icono");
  const btnSonido = $("#v-sonido");
  const btnToque = $("#v-toque");
  const btnFull = $("#v-full");
  const barra = $("#v-barra");
  const relleno = barra.querySelector("i");
  const tiempo = $("#v-tiempo");

  const ICONO_PLAY = "M7 4.5v15l13-7.5z";
  const ICONO_PAUSA = "M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z";

  const mmss = (s) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    return m + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  };

  /* ------------------------------ estado ------------------------------ */
  /* `queria` es la intención del usuario, separada de si el video está
   * sonando ahora mismo. Sin esa distinción, salir de vista (que pausa) y
   * volver dejaba el video parado: el observer no sabía si lo había pausado
   * él o la persona. */
  let queria = !REDUCED;
  let visible = false;
  let arrastrando = false;
  let yendose = false;                  // la sección se está yendo de pantalla

  /* UN solo sitio decide si el video debe estar corriendo.
   *
   * Antes lo decidían dos —el `IntersectionObserver` y el fundido de salida—
   * con umbrales distintos, y el resultado era una banda en la que el video
   * sonaba y el ratón ya no podía callarlo. Se tapó bajando y reapareció
   * subiendo, más ancha (142 px en una pantalla de 900): el observer cruzaba
   * su umbral antes de que la salida soltara los clics, y ganaba él.
   * Dos dueños del mismo estado siempre acaban así. */
  function revisar() {
    const debe = queria && visible && !yendose && !video.ended;
    if (debe && video.paused) intentarPlay();
    else if (!debe && !video.paused) video.pause();
  }

  function pintarPlay() {
    const parado = video.paused;
    escena.classList.toggle("pausada", parado);
    if (icoPlay) icoPlay.setAttribute("d", parado ? ICONO_PLAY : ICONO_PAUSA);
    btnPlay.setAttribute("aria-label", parado ? "Reproducir" : "Pausar");
  }

  function intentarPlay() {
    const p = video.play();
    /* Si el navegador lo rechaza (pasa en iOS con ahorro de batería), no se
     * insiste: se deja el botón grande de play encima y ya. */
    if (p && p.catch) p.catch(() => pintarPlay());
  }

  function alternar() {
    queria = video.paused;
    revisar();
  }

  btnPlay.addEventListener("click", alternar);
  btnToque.addEventListener("click", alternar);
  video.addEventListener("play", pintarPlay);
  video.addEventListener("pause", pintarPlay);

  /* El final. El último fotograma del video trae dibujada su llamada a la
   * acción, y un dibujo no se pulsa: con la película en DOM ese botón SÍ
   * funcionaba, así que dejarlo así habría sido perder algo por el camino.
   * El panel de cierre pone el botón de verdad encima, con la salida de verlo
   * otra vez al lado. */
  const fin = $("#v-fin");
  const marcarFin = (si) => escena.classList.toggle("terminado", si);
  video.addEventListener("ended", () => { queria = false; marcarFin(true); pintarPlay(); });
  video.addEventListener("play", () => marcarFin(false));
  video.addEventListener("seeking", () => { if (!video.ended) marcarFin(false); });
  if (fin) $("#v-otra").addEventListener("click", () => {
    video.currentTime = 0;
    queria = true;
    marcarFin(false);
    revisar();
  });

  /* ------------------------------ el sonido ------------------------------
   * Antes esto era una compuerta a pantalla completa: la pieza se quedaba
   * borrosa detrás de una tarjeta con dos botones hasta que se elegía. El
   * navegador solo exige un GESTO para dejar sonar; no exige un cartel. Así
   * que el video arranca mudo y el gesto es este botón, que además sirve para
   * volver a callarlo — cosa que el cartel no permitía. */
  function pintarSonido() {
    const con = !video.muted;
    escena.classList.toggle("con-sonido", con);
    /* Ni `aria-label` ni `aria-pressed`.
     * Sin label: el botón YA tiene texto visible ("Activar sonido" / "Sonido" /
     * "Silenciar") y un nombre accesible distinto rompe el control por voz —
     * quien dice lo que lee no acciona nada (WCAG 2.5.3).
     * Sin `pressed`: el nombre ya dice el estado, y los dos juntos se leen al
     * revés ("Silenciar, alternar, activado"). Un botón cuyo texto cambia no
     * es un interruptor: es un botón que hace otra cosa cada vez. */
    btnSonido.removeAttribute("aria-pressed");
    btnSonido.querySelector(".tachon").style.display = con ? "none" : "";
    for (const o of btnSonido.querySelectorAll(".ondas")) o.style.display = con ? "" : "none";
  }
  btnSonido.addEventListener("click", () => {
    video.muted = !video.muted;
    if (!video.muted) {
      video.volume = 1;
      /* Activar el sonido es también decir "quiero verlo": si estaba pausado
       * —porque terminó, o porque alguien lo paró— vuelve a correr. */
      if (video.ended) video.currentTime = 0;
      queria = true;
      revisar();
    }
    pintarSonido();
  });
  video.addEventListener("volumechange", pintarSonido);

  /* ------------------------------ la barra ------------------------------ */
  const cargado = barra.querySelector("b");
  function pintarTiempo() {
    const d = video.duration;
    const t = video.currentTime;
    if (!arrastrando) relleno.style.width = (isFinite(d) && d ? (t / d) * 100 : 0).toFixed(2) + "%";
    /* Lo descargado. Es la otra mitad de lo que enseña un reproductor, y aquí
     * además explica por qué a veces se salta al final de golpe y a veces hay
     * que esperar: el MP4 se sirve por rangos. */
    if (cargado && isFinite(d) && d && video.buffered.length) {
      let hasta = 0;
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.buffered.start(i) <= t + 0.1) hasta = Math.max(hasta, video.buffered.end(i));
      }
      cargado.style.width = ((hasta / d) * 100).toFixed(2) + "%";
    }
    tiempo.textContent = `${mmss(t)} / ${mmss(d)}`;
    barra.setAttribute("aria-valuenow", String(Math.round(isFinite(d) && d ? (t / d) * 100 : 0)));
    // "0:34 de 0:48" en vez de "71": el porcentaje no le dice nada a nadie.
    barra.setAttribute("aria-valuetext", `${mmss(t)} de ${mmss(d)}`);
  }
  video.addEventListener("timeupdate", pintarTiempo);
  video.addEventListener("loadedmetadata", pintarTiempo);
  video.addEventListener("durationchange", pintarTiempo);
  video.addEventListener("progress", pintarTiempo);

  const desdeEvento = (e) => {
    const r = barra.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    return Math.min(1, Math.max(0, x / r.width));
  };
  function llevar(e) {
    const f = desdeEvento(e);
    relleno.style.width = (f * 100).toFixed(2) + "%";
    if (isFinite(video.duration)) video.currentTime = f * video.duration;
  }
  barra.addEventListener("pointerdown", (e) => {
    arrastrando = true;
    barra.classList.add("agarrada");
    // Si la captura falla, el arrastre sigue funcionando con los eventos
    // normales; lo que no puede pasar es quedarse con `arrastrando` en true
    // para siempre y la barra congelada.
    try { barra.setPointerCapture(e.pointerId); } catch {}
    llevar(e);
  });
  barra.addEventListener("pointermove", (e) => { if (arrastrando) llevar(e); });
  const soltar = (e) => {
    if (!arrastrando) return;
    arrastrando = false;
    barra.classList.remove("agarrada");
    try { barra.releasePointerCapture(e.pointerId); } catch {}
  };
  barra.addEventListener("pointerup", soltar);
  barra.addEventListener("pointercancel", soltar);
  /* También en la ventana: si `setPointerCapture` falla, el `pointerup` puede
   * ocurrir fuera de la barra y `arrastrando` se quedaría en true para
   * siempre — el relleno dejaría de seguir al video y cualquier movimiento
   * posterior sobre la barra buscaría sin que nadie haya pulsado. */
  addEventListener("pointerup", soltar);
  addEventListener("pointercancel", soltar);

  /* Teclado sobre la barra. Es un `role="slider"`, así que se comporta como
   * uno: flechas, Inicio/Fin y las páginas. ↑/↓ también — si no, con el foco
   * aquí se quedaban muertas (el encaje del riel se aparta a propósito de los
   * sliders y el scroll nativo de 40 px lo devolvía el propio encaje). */
  barra.addEventListener("keydown", (e) => {
    const d = video.duration || 0;
    const paso = { ArrowLeft: -5, ArrowRight: 5, ArrowDown: -5, ArrowUp: 5,
                   PageDown: -15, PageUp: 15 }[e.key];
    let t = null;
    if (paso != null) t = video.currentTime + paso;
    else if (e.key === "Home") t = 0;
    else if (e.key === "End") t = d;
    if (t == null) return;
    e.preventDefault();
    video.currentTime = Math.min(d, Math.max(0, t));
  });

  /* Sin marcas de capítulo.
   *
   * La barra las llevaba, una por escena, y lo que se leía era una pieza
   * dividida en etapas — justo lo que se venía a dejar atrás. Un reproductor
   * normal enseña tres cosas: lo reproducido, lo descargado y dónde está la
   * cabeza. Nada más. Los tiempos de escena siguen existiendo en
   * `assets/peli/capitulos.json`, que escribe el render, pero como dato del
   * montaje: la página ya no los pinta ni los descarga. */

  /* --------------------------- pantalla completa --------------------------
   * Sobre el ESCENARIO entero, no sobre la pantalla del video: los controles
   * son hermanos del marco, así que pidiéndola sobre `#v-pantalla` se quedaban
   * fuera y en pantalla completa no había ni play, ni barra, ni forma de
   * salir salvo Escape.
   *
   * En iPhone el <video> no comparte la API de fullscreen del documento: el
   * sistema lo abre en su propio reproductor, con sus propios controles. Es
   * justo lo que uno quiere ahí, porque el video es 16:10 y en vertical se ve
   * diminuto. */
  btnFull.addEventListener("click", () => {
    if (document.fullscreenElement) return document.exitFullscreen();
    if (video.webkitEnterFullscreen && !document.fullscreenEnabled) return video.webkitEnterFullscreen();
    if (!escena.requestFullscreen) return;
    escena.requestFullscreen().then(() => {
      /* En un teléfono vertical, pantalla completa NO agranda nada: el video
       * es 16:10 y la pantalla no, así que pasa de 371 px de ancho a 374.
       * El botón dice "Ver en grande" y hay que cumplirlo — se pide el giro,
       * que es lo que en iPhone hace solo el reproductor del sistema. */
      const o = screen.orientation;
      if (o && o.lock && innerHeight > innerWidth) o.lock("landscape").catch(() => {});
    }).catch(() => {});
  });
  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement === escena) {
      /* En pantalla completa no hay salida que desvanecer: el estilo en línea
       * del fundido se hereda y el video se veía lavado al 50 % — justo el
       * botón cuyo trabajo es enseñarlo mejor. Se limpia al entrar y se vuelve
       * a calcular al salir, que es cuando el scroll vuelve a mandar. */
      escena.style.opacity = "";
      escena.style.pointerEvents = "";
      yendose = false;
      revisar();
      return;
    }
    alSalir();
    if (screen.orientation && screen.orientation.unlock) {
      try { screen.orientation.unlock(); } catch {}
    }
  });

  /* ------------------------ entrar y salir de vista ------------------------ */
  /* Se observa la PANTALLA, no la sección.
   *
   * Con la sección —150vh— el vídeo no empezaba hasta bien entrado el pin, y
   * durante el empalme (la cámara metiéndose en el monitor) se veía el botón
   * gigante de play encima de la pantalla que estaba aterrizando. La pantalla
   * del vídeo, en cambio, entra en cuadro con el empalme: encajada sobre la
   * del iMac, pero en cuadro. Así el vídeo arranca durante la entrada y no
   * después, que es lo que se pidió: que se vea que el computador ya está
   * reproduciendo algo cuando uno llega. */
  const obs = new IntersectionObserver((entradas) => {
    for (const e of entradas) visible = e.isIntersecting;
    revisar();                                   // sin tocar `queria`
  }, { threshold: 0.4 });
  obs.observe($("#v-pantalla") || seccion);

  /* La salida hacia la landing.
   *
   * `.d-sticky` deja de estar pegada y el escenario sube con la página: se
   * quedaba a media pantalla la cola de la fila de controles bajo la barra de
   * navegación, y debajo un bloque oscuro vacío hasta la siguiente sección. Se
   * desvanece en el último tramo, así que la landing entra por encima en vez
   * de aparecer detrás de un escenario a medio salir. */
  let pedido = false;
  const alSalir = () => {
    pedido = false;
    /* En pantalla completa no hay salida que pintar. Sin esta guarda, un
     * `resize` o un `scroll` de después devolvía el fundido con la pantalla
     * completa todavía puesta — el mismo error de dos dueños, otra vez. */
    if (document.fullscreenElement === escena) return;
    const r = seccion.getBoundingClientRect();
    /* Se apaga ANTES de terminar de salir, y con curva: si no, la cola de la
     * fila de controles sigue legible pegada bajo la barra de navegación
     * mientras la landing ya ocupa media pantalla. Con exponente, a mitad de
     * salida ya está en el 30 % y lo que se ve es un fundido, no un escenario
     * a medio recoger. */
    const k = Math.pow(Math.min(1, Math.max(0, r.bottom / innerHeight)), 1.8);
    escena.style.opacity = k >= 0.999 ? "" : k.toFixed(3);
    /* Y cuando ya no se ve, tampoco recibe. Bajar la opacidad no quita los
     * clics: a 0.19 el escenario era invisible y la barra de avance seguía a
     * media pantalla comiéndose el clic que iba a la landing — y encima
     * saltaba el video. Visualmente recogido, para el ratón no. */
    /* Y si ya se está yendo, el video se para. Antes el corte de los clics y
     * la pausa venían de sitios distintos —este fundido y el observer, con
     * umbrales que no coincidían— y quedaba una banda de ~90 px en la que el
     * video seguía sonando y el ratón ya no podía callarlo. Ahora la salida
     * manda las dos cosas. */
    yendose = k < 0.35;
    escena.style.pointerEvents = yendose ? "none" : "";
    revisar();
  };
  addEventListener("scroll", () => {
    if (pedido) return;
    pedido = true;
    requestAnimationFrame(alSalir);
  }, { passive: true });
  addEventListener("resize", alSalir);
  alSalir();

  pintarPlay();
  pintarSonido();
  pintarTiempo();

  window.__peli = {
    video,
    estado: () => ({
      t: video.currentTime, dur: video.duration, pausado: video.paused,
      mudo: video.muted, visible, queria, listo: video.readyState,
    }),
    sonido: () => btnSonido.click(),
    play: () => btnPlay.click(),
  };
}
