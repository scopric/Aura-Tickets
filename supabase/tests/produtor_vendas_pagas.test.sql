-- pgTAP da L6 (docs/sql/20261016_produtor_vendas_pagas.sql). Só no banco local: aplicar o baseline, o SQL da E4
-- (20261011, que troca o SELECT de orders por colunas) e o da L6; rodar `supabase test db`.
-- Tudo em begin ... rollback. Nunca contra produção.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(15);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', p_role, true);
end $f$;
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- p produtora (com 2FA) dona de e1 e e2; q outra produtora dona de e3; c compradora; a admin (não dona)
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('16000000-0000-4000-8000-000000000009', 'p@teste-l6.local', now(), '{"role":"producer","full_name":"Paula"}'),
  ('16000000-0000-4000-8000-000000000008', 'q@teste-l6.local', now(), '{"role":"producer","full_name":"Quita"}'),
  ('16000000-0000-4000-8000-00000000000c', 'c@teste-l6.local', now(), '{"full_name":"Caio"}'),
  ('16000000-0000-4000-8000-00000000000a', 'a@teste-l6.local', now(), '{"full_name":"Admin"}');
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at) values
  ('16000000-0000-4000-8000-0000000000fa', '16000000-0000-4000-8000-000000000009', 'teste', 'totp', 'verified', now(), now());
update public.profiles set role = 'admin', admin_permissions = array['manage_finance', 'view_analytics']
  where id = '16000000-0000-4000-8000-00000000000a';
insert into public.events (id, producer_id, title, slug, status, approval_status) values
  ('16000000-0000-4000-8000-0000000000e1', '16000000-0000-4000-8000-000000000009', 'Evento 1', 'l6-e1', 'published', 'approved'),
  ('16000000-0000-4000-8000-0000000000e2', '16000000-0000-4000-8000-000000000009', 'Evento 2', 'l6-e2', 'published', 'approved'),
  ('16000000-0000-4000-8000-0000000000e3', '16000000-0000-4000-8000-000000000008', 'Evento 3', 'l6-e3', 'published', 'approved');
-- 1.200 pedidos pagos de R$ 10,10 em e1 (passa do teto de 1.000 linhas do PostgREST), Pix, em 1 dia
insert into public.orders (user_id, event_id, total, status, payment_method, created_at)
  select '16000000-0000-4000-8000-00000000000c', '16000000-0000-4000-8000-0000000000e1', 10.10, 'paid', 'pix', '2026-10-01 15:00+00'
  from generate_series(1, 1200);
insert into public.orders (user_id, event_id, total, status, payment_method, created_at) values
  -- 02:30 UTC de 03/10 = 23:30 de 02/10 em São Paulo (dia certo = 02/10)
  ('16000000-0000-4000-8000-00000000000c', '16000000-0000-4000-8000-0000000000e2', 100.00, 'paid', 'credit_card', '2026-10-03 02:30+00'),
  ('16000000-0000-4000-8000-00000000000c', '16000000-0000-4000-8000-0000000000e2', 50.00, 'paid', null, '2026-10-05 15:00+00'),
  ('16000000-0000-4000-8000-00000000000c', '16000000-0000-4000-8000-0000000000e2', 70.00, 'refunded', 'pix', '2026-10-05 16:00+00'),
  ('16000000-0000-4000-8000-00000000000c', '16000000-0000-4000-8000-0000000000e2', 30.00, 'pending', 'pix', '2026-10-05 17:00+00'),
  ('16000000-0000-4000-8000-00000000000c', '16000000-0000-4000-8000-0000000000e3', 999.00, 'paid', 'pix', '2026-10-05 15:00+00');

-- Estrutura
select ok(not has_function_privilege('anon', 'public.produtor_vendas_pagas(timestamptz, timestamptz, uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.produtor_vendas_pagas(timestamptz, timestamptz, uuid)', 'execute'),
  'só authenticated executa');
select ok(not (select prosecdef from pg_proc where oid = 'public.produtor_vendas_pagas(timestamptz, timestamptz, uuid)'::regprocedure),
  'SECURITY INVOKER');
select ok((select proconfig from pg_proc where oid = 'public.produtor_vendas_pagas(timestamptz, timestamptz, uuid)'::regprocedure)
  @> array['search_path=""'], 'search_path vazio');

-- Produtora com 2FA e token aal2: soma exata, sem o teto de 1.000 linhas
select pg_temp.como('authenticated', '16000000-0000-4000-8000-000000000009', 'aal2');
select is((public.produtor_vendas_pagas()->>'pedidos')::int, 1202, '1.202 pedidos pagos (1.200 + 2): passa de 1.000');
select is((public.produtor_vendas_pagas()->>'total')::numeric, 12270::numeric, 'total exato: 1.200 x 10,10 + 100 + 50 = 12.270,00');
select is((public.produtor_vendas_pagas()->'reembolsados'->>'pedidos')::int, 1, 'reembolsado contado à parte');
select is((public.produtor_vendas_pagas()->'reembolsados'->>'total')::numeric, 70::numeric, 'reembolsado fora da soma: 70,00 à parte');
select is((public.produtor_vendas_pagas()->>'total')::numeric,
  (select sum(total) from public.orders where status = 'paid' and event_id in
    ('16000000-0000-4000-8000-0000000000e1', '16000000-0000-4000-8000-0000000000e2')),
  'bate com a soma direta nas linhas (pending e pedido de outra produtora fora)');
select is(public.produtor_vendas_pagas('2026-10-04 03:00+00', null, '16000000-0000-4000-8000-0000000000e2')->'por_dia',
  '[{"dia":"2026-10-05","pedidos":1,"total":50.00}]'::jsonb, 'janela e evento: só o pedido de 05/10; por_dia no fuso de São Paulo');
select is(public.produtor_vendas_pagas(null, null, '16000000-0000-4000-8000-0000000000e2')->'por_dia'->0->>'dia', '2026-10-02',
  '02:30 UTC de 03/10 conta como 02/10 (São Paulo)');
select is(public.produtor_vendas_pagas()->'por_forma',
  '[{"forma":"pix","pedidos":1200,"total":12120.00},{"forma":"credit_card","pedidos":1,"total":100.00},{"forma":"","pedidos":1,"total":50.00}]'::jsonb,
  'por forma (vazio = não informada)');

-- Outra produtora só enxerga o que é dela; admin não dona soma zero (o filtro de dono é explícito)
select pg_temp.como('authenticated', '16000000-0000-4000-8000-000000000008');
select is((public.produtor_vendas_pagas()->>'total')::numeric, 999::numeric, 'Quita soma só o evento dela');
select pg_temp.como('authenticated', '16000000-0000-4000-8000-00000000000a');
select is((public.produtor_vendas_pagas()->>'pedidos')::int, 0, 'admin sem evento próprio: zero pedidos');

-- aal1 de quem tem 2FA: zero, sem erro (RESTRICTIVE gf_mfa_aal2)
select pg_temp.como('authenticated', '16000000-0000-4000-8000-000000000009', 'aal1');
select is((public.produtor_vendas_pagas()->>'total')::numeric, 0::numeric, 'aal1 com 2FA: total 0, sem erro');

-- anon: sem permissão
select pg_temp.como('anon');
select throws_ok($$select public.produtor_vendas_pagas()$$, '42501', null, 'anon: permissão negada');

select * from finish();
rollback;
