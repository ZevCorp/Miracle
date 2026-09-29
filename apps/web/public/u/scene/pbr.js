/**
 * Calidad PBR real: texturas e iluminación de imagen.
 *
 * Se acabó la restricción de "cero assets": este módulo trae texturas CC0 de
 * Poly Haven (dominio público, servidas con CORS desde su CDN) y un HDRI de
 * interior para que los metales, el clearcoat y los suelos reflejen un entorno
 * real en vez de un cuarto sintético.
 *
 * Todo con degradación elegante: si una textura falla (red, 404), el material
 * conserva su versión procedural. La escena nunca se rompe por el CDN.
 */

import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

const CDN_TEX = "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/";
const CDN_HDRI = "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/";

const cargadorTex = new THREE.TextureLoader();
cargadorTex.setCrossOrigin("anonymous");

/** Carga una textura; resuelve null si falla (nunca rechaza). */
function tex(ruta, { srgb = false, repeat = [1, 1] } = {}) {
  return new Promise((resolve) => {
    cargadorTex.load(
      CDN_TEX + ruta,
      (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repeat[0], repeat[1]);
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        resolve(t);
      },
      undefined,
      () => resolve(null)
    );
  });
}

/**
 * Aplica el paquete PBR a los materiales existentes de la escena.
 * @returns {Promise<{ok: string[], fallidos: string[]}>} reporte de qué cargó.
 */
export async function aplicarPBR(MAT, scene, renderer) {
  const ok = [], fallidos = [];

  /* ------------------------------ HDRI ------------------------------ */
  // lebombo: interior cálido con ventanas — reflejos creíbles para cromo,
  // clearcoat y el mármol del piso.
  await new Promise((resolve) => {
    new RGBELoader().load(
      CDN_HDRI + "lebombo_1k.hdr",
      (hdr) => {
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromEquirectangular(hdr).texture;
        scene.environmentIntensity = 0.70;
        hdr.dispose();
        pmrem.dispose();
        ok.push("hdri");
        resolve();
      },
      undefined,
      () => { fallidos.push("hdri"); resolve(); }
    );
  });

  /* ---------------------------- texturas ---------------------------- */

  const [
    robleDiff, robleNor, robleRough,
    paredDiff, paredNor,
    pisoDiff,
    cueroDiff, cueroNor,
  ] = await Promise.all([
    tex("oak_veneer_01/oak_veneer_01_diff_1k.jpg", { srgb: true, repeat: [1.4, 0.8] }),
    tex("oak_veneer_01/oak_veneer_01_nor_gl_1k.jpg", { repeat: [1.4, 0.8] }),
    tex("oak_veneer_01/oak_veneer_01_rough_1k.jpg", { repeat: [1.4, 0.8] }),
    tex("beige_wall_001/beige_wall_001_diff_1k.jpg", { srgb: true, repeat: [3.2, 1.8] }),
    tex("beige_wall_001/beige_wall_001_nor_gl_1k.jpg", { repeat: [3.2, 1.8] }),
    tex("marble_01/marble_01_diff_1k.jpg", { srgb: true, repeat: [1.4, 1.0] }),
    tex("leather_white/leather_white_diff_1k.jpg", { srgb: true, repeat: [1.15, 1.15] }),
    tex("leather_white/leather_white_nor_gl_1k.jpg", { repeat: [1.15, 1.15] }),
  ]);

  // Madera del escritorio: roble real con su normal y su rugosidad.
  if (robleDiff) {
    MAT.madera.map = robleDiff;
    MAT.madera.color.setHex(0xC4A981);           // tinte cálido sobre el roble
    if (robleNor) { MAT.madera.normalMap = robleNor; MAT.madera.normalScale.set(0.6, 0.6); }
    if (robleRough) { MAT.madera.roughnessMap = robleRough; MAT.madera.roughness = 1.0; }
    MAT.madera.needsUpdate = true;
    ok.push("roble");
  } else fallidos.push("roble");

  // Paredes: yeso beige con relieve fino — mata el plano de color liso.
  if (paredDiff) {
    MAT.pared.map = paredDiff;
    MAT.pared.color.setHex(0xE9E2D5);
    if (paredNor) { MAT.pared.normalMap = paredNor; MAT.pared.normalScale.set(0.35, 0.35); }
    MAT.pared.needsUpdate = true;
    ok.push("pared");
  } else fallidos.push("pared");

  // Piso: mármol crema pulido con reflejo del HDRI.
  if (pisoDiff) {
    MAT.piso.map = pisoDiff;
    MAT.piso.color.setHex(0xF0E8D8);
    MAT.piso.roughness = 0.22;
    MAT.piso.roughnessMap = null;
    MAT.piso.envMapIntensity = 1.0;
    MAT.piso.needsUpdate = true;
    ok.push("piso");
  } else fallidos.push("piso");

  // Camilla y silla: cuero blanco tintado de menta, con su grano real.
  if (cueroDiff) {
    MAT.menta.map = cueroDiff;
    MAT.menta.color.setHex(0xCBE2D2);
    if (cueroNor) { MAT.menta.normalMap = cueroNor; MAT.menta.normalScale.set(0.35, 0.35); }
    MAT.menta.roughness = 0.65;
    MAT.menta.needsUpdate = true;
    ok.push("cuero");
  } else fallidos.push("cuero");

  // Blancos a marfil con reflejo tenue del HDRI — el blanco puro flota.
  for (const m of [MAT.blanco, MAT.crema]) {
    if (!m) continue;
    m.color.setHex(0xF4F1EA);
    m.roughness = 0.45;
    m.envMapIntensity = 0.6;
    m.needsUpdate = true;
  }

  // Los metales no necesitan textura: con el HDRI real ya reflejan un interior.
  for (const m of [MAT.cromo, MAT.metal, MAT.negro]) {
    if (!m) continue;
    m.envMapIntensity = 1.25;
    m.needsUpdate = true;
  }

  return { ok, fallidos };
}
