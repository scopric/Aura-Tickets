-- =============================================================================
-- L6 do produtor: somas exatas no banco. 04/10/2026.
-- Hoje o Início soma pedidos no navegador e o PostgREST corta em 1.000 linhas (a tela avisa "soma parcial").
-- Esta função devolve a soma pronta, sem teto, em UM jsonb (uma linha: o max_rows não corta).
--
-- public.produtor_vendas_pagas(p_de, p_ate, p_event_id) -> jsonb
--   total, pedidos            : pedidos status 'paid' dos eventos do chamador (orders.total = "bruto", Decisões 88 e 111)
--   reembolsados              : {pedidos, total} dos 'refunded' (SAEM da soma; a tela avisa, ficha 27)
--   por_evento / por_dia / por_forma : listas {…, pedidos, total}; por_dia no fuso America/Sao_Paulo (AAAA-MM-DD)
--   Janela [p_de, p_ate): nulo = sem limite. p_event_id nulo = todos os eventos do chamador.
--
-- SECURITY INVOKER: a RLS de orders continua valendo, inclusive a RESTRICTIVE gf_mfa_aal2: sessão aal1 de quem tem
-- 2FA recebe tudo ZERO, sem erro (a tela mostra o aviso de 2FA). O filtro events.producer_id = auth.uid() é explícito
-- porque a RLS de orders também deixa o admin ler tudo: aqui o admin só soma os eventos que são dele.
-- search_path vazio: tudo qualificado. Só authenticated executa (anon e public não).
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17).
-- Uma transação, idempotente. Sem tabela nova, sem mudança em dados.
-- NÃO mover para supabase/migrations/ (motivo no cabeçalho de 20260927_security_hardening.sql).
-- Teste: supabase/tests/produtor_vendas_pagas.test.sql (pgTAP; banco local, nunca em produção).
-- Ordem: sem dependência de outro arquivo desta fila além do baseline (usa orders, events). O front antigo não chama
-- a função; o novo, sem a função, mostra erro com "Tentar de novo" (Financeiro) e o Início segue com a soma parcial.
-- =============================================================================
begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public.orders') is null or to_regclass('public.events') is null then
    raise exception 'public.orders ou public.events não existe';
  end if;
end $$;

create or replace function public.produtor_vendas_pagas(
  p_de timestamptz default null,
  p_ate timestamptz default null,
  p_event_id uuid default null
) returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select o.id, o.event_id, e.title, o.status, o.total, o.payment_method,
           (o.created_at at time zone 'America/Sao_Paulo')::date as dia
    from public.orders o
    join public.events e on e.id = o.event_id
    where e.producer_id = (select auth.uid())
      and o.status in ('paid', 'refunded')
      and (p_de is null or o.created_at >= p_de)
      and (p_ate is null or o.created_at < p_ate)
      and (p_event_id is null or o.event_id = p_event_id)
  ), pagos as (select * from base where status = 'paid')
  select jsonb_build_object(
    'total', coalesce((select sum(total) from pagos), 0),
    'pedidos', (select count(*) from pagos),
    'reembolsados', jsonb_build_object(
      'pedidos', (select count(*) from base where status = 'refunded'),
      'total', coalesce((select sum(total) from base where status = 'refunded'), 0)),
    'por_evento', coalesce((select jsonb_agg(jsonb_build_object('event_id', event_id, 'titulo', titulo, 'pedidos', n, 'total', t)
                            order by t desc, event_id)
                            from (select event_id, max(title) as titulo, count(*) as n, sum(total) as t from pagos group by event_id) x), '[]'::jsonb),
    'por_dia', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'pedidos', n, 'total', t) order by dia)
                          from (select dia, count(*) as n, sum(total) as t from pagos group by dia) x), '[]'::jsonb),
    'por_forma', coalesce((select jsonb_agg(jsonb_build_object('forma', forma, 'pedidos', n, 'total', t) order by t desc, forma)
                            from (select coalesce(payment_method, '') as forma, count(*) as n, sum(total) as t from pagos group by 1) x), '[]'::jsonb)
  );
$$;

revoke all on function public.produtor_vendas_pagas(timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.produtor_vendas_pagas(timestamptz, timestamptz, uuid) to authenticated, service_role;

-- Conferência: função existe, é invoker, search_path vazio, anon sem EXECUTE
do $$
declare f record;
begin
  select p.prosecdef, p.proconfig into f from pg_proc p
   where p.oid = 'public.produtor_vendas_pagas(timestamptz, timestamptz, uuid)'::regprocedure;
  if f.prosecdef then raise exception 'produtor_vendas_pagas deveria ser SECURITY INVOKER'; end if;
  if not (f.proconfig @> array['search_path=""']) then raise exception 'produtor_vendas_pagas sem search_path vazio'; end if;
  if has_function_privilege('anon', 'public.produtor_vendas_pagas(timestamptz, timestamptz, uuid)', 'execute') then
    raise exception 'anon não pode executar produtor_vendas_pagas';
  end if;
end $$;

commit;

-- Desfazer:
-- drop function if exists public.produtor_vendas_pagas(timestamptz, timestamptz, uuid);
