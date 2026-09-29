-- El rótulo (número de caso) vive dentro de `note` (un arreglo JSONB), así
-- que hoy no se puede buscar ni indexar directamente. Se agrega una columna
-- `rotulo` sincronizada por trigger cada vez que se escribe la consulta:
-- sirve tanto para mostrarlo (tarjetas) como para el buscador, sin tener que
-- traer ni parsear el JSONB completo del lado del cliente.
--
-- Transversal a cualquier especialidad: si la plantilla no tiene una sección
-- "rotulo", la columna simplemente queda null (sin romper nada ni requerir
-- casos especiales por especialidad).
alter table public.consultations
  add column if not exists rotulo text;

create or replace function private.sync_consultation_rotulo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.rotulo := (
    select elem ->> 'texto'
    from jsonb_array_elements(coalesce(new.note, '[]'::jsonb)) as elem
    where elem ->> 'id' = 'rotulo' or elem ->> 'titulo' = 'Rótulo'
    limit 1
  );
  return new;
end;
$$;

drop trigger if exists consultations_sync_rotulo on public.consultations;
create trigger consultations_sync_rotulo
  before insert or update of note on public.consultations
  for each row
  execute function private.sync_consultation_rotulo();

-- Backfill de las filas existentes (el trigger solo corre hacia adelante).
update public.consultations
set rotulo = (
  select elem ->> 'texto'
  from jsonb_array_elements(coalesce(note, '[]'::jsonb)) as elem
  where elem ->> 'id' = 'rotulo' or elem ->> 'titulo' = 'Rótulo'
  limit 1
)
where note is not null;

create index if not exists idx_consultations_rotulo on public.consultations (rotulo);
