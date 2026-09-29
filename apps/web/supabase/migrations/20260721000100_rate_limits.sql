-- Rate limiting durable en Postgres (ventana fija por bucket de tiempo).
-- Reemplaza (como segunda barrera) al Map en memoria de lib/api/guard.ts, que
-- se pierde en cada cold start de Vercel.

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 1,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;
-- Sin policies y sin grants: nadie toca la tabla directo, solo la función.
revoke all on table public.rate_limits from public, anon, authenticated;

create or replace function public.check_rate_limit(
  p_key text,
  p_limit int,
  p_window_seconds int default 60
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_count int;
begin
  -- Bucket de ventana fija: floor(epoch / ventana) * ventana.
  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start)
  do update set count = rl.count + 1
  returning rl.count into v_count;

  -- Limpieza oportunista (~1% de las llamadas): borra ventanas de hace >1h.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 hour';
  end if;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.check_rate_limit(text, int, int) from public, anon;
grant execute on function public.check_rate_limit(text, int, int) to authenticated;
