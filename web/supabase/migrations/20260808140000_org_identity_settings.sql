-- Identidad institucional y valores por defecto de la organización.
--
-- POR QUÉ
-- La página de Configuración institucional solo persistía tres cosas (nombre,
-- NIT y el toggle de plantillas); el resto de la pantalla era decorativa. Y la
-- nota clínica que imprime un médico no llevaba NINGÚN dato de la institución:
-- el único texto institucional del documento era la cadena
-- 'Hospital General de Medellín', escrita a mano en
-- app/app/consultas/[id]/page.tsx. Cualquier otra institución imprimía notas con
-- el nombre de ese hospital.
--
-- Estas columnas son lo que hace falta para que el documento salga con el
-- encabezado correcto sin pedirle nada al médico, que es el criterio de todo lo
-- que se agrega aquí: ajustes que le ahorran trabajo o cumplen un requisito
-- legal, nunca que limiten su juicio clínico.
--
-- La política "admin updates own org" (migración 20260628000000) ya permite que
-- el admin escriba estas columnas, y "members read own org" que cualquier
-- miembro las lea para armar el encabezado. No hace falta RLS nueva.
--
-- Idempotente.

alter table public.organizations
  -- Encabezado del documento.
  add column if not exists address text,
  add column if not exists city    text,
  add column if not exists phone   text,
  -- Servicios de la institución. NULL (no un array vacío) significa "no
  -- configurado": el código cae a la lista por defecto de lib/mock. Un array
  -- vacío sería una configuración deliberada de "ningún servicio", que no tiene
  -- sentido, así que la app lo trata igual que NULL.
  add column if not exists servicios text[],
  -- Etiqueta de responsable del bloque de firma ("Médico tratante"). Hoy solo
  -- existe por perfil y está cargada a mano en un par de cuentas, así que el
  -- bloque no aparece para el resto del equipo.
  add column if not exists default_responsable_label text;

comment on column public.organizations.servicios is
  'Servicios de la institución. NULL = usar la lista por defecto de la app.';
comment on column public.organizations.default_responsable_label is
  'Etiqueta de responsable por defecto para el bloque de firma de la nota impresa.';
