/**
 * El dibujo del orbe de Miracle, compartido por BrandMark (símbolo pequeño) y
 * BrandSphere (logo grande). Vive aparte para que exista UNA sola definición
 * del orbe: cuando se retoca un color, se retoca en un lugar.
 *
 * Sistema de coordenadas: viewBox 0 0 100 100, orbe centrado en (50,50) con
 * radio 38. Los 12 puntos que sobran hasta el borde son el sitio del halo —
 * por eso los tamaños de llamada son mayores que los del símbolo anterior.
 *
 * Lo que hace que se lea como burbuja de luz y no como bola de billar:
 *  1. El núcleo cian que se hunde a azul profundo abajo-derecha.
 *  2. El ARO: un trazo blanco nítido más su bloom desenfocado, que derrama
 *     luz hacia adentro y hacia afuera. Es el rasgo más característico del
 *     logo original y lo único que no se puede insinuar.
 *  3. El halo ambiental, ancho y muriendo en transparente.
 */
export function OrbArt({
  id,
  size,
  glow = true,
  haloRadius = 50,
}: {
  /** Prefijo de los ids de <defs>: dos orbes en la misma página no pueden
   *  compartir gradientes o el segundo hereda los del primero. */
  id: string;
  /** Tamaño real de render, en px. Solo se usa para que el aro no se
   *  desvanezca: un trazo de 0.9 unidades mide 0.18px a 20px de caja. */
  size: number;
  /** Halo ambiental. Se apaga sobre fondos muy cargados. */
  glow?: boolean;
  /**
   * Hasta dónde llega el halo, en unidades del viewBox. El símbolo de interfaz
   * lo mantiene corto (50 = 1.3 radios) para no comerse el espacio de la
   * cabecera; la esfera grande lo abre a 70 (1.8 radios) porque ahí el halo
   * ancho ES la marca — es lo primero que se reconoce del logo original.
   */
  haloRadius?: number;
}) {
  // El aro conserva ~0.8px ópticos por debajo de 110px, y a partir de ahí
  // crece proporcional como cualquier otro detalle del dibujo.
  const aro = Math.max(0.75, 70 / size);
  const bloom = aro * 1.7;
  // Dónde cae el filo del orbe dentro del halo, y cuánto queda para la cola.
  const borde = (38 / haloRadius) * 100;
  const resto = 100 - borde;

  return (
    <>
      <defs>
        {/* Núcleo: cian encendido arriba-izquierda, azul profundo abajo-derecha.
            El azul manda; en el original el orbe no es celeste lavado. */}
        <radialGradient id={`${id}-core`} cx="44%" cy="40%" r="72%">
          <stop offset="0%" stopColor="#6ad9fd" />
          <stop offset="34%" stopColor="#42ccfd" />
          <stop offset="62%" stopColor="#1cb4f4" />
          <stop offset="86%" stopColor="#039ceb" />
          <stop offset="100%" stopColor="#0f9ae6" />
        </radialGradient>
        {/* Luz de borde: solo el último tramo. El orbe se ACLARA en el filo. */}
        <radialGradient id={`${id}-rim`} cx="50%" cy="50%" r="50%">
          <stop offset="80%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="92%" stopColor="#cfeeff" stopOpacity="0.34" />
          <stop offset="99%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
        </radialGradient>
        {/* El filo no arde parejo: enciende arriba-izquierda y se apaga
            abajo-derecha, igual que el original. */}
        <radialGradient id={`${id}-arc`} cx="26%" cy="20%" r="96%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.82" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.35" />
        </radialGradient>
        {/* Halo ambiental. */}
        <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a6e4ff" stopOpacity="0.45" />
          <stop offset={`${borde}%`} stopColor="#96dfff" stopOpacity="0.4" />
          <stop offset={`${borde + resto * 0.26}%`} stopColor="#88daff" stopOpacity="0.21" />
          <stop offset={`${borde + resto * 0.52}%`} stopColor="#7ed4ff" stopOpacity="0.1" />
          <stop offset={`${borde + resto * 0.76}%`} stopColor="#7ed4ff" stopOpacity="0.035" />
          <stop offset="100%" stopColor="#7ed4ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-spec`} cx="34%" cy="30%" r="38%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        {/* Región holgada: un bloom recortado deja un canto cuadrado visible. */}
        <filter
          id={`${id}-bloom`}
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="3.4" />
        </filter>
      </defs>

      {glow ? (
        <circle cx="50" cy="50" r={haloRadius} fill={`url(#${id}-halo)`} />
      ) : null}
      <circle cx="50" cy="50" r="38" fill={`url(#${id}-core)`} />
      <circle cx="50" cy="50" r="38" fill={`url(#${id}-spec)`} />
      <circle cx="50" cy="50" r="38" fill={`url(#${id}-rim)`} />
      {/* El bloom del aro: derrama hacia dentro y hacia fuera. */}
      <circle
        cx="50"
        cy="50"
        r="38"
        fill="none"
        stroke={`url(#${id}-arc)`}
        strokeWidth={bloom}
        opacity="0.62"
        filter={`url(#${id}-bloom)`}
      />
      {/* Y el trazo nítido que lo cierra. */}
      <circle
        cx="50"
        cy="50"
        r="38"
        fill="none"
        stroke={`url(#${id}-arc)`}
        strokeWidth={aro}
      />
    </>
  );
}
