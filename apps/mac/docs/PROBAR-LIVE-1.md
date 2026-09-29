# Probar Live 1 en Ü para Mac

1. Abre la copia instalada: `open "$HOME/Applications/U.app"`.
2. En **Configuración**, espera a que termine **Consultando el Llavero**. Si macOS pide acceso a la credencial de Ü, autorízalo en el diálogo del sistema. No hace falta borrar ni volver a crear la credencial.
3. Pulsa **Comprobar Live 1**. Es una sesión breve facturada por el proveedor, sin micrófono ni acciones en el escritorio. Solo debe mostrar **Live 1 y Luna respondieron** después de una llamada y respuesta reales de herramienta.
4. Cierra Configuración y toca **una vez la carita**. Ese toque elige Live 1, aunque se hubiera seleccionado el dictado de macOS como respaldo. Cuando conecte, el halo gris detrás de la carita indica que la conversación está activa.
5. Espera **Conversación en vivo** y di: «Hola Ü, responde en una frase para probar tu voz». Comprueba que oyes la respuesta. Habla durante ella para probar interrupción.
6. Para probar la ejecución: abre una app de prueba y pide una acción sencilla. La prueba de conexión por sí sola no certifica Jev ni el control del escritorio.
7. Toca **otra vez la carita** o pulsa **Esc** para cerrar la sesión; comprueba que se apaga el indicador de micrófono del sistema.

## Causas visibles

- **Consultando el Llavero**: falta que macOS entregue la credencial; todavía no prueba la conexión remota.
- **Graph no entrega credencial**: revisar la configuración OpenAI de Graph. Live utiliza esa credencial, sin sustituirla silenciosamente por una clave local antigua.
- **credit_balance_exhausted**: la cuenta OpenAI asociada a esa clave no tiene saldo. Cambiar permisos de macOS no lo resuelve.
- **invalid_api_key** o **model_not_found**: el proveedor rechazó la clave o el acceso al modelo.
- **Live 1 conectó, pero no pude iniciar el audio del Mac**: revisar el dispositivo de entrada/salida y el permiso de micrófono.

La ruta oficial es Live WebSocket, PCM16 mono de 24 kHz y delegación a Luna. Documentación: https://developers.openai.com/api/docs/guides/voice-websockets

## Evidencia de esta actualización

24 contratos, 127 comprobaciones locales. Mutación de la duración de silencios detectada por el contrato. Compilación release e instalación con firma local estable completadas. Computer Use confirmó los botones, el chat expandido del notch, el cierre de voz desde el notch y los permisos mostrados por Ü. La prueba de conservación del borrador agotó el tiempo de Computer Use y sigue pendiente. La comprobación remota quedó esperando autorización del Llavero; no se declara aprobada la conversación audible.

## Chat del notch

Pulsa el título del notch para expandir/plegar el chat, o haz clic derecho en la carita y elige **Abrir chat del notch**. El chat comparte historial y borrador con la ventana principal. Enter envía el texto; cerrar el chat no debe colgar la voz. Para colgar, usa la carita o el micrófono.
