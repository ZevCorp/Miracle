/**
 * El consultorio COMPLETO, recreado contra la imagen de referencia
 * (~/Downloads/ChatGPT Image 14 ago 2026, 11_49_29 p.m..png).
 *
 * Inventario de la referencia, todo en cuadro desde un 3/4 alto:
 *   izquierda: báscula de columna, dos atriles de suero (uno con bolsa)
 *   fondo: negatoscopio, reloj, optotipo, planta, vitrina blanca con insumos,
 *          dispensador de toallas, lavamanos con jabón, caneca de pedal
 *   derecha: ventana con persiana y sol cálido, camilla menta con rollo de
 *            papel y cabecera levantada, butaco de dos pasos, tensiómetro
 *   centro: escritorio de madera con patas de aro negras, cajonera, iMac con
 *           Ü en pantalla azul, teclado, mouse, taza, papeles, silla menta
 *           con fonendoscopio colgado
 *
 * Todo procedural. Cero assets.
 */

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

import { makeRoughnessMap, makeContactShadow, makeDustAlpha, makeLeafAlpha, makeWoodMap, makeTerrazzoMap, mulberry32 } from "./procedural.js";
import { aplicarPBR } from "./pbr.js";
import { drawFace } from "../face-canvas.js";

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const rnd = mulberry32(0x0F1C1A);

/* ------------------------------- paleta ------------------------------- */

const P = {
  pared:    0xD3C7B8,
  piso:     0xD9CEC0,
  madera:   0xB98D5F,
  negro:    0x1C1D1F,
  cromo:    0xB9BEC4,
  blanco:   0xF2F1EC,
  menta:    0xB2D2BB,
  mentaSuave: 0xC9DBCD,
  crema:    0xE2DACC,
  gris:     0x9B9B98,
  azulApp:  0x3776E3,
};

/* ------------------------------- montaje ------------------------------- */

const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
// Nada de lo que proyecta sombra se mueve: la sombra se hornea una vez y listo.
// Re-renderizarla cada frame costaba la mitad del framerate.
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xE8DFD2);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.02, 40);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.30;
pmrem.dispose();

/* -------------------------------- helpers -------------------------------- */

const rough = makeRoughnessMap(512);
function std(color, r = 0.7, m = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m, ...extra });
}
function caja(w, h, d, mat, radio = 0.008) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, radio), mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

const MAT = {
  pared: std(P.pared, 0.95),
  piso: (() => {
    const t = rough.clone(); t.needsUpdate = true; t.repeat.set(5, 4);
    const terrazo = makeTerrazzoMap(512);
    terrazo.repeat.set(4, 3);
    return std(0xFFFFFF, 0.30, 0, { roughnessMap: t, map: terrazo, envMapIntensity: 0.9 });
  })(),
  madera: (() => {
    const t = rough.clone(); t.needsUpdate = true; t.repeat.set(2, 1);
    return std(0xFFFFFF, 0.55, 0, { roughnessMap: t, map: makeWoodMap(512) });
  })(),
  negro: std(P.negro, 0.45, 0.3),
  cromo: std(P.cromo, 0.15, 1.0),
  blanco: std(P.blanco, 0.6),
  menta: std(P.menta, 0.75),
  crema: std(P.crema, 0.7),
  gris: std(0x8E8E8B, 0.85),
};

// Texturas e HDRI reales por encima de la base procedural. Si el CDN falla,
// la escena queda como estaba — nunca en negro.
aplicarPBR(MAT, scene, renderer).then((r) => {
  console.log("[PBR]", JSON.stringify(r));
  renderer.shadowMap.needsUpdate = true;
});

/* ---------------------------------- sala ---------------------------------- */
/* 6.0 (X) × 4.4 (Z), 3.0 de alto. Ventana en la pared derecha (x=+3). */

const sala = new THREE.Group();
scene.add(sala);

const piso = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 4.4), MAT.piso);
piso.rotation.x = -Math.PI / 2;
piso.receiveShadow = true;
sala.add(piso);

const pFondo = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 3.0), MAT.pared);
pFondo.position.set(0, 1.5, -2.2);
pFondo.receiveShadow = true;
sala.add(pFondo);

const pIzq = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.0), MAT.pared);
pIzq.rotation.y = Math.PI / 2;
pIzq.position.set(-3.0, 1.5, 0);
pIzq.receiveShadow = true;
sala.add(pIzq);

// Pared derecha con hueco de ventana: z ∈ [-1.75, 0.75], y ∈ [1.00, 2.60].
for (const t of [
  { w: 4.4, h: 1.0, z: 0, y: 0.5 },
  { w: 4.4, h: 0.4, z: 0, y: 2.8 },
  { w: 0.45, h: 1.6, z: -1.975, y: 1.8 },
  { w: 1.45, h: 1.6, z: 1.475, y: 1.8 },
]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(t.w, t.h), MAT.pared);
  m.rotation.y = -Math.PI / 2;
  m.position.set(3.0, t.y, t.z);
  m.receiveShadow = true;
  sala.add(m);
}

// El "afuera": un plano cálido que QUEMA un poco — es la fuente de la hora dorada.
// Vidrio con gradiente vertical: quema arriba, ámbar profundo abajo.
const cvAfuera = document.createElement("canvas");
cvAfuera.width = 8; cvAfuera.height = 256;
const cxA = cvAfuera.getContext("2d");
const gA = cxA.createLinearGradient(0, 0, 0, 256);
gA.addColorStop(0, "#FFF4E0");
gA.addColorStop(0.55, "#FFE3B4");
gA.addColorStop(1, "#F7CE93");
cxA.fillStyle = gA;
cxA.fillRect(0, 0, 8, 256);
const afuera = new THREE.Mesh(
  new THREE.PlaneGeometry(3.4, 2.4),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cvAfuera), toneMapped: false })
);
afuera.rotation.y = -Math.PI / 2;
afuera.position.set(3.45, 1.8, -0.5);
sala.add(afuera);

// Persiana completa con lamas abiertas: es la que raya el piso con el sol de
// la mañana. (Con el sol a ~45° las franjas caen dentro del cuarto.)
const lamas = [];
for (let i = 0; i < 26; i++) {
  const g = new THREE.BoxGeometry(0.044, 0.011, 2.50);
  g.rotateZ(0.42);
  g.translate(2.93, 1.03 + i * 0.062, -0.50);
  lamas.push(g);
}
// Lamas encendidas por el contraluz: emisivo suave del lado del sol.
const persiana = new THREE.Mesh(
  BufferGeometryUtils.mergeGeometries(lamas),
  std(P.crema, 0.5, 0.15, { emissive: 0xFFD9A6, emissiveIntensity: 0.35 })
);
persiana.castShadow = true;
sala.add(persiana);
// Cajón de la persiana arriba.
const cajonPersiana = caja(0.10, 0.07, 2.52, MAT.blanco, 0.008);
cajonPersiana.position.set(2.93, 2.62, -0.50);
sala.add(cajonPersiana);

// Marco de la ventana.
const marcoV = [
  new THREE.BoxGeometry(0.06, 0.06, 2.56).translate(2.98, 1.00, -0.50),
  new THREE.BoxGeometry(0.06, 0.06, 2.56).translate(2.98, 2.60, -0.50),
  new THREE.BoxGeometry(0.06, 1.66, 0.06).translate(2.98, 1.80, -1.75),
  new THREE.BoxGeometry(0.06, 1.66, 0.06).translate(2.98, 1.80, 0.75),
];
marcoV.push(new THREE.BoxGeometry(0.055, 1.66, 0.05).translate(2.97, 1.80, -0.50));   // montante
const marcoVm = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(marcoV), MAT.blanco);
marcoVm.castShadow = true;
sala.add(marcoVm);

/* ------------------------------- escritorio ------------------------------- */

const gEscritorio = new THREE.Group();
gEscritorio.position.set(-0.85, 0, 0.05);
gEscritorio.rotation.y = -0.10;
sala.add(gEscritorio);

const tapa = caja(1.62, 0.04, 0.78, MAT.madera, 0.006);
tapa.position.y = 0.74;
gEscritorio.add(tapa);

// Patas de aro: dos marcos rectangulares de acero negro.
for (const x of [-0.74, 0.74]) {
  const aro = [
    new THREE.BoxGeometry(0.05, 0.72, 0.05).translate(x, 0.36, -0.33),
    new THREE.BoxGeometry(0.05, 0.72, 0.05).translate(x, 0.36, 0.33),
    new THREE.BoxGeometry(0.05, 0.05, 0.71).translate(x, 0.025, 0),
    new THREE.BoxGeometry(0.05, 0.05, 0.71).translate(x, 0.695, 0),
  ];
  const marco = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(aro), MAT.negro);
  marco.castShadow = true;
  gEscritorio.add(marco);
}

// Cajonera de madera con dos frentes de cajón marcados y manijas negras.
const matCajonera = MAT.madera.clone();
matCajonera.color.setHex(0xC4A981);      // medio paso más claro: iguala al tablero en cámara
const cajonera = caja(0.42, 0.52, 0.55, matCajonera, 0.006);
cajonera.position.set(0.42, 0.27, 0.02);
gEscritorio.add(cajonera);
for (const dy of [0.13, -0.12]) {
  const frente = caja(0.38, 0.205, 0.015, matCajonera, 0.005);
  frente.position.set(0.42, 0.27 + dy, 0.295);
  gEscritorio.add(frente);
  const manija = caja(0.13, 0.013, 0.013, MAT.negro, 0.003);
  manija.position.set(0.42, 0.27 + dy + 0.05, 0.304);
  gEscritorio.add(manija);
}

/* ------------------------------ iMac con Ü ------------------------------ */

const gMac = new THREE.Group();
gMac.position.set(-0.12, 0.76, -0.12);
gMac.rotation.y = 0.06;
gEscritorio.add(gMac);

/* Formulario del HIS que Ü va llenando en la pantalla del iMac.
   CAMPOS = ancho relativo del texto de cada campo. El cuarto (CUPS) es el
   ambiguo: se queda en ámbar esperando al médico y luego el ciclo reinicia.
   Todo el estado es función del tiempo, así que no hay que guardar nada. */
const CAMPOS = [0.95, 0.72, 1.0, 0.62, 0.85];
const T_CAMPO = 1.15;          // segundos que tarda en escribir un campo
const T_PAUSA = 4.2;           // lo que se queda esperando firma en el CUPS
const I_AMBIGUO = 3;
const T_CICLO = CAMPOS.length * T_CAMPO + T_PAUSA + 2.2;
let tPantalla = 0;

function estadoCampo(i) {
  const t = tPantalla % T_CICLO;
  const inicio = i * T_CAMPO + (i > I_AMBIGUO ? T_PAUSA : 0);
  if (t < inicio) return 0;
  if (i === I_AMBIGUO && t >= inicio + T_CAMPO && t < inicio + T_CAMPO + T_PAUSA) return 2;
  return Math.min(1, (t - inicio) / T_CAMPO);
}

// Pantalla: canvas con la app azul y la carita blanca al centro.
const cvs = document.createElement("canvas");
cvs.width = 1100; cvs.height = 660;
const cx = cvs.getContext("2d");
function pintarPantalla(t = 0) {
  const w = cvs.width, h = cvs.height;
  // Dashboard con jerarquía real: sidebar, cards, tarjeta con la carita.
  const g = cx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#3E7FF0");
  g.addColorStop(1, "#2558BD");
  cx.fillStyle = g;
  cx.fillRect(0, 0, w, h);

  // sidebar blanco con navegación
  cx.fillStyle = "rgba(255,255,255,0.96)";
  cx.fillRect(0, 0, w * 0.155, h);
  cx.fillStyle = "#3776E3";
  cx.beginPath(); cx.arc(w * 0.077, 46, 17, 0, Math.PI * 2); cx.fill();
  cx.fillStyle = "#fff";
  cx.font = "700 20px ui-sans-serif, system-ui";
  cx.textAlign = "center"; cx.textBaseline = "middle";
  cx.fillText("Ü", w * 0.077, 47);
  cx.textAlign = "left";
  for (let i = 0; i < 7; i++) {
    if (i === 1) {
      cx.fillStyle = "#E3EDFB";
      roundRect(cx, w * 0.018, 88 + i * 46, w * 0.12, 32, 8); cx.fill();
    }
    cx.fillStyle = i === 1 ? "#3776E3" : "#B9C6DA";
    cx.fillRect(w * 0.035, 100 + i * 46, w * 0.085, 9);
  }

  // barra superior
  cx.fillStyle = "rgba(255,255,255,0.15)";
  cx.fillRect(w * 0.155, 0, w, 54);
  cx.fillStyle = "rgba(255,255,255,0.92)";
  cx.font = "600 19px ui-sans-serif, system-ui";
  cx.fillText("Historia clínica · consulta externa", w * 0.18, 28);

  // grid de cards con métricas
  for (let c = 0; c < 3; c++) {
    cx.fillStyle = "rgba(255,255,255,0.13)";
    roundRect(cx, w * (0.18 + c * 0.135), 78, w * 0.12, 74, 10); cx.fill();
    cx.fillStyle = "rgba(255,255,255,0.85)";
    cx.fillRect(w * (0.192 + c * 0.135), 96, w * 0.055, 12);
    cx.fillStyle = "rgba(255,255,255,0.35)";
    cx.fillRect(w * (0.192 + c * 0.135), 118, w * 0.09, 7);
  }

  // Panel derecho: el formulario llenándose. Es lo que hace que la escena
  // esté VIVA desde el primer segundo sin que la cámara se haya movido.
  cx.fillStyle = "rgba(255,255,255,0.10)";
  roundRect(cx, w * 0.72, 78, w * 0.245, h - 130, 12); cx.fill();
  for (let i = 0; i < CAMPOS.length; i++) {
    const y = 108 + i * 62;
    const est = estadoCampo(i);            // 0 vacío · (0,1) escribiendo · 1 lleno · 2 en pausa
    cx.fillStyle = "rgba(255,255,255,0.42)";
    cx.fillRect(w * 0.745, y - 14, w * 0.055, 7);   // etiqueta
    // caja del campo
    cx.fillStyle = est === 2 ? "rgba(224,163,60,0.22)" : "rgba(255,255,255,0.10)";
    roundRect(cx, w * 0.745, y, w * 0.20, 26, 6); cx.fill();
    if (est === 2) {
      cx.strokeStyle = "rgba(240,186,96,0.95)"; cx.lineWidth = 2; cx.stroke();
    }
    // texto escrito: barra que crece con el progreso
    const llenado = est === 2 ? 0.55 : Math.min(1, est);
    if (llenado > 0) {
      cx.fillStyle = est === 2 ? "rgba(246,205,140,0.95)" : "rgba(255,255,255,0.78)";
      cx.fillRect(w * 0.755, y + 10, w * 0.18 * llenado * CAMPOS[i], 7);
    }
  }

  // tarjeta blanca con la carita
  cx.fillStyle = "rgba(255,255,255,0.97)";
  roundRect(cx, w * 0.235, 172, w * 0.42, h - 224, 16); cx.fill();
  const lado = Math.min(w * 0.30, h - 260);
  cx.save();
  cx.translate(w * 0.445 - lado / 2, 178 + (h - 236 - lado) / 2);
  drawFace(cx, lado, { dark: false, clear: false, transparent: true, blink: caraBlink(t), eyeShift: caraMirada(t) });
  cx.restore();

  // fresnel: barrido diagonal de reflejo sobre todo el panel
  const gl = cx.createLinearGradient(0, h, w * 0.7, 0);
  gl.addColorStop(0.55, "rgba(255,255,255,0)");
  gl.addColorStop(0.72, "rgba(255,255,255,0.07)");
  gl.addColorStop(0.85, "rgba(255,255,255,0)");
  cx.fillStyle = gl;
  cx.fillRect(0, 0, w, h);
}
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
let proxBlink = performance.now() + 2800, iniBlink = -1;
function caraBlink(now) {
  if (iniBlink < 0 && now > proxBlink) iniBlink = now;
  if (iniBlink < 0) return 0;
  const q = (now - iniBlink) / 340;
  if (q >= 1) { iniBlink = -1; proxBlink = now + 8000 + Math.random() * 10000; return 0; }
  return q < 0.5 ? q * 2 : (1 - q) * 2;
}

// Mirada lateral con los tiempos del cliente: 450 ida / aguanta 1250 / vuelve 1800.
let proxMirada = performance.now() + 6000, iniMirada = -1, destinoMirada = 0;
function caraMirada(now) {
  if (iniMirada < 0 && now > proxMirada) {
    iniMirada = now;
    destinoMirada = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 1.5);
  }
  if (iniMirada < 0) return 0;
  const ms = now - iniMirada;
  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
  if (ms < 450) return destinoMirada * ease(ms / 450);
  if (ms < 1250) return destinoMirada;
  if (ms < 1800) return destinoMirada * (1 - ease((ms - 1250) / 550));
  iniMirada = -1;
  proxMirada = now + 9000 + Math.random() * 12000;
  return 0;
}
pintarPantalla();
const texPantalla = new THREE.CanvasTexture(cvs);
texPantalla.colorSpace = THREE.SRGBColorSpace;

// Cuerpo del iMac: panel delgado plateado con mentón, pie de aluminio.
const cuerpoMac = caja(0.52, 0.335, 0.016, std(0xD8DADD, 0.35, 0.6), 0.006);
cuerpoMac.position.y = 0.36;
gMac.add(cuerpoMac);
const pantallaMac = new THREE.Mesh(
  new THREE.PlaneGeometry(0.485, 0.272),
  new THREE.MeshBasicMaterial({ map: texPantalla, toneMapped: false })
);
pantallaMac.position.set(0, 0.375, 0.0095);
gMac.add(pantallaMac);
const menton = caja(0.52, 0.045, 0.016, std(0xCFD2D6, 0.35, 0.6), 0.004);
menton.position.set(0, 0.208, 0);
gMac.add(menton);
const pieMac = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.20, 0.012), std(0xC9CCD1, 0.3, 0.7));
pieMac.rotation.x = -0.32;
pieMac.position.set(0, 0.10, -0.045);
pieMac.castShadow = true;
gMac.add(pieMac);
const baseMac = caja(0.20, 0.008, 0.17, std(0xC9CCD1, 0.3, 0.7), 0.003);
baseMac.position.set(0, 0.004, -0.07);
gMac.add(baseMac);

// Teclado, mouse, taza, papeles.
const teclado = caja(0.36, 0.012, 0.13, std(0xE8E8E6, 0.5), 0.004);
teclado.position.set(-0.10, 0.766, 0.20);
gEscritorio.add(teclado);
// Retícula de teclas: es lo que sostiene el teclado en el plano cercano.
const teclasMac = new THREE.InstancedMesh(
  new THREE.BoxGeometry(0.026, 0.0035, 0.024),
  std(0xD2D2CE, 0.65),
  60
);
let tn = 0;
const mTecla = new THREE.Matrix4();
for (let fila = 0; fila < 4 && tn < 60; fila++) {
  for (let col = 0; col < 12 && tn < 60; col++) {
    mTecla.makeTranslation(-0.157 + col * 0.0285, 0.0078, -0.042 + fila * 0.028);
    teclasMac.setMatrixAt(tn++, mTecla);
  }
}
// barra espaciadora
mTecla.makeTranslation(0.0, 0.0078, 0.049);
teclasMac.setMatrixAt(48, mTecla);
teclasMac.instanceMatrix.needsUpdate = true;
teclado.add(teclasMac);
// AO de contacto bajo los props del primer plano.
const texAOProp = makeContactShadow(128);
for (const [ax, az, s] of [[-0.10, 0.20, 0.42], [0.10, 0.05, 0.11], [0.18, 0.21, 0.10]]) {
  const aoP = new THREE.Mesh(
    new THREE.PlaneGeometry(s, s * 0.6),
    new THREE.MeshBasicMaterial({ map: texAOProp, transparent: true, opacity: 0.3, depthWrite: false })
  );
  aoP.rotation.x = -Math.PI / 2;
  aoP.position.set(ax, 0.7615, az);
  gEscritorio.add(aoP);
}
const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 10), std(0xE8E8E6, 0.5));
mouse.scale.set(1, 0.45, 1.4);
mouse.position.set(0.18, 0.774, 0.21);
mouse.castShadow = true;
gEscritorio.add(mouse);
const taza = new THREE.Mesh(
  new THREE.CylinderGeometry(0.036, 0.032, 0.085, 18),
  std(0xF1EDE4, 0.55)
);
taza.position.set(0.10, 0.803, 0.05);
taza.castShadow = true;
gEscritorio.add(taza);
const asaTaza = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 6, 16, Math.PI), std(0xF4F2EE, 0.6));
asaTaza.position.set(0.145, 0.805, 0.05);
asaTaza.rotation.z = -Math.PI / 2;
asaTaza.castShadow = true;
gEscritorio.add(asaTaza);
for (let i = 0; i < 3; i++) {
  const hoja = new THREE.Mesh(new THREE.PlaneGeometry(0.20, 0.28), std(0xF6F4EE, 0.95));
  hoja.rotation.x = -Math.PI / 2;
  hoja.rotation.z = -0.35 + i * 0.22;
  hoja.position.set(-0.52 + i * 0.025, 0.762 + i * 0.0012, 0.12 - i * 0.015);
  hoja.receiveShadow = true;
  gEscritorio.add(hoja);
}
const boli = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.14, 8), std(0x22262C, 0.4));
boli.rotation.set(Math.PI / 2, 0, 0.5);
boli.position.set(-0.46, 0.768, 0.10);
boli.castShadow = true;
gEscritorio.add(boli);

/* --------------------------------- silla --------------------------------- */

const gSilla = new THREE.Group();
gSilla.position.set(-0.42, 0, 0.86);
gSilla.rotation.y = 2.42;         // de espaldas a cámara, mirando al escritorio
sala.add(gSilla);

// Cojín grueso y respaldo más angosto que el asiento, con curva — antes era
// una placa cuadrada que se leía como cartón.
const asiento = caja(0.46, 0.10, 0.44, MAT.menta, 0.035);
asiento.position.y = 0.48;
gSilla.add(asiento);
const respaldo = caja(0.34, 0.46, 0.10, MAT.menta, 0.06);
respaldo.position.set(0, 0.85, 0.215);
respaldo.rotation.x = -0.16;
gSilla.add(respaldo);
// Apoyabrazos conectados al asiento.
for (const s of [-1, 1]) {
  const soporte = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.16, 8), MAT.negro);
  soporte.position.set(s * 0.245, 0.55, 0.02);
  gSilla.add(soporte);
  const brazo = caja(0.05, 0.035, 0.26, MAT.negro, 0.012);
  brazo.position.set(s * 0.245, 0.635, 0.02);
  gSilla.add(brazo);
}
const columnaS = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.030, 0.34, 12), MAT.cromo);
columnaS.position.y = 0.28;
columnaS.castShadow = true;
gSilla.add(columnaS);
const m4 = new THREE.Matrix4();
// Base de disco: más simple que la estrella de cinco aspas y se lee premium.
const discoSilla = new THREE.Mesh(
  new THREE.CylinderGeometry(0.20, 0.22, 0.022, 32),
  MAT.cromo
);
discoSilla.position.y = 0.022;
discoSilla.castShadow = true;
gSilla.add(discoSilla);
const gomaSilla = new THREE.Mesh(
  new THREE.TorusGeometry(0.21, 0.008, 8, 32),
  MAT.negro
);
gomaSilla.rotation.x = Math.PI / 2;
gomaSilla.position.y = 0.012;
gSilla.add(gomaSilla);

// Fonendoscopio colgado del respaldo.
// Fonendo descolgado sobre el asiento, enroscado — como en la referencia.
const matGoma = std(0x26282C, 0.45, 0.15);
const rollo1 = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.0085, 8, 30), matGoma);
rollo1.rotation.x = -Math.PI / 2 + 0.08;
rollo1.position.set(-0.05, 0.545, -0.04);
rollo1.castShadow = true;
gSilla.add(rollo1);
const rollo2 = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.0085, 8, 26, Math.PI * 1.6), matGoma);
rollo2.rotation.set(-Math.PI / 2 + 0.05, 0, 1.2);
rollo2.position.set(-0.02, 0.552, -0.02);
rollo2.castShadow = true;
gSilla.add(rollo2);
const campanaF = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.040, 0.016, 18), std(0xD9DEE3, 0.2, 0.95));
campanaF.position.set(0.09, 0.548, 0.06);
campanaF.castShadow = true;
gSilla.add(campanaF);

/* --------------------------------- camilla --------------------------------- */

const gCamilla = new THREE.Group();
gCamilla.position.set(2.15, 0, -0.45);
sala.add(gCamilla);

// Mueble base: puerta – módulo de tres cajones – puerta, como la referencia.
const baseCam = caja(0.72, 0.55, 1.95, MAT.crema, 0.008);
baseCam.position.y = 0.30;
gCamilla.add(baseCam);
for (const dz of [-0.62, 0.62]) {
  const puerta = caja(0.02, 0.42, 0.50, std(0xEAE3D6, 0.65), 0.004);
  puerta.position.set(-0.37, 0.30, dz);
  gCamilla.add(puerta);
  const manija = caja(0.015, 0.10, 0.02, MAT.cromo, 0.003);
  manija.position.set(-0.385, 0.32, dz + 0.18);
  gCamilla.add(manija);
}
// Tres cajones al centro con tiradores horizontales.
for (let i = 0; i < 3; i++) {
  const frente = caja(0.02, 0.125, 0.50, std(0xEAE3D6, 0.65), 0.004);
  frente.position.set(-0.37, 0.115 + i * 0.145, 0.0);
  gCamilla.add(frente);
  const tirador = caja(0.015, 0.018, 0.16, MAT.cromo, 0.003);
  tirador.position.set(-0.385, 0.155 + i * 0.145, 0.0);
  gCamilla.add(tirador);
}

// Colchoneta menta en tres secciones que se tocan; cabecera levantada.
const sec1 = caja(0.66, 0.09, 0.62, MAT.menta, 0.02);
sec1.position.set(0, 0.62, 0.59);
gCamilla.add(sec1);
const sec2 = caja(0.66, 0.09, 0.62, MAT.menta, 0.02);
sec2.position.set(0, 0.62, -0.02);
gCamilla.add(sec2);
const cabecera = caja(0.66, 0.09, 0.60, MAT.menta, 0.02);
cabecera.position.set(0, 0.75, -0.71);
cabecera.rotation.x = 0.48;
gCamilla.add(cabecera);

// Sábana de papel: sube por la cabecera y corre hasta el rollo del pie.
const papel = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 1.62), std(0xF2EFE8, 0.9));
papel.rotation.x = -Math.PI / 2;
papel.position.set(0, 0.673, 0.16);
papel.receiveShadow = true;
gCamilla.add(papel);
const papelCabecera = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.56), std(0xF2EFE8, 0.9));
papelCabecera.position.set(0, 0.76, -0.705);
papelCabecera.rotation.x = 0.48 - Math.PI / 2;
papelCabecera.receiveShadow = true;
gCamilla.add(papelCabecera);
const rollo = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.44, 16), std(0xFAFAF6, 0.9));
rollo.rotation.z = Math.PI / 2;
rollo.position.set(0, 0.66, 0.98);
rollo.castShadow = true;
gCamilla.add(rollo);

// Butaco de dos pasos.
const gButaco = new THREE.Group();
gButaco.position.set(1.62, 0, 0.28);
gButaco.rotation.y = -0.35;
for (const [h, prof, y] of [[0.20, 0.30, 0.10], [0.38, 0.16, 0.19]]) {
  const paso = caja(0.42, 0.035, prof, MAT.negro, 0.006);
  paso.position.set(0, h, y - prof / 2);
  gButaco.add(paso);
}
for (const [x, z] of [[-0.18, 0.06], [0.18, 0.06], [-0.18, -0.12], [0.18, -0.12]]) {
  const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.20, 8), MAT.cromo);
  pata.position.set(x, 0.10, z);
  pata.castShadow = true;
  gButaco.add(pata);
}
// Marco cromado: travesaños que conectan las patas, como el butaco real.
for (const x of [-0.18, 0.18]) {
  const riel = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.20, 8), MAT.cromo);
  riel.rotation.x = Math.PI / 2;
  riel.position.set(x, 0.055, -0.03);
  gButaco.add(riel);
}
sala.add(gButaco);

/* ------------------------------ pared del fondo ------------------------------ */

// Vitrina blanca: el cuerpo superior es HUECO (fondo + costados + techo), con
// los insumos visibles tras el vidrio. Antes era un bloque sólido y las cajitas
// quedaban enterradas adentro — el mueble más grande del fondo no comunicaba nada.
const gVitrina = new THREE.Group();
gVitrina.position.set(0.55, 0, -2.02);
sala.add(gVitrina);

// Zócalo sólido inferior con puertas.
const baseV = caja(1.05, 0.85, 0.34, MAT.blanco, 0.008);
baseV.position.y = 0.425;
gVitrina.add(baseV);
for (const dx of [-0.26, 0.26]) {
  const puertaB = caja(0.46, 0.72, 0.02, std(0xEDECE7, 0.6), 0.005);
  puertaB.position.set(dx, 0.42, 0.165);
  gVitrina.add(puertaB);
  const manijaB = caja(0.015, 0.12, 0.015, MAT.cromo, 0.003);
  manijaB.position.set(dx + (dx < 0 ? 0.17 : -0.17), 0.46, 0.18);
  gVitrina.add(manijaB);
}

// Caja hueca superior: fondo, dos costados, techo.
const fondoV = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.30, 0.02), MAT.blanco);
fondoV.position.set(0, 1.50, -0.155);
fondoV.castShadow = true;
gVitrina.add(fondoV);
for (const dx of [-0.515, 0.515]) {
  const lado = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.30, 0.34), MAT.blanco);
  lado.position.set(dx, 1.50, 0);
  lado.castShadow = true;
  gVitrina.add(lado);
}
const techoV = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.05, 0.34), MAT.blanco);
techoV.position.set(0, 2.175, 0);
techoV.castShadow = true;
gVitrina.add(techoV);

// Repisas + insumos, DELANTE del fondo y DETRÁS del vidrio.
for (const y of [1.02, 1.38, 1.74]) {
  const repisa = new THREE.Mesh(new THREE.BoxGeometry(0.99, 0.014, 0.26), MAT.blanco);
  repisa.position.set(0, y, 0.0);
  gVitrina.add(repisa);
}
const cajitas = new THREE.InstancedMesh(
  new THREE.BoxGeometry(0.085, 0.062, 0.05),
  new THREE.MeshStandardMaterial({ roughness: 0.7 }),
  32
);
const colores = [0xA9CCE6, 0x4E8FA8, 0xE2EEF8, 0x6FAEC6, 0xF5EFE0, 0x8FBBDD, 0x3E7A94, 0xFFFFFF];
let ci = 0;
for (const y of [1.06, 1.42, 1.78]) {
  for (let i = 0; i < 8 && ci < 24; i++) {
    m4.identity().setPosition(-0.375 + i * 0.105 + (rnd() - 0.5) * 0.006, y + 0.031, 0.02);
    cajitas.setMatrixAt(ci, m4);
    cajitas.setColorAt(ci, new THREE.Color(colores[(ci * 5 + (ci % 3)) % colores.length]));
    ci++;
  }
}
// segunda fila al fondo de cada estante, para el 70% de llenado
for (const y of [1.06, 1.42]) {
  for (let i = 0; i < 4 && ci < 32; i++) {
    m4.identity().setPosition(-0.28 + i * 0.16, y + 0.031, -0.05);
    cajitas.setMatrixAt(ci, m4);
    cajitas.setColorAt(ci, new THREE.Color(colores[(ci * 3 + 1) % colores.length]));
    ci++;
  }
}
cajitas.instanceMatrix.needsUpdate = true;
if (cajitas.instanceColor) cajitas.instanceColor.needsUpdate = true;
gVitrina.add(cajitas);

// Etiquetas: rectángulo blanco con línea de color en la cara frontal de cada caja.
const etiqBlanca = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(0.052, 0.034),
  new THREE.MeshStandardMaterial({ color: 0xFAFAF7, roughness: 0.8 }),
  24
);
const etiqLinea = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(0.040, 0.007),
  new THREE.MeshStandardMaterial({ roughness: 0.7 }),
  24
);
const coloresLinea = [0x3776E3, 0xD9744A, 0x4E8FA8, 0xC6A34E];
let ei = 0;
for (const y of [1.06, 1.42, 1.78]) {
  for (let i = 0; i < 8 && ei < 24; i++) {
    const px = -0.375 + i * 0.105;
    m4.identity().setPosition(px, y + 0.031, 0.0465);
    etiqBlanca.setMatrixAt(ei, m4);
    m4.identity().setPosition(px, y + 0.038, 0.047);
    etiqLinea.setMatrixAt(ei, m4);
    etiqLinea.setColorAt(ei, new THREE.Color(coloresLinea[ei % 4]));
    ei++;
  }
}
etiqBlanca.instanceMatrix.needsUpdate = true;
etiqLinea.instanceMatrix.needsUpdate = true;
if (etiqLinea.instanceColor) etiqLinea.instanceColor.needsUpdate = true;
gVitrina.add(etiqBlanca, etiqLinea);

// Sombra interior: gradiente oscuro al fondo de cada estante.
const texAOEstante = makeContactShadow(128);
for (const y of [1.06, 1.42, 1.78]) {
  const aoE = new THREE.Mesh(
    new THREE.PlaneGeometry(0.98, 0.30),
    new THREE.MeshBasicMaterial({ map: texAOEstante, transparent: true, opacity: y > 1.2 ? 0.68 : 0.5, depthWrite: false })
  );
  aoE.position.set(0, y + 0.15, -0.145);
  gVitrina.add(aoE);
}
// Frascos en la repisa alta.
const frascos = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.022, 0.022, 0.09, 10),
  std(0xDCE9F2, 0.5),
  6
);
const tapas = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.023, 0.023, 0.018, 10),
  std(0x6B7A8A, 0.5),
  6
);
const etiquetas = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.0228, 0.0228, 0.03, 10),
  new THREE.MeshStandardMaterial({ roughness: 0.6 }),
  6
);
const coloresEtiq = [0x4E8FA8, 0xD9744A, 0x6FAEC6, 0x4E8FA8, 0xC6A34E, 0x6FAEC6];
for (let i = 0; i < 6; i++) {
  m4.identity().setPosition(-0.30 + i * 0.12, 2.02, 0.02);
  frascos.setMatrixAt(i, m4);
  m4.identity().setPosition(-0.30 + i * 0.12, 2.075, 0.02);
  tapas.setMatrixAt(i, m4);
  m4.identity().setPosition(-0.30 + i * 0.12, 2.01, 0.02);
  etiquetas.setMatrixAt(i, m4);
  etiquetas.setColorAt(i, new THREE.Color(coloresEtiq[i]));
}
frascos.instanceMatrix.needsUpdate = true;
tapas.instanceMatrix.needsUpdate = true;
gVitrina.add(frascos, tapas, etiquetas);

// Puertas de vidrio con marco blanco y manijas.
for (const dx of [-0.26, 0.26]) {
  const marcoP = new THREE.Group();
  const mv = [
    new THREE.BoxGeometry(0.50, 0.025, 0.02).translate(dx, 2.13, 0.165),
    new THREE.BoxGeometry(0.50, 0.025, 0.02).translate(dx, 0.875, 0.165),
    new THREE.BoxGeometry(0.025, 1.28, 0.02).translate(dx - 0.238, 1.50, 0.165),
    new THREE.BoxGeometry(0.025, 1.28, 0.02).translate(dx + 0.238, 1.50, 0.165),
  ];
  const marcoM = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(mv), MAT.blanco);
  marcoP.add(marcoM);
  const vidrioV = new THREE.Mesh(
    new THREE.PlaneGeometry(0.45, 1.24),
    new THREE.MeshPhysicalMaterial({ color: 0xE8F0F5, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.18, envMapIntensity: 2.2 })
  );
  vidrioV.position.set(dx, 1.50, 0.163);
  marcoP.add(vidrioV);
  // Reflejo fingido: banda diagonal blanca. A esta escala esto ES el vidrio.
  const cvGlare = document.createElement("canvas");
  cvGlare.width = cvGlare.height = 128;
  const cg = cvGlare.getContext("2d");
  const gg = cg.createLinearGradient(0, 128, 128, 0);
  gg.addColorStop(0.18, "rgba(255,255,255,0)");
  gg.addColorStop(0.5, "rgba(255,255,255,0.9)");
  gg.addColorStop(0.82, "rgba(255,255,255,0)");
  cg.fillStyle = gg;
  cg.fillRect(0, 0, 128, 128);
  const glare = new THREE.Mesh(
    new THREE.PlaneGeometry(0.45, 1.24),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cvGlare), transparent: true, opacity: 0.16, depthWrite: false })
  );
  glare.position.set(dx, 1.50, 0.164);
  marcoP.add(glare);
  const manijaV = caja(0.015, 0.12, 0.015, MAT.cromo, 0.003);
  manijaV.position.set(dx + (dx < 0 ? 0.19 : -0.19), 1.46, 0.18);
  marcoP.add(manijaV);
  gVitrina.add(marcoP);
}

// Lavamanos + jabón + dispensador de toallas + caneca.
const gLava = new THREE.Group();
gLava.position.set(1.72, 0, -2.02);
sala.add(gLava);
const pileta = caja(0.52, 0.16, 0.40, MAT.blanco, 0.03);
pileta.position.y = 0.86;
gLava.add(pileta);
const hueco = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.05, 20), std(0xE4E2DC, 0.4));
hueco.position.set(0, 0.90, 0.02);
gLava.add(hueco);
const sifon = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 10), MAT.cromo);
sifon.position.set(0, 0.62, 0);
gLava.add(sifon);
const grifo = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.011, 8, 20, Math.PI * 0.9), MAT.cromo);
grifo.position.set(0, 0.97, -0.13);
grifo.rotation.set(0, Math.PI / 2, 0.35);
gLava.add(grifo);
const jabon = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.11, 10), std(0x7FB89A, 0.5));
jabon.position.set(-0.20, 0.98, -0.10);
jabon.castShadow = true;
gLava.add(jabon);
const toallas = caja(0.26, 0.32, 0.12, MAT.blanco, 0.01);
toallas.position.set(0.02, 1.62, -0.10);
gLava.add(toallas);
const caneca = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.34, 16), MAT.gris);
caneca.position.set(-0.42, 0.17, 0.28);
caneca.castShadow = true;
gLava.add(caneca);

// Negatoscopio en la pared del fondo: caja plateada delgada con panel que
// emite apenas, sobre la zona del escritorio.
const marcoN = caja(0.56, 0.44, 0.03, MAT.cromo, 0.008);
marcoN.position.set(-1.60, 1.86, -2.17);
sala.add(marcoN);
const negatoscopio = new THREE.Mesh(
  new THREE.PlaneGeometry(0.48, 0.36),
  new THREE.MeshStandardMaterial({ color: 0xF2F2EE, roughness: 0.35, emissive: 0xE8E8E2, emissiveIntensity: 0.18 })
);
negatoscopio.position.set(-1.60, 1.86, -2.135);
sala.add(negatoscopio);

const gReloj = new THREE.Group();
gReloj.position.set(-0.95, 2.25, -2.17);
const caraReloj = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 32), MAT.blanco);
caraReloj.rotation.x = Math.PI / 2;
gReloj.add(caraReloj);
const aroReloj = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.008, 8, 32), std(0xD8D2C6, 0.5));
gReloj.add(aroReloj);
// Manecillas dentro de pivotes: el minutero avanza de verdad (no proyectan sombra).
const pivotMin = new THREE.Group();
const aguja1 = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.105, 0.010), std(0x2A2C30, 0.5));
aguja1.position.y = 0.045;
pivotMin.add(aguja1);
pivotMin.position.z = 0.02;
gReloj.add(pivotMin);
const pivotHora = new THREE.Group();
const aguja2 = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.065, 0.010), std(0x2A2C30, 0.5));
aguja2.position.y = 0.03;
pivotHora.add(aguja2);
pivotHora.rotation.z = -1.9;
pivotHora.position.z = 0.02;
gReloj.add(pivotHora);
sala.add(gReloj);

// Optotipo: canvas con letras.
const cvsOpto = document.createElement("canvas");
cvsOpto.width = 512; cvsOpto.height = 768;
const ox = cvsOpto.getContext("2d");
ox.fillStyle = "#FAF8F2"; ox.fillRect(0, 0, 512, 768);
ox.fillStyle = "#141414"; ox.textAlign = "center"; ox.textBaseline = "middle";
const filasOpto = [["E", 180], ["FP", 124], ["TOZ", 88], ["LPED", 64], ["PECFD", 48], ["EDFCZP", 36], ["FELOPZD", 26]];
let oy = 132;
for (const [txt, tam] of filasOpto) {
  ox.font = `700 ${tam}px Georgia, serif`;
  ox.fillText(txt, 256, oy);
  oy += tam * 0.9 + 28;
}
ox.fillStyle = "#C33"; ox.fillRect(104, 704, 140, 14);
ox.fillStyle = "#2A7"; ox.fillRect(268, 704, 140, 14);
const optotipo = new THREE.Mesh(
  new THREE.PlaneGeometry(0.30, 0.45),
  new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cvsOpto), roughness: 0.9 })
);
optotipo.position.set(-1.12, 1.70, -2.185);
sala.add(optotipo);

// Planta de piso (~1.5 m) entre el escritorio y la vitrina, dos verdes.
const gPlanta = new THREE.Group();
gPlanta.position.set(-0.28, 0, -1.80);
const materaP = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.30, 16), MAT.blanco);
materaP.position.y = 0.15;
materaP.castShadow = true;
gPlanta.add(materaP);
const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.026, 0.70, 8), std(0x6E5636, 0.8));
tronco.position.y = 0.55;
tronco.castShadow = true;
gPlanta.add(tronco);
const matHojaA = new THREE.MeshStandardMaterial({
  color: 0x4A7A4E, roughness: 0.8, side: THREE.DoubleSide,
  alphaMap: makeLeafAlpha(128), transparent: true, alphaTest: 0.45,
});
const matHojaB = matHojaA.clone();
matHojaB.color.setHex(0x6B9A5E);
// Ficus: 48 hojas desde media altura, radio decreciente hacia arriba (cono).
for (let i = 0; i < 72; i++) {
  const hoja = new THREE.Mesh(new THREE.PlaneGeometry(0.115, 0.25, 1, 3), i % 3 ? matHojaA : matHojaB);
  const a = (i / 72) * Math.PI * 2 * 7.3;
  const nivel = i % 9;
  const radio = 0.20 - nivel * 0.016;
  hoja.position.set(Math.sin(a) * radio, 0.58 + nivel * 0.098, Math.cos(a) * radio);
  hoja.rotation.set(-0.55 + nivel * 0.11, a, 0.10 + (i % 2) * 0.08);
  hoja.castShadow = true;
  gPlanta.add(hoja);
}
sala.add(gPlanta);

/* ---------------------------- lado izquierdo ---------------------------- */

// Báscula de columna.
const gBascula = new THREE.Group();
gBascula.position.set(-1.86, 0, 0.42);
gBascula.rotation.y = 0.85;
const plataforma = caja(0.40, 0.07, 0.44, MAT.blanco, 0.015);
plataforma.position.y = 0.045;
gBascula.add(plataforma);
const pisa = caja(0.32, 0.02, 0.34, MAT.negro, 0.006);
pisa.position.y = 0.09;
gBascula.add(pisa);
const columnaB = caja(0.10, 1.15, 0.07, MAT.blanco, 0.012);
columnaB.position.set(0, 0.65, -0.16);
gBascula.add(columnaB);
const cabezaB = caja(0.32, 0.16, 0.09, MAT.blanco, 0.018);
cabezaB.position.set(0, 1.28, -0.14);
gBascula.add(cabezaB);
const displayB = new THREE.Mesh(new THREE.PlaneGeometry(0.20, 0.065), std(0x25282C, 0.3));
displayB.position.set(0, 1.28, -0.089);
gBascula.add(displayB);
sala.add(gBascula);

// Dos atriles de suero, uno con bolsa.
function atril(conBolsa) {
  const g = new THREE.Group();
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1.70, 10), MAT.cromo);
  poste.position.y = 0.90;
  poste.castShadow = true;
  g.add(poste);
  for (let i = 0; i < 4; i++) {
    const ganchoA = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 14, Math.PI * 1.2), MAT.cromo);
    const a = (i / 4) * Math.PI * 2;
    ganchoA.position.set(Math.sin(a) * 0.05, 1.74, Math.cos(a) * 0.05);
    ganchoA.rotation.set(Math.PI / 2, 0, a);
    g.add(ganchoA);
  }
  // Base de disco pesada, como los atriles reales de hospital.
  const discoAtril = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.15, 0.025, 24),
    MAT.cromo
  );
  discoAtril.position.y = 0.0125;
  discoAtril.castShadow = true;
  g.add(discoAtril);
  if (conBolsa) {
    const bolsa = caja(0.15, 0.25, 0.05, new THREE.MeshPhysicalMaterial({
      color: 0xF6F8FA, roughness: 0.3, transparent: true, opacity: 0.92,
    }), 0.025);
    bolsa.position.set(0.06, 1.55, 0);
    const ganchoBolsa = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 6), MAT.cromo);
    ganchoBolsa.position.set(0.06, 1.71, 0);
    g.add(ganchoBolsa);
    g.add(bolsa);
    const manguera = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.05, 1.48, 0), new THREE.Vector3(0.09, 1.20, 0.03),
        new THREE.Vector3(0.05, 0.90, 0.05), new THREE.Vector3(0.10, 0.60, 0.02),
      ]), 24, 0.004, 6, false),
      std(0xE8ECEF, 0.4)
    );
    g.add(manguera);
  }
  return g;
}
const atril1 = atril(true);
atril1.position.set(-1.72, 0, -0.62);
sala.add(atril1);
const atril2 = atril(false);
atril2.position.set(-1.88, 0, -1.05);
sala.add(atril2);

/* ------------------------- tensiómetro (pared der.) ------------------------- */

const gTensio = new THREE.Group();
gTensio.position.set(2.96, 1.52, -1.93);
const cuerpoT = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.05, 24), MAT.negro);
cuerpoT.rotation.z = Math.PI / 2;
gTensio.add(cuerpoT);
const caraT = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.052, 24), MAT.blanco);
caraT.rotation.z = Math.PI / 2;
caraT.position.x = -0.002;
gTensio.add(caraT);
const cesta = caja(0.14, 0.12, 0.08, MAT.negro, 0.01);
cesta.position.set(-0.02, -0.28, 0);
gTensio.add(cesta);
const espiral = [];
for (let i = 0; i < 60; i++) {
  const t = i / 59;
  espiral.push(new THREE.Vector3(
    -0.01 - Math.sin(t * Math.PI * 10) * 0.025,
    -0.06 - t * 0.16,
    Math.cos(t * Math.PI * 10) * 0.025
  ));
}
const tubo = new THREE.Mesh(
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(espiral), 80, 0.005, 6, false),
  MAT.negro
);
gTensio.add(tubo);
sala.add(gTensio);

/* ---------------------- luz pintada: parches y rayas ---------------------- */
/* La física ya hace lo suyo; esto es el 10% restante que en la referencia pinta
   el clima: parches cálidos en las paredes, rayas largas barriendo el piso y
   trepando la camilla, y el fantasma del follaje tras el vidrio. Todo aditivo,
   sin sombras, sin costo. */

function texturaResplandor(size = 256) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const c = cv.getContext("2d");
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,205,140,0.9)");
  g.addColorStop(0.55, "rgba(255,205,140,0.35)");
  g.addColorStop(1, "rgba(255,205,140,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(cv);
}
function texturaRayas(size = 256, n = 9) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const c = cv.getContext("2d");
  for (let i = 0; i < n; i++) {
    const y = (i / n) * size;
    const grad = c.createLinearGradient(0, y, 0, y + size / n * 0.5);
    grad.addColorStop(0, "rgba(255,215,160,0)");
    grad.addColorStop(0.5, "rgba(255,215,160,0.85)");
    grad.addColorStop(1, "rgba(255,215,160,0)");
    c.fillStyle = grad;
    c.fillRect(0, y, size, size / n * 0.5);
  }
  return new THREE.CanvasTexture(cv);
}
const matResplandor = (op) => new THREE.MeshBasicMaterial({
  map: texturaResplandor(), transparent: true, opacity: op,
  blending: THREE.AdditiveBlending, depthWrite: false,
});





// Fantasmas de follaje tras el vidrio: profundidad para el exterior.
function texturaFollaje(size = 256, color = "90,106,62") {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const c = cv.getContext("2d");
  const g = c.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${color},0.95)`);
  g.addColorStop(0.6, `rgba(${color},0.6)`);
  g.addColorStop(1, `rgba(${color},0)`);
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(cv);
}
const matFollajeA = new THREE.MeshBasicMaterial({ map: texturaFollaje(256, "84,98,56"), transparent: true, opacity: 0.62, depthWrite: false });
const matFollajeB = new THREE.MeshBasicMaterial({ map: texturaFollaje(256, "116,130,76"), transparent: true, opacity: 0.52, depthWrite: false });
for (const [y, z, s, m, ex] of [
  [1.55, -1.15, 1.6, matFollajeA, 1.5], [1.35, 0.25, 1.4, matFollajeB, 1.6],
  [2.0, -0.45, 1.1, matFollajeB, 1.4], [1.05, -0.7, 1.2, matFollajeA, 1.7],
  [1.8, 0.4, 0.9, matFollajeA, 1.3],
]) {
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(s, s), m);
  blob.rotation.y = -Math.PI / 2;
  blob.scale.set(ex, 1, 1);          // elipses: masas de árbol, no niebla
  blob.position.set(3.40, y, z);
  sala.add(blob);
}

/* ------------------------- polvo dorado en la luz ------------------------- */
/* Motas flotando en la zona donde entra el sol. No proyectan sombra. */

const NMOTAS = 420;
const posMotas = new Float32Array(NMOTAS * 3);
const semillasMotas = new Float32Array(NMOTAS);
const rndMotas = mulberry32(0xDAF7);
for (let i = 0; i < NMOTAS; i++) {
  posMotas[i * 3] = 0.6 + rndMotas() * 2.3;        // cerca de la ventana
  posMotas[i * 3 + 1] = 0.25 + rndMotas() * 2.1;
  posMotas[i * 3 + 2] = -1.7 + rndMotas() * 2.4;
  semillasMotas[i] = rndMotas() * 6.28;
}
const geoMotas = new THREE.BufferGeometry();
geoMotas.setAttribute("position", new THREE.BufferAttribute(posMotas, 3));
const motas = new THREE.Points(
  geoMotas,
  new THREE.PointsMaterial({
    color: 0xFFE8C0, size: 0.014, sizeAttenuation: true,
    map: makeDustAlpha(32), transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })
);
scene.add(motas);

/* --------------------------- sombras de contacto --------------------------- */

const texContacto = makeContactShadow(256);
for (const [x, z, s, op] of [
  [-0.85, 0.10, 2.2, 0.22], [2.15, -0.45, 2.4, 0.25], [0.55, -1.95, 1.3, 0.22],
  [-0.42, 0.86, 1.0, 0.22], [-2.55, -0.70, 0.7, 0.2], [1.38, 0.42, 0.6, 0.2],
  [-0.35, -1.90, 0.5, 0.2],
]) {
  const d = new THREE.Mesh(
    new THREE.PlaneGeometry(s, s),
    new THREE.MeshBasicMaterial({ map: texContacto, transparent: true, opacity: op, depthWrite: false })
  );
  d.rotation.x = -Math.PI / 2;
  d.position.set(x, 0.015, z);
  sala.add(d);
}

/* ---------------------------------- luz ---------------------------------- */

// Hora dorada: sol bajo (~28°), cálido y fuerte, entrando por la ventana
// derecha y rastrillando el piso hacia el centro.
const sol = new THREE.DirectionalLight(0xFFE0B8, 2.9);
sol.position.set(6.5, 6.0, 0.6);
sol.target.position.set(0.5, 0.0, -0.6);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -3.4, right: 3.4, top: 3.0, bottom: -2.6, near: 0.5, far: 18 });
sol.shadow.camera.updateProjectionMatrix();
sol.shadow.radius = 5;
sol.shadow.blurSamples = 16;
sol.shadow.bias = -0.0001;
scene.add(sol, sol.target);

const cieloL = new THREE.HemisphereLight(0xF5EFE4, 0xB8AE9C, 0.80);
scene.add(cieloL);

const rebote = new THREE.PointLight(0xFFE0B8, 0.55, 8, 2);
rebote.position.set(2.0, 1.6, 1.8);
scene.add(rebote);
// La pared de la camilla no recibe sol directo (mira contra él): sin este fill
// queda en chocolate mientras la izquierda brilla.
const fillParedDer = new THREE.DirectionalLight(0xF5EAD8, 1.25);
fillParedDer.position.set(-2.0, 2.2, 1.2);
fillParedDer.target.position.set(3.0, 1.6, -0.5);
scene.add(fillParedDer, fillParedDer.target);
// Baño ámbar interior junto a la ventana: es lo que calienta la pared derecha,
// la camilla y el aire alrededor del vano.
const banoAmbar = new THREE.PointLight(0xFFD9A8, 0.3, 4.5, 2);
banoAmbar.position.set(2.35, 1.7, -0.5);
scene.add(banoAmbar);
// Fill cálido de derecha a izquierda: la miel también toca el escritorio y la
// pared del optotipo, sin aplanar la gradiente térmica.
const fillMiel = new THREE.DirectionalLight(0xFFE0B8, 0.35);
fillMiel.position.set(4.0, 2.2, 1.5);
fillMiel.target.position.set(-2.5, 1.0, -0.5);
scene.add(fillMiel, fillMiel.target);

/* ------------------------- recorrido por scroll ------------------------- */

const MODO_RECORRIDO = !!document.querySelector("[data-acto]");

const bezier = (x1, y1, x2, y2) => (t) => {
  let u = t;
  for (let i = 0; i < 4; i++) {
    const u1 = 1 - u;
    const x = 3 * u1 * u1 * u * x1 + 3 * u1 * u * u * x2 + u ** 3;
    const dx = 3 * u1 * u1 * x1 + 6 * u1 * u * (x2 - x1) + 3 * u * u * (1 - x2);
    if (Math.abs(dx) < 1e-6) break;
    u -= (x - t) / dx;
    u = Math.max(0, Math.min(1, u));
  }
  const u1 = 1 - u;
  return 3 * u1 * u1 * u * y1 + 3 * u1 * u * u * y2 + u ** 3;
};
const easeRevelar = bezier(0.22, 0.61, 0.36, 1.0);
const easeSuccion = bezier(0.65, 0.0, 0.35, 1.0);

/* --------------------------------- cámara --------------------------------- */

const CAM = {
  pos: new THREE.Vector3(-3.35, 4.15, 4.65),
  tgt: new THREE.Vector3(0.32, 0.42, -0.88),
  fov: 33,
};
camera.fov = CAM.fov;
camera.updateProjectionMatrix();

// Riel del recorrido. K3 (el foco sobre Ü) se calcula contra la pantalla real.
// Cada parada encuadra lo que su texto nombra, y deja libre el lado donde
// el texto vive: acto 1 texto a la derecha → puesto de trabajo a la izquierda;
// acto 2 texto a la izquierda → pantalla a la derecha.
const RIEL = [
  { p: 0.00, pos: [-2.45, 3.05, 3.30], tgt: [0.30, 0.46, -0.85], fov: 44, ease: easeRevelar },
  { p: 0.30, pos: [0.95, 2.10, 2.80], tgt: [-0.55, 0.95, -0.35], fov: 40, ease: easeRevelar },
  { p: 0.62, pos: [-1.60, 1.46, 1.30], tgt: [-1.12, 1.16, -0.05], fov: 34, ease: easeSuccion },
  { p: 1.00, pos: null, tgt: null, fov: 27, ease: easeSuccion },   // se resuelve abajo
];

function resolverK3() {
  // Posición y normal de la pantalla del iMac en mundo.
  const centro = new THREE.Vector3();
  pantallaMac.getWorldPosition(centro);
  const normal = new THREE.Vector3(0, 0, 1)
    .applyQuaternion(pantallaMac.getWorldQuaternion(new THREE.Quaternion()));
  const d = 0.47;                      // la carita llena el cuadro sin clipear
  const pos = centro.clone().addScaledVector(normal, d);
  RIEL[3].pos = [pos.x, pos.y, pos.z];
  RIEL[3].tgt = [centro.x, centro.y, centro.z];
}
resolverK3();

/* El recorrido ARRANCA EN LA ESCENA 2, no en el principio del riel.
 * En la reunión: "esta escena no me gusta, podríamos hacer que iniciara desde
 * la siguiente… ahí me parece que tiene mucho más sentido". El primer tramo
 * era un plano general del cuarto que no contaba nada.
 * El riel completo se conserva: sólo se recorre de aquí a 1. */
const P_INICIO = 0.46;
let pTarget = P_INICIO, pPos = P_INICIO;
let qEmpalme = 0;
const elDentro = document.getElementById("dentro");

/* Se declara fuera para que `resize` pueda volver a leerlo: `qEmpalme` depende
 * de innerHeight, y si solo se recalcula con el scroll, redimensionar a mitad
 * del empalme lo deja congelado en el valor de antes — el escritorio a medio
 * escalar sobre el monitor hasta que alguien vuelva a mover la rueda. */
let leerScroll = () => {};
if (MODO_RECORRIDO) {
  leerScroll = () => {
    const fin = elDentro ? elDentro.offsetTop - innerHeight : document.body.scrollHeight - innerHeight;
    const q = fin > 0 ? Math.min(1, Math.max(0, scrollY / fin)) : 0;
    pTarget = P_INICIO + (1 - P_INICIO) * q;
    // Empalme: los 100vh muertos entre el final del riel y el pin de #dentro.
    // Ahí la pantalla del iMac SE CONVIERTE en el escritorio — no hay reveal.
    qEmpalme = elDentro
      ? Math.min(1, Math.max(0, (scrollY - fin) / innerHeight))
      : 0;
  };
  addEventListener("scroll", leerScroll, { passive: true });
  leerScroll();
}

/* ------------------------- encaje a las paradas -------------------------
 * El riel es continuo, pero el TEXTO no: cada bloque de copy vive en una
 * ventana de p (data-desde/data-hasta) y entre ventana y ventana no hay nada
 * que leer. Medido en esta misma página: soltar el scroll entre 200 y 500 px,
 * o entre 1700 y 1950, deja un plano del consultorio sin una sola palabra —
 * y los 100vh del empalme, peor todavía: se queda el escritorio a medio
 * escalar sobre el monitor.
 *
 * Así que cuando el scroll SE PARA, se termina el viaje: hasta la parada más
 * cercana, y si el gesto iba claramente hacia adelante o hacia atrás, hasta
 * la siguiente en esa dirección aunque la de atrás quede más cerca. Un flick
 * corto avanza una escena entera, que es lo que uno espera al empujar.
 *
 * Lo que NO hace, a propósito:
 *  - No toca nada mientras el dedo está encima: solo al pararse (160 ms).
 *  - Se cancela con cualquier gesto nuevo. Nunca se pelea con nadie.
 *  - No pasa de #dentro: la landing de abajo se scrollea como cualquier web.
 */
if (MODO_RECORRIDO && elDentro) {
  const REDUCIDO = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const QUIETO = 160;         // ms sin scroll para dar el gesto por terminado
  const CERCA = 24;           // px: ya está en su sitio, no se toca
  const EMPUJE = 70;          // px: por debajo de esto no cuenta como dirección

  const bloques = [...document.querySelectorAll("#relato .copy[data-desde]")];

  function paradas() {
    const fin = elDentro.offsetTop - innerHeight;
    if (fin <= 0) return [];
    /* De la p a los píxeles, con el MISMO mapeo que leerScroll — si un día
     * cambia P_INICIO, esto cambia con él y no se queda mintiendo. */
    const y = (p) => Math.round(((p - P_INICIO) / (1 - P_INICIO)) * fin);
    const medias = bloques
      .map((b) => (+b.dataset.desde + Math.min(1, +b.dataset.hasta)) / 2)
      .filter((p) => p > P_INICIO)
      .map(y)
      .filter((v) => v > 0 && v < fin);
    // 0 = el hero; el último = el video ya encajado, con el empalme terminado.
    return [0, ...medias, elDentro.offsetTop].sort((a, b) => a - b);
  }

  /* La parada en la que se descansó por última vez. Es lo que hace falta para
   * saber si un gesto SALIÓ de una parada, y no se puede leer del scroll en el
   * momento del gesto: los listeners de `wheel` son pasivos, así que Chrome ya
   * ha movido la página cuando el manejador corre — medido, `scrollY` valía ya
   * 420 dentro del propio manejador. Por eso el punto de partida se recuerda
   * al llegar, no al empujar. */
  let animando = false, quieto = null, ultimaParada = scrollY, iParada = null;

  /* Se guarda la parada Y SU ÍNDICE. El píxel sirve para la regla de
   * dirección; el índice, para sobrevivir a un cambio de tamaño: al girar el
   * teléfono el documento entero cambia de alto y el mismo scroll en píxeles
   * ya no es el mismo sitio — se aterrizaba en la landing sin haber pedido
   * nada. Con el índice se vuelve a la misma parada, medida de nuevo. */
  let anclado = false;                 // ¿seguimos donde nos dejó el encaje?
  function fijar(y) {
    ultimaParada = y;
    const P = paradas();
    const i = P.findIndex((p) => Math.abs(p - y) <= CERCA);
    iParada = i >= 0 ? i : null;
    anclado = iParada != null;
  }
  fijar(scrollY);

  addEventListener("resize", () => {
    // Solo si nadie se ha movido desde la última parada: si la persona ya se
    // fue a la landing, girar el teléfono no puede devolverla al video.
    if (!anclado || iParada == null) return;
    const P = paradas();
    if (!P.length || P[iParada] == null) return;
    animando = false;
    scrollTo(0, P[iParada]);
    ultimaParada = P[iParada];
  });

  function irA(destino) {
    const y0 = scrollY, d = destino - y0;
    // Un par de píxeles no merecen animación, pero sí hay que ponerlos: es la
    // diferencia entre el empalme terminado y el empalme al 99,7 %.
    if (Math.abs(d) < 2) { scrollTo(0, destino); fijar(destino); return; }
    if (REDUCIDO) { scrollTo(0, destino); fijar(destino); return; }
    // 380–760 ms según lo lejos que esté: cerca, un ajuste; lejos, un viaje.
    const dur = Math.min(760, Math.max(380, Math.abs(d) * 0.62));
    const t0 = performance.now();
    animando = true;
    const paso = (t) => {
      if (!animando) return;
      const k = Math.min(1, (t - t0) / dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      scrollTo(0, Math.round(y0 + d * e));
      if (k < 1) requestAnimationFrame(paso);
      else { animando = false; fijar(destino); }
    };
    requestAnimationFrame(paso);
  }

  // Cualquier gesto cancela el encaje en marcha. Nunca se pelea con nadie.
  const cancelar = () => { animando = false; anclado = false; };
  for (const ev of ["wheel", "touchstart", "pointerdown", "keydown"])
    addEventListener(ev, cancelar, { passive: true });

  /* Con el dedo apoyado no se encaja. `cancelar` corta el encaje que ya está
   * en marcha, pero un arrastre lento no dispara `touchstart` de nuevo: basta
   * con parar el dedo 160 ms —sin levantarlo— para que `alPararse` mueva la
   * página debajo. Medido: 885 px, más de una pantalla, con el dedo puesto; y
   * al soltar, los píxeles que se siguieron arrastrando se leían como un
   * empujón nuevo y saltaban otra escena de más.
   *
   * El comentario de arriba prometía justo esto ("no toca nada mientras el
   * dedo está encima") y no estaba implementado. */
  let dedoAbajo = false;
  const soltarDedo = () => {
    if (!dedoAbajo) return;
    dedoAbajo = false;
    // Al soltar empieza a contar el reposo, no antes.
    clearTimeout(quieto);
    quieto = setTimeout(alPararse, QUIETO);
  };
  /* El dedo se sigue con eventos TÁCTILES, no con los de puntero: en cuanto el
   * navegador decide que el gesto es un scroll, dispara `pointercancel` sobre
   * ese puntero aunque el dedo siga puesto. Escuchándolo ahí, el dedo se daba
   * por levantado a los pocos píxeles y volvía el tirón. */
  addEventListener("touchstart", () => { dedoAbajo = true; }, { passive: true });
  for (const ev of ["touchend", "touchcancel"])
    addEventListener(ev, (e) => { if (!e.touches || e.touches.length === 0) soltarDedo(); }, { passive: true });
  // Ratón y lápiz: arrastrar la barra de scroll es el caso análogo.
  addEventListener("pointerdown", (e) => { if (e.pointerType !== "touch") dedoAbajo = true; }, { passive: true });
  for (const ev of ["pointerup", "pointercancel"])
    addEventListener(ev, (e) => { if (e.pointerType !== "touch") soltarDedo(); }, { passive: true });

  function alPararse() {
    if (animando || dedoAbajo) return;
    const P = paradas();
    if (!P.length) return;
    const y = scrollY;
    /* Pasado el pin del video ya no hay riel que encajar: manda el scroll.
     *
     * El margen era `innerHeight * 0.12` —108 px en una pantalla de 900— y un
     * notch de rueda de Chrome son ~100: quien bajaba UN notch y se paraba veía
     * cómo la página se devolvía sola al video, y otro notch hacía lo mismo.
     * Quedaba encerrado. Aquí no hace falta margen ninguno: por debajo, la
     * regla de la última parada ya obliga a aterrizar exacto. */
    if (y > elDentro.offsetTop + 2) return;
    if (document.hidden) return;

    let cerca = P[0];
    for (const p of P) if (Math.abs(p - y) < Math.abs(cerca - y)) cerca = p;

    /* Dirección. Solo se aplica cuando la parada más cercana ES aquella de la
     * que se venía: devolver a alguien al sitio del que acaba de salir es lo
     * contrario de lo que pidió al empujar, así que en ese caso se sigue a la
     * siguiente. Si ya se alejó lo bastante como para tener otra más cerca,
     * manda la cercanía — si no, medio empalme de scroll te echaba una parada
     * entera hacia atrás, que es peor que no encajar nada. */
    const avance = y - ultimaParada;
    if (Math.abs(avance) > EMPUJE && Math.abs(cerca - ultimaParada) <= CERCA) {
      const adelante = avance > 0;
      const sig = adelante ? P.find((p) => p > ultimaParada + CERCA)
                           : [...P].reverse().find((p) => p < ultimaParada - CERCA);
      if (sig != null) cerca = sig;
    }
    /* En la última parada —el video ya encajado— no vale "casi". Quedarse 20 px
     * antes es invisible (la escala va en 1.0003), pero el empalme sigue
     * técnicamente a medias: `tapado` no se activa y el 3D con su post-proceso
     * sigue dibujando a 60 fps detrás de un canvas invisible mientras se
     * decodifica el MP4. Medido: 3600 frames en 2 s ahí, contra 0 ya encajado. */
    const exacto = cerca === P[P.length - 1];
    if (Math.abs(cerca - y) > (exacto ? 0 : CERCA)) irA(cerca);
    else fijar(cerca);                                // ya estaba en su sitio
  }

  /* Las flechas mueven ~40 px, menos que EMPUJE, así que el encaje las leía
   * como "no te has movido" y devolvía a la parada: pulsar ↓ tres veces dejaba
   * la página exactamente donde estaba. Con teclado la sección era una pared.
   * Aquí la flecha deja de competir con el scroll nativo y pasa a ser lo mismo
   * que un empujón: una parada, en la dirección que se pide. */
  addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    const t = e.target;
    /* Solo se aparta donde la flecha YA significa algo: la barra de avance
     * busca en el video, y los campos y menús se manejan con flechas. Apartarse
     * de `#dentro` entero era demasiado: con el foco en el botón de play —donde
     * queda después de pulsarlo— la flecha volvía a no hacer nada. */
    if (t && t.closest && t.closest("input, textarea, select, dialog, video, [role=slider]")) return;
    if (t && t.isContentEditable) return;
    const P = paradas();
    if (!P.length) return;
    const y = scrollY;
    if (y > elDentro.offsetTop + innerHeight * 0.12) return;
    const abajo = e.key === "ArrowDown";
    const destino = abajo ? P.find((p) => p > y + CERCA)
                          : [...P].reverse().find((p) => p < y - CERCA);
    if (destino == null) return;                 // en los extremos, scroll normal
    e.preventDefault();
    irA(destino);
  }, { passive: false });

  addEventListener("scroll", () => {
    if (animando) return;
    clearTimeout(quieto);
    quieto = setTimeout(alPararse, QUIETO);
  }, { passive: true });

  window.__encaje = {
    paradas, irA, alPararse,
    // Para verificar desde fuera POR QUÉ encajó donde encajó, no solo dónde.
    estado: () => ({ ultimaParada, animando, y: scrollY }),
  };
}

/* ------------------------------- el empalme -------------------------------
 * La pantalla del iMac y el escritorio DOM son el mismo plano: proyectamos las
 * cuatro esquinas de la malla a coordenadas de viewport y encajamos el #dentro
 * sobre ese rectángulo. Con q el encaje se relaja hasta la identidad, así que
 * el corte es un solo movimiento continuo en vez de una sección que sube.
 */
const elSticky = document.querySelector("#dentro .d-sticky");
const elRelato = document.getElementById("relato");
const elHud = document.getElementById("hud");
const hudPct = document.getElementById("pct");
const hudBar = document.querySelector("#bar i");
let tapado = false;          // el video cubre el 3D: no hay nada que dibujar
const easeEmpalme = bezier(0.34, 0.0, 0.16, 1.0);
const _esq = new THREE.Vector3();
const _fwd = new THREE.Vector3();
let empalmeActivo = false;

function rectPantalla() {
  const bb = pantallaMac.geometry.boundingBox
    || (pantallaMac.geometry.computeBoundingBox(), pantallaMac.geometry.boundingBox);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const sx of [bb.min.x, bb.max.x]) {
    for (const sy of [bb.min.y, bb.max.y]) {
      camera.updateMatrixWorld(true);   // la cámara se movió después del lookAt
      _esq.set(sx, sy, 0);
      pantallaMac.localToWorld(_esq);
      _esq.project(camera);
      const x = (_esq.x * 0.5 + 0.5) * innerWidth;
      const y = (-_esq.y * 0.5 + 0.5) * innerHeight;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/* El rectángulo de la pantalla del video SIN transformar. Medirlo con el
 * sticky ya escalado daría el de después, así que se quita la transformación,
 * se mide y se restaura — pero una sola vez por tamaño de ventana, no en cada
 * frame: la caja solo depende del viewport, y forzar reflow a 60 fps dentro
 * del empalme es exactamente donde no hay presupuesto.
 * Sin `.v-pantalla` (modo render) el destino es el viewport, como antes. */
let _base = null;
function baseVideo() {
  const el = document.getElementById("v-pantalla");
  if (!el) return { x: 0, y: 0, w: innerWidth, h: innerHeight };
  /* `offsetWidth` es medida de LAYOUT: el transform no la toca. Sirve de llave
   * de la caché, y así vale también cuando la caja cambia sin que haya habido
   * un `resize` — por ejemplo si la cabecera pasa a dos filas y `--marca-h`
   * cambia el hueco de arriba. */
  if (_base && _base.k === el.offsetWidth) return _base;
  const antes = elSticky.style.transform;
  elSticky.style.transform = "none";
  const r = el.getBoundingClientRect();
  elSticky.style.transform = antes;
  if (!r.width || !r.height) return { x: 0, y: 0, w: innerWidth, h: innerHeight };
  return (_base = { x: r.x, y: r.y, w: r.width, h: r.height, k: el.offsetWidth });
}

function aplicarEmpalme(q) {
  if (!elSticky || !elDentro) return;
  const activo = q > 0.0005 && q < 0.999;

  if (activo !== empalmeActivo) {
    empalmeActivo = activo;
    elDentro.classList.toggle("empalmando", activo);
    if (!activo) {
      elSticky.style.transform = "";
      elSticky.style.opacity = "";
      elSticky.style.removeProperty("--mueble");
      // el relato lo decide la rama de abajo, según de qué lado se salió
    }
  }
  if (!activo) {
    /* El copy del riel se apaga mientras el video manda. Su ventana llega a
     * 1.01, así que a q=1 seguía "encendido" detrás del escenario. Con el
     * escenario opaco no se notaba; desde que se desvanece al salir hacia la
     * landing, reaparecía "Aprende como tú trabajas." cruzado con la fila de
     * controles del reproductor. */
    if (elRelato) elRelato.style.opacity = q >= 0.999 ? "0" : "";
    /* Tapado del todo = no se dibuja. Con `opacity:0` el canvas seguía
     * compositándose y el bucle seguía llamando a composer.render() a 60 fps
     * detrás del video: medidos 182 frames en 1.5 s con la escena invisible,
     * decodificando el MP4 al mismo tiempo. En un portátil es batería y en un
     * teléfono es jank. `display:none` además saca la capa del compositor. */
    tapado = q >= 0.999;
    canvas.style.opacity = tapado ? "0" : "1";
    canvas.style.display = tapado ? "none" : "";
    // El HUD del riel ("93 · recorrido") es del 3D: dentro del video no mide
    // nada y encima caía justo sobre los controles del reproductor.
    if (elHud) elHud.style.opacity = tapado ? "0" : "1";
    return;
  }
  if (tapado) { tapado = false; canvas.style.display = ""; }

  const r = rectPantalla();
  /* Lo que tiene que encajar sobre la pantalla del iMac es la pantalla del
   * VIDEO, no el viewport entero. Antes coincidían —el escritorio ocupaba la
   * pantalla completa— y bastaba con escalar el sticky hasta la identidad.
   * Ahora el video vive dentro de un monitor, más pequeño y centrado, así que
   * hay que resolver la transformación que lleva ESE rectángulo hasta el del
   * iMac. Con origen en el centro del sticky (50% 50%), un punto p va a
   *     C + s·(p − C) + T,   C = centro del viewport
   * y pidiendo que el centro de la pantalla del video caiga en el de la del
   * iMac sale la traslación de abajo. En q=1 da s=1 y T=0: identidad, sin
   * salto, igual que antes. */
  const b = baseVideo();
  const s0 = Math.min(r.w / b.w, r.h / b.h);
  const cx = innerWidth / 2, cy = innerHeight / 2;
  const tx0 = (r.x + r.w / 2) - cx - s0 * ((b.x + b.w / 2) - cx);
  const ty0 = (r.y + r.h / 2) - cy - s0 * ((b.y + b.h / 2) - cy);
  const e = easeEmpalme(q);
  const k = 1 - e;

  elSticky.style.transform =
    `translate3d(${(tx0 * k).toFixed(2)}px, ${(ty0 * k).toFixed(2)}px, 0) ` +
    `scale(${(1 + (s0 - 1) * k).toFixed(4)})`;

  // El corte en dos tiempos. Cruzar las dos imágenes a la vez se veía sucio:
  // la app del HIS y el escritorio son dibujos distintos y se transparentaban
  // uno sobre otro. Así que primero el AZUL del escritorio cubre la pantalla
  // —es el mismo azul que ya está en el monitor, así que no se percibe corte—
  // y solo después aparecen encima los muebles del escritorio.
  const paso = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));

  elSticky.style.opacity = paso(q, 0.04, 0.26).toFixed(3);          // el azul entra
  elSticky.style.setProperty("--mueble", paso(q, 0.30, 0.64).toFixed(3)); // y luego lo de encima
  canvas.style.opacity = (1 - paso(q, 0.08, 0.34)).toFixed(3);      // el 3D se apaga tapado
  if (elRelato) elRelato.style.opacity = (1 - paso(q, 0, 0.06)).toFixed(3);
  const vin = document.getElementById("vineta");
  if (vin) vin.style.opacity = (0.85 * (1 - paso(q, 0, 0.12))).toFixed(3);
  if (elHud) elHud.style.opacity = (1 - paso(q, 0, 0.15)).toFixed(3);
}

function muestrearRiel(p, out) {
  let i = 0;
  while (i < RIEL.length - 2 && p > RIEL[i + 1].p) i++;
  const a = RIEL[i], b = RIEL[i + 1];
  const t = b.ease(Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p))));
  out.pos.set(
    a.pos[0] + (b.pos[0] - a.pos[0]) * t,
    a.pos[1] + (b.pos[1] - a.pos[1]) * t,
    a.pos[2] + (b.pos[2] - a.pos[2]) * t
  );
  out.tgt.set(
    a.tgt[0] + (b.tgt[0] - a.tgt[0]) * t,
    a.tgt[1] + (b.tgt[1] - a.tgt[1]) * t,
    a.tgt[2] + (b.tgt[2] - a.tgt[2]) * t
  );
  out.fov = a.fov + (b.fov - a.fov) * t;
}
const rielOut = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), fov: 44 };

/* ------------------------------ postproceso ------------------------------ */

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.16, 0.85, 0.96));
composer.addPass(new OutputPass());

/* ---------------------------------- loop ---------------------------------- */

let ultimoRepintado = 0;
let framesSombra = 0;
let ultimoActo = -2;
const bloquesRelato = [...document.querySelectorAll("[data-acto]")];

// Paralaje de mouse: objetivo y suavizado con tau 220 ms.
const mouseNDC = { x: 0, y: 0 };
const paralaje = { x: 0, y: 0 };
if (matchMedia("(pointer: fine)").matches) {
  addEventListener("pointermove", (e) => {
    mouseNDC.x = (e.clientX / innerWidth) * 2 - 1;
    mouseNDC.y = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
}

let tPrev = performance.now();

function frame(now) {
  const t = now / 1000;
  const dt = Math.min((now - tPrev) / 1000, 0.05);
  tPrev = now;

  // Hornear la sombra en el frame 2 (tras el primer render completo).
  if (++framesSombra === 2) renderer.shadowMap.needsUpdate = true;

  if (MODO_RECORRIDO) {
    pPos += (pTarget - pPos) * (REDUCED ? 1 : 1 - Math.exp(-dt / 0.085));
    muestrearRiel(pPos, rielOut);
    camera.position.copy(rielOut.pos);
    // La respiración y el paralaje se extinguen al acercarse a Ü: adentro,
    // la cámara no tiene cuerpo.
    const vida = 1 - Math.min(1, Math.max(0, (pPos - 0.70) / 0.18));
    if (!REDUCED) {
      const k = 1 - Math.exp(-dt / 0.22);
      paralaje.x += (mouseNDC.x * 0.035 - paralaje.x) * k;
      paralaje.y += (-mouseNDC.y * 0.022 - paralaje.y) * k;
      if (vida > 0) {
        camera.position.x += (Math.sin(t * 0.27) * 0.010 + paralaje.x) * vida;
        camera.position.y += (Math.sin(t * 0.21 + 1.1) * 0.007 + paralaje.y) * vida;
      }
    }
    camera.lookAt(rielOut.tgt);
    // Durante el empalme la cámara sigue entrando en la pantalla: si se
    // congelara, el DOM creciendo encima se leería como dos movimientos.
    if (qEmpalme > 0) {
      _fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
      camera.position.addScaledVector(_fwd, qEmpalme * 0.085);
    }
    const fovAdaptado = fovParaAspect(rielOut.fov, camera.aspect);
    if (Math.abs(camera.fov - fovAdaptado) > 0.01) {
      camera.fov = fovAdaptado;
      camera.updateProjectionMatrix();
    }
    // Foco sobre Ü: viñeta CSS + sincronía de los bloques de copy.
    const vineta = document.getElementById("vineta");
    if (vineta) vineta.style.opacity = (Math.max(0, (pPos - 0.62) / 0.38) * 0.85).toFixed(3);

    // El hero fijo se desvanece con el primer scroll — no viaja con la página.
    const heroFijo = document.getElementById("hero-fijo");
    if (heroFijo) {
      /* Contra el avance del SCROLL, no contra p.
       * Desde que el riel arranca en P_INICIO (it. de la escena 2), pPos vale
       * 0.46 en el primer frame: `1 - pPos/0.06` daba -6.7, o sea que el hero
       * nacía invisible y la primera pantalla salía sin una sola palabra.
       * Normalizando el avance, el hero vuelve a estar entero al principio y
       * se va en el mismo tramo de scroll de siempre. */
      const avance = (pPos - P_INICIO) / (1 - P_INICIO);
      const op = Math.max(0, 1 - avance / 0.06);
      heroFijo.style.opacity = op.toFixed(3);
      heroFijo.style.visibility = op <= 0.01 ? "hidden" : "visible";
    }

    // Cada bloque declara su ventana del riel (data-desde/data-hasta): el texto
    // aparece exactamente donde la cámara ya encuadró lo que el texto nombra.
    let activo = -1;
    for (let i = 0; i < bloquesRelato.length; i++) {
      const b = bloquesRelato[i];
      if (pPos >= +b.dataset.desde && pPos < +b.dataset.hasta) { activo = i; break; }
    }
    if (activo !== ultimoActo) {
      bloquesRelato.forEach((b, i) => b.setAttribute("data-on", i === activo ? "1" : "0"));
      ultimoActo = activo;

      // El gradiente entra por el lado donde está el texto.
      const grad = document.getElementById("lateral-grad");
      if (grad) {
        grad.classList.remove("izq", "der", "on");
        const b = bloquesRelato[activo];
        if (b) grad.classList.add(b.classList.contains("der") ? "der" : "izq", "on");
      }
    }
    /* El avance, normalizado. `pPos` arranca en P_INICIO (0.46) porque el riel
     * se recorre solo de ahí a 1, así que el crudo marcaba "46 · recorrido" y
     * la barra medio llena en lo más alto de la página. Se mide lo que se
     * recorre, no dónde cae en un riel del que la mitad no se usa.
     * Los dos nodos se buscan UNA vez: esto corre en cada frame. */
    if (hudPct) {
      const av = Math.round(Math.min(1, Math.max(0, (pPos - P_INICIO) / (1 - P_INICIO))) * 100);
      hudPct.textContent = String(av).padStart(2, "0");
      if (hudBar) hudBar.style.width = av + "%";
    }

    aplicarEmpalme(qEmpalme);
  } else {
    camera.position.copy(CAM.pos);
    if (!REDUCED) {
      camera.position.x += Math.sin(t * 0.27) * 0.010;
      camera.position.y += Math.sin(t * 0.21 + 1.1) * 0.007;
      const k = 1 - Math.exp(-dt / 0.22);
      paralaje.x += (mouseNDC.x * 0.035 - paralaje.x) * k;
      paralaje.y += (-mouseNDC.y * 0.022 - paralaje.y) * k;
      camera.position.x += paralaje.x;
      camera.position.y += paralaje.y;
    }
    camera.lookAt(CAM.tgt);
  }

  /* Con el video encima no se dibuja NADA de aquí abajo. Saltarse solo el
   * `composer.render()` no bastaba: el canvas de la pantalla del HIS se seguía
   * repintando a 8 Hz y las 420 motas se seguían moviendo a 60 fps, todo para
   * una escena en `display:none`. El estado que sí importa (riel, empalme,
   * copy) ya se actualizó más arriba. */
  if (tapado) { requestAnimationFrame(frame); return; }

  // El minutero da una vuelta cada 60 s de reloj real (acelerado, se nota vivo).
  pivotMin.rotation.z = -(t / 60) * Math.PI * 2;

  // Motas: deriva lenta hacia arriba con vaivén.
  if (!REDUCED) {
    const arr = geoMotas.attributes.position.array;
    for (let i = 0; i < NMOTAS; i++) {
      arr[i * 3] += Math.sin(t * 0.15 + semillasMotas[i]) * 0.00012;
      arr[i * 3 + 1] += 0.00018;
      if (arr[i * 3 + 1] > 2.5) arr[i * 3 + 1] = 0.25;
    }
    geoMotas.attributes.position.needsUpdate = true;
  }

  /* La pantalla del HIS se repinta con cuentagotas: en el parpadeo de Ü, en el
   * primer frame, y mientras el formulario se escribe — ahí a 8 subidas/s como
   * mucho. `composer.render` cuesta 0.85 ms; el cuello era este canvas de
   * 1100×660 subiendo a GPU en cada frame. A 8 Hz son ~5 MB/s y ni se siente. */
  tPantalla = t;
  const escribiendo = !REDUCED && now - ultimoRepintado > 125;

  const parpadeando = iniBlink >= 0 || now > proxBlink || iniMirada >= 0 || now > proxMirada || ultimoRepintado === 0;
  if ((parpadeando || escribiendo) && now - ultimoRepintado > 40) {
    pintarPantalla(now);
    texPantalla.needsUpdate = true;
    ultimoRepintado = now;
  }

  if (!tapado) composer.render();
  requestAnimationFrame(frame);
}

/* Adaptación a pantallas verticales.
 *
 * Dos caminos ya probados y descartados:
 *  - Abrir el lente hasta conservar el ancho de desktop pide ~114° en un
 *    teléfono: deforma la perspectiva y deja ver por encima de las paredes,
 *    que no tienen techo.
 *  - Alejar la cámara para compensar la saca del cuarto: la sala mide
 *    6.0 × 4.4 × 3.0 y la cámara terminaba atravesando la pared.
 *
 * En un interior pequeño no se puede conservar el encuadre horizontal de
 * desktop. Lo correcto es asumir que en vertical se ve MENOS de ancho —como
 * hace cualquier sitio responsive— y abrir el lente solo lo justo para que el
 * plano no quede asfixiado.
 */
const FOV_TOPE_VERTICAL = 55;

function fovParaAspect(fovV, aspect) {
  if (aspect >= 1.2) return fovV;
  // Interpola entre el fov de desktop y el tope según lo angosto que sea.
  const k = Math.min(1, (1.2 - aspect) / 0.75);
  return Math.min(FOV_TOPE_VERTICAL, fovV + (FOV_TOPE_VERTICAL - fovV) * k);
}

function resize() {
  camera.aspect = innerWidth / innerHeight;
  if (!MODO_RECORRIDO) camera.fov = fovParaAspect(CAM.fov, camera.aspect);
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  /* La caja del video cambia de sitio aunque no cambie de ancho: en pantallas
   * estrechas el ancho lo fija `100%`, así que la llave de la caché (el
   * offsetWidth) no se entera de que la barra de URL del móvil movió la `y`
   * 27 px. A mitad del empalme eso aterriza el escritorio descuadrado. */
  _base = null;
  /* El riel y el empalme se miden contra innerHeight: sin releerlos aquí,
   * redimensionar (o girar el teléfono) a mitad del empalme lo deja clavado
   * en el valor de antes hasta el siguiente scroll. Medido: q se quedaba en
   * 0.5 cuando ya tocaba 1. */
  leerScroll();
}
addEventListener("resize", resize);
resize();

requestAnimationFrame(frame);
document.getElementById("loading")?.classList.add("done");

window.__u = {
  build: "empalme-1",
  empalme: () => qEmpalme,
  scene, camera, CAM, sol, renderer, composer,
  recorrido: MODO_RECORRIDO ? { irA: (v) => { pTarget = v; pPos = v; }, p: () => pPos } : null,
  encuadre: (px, py, pz, tx, ty, tz, fov) => {
    CAM.pos.set(px, py, pz);
    CAM.tgt.set(tx, ty, tz);
    if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  },
};
