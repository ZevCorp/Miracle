-- La secretaria necesita poder marcar que YA subió una nota aprobada al
-- sistema propio del hospital (estado "exportada"). La política UPDATE de
-- consultations solo permite escribir a admin/supervisor o al médico dueño
-- de la nota, así que un UPDATE directo desde el cliente fallaría por RLS
-- para ella. En vez de ampliar esa política (lo que le daría permiso para
-- tocar cualquier columna), se agrega una RPC security definer bien acotada:
-- solo transiciona una consulta YA aprobada, de un médico que tenga
-- asignado en secretary_doctor_access, a "exportada". No puede editar nota,
-- códigos, ni aprobar/desaprobar nada por esta vía.
create or replace function public.secretary_mark_exported(p_consultation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select private.current_app_role()) <> 'secretaria' then
    raise exception 'No autorizado';
  end if;

  update public.consultations c
  set estado = 'exportada'
  where c.id = p_consultation_id
    and c.deleted_at is null
    and c.estado = 'aprobada'
    and c.organization_id = (select private.current_org())
    and exists (
      select 1
      from public.secretary_doctor_access sda
      where sda.secretary_id = (select auth.uid())
        and sda.medico_id = c.medico_id
    );

  if not found then
    raise exception 'Consulta no encontrada, no aprobada, o sin permiso';
  end if;
end;
$$;

revoke all on function public.secretary_mark_exported(uuid) from public, anon;
grant execute on function public.secretary_mark_exported(uuid) to authenticated;
