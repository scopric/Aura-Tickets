-- pgTAP de docs/sql/20261028_limite_por_cpf.sql. Só no banco local: aplicar o SQL (e os de docs/sql anteriores: 20261022,
-- 20261008, 20261011, 20261027) e rodar `supabase test db`. Precisa de pr7_hmac (20261007_pr7_cripto_passo1 e o segredo
-- pr7_pii_key no Vault local). Tudo em begin ... rollback. Nunca contra produção.
-- CPFs FICTÍCIOS, só válidos pelo algoritmo dos dígitos: 529.982.247-25 (A), 111.444.777-35 (B),
-- 390.533.447-05 e 714.287.938-60.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(18);

create function pg_temp.como(p_role text, p uuid default null) returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then 'aal2' end))::text end, true);
  perform set_config('role', p_role, true);
end $f$;
grant execute on function pg_temp.como(text, uuid) to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select ('fc000000-0000-4000-8000-00000000000' || n)::uuid, 'cpf' || n || '@teste-cpf.local', now(), '{}'::jsonb from generate_series(1, 9) n;
insert into public.events (id, producer_id, title, slug, status, approval_status, start_date) values
  ('fc000000-0000-4000-8000-0000000000e1', 'fc000000-0000-4000-8000-000000000009', 'CPF', 'cpf-e1', 'published', 'approved', now() + interval '7 days');
-- b0 sem limite; b1 limite 2 sem lotação (0); b2 limite 2 (outro tipo); b3 grátis limite 3 (baixa para 2 adiante)
insert into public.ticket_types (id, event_id, name, price, quantity_total, max_por_cpf) values
  ('fc000000-0000-4000-8000-0000000000b0', 'fc000000-0000-4000-8000-0000000000e1', 'Livre', 50, 100, null),
  ('fc000000-0000-4000-8000-0000000000b1', 'fc000000-0000-4000-8000-0000000000e1', 'Limitado', 50, 0, 2),
  ('fc000000-0000-4000-8000-0000000000b2', 'fc000000-0000-4000-8000-0000000000e1', 'Outro', 50, 100, 2),
  ('fc000000-0000-4000-8000-0000000000b3', 'fc000000-0000-4000-8000-0000000000e1', 'Grátis', 0, 100, 3);

-- sem CPF: tipo livre passa, tipo limitado pede o CPF
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000001');
insert into public.orders (id, user_id, event_id, total, status) values
  ('fc000000-0000-4000-8000-0000000000f0', 'fc000000-0000-4000-8000-000000000001', 'fc000000-0000-4000-8000-0000000000e1', 50, 'pending');
select lives_ok($$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fc000000-0000-4000-8000-0000000000f0', 'fc000000-0000-4000-8000-0000000000b0', 1, 50)$$, 'sem limite e sem CPF passa');
select throws_ok($$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fc000000-0000-4000-8000-0000000000f0', 'fc000000-0000-4000-8000-0000000000b1', 1, 50)$$, '22023',
  'Informe o CPF do comprador para este ingresso', 'com limite e sem CPF recusa');
select throws_ok($$insert into public.orders (user_id, event_id, total, status, customer_cpf) values
  ('fc000000-0000-4000-8000-000000000001', 'fc000000-0000-4000-8000-0000000000e1', 50, 'pending', '529.982.247-24')$$, '22023',
  'CPF inválido', 'CPF inválido recusa');

-- conta 1, CPF A formatado; conta 2, CPF A só dígitos; conta 3 manda hash forjado sem CPF
insert into public.orders (id, user_id, event_id, total, status, customer_cpf) values
  ('fc000000-0000-4000-8000-0000000000f1', 'fc000000-0000-4000-8000-000000000001', 'fc000000-0000-4000-8000-0000000000e1', 100, 'pending', '529.982.247-25');
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000002');
insert into public.orders (id, user_id, event_id, total, status, customer_cpf) values
  ('fc000000-0000-4000-8000-0000000000f2', 'fc000000-0000-4000-8000-000000000002', 'fc000000-0000-4000-8000-0000000000e1', 50, 'pending', '52998224725');
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000003');
insert into public.orders (id, user_id, event_id, total, status, customer_cpf_hmac) values
  ('fc000000-0000-4000-8000-0000000000f3', 'fc000000-0000-4000-8000-000000000003', 'fc000000-0000-4000-8000-0000000000e1', 50, 'pending', '\x00ff'::bytea);
select pg_temp.como('postgres');
select ok((select customer_cpf is null and customer_cpf_hmac is not null from public.orders where id = 'fc000000-0000-4000-8000-0000000000f1'),
  'CPF puro não fica; hash fica');
select is((select customer_cpf_hmac from public.orders where id = 'fc000000-0000-4000-8000-0000000000f1'),
          (select customer_cpf_hmac from public.orders where id = 'fc000000-0000-4000-8000-0000000000f2'), 'formatado e só dígitos: mesmo hash');
select is((select customer_cpf_hmac from public.orders where id = 'fc000000-0000-4000-8000-0000000000f3'), null, 'hash forjado sem CPF é descartado');

-- limite 2 (sem lotação): conta 1 leva 2; o pendente dela não segura o CPF para a conta 2; outro tipo passa
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000001');
select lives_ok($$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fc000000-0000-4000-8000-0000000000f1', 'fc000000-0000-4000-8000-0000000000b1', 2, 50)$$, 'CPF A: 2 passam (limite vale sem lotação)');
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000002');
select lives_ok($$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fc000000-0000-4000-8000-0000000000f2', 'fc000000-0000-4000-8000-0000000000b1', 1, 50)$$, 'pendente de outra conta não conta');
select lives_ok($$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fc000000-0000-4000-8000-0000000000f2', 'fc000000-0000-4000-8000-0000000000b2', 2, 50)$$, 'outro tipo não conta');

-- ao pagar: conta 1 paga; a conta 2 não vira 'paid' (recheck), mensagem sem contagem
select pg_temp.como('postgres');
update public.orders set status = 'paid' where id = 'fc000000-0000-4000-8000-0000000000f1';
select throws_ok($$update public.orders set status = 'paid' where id = 'fc000000-0000-4000-8000-0000000000f2'$$, '22023',
  'Limite de 2 ingressos por CPF neste ingresso', 'recheck ao pagar recusa o 2º pagamento do mesmo CPF');
delete from public.order_items where order_id = 'fc000000-0000-4000-8000-0000000000f2' and ticket_type_id = 'fc000000-0000-4000-8000-0000000000b1';
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000002');
select throws_ok($$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fc000000-0000-4000-8000-0000000000f2', 'fc000000-0000-4000-8000-0000000000b1', 1, 50)$$, '22023',
  'Limite de 2 ingressos por CPF neste ingresso', 'pago conta (outra conta)');

-- pendente da MESMA conta conta (orders_um_pendente cancela o anterior; o teste o devolve a 'pending'); vencido não
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000004');
insert into public.orders (id, user_id, event_id, total, status, customer_cpf) values
  ('fc000000-0000-4000-8000-0000000000f4', 'fc000000-0000-4000-8000-000000000004', 'fc000000-0000-4000-8000-0000000000e1', 100, 'pending', '111.444.777-35');
insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fc000000-0000-4000-8000-0000000000f4', 'fc000000-0000-4000-8000-0000000000b1', 2, 50);
insert into public.orders (id, user_id, event_id, total, status, customer_cpf) values
  ('fc000000-0000-4000-8000-0000000000f7', 'fc000000-0000-4000-8000-000000000004', 'fc000000-0000-4000-8000-0000000000e1', 50, 'pending', '11144477735');
select pg_temp.como('postgres');
update public.orders set status = 'pending' where id = 'fc000000-0000-4000-8000-0000000000f4';
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000004');
select throws_ok($$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fc000000-0000-4000-8000-0000000000f7', 'fc000000-0000-4000-8000-0000000000b1', 1, 50)$$, '22023',
  'Limite de 2 ingressos por CPF neste ingresso', 'pendente da mesma conta conta');
select pg_temp.como('postgres');
update public.orders set created_at = now() - interval '31 minutes' where id = 'fc000000-0000-4000-8000-0000000000f4';
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000004');
select lives_ok($$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fc000000-0000-4000-8000-0000000000f7', 'fc000000-0000-4000-8000-0000000000b1', 1, 50)$$, 'pendente vencido não conta');

-- anti-sondagem: conta 8 usa 3 CPFs (e repete um); o 4º diferente na mesma hora é recusado
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000008');
insert into public.orders (user_id, event_id, total, status, customer_cpf)
select 'fc000000-0000-4000-8000-000000000008', 'fc000000-0000-4000-8000-0000000000e1', 50, 'pending', c
  from unnest(array['52998224725', '11144477735', '39053344705', '529.982.247-25']) c;
select throws_ok($$insert into public.orders (user_id, event_id, total, status, customer_cpf) values
  ('fc000000-0000-4000-8000-000000000008', 'fc000000-0000-4000-8000-0000000000e1', 50, 'pending', '71428793860')$$, '22023',
  'Muitas tentativas com CPFs diferentes. Tente de novo mais tarde.', '4º CPF diferente na hora é recusado');

-- confirmar_pedido_gratis: conta 5 (CPF B) confirma 2; conta 6 (CPF B) entra com limite 3 e confirma com limite 2: recusa
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000005');
insert into public.orders (id, user_id, event_id, total, status, customer_cpf) values
  ('fc000000-0000-4000-8000-0000000000f5', 'fc000000-0000-4000-8000-000000000005', 'fc000000-0000-4000-8000-0000000000e1', 0, 'pending', '111.444.777-35');
insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fc000000-0000-4000-8000-0000000000f5', 'fc000000-0000-4000-8000-0000000000b3', 2, 0);
select is(public.confirmar_pedido_gratis('fc000000-0000-4000-8000-0000000000f5'), 2, 'grátis CPF B: 2 confirmados (passa pelo gatilho de pagamento)');
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000006');
insert into public.orders (id, user_id, event_id, total, status, customer_cpf) values
  ('fc000000-0000-4000-8000-0000000000f6', 'fc000000-0000-4000-8000-000000000006', 'fc000000-0000-4000-8000-0000000000e1', 0, 'pending', '11144477735');
insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fc000000-0000-4000-8000-0000000000f6', 'fc000000-0000-4000-8000-0000000000b3', 1, 0);
select pg_temp.como('postgres');
update public.ticket_types set max_por_cpf = 2 where id = 'fc000000-0000-4000-8000-0000000000b3';
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000006');
select throws_ok($$select public.confirmar_pedido_gratis('fc000000-0000-4000-8000-0000000000f6')$$, '22023',
  'Limite de 2 ingressos por CPF neste ingresso', 'confirmar_pedido_gratis recusa acima do limite por CPF');

-- grants: hash invisível para a API; o produtor edita max_por_cpf
select pg_temp.como('postgres');
select ok(not has_column_privilege('authenticated', 'public.orders', 'customer_cpf_hmac', 'select')
          and not has_column_privilege('anon', 'public.orders', 'customer_cpf_hmac', 'select'), 'hash sem SELECT para authenticated e anon');
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000009');
update public.ticket_types set max_por_cpf = 5 where id = 'fc000000-0000-4000-8000-0000000000b0';
select pg_temp.como('postgres');
select is((select max_por_cpf from public.ticket_types where id = 'fc000000-0000-4000-8000-0000000000b0'), 5, 'produtor grava max_por_cpf');

select * from finish();
rollback;
