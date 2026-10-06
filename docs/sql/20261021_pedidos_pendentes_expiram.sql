-- =============================================================================
-- Pedidos pendentes vencem — banco — 2026-10-21
-- Aplicar à mão no SQL Editor do Supabase. NÃO vai para supabase/migrations (Decisão 02).
-- Contrato: pedido com status 'pending' há mais de p_minutos (padrão 30) vira 'cancelled'.
-- O cliente não tem UPDATE em orders (RLS); só esta função (service_role/cron) cancela.
-- 'cancelled' já existe no CHECK de orders. Idempotente: pode rodar de novo.
-- Pré-requisito: pg_cron ligado (como em 20261001_chat.sql).
-- =============================================================================
begin;
set local lock_timeout = '5s';

create or replace function public.pedidos_pendentes_expirar(p_minutos int default 30)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare n int;
begin
  update public.orders
     set status = 'cancelled'
   where status = 'pending'
     and created_at < now() - make_interval(mins => p_minutos);
  get diagnostics n = row_count;
  return n;
end $$;

-- O Supabase dá EXECUTE a anon e authenticated por padrão: revoke explícito, depois o grant mínimo.
revoke execute on function public.pedidos_pendentes_expirar(int) from public, anon, authenticated;
grant execute on function public.pedidos_pendentes_expirar(int) to service_role;

grant usage on schema cron to postgres;
select cron.unschedule('pedidos_pendentes_expirar') where exists (select 1 from cron.job where jobname = 'pedidos_pendentes_expirar');
select cron.schedule('pedidos_pendentes_expirar', '*/10 * * * *', $cron$ select public.pedidos_pendentes_expirar(30); $cron$);

-- Conferência: a função é security definer, só service_role executa, e o job existe.
do $$
begin
  assert (select prosecdef from pg_proc where oid = 'public.pedidos_pendentes_expirar(int)'::regprocedure), 'função não é security definer';
  assert not has_function_privilege('anon', 'public.pedidos_pendentes_expirar(int)', 'execute'), 'anon executa';
  assert not has_function_privilege('authenticated', 'public.pedidos_pendentes_expirar(int)', 'execute'), 'authenticated executa';
  assert has_function_privilege('service_role', 'public.pedidos_pendentes_expirar(int)', 'execute'), 'service_role não executa';
  assert exists (select 1 from cron.job where jobname = 'pedidos_pendentes_expirar'), 'job não agendado';
  raise notice 'OK: função e job pedidos_pendentes_expirar conferidos';
end $$;
commit;

/* Desfazer:
select cron.unschedule('pedidos_pendentes_expirar');
drop function if exists public.pedidos_pendentes_expirar(int);
*/
