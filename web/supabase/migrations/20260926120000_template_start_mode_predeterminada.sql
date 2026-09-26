-- La plantilla con la que arranca una consulta la elige el médico: su predeterminada.
--
-- Hasta hoy la columna nacía en 'last' («la última que usé»). Como la fila de
-- preferencias se crea al guardar CUALQUIER preferencia, casi todos los médicos
-- quedaban en 'last' sin haberlo elegido, y la estrella de «mi predeterminada»
-- se guardaba sin efecto: seguía arrancando con la última usada. El dueño pidió
-- el 2026-09-25 que la web y Miracle para Windows funcionen igual: el médico
-- escoge su plantilla predeterminada y con ella empieza.
--
-- Solo se cambia el valor por defecto de las filas NUEVAS. Las que ya existen no
-- se tocan: no hay forma de distinguir a quien eligió 'last' a propósito de a
-- quien le cayó por defecto, y cambiarle a alguien una decisión suya sin avisar
-- es peor que dejarle el comportamiento de ayer. Fijar la estrella (en la web o
-- en Windows) ya pasa la fila de ese médico a 'fixed'.
alter table public.user_preferences
  alter column template_start_mode set default 'fixed';
