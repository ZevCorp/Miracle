-- La secretaria no podía leer el perfil (full_name/email) de los médicos que
-- tiene asignados: "profiles_select_self" solo permite ver el propio perfil
-- o, para admin/supervisor, los de su organización. Como consecuencia, el
-- selector de médico en /app/consultas mostraba la misma etiqueta genérica
-- "Médico" para las dos opciones (el join a profiles volvía null por RLS),
-- haciéndolo inútil para distinguir entre los dos patólogos.
--
-- Se agrega una rama más a la misma política: puede leer el perfil de un
-- médico si existe una fila en secretary_doctor_access que la conecte con
-- él. Mismo patrón ya usado en las políticas de consultations/patients.
alter policy "profiles_select_self" on public.profiles
  using (
    id = (select auth.uid())
    or (
      (select private.current_app_role()) in ('admin', 'supervisor')
      and organization_id = (select private.current_org())
    )
    or (
      (select private.current_app_role()) = 'secretaria'
      and exists (
        select 1
        from public.secretary_doctor_access sda
        where sda.secretary_id = (select auth.uid())
          and sda.medico_id = profiles.id
      )
    )
  );
