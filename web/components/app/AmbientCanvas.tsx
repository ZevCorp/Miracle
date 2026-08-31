/**
 * El lienzo ambiental: dos o tres luces difusas con los colores del orbe de
 * marca, derivando muy lento detrás de todo el contenido.
 *
 * Existe para que el fondo deje de ser un color plano sin volverse ruido: la
 * marca (el orbe luminoso) se convierte en atmósfera. Es puro CSS —divs con
 * blur y una animación de transform de ~50 segundos—, así que no cuesta nada
 * por frame y con prefers-reduced-motion las luces simplemente se quedan
 * quietas. Decorativo de principio a fin: aria-hidden y sin eventos.
 */
export function AmbientCanvas() {
  return (
    <div aria-hidden className="ambient-canvas">
      <span className="orb-light orb-a" />
      <span className="orb-light orb-b" />
      <span className="orb-light orb-c" />
    </div>
  );
}
