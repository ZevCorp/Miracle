-- Campos exclusivos para el bloque "Nota realizada por / Responsable /
-- Identificación / Reg. Med. / Especialidad" que se agrega al final del PDF
-- -pedido explícito, imitando el sello que deja el sistema del hospital.
-- Deliberadamente NO se derivan de full_name (no hay forma confiable de
-- partir "Juliana Maria Bacca González" en nombres/apellidos de forma
-- genérica) y quedan null por defecto: el PDF solo agrega este bloque
-- cuando un perfil tiene AMBOS campos cargados, que hoy es una decisión
-- explícita nuestra, no automática — es una funcionalidad anclada a las
-- cuentas para las que el usuario dio el dato real.
alter table public.profiles
  add column if not exists honorific text,
  add column if not exists responsable_label text;
