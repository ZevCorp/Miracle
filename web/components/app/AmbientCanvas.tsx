/**
 * El lienzo ambiental: la ILUMINACIÓN de la escena, no un dibujo detrás.
 *
 * Antes eran tres luces de colores —cian, azul y una verde menta— derivando
 * desde tres esquinas distintas. El problema no era el gusto: el sistema de
 * materiales afirma que la luz entra por arriba a la izquierda (de ahí el filo
 * claro en la cara superior de cada panel), y un fondo con tres focos de tres
 * colores contradice esa afirmación. Dos versiones opuestas de la misma escena
 * es exactamente lo que hace que un fondo se note y termine cansando.
 *
 * Ahora hay UNA luz, en el sitio que el material ya prometía, y sin color
 * propio más allá del frío del acento. El color de la app lo pone el contenido.
 *
 * Sigue siendo puro CSS: un gradiente radial en su capa, una deriva de 90 s
 * imperceptible y un grano finísimo para que una superficie tan grande y tan
 * lisa no se bandee en escalones. Nada se recalcula por frame; con
 * prefers-reduced-motion la luz se queda quieta.
 */
export function AmbientCanvas() {
  return (
    <div aria-hidden className="ambient-canvas">
      <span className="ambient-key" />
      <span className="ambient-weave" />
    </div>
  );
}
