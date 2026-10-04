-- pgTAP da E4 (docs/sql/20261011_orders_tickets_colunas_pessoais.sql). Só no banco local: `supabase start`, aplicar
-- o SQL da E4 e rodar `supabase test db`. Tudo em begin ... rollback: nada fica gravado. Nunca contra produção.
-- Sem os helpers do dbdev (precisam de internet no container): pg_temp.como() troca o papel e as claims do JWT
-- como o PostgREST faz, igual a supabase/tests/favoritos.test.sql.
-- As colunas lidas abaixo são as das telas: COLUNAS_PEDIDO/COLUNAS_INGRESSO de app/src/hooks/useCheckout.ts,
-- Check-in (pages/producer/CheckIn.tsx), Financeiro do produtor e do admin (useAdminFinance.ts).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(26);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', p_role, true);
end $f$;
-- funções novas do postgres nascem sem EXECUTE para PUBLIC (seg6); as do pgTAP também, neste banco
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- Dados (como postgres) -------------------------------------------------------------------------------------------
-- p produtor dono do evento e1; c comprador com pedido e ingresso em e1 (com CPF e telefone); a admin
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('e4000000-0000-4000-8000-000000000009', 'p@teste-e4.local', now(), '{"role":"producer","full_name":"Paula"}'),
  ('e4000000-0000-4000-8000-00000000000c', 'c@teste-e4.local', now(), '{"full_name":"Caio"}'),
  ('e4000000-0000-4000-8000-00000000000a', 'a@teste-e4.local', now(), '{"full_name":"Admin"}');
-- Admin como em produção (Decisão 99 e S3): fator verificado, token aal2 e a permissão da tela (manage_finance)
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at) values
  ('e4000000-0000-4000-8000-0000000000fa', 'e4000000-0000-4000-8000-00000000000a', 'teste', 'totp', 'verified', now(), now());
update public.profiles set role = 'admin', admin_permissions = array['manage_finance'] where id = 'e4000000-0000-4000-8000-00000000000a';
insert into public.events (id, producer_id, title, slug, status, approval_status) values
  ('e4000000-0000-4000-8000-0000000000e1', 'e4000000-0000-4000-8000-000000000009', 'Evento E4', 'e4-e1', 'published', 'approved');
insert into public.orders (id, user_id, event_id, total, status, customer_name, customer_email, customer_cpf, customer_phone) values
  ('e4000000-0000-4000-8000-0000000000a1', 'e4000000-0000-4000-8000-00000000000c', 'e4000000-0000-4000-8000-0000000000e1',
   100, 'paid', 'Caio', 'c@teste-e4.local', '12345678909', '11999990000');
insert into public.ticket_types (id, event_id, name) values
  ('e4000000-0000-4000-8000-0000000000b1', 'e4000000-0000-4000-8000-0000000000e1', 'Pista');
insert into public.tickets (order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, buyer_cpf, status) values
  ('e4000000-0000-4000-8000-0000000000a1', 'e4000000-0000-4000-8000-0000000000b1', 'e4000000-0000-4000-8000-0000000000e1',
   'e4000000-0000-4000-8000-00000000000c', 'Caio', 'c@teste-e4.local', '12345678909', 'active');

-- Estrutura -------------------------------------------------------------------------------------------------------
select ok(not has_column_privilege('authenticated', 'public.orders', 'customer_cpf', 'select')
  and not has_column_privilege('authenticated', 'public.orders', 'customer_phone', 'select')
  and not has_column_privilege('authenticated', 'public.tickets', 'buyer_cpf', 'select'),
  'authenticated sem SELECT em customer_cpf, customer_phone e buyer_cpf');
select ok(not has_table_privilege('authenticated', 'public.orders', 'select')
  and not has_table_privilege('authenticated', 'public.tickets', 'select'), 'authenticated sem SELECT na tabela inteira');
select ok(has_column_privilege('authenticated', 'public.orders', 'total', 'select')
  and has_column_privilege('authenticated', 'public.orders', 'customer_email', 'select')
  and has_column_privilege('authenticated', 'public.tickets', 'qr_code', 'select')
  and has_column_privilege('authenticated', 'public.tickets', 'buyer_name', 'select'), 'authenticated lê as colunas liberadas');
select ok(not has_table_privilege('anon', 'public.orders', 'select') and not has_any_column_privilege('anon', 'public.orders', 'select')
  and not has_table_privilege('anon', 'public.tickets', 'select') and not has_any_column_privilege('anon', 'public.tickets', 'select'),
  'anon sem SELECT nenhum em orders e tickets');
select ok(has_table_privilege('authenticated', 'public.orders', 'insert'), 'INSERT de authenticated em orders intacto');

-- Produtor (dono do evento) ---------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'e4000000-0000-4000-8000-000000000009');
select throws_ok($$select customer_cpf from orders where id = 'e4000000-0000-4000-8000-0000000000a1'$$, '42501', null,
  'produtor não lê customer_cpf de pedido do próprio evento');
select throws_ok($$select customer_phone from orders where event_id = 'e4000000-0000-4000-8000-0000000000e1'$$, '42501', null,
  'produtor não lê customer_phone');
select throws_ok($$select * from orders$$, '42501', null, 'select * em orders dá 42501');
select throws_ok($$select id from orders where customer_cpf is not null$$, '42501', null, 'produtor nem filtra por customer_cpf');
select results_eq($$select total, status from orders where event_id = 'e4000000-0000-4000-8000-0000000000e1'$$,
  $$values (100::numeric, 'paid'::text)$$, 'produtor lê total e status do pedido do próprio evento');
select throws_ok($$select buyer_cpf from tickets$$, '42501', null, 'produtor não lê tickets.buyer_cpf');
select results_eq($$select buyer_name, buyer_email, status from tickets where event_id = 'e4000000-0000-4000-8000-0000000000e1'$$,
  $$values ('Caio'::text, 'c@teste-e4.local'::text, 'active'::text)$$, 'Check-in: produtor lê nome, e-mail e status do ingresso');
select results_eq($$select count(*) from tickets where event_id = 'e4000000-0000-4000-8000-0000000000e1'$$, array[1::bigint],
  'contagem (count/head do PostgREST) continua funcionando');
-- Borderô (E5) e Financeiro: filtram e ordenam por colunas além das do select (sem SELECT nelas, daria 42501)
select results_eq($$select id, total, payment_method from orders
  where event_id = 'e4000000-0000-4000-8000-0000000000e1' and status in ('paid') and created_at >= now() - interval '1 day'
  order by created_at desc, id$$,
  $$values ('e4000000-0000-4000-8000-0000000000a1'::uuid, 100::numeric, null::text)$$,
  'produtor filtra orders por event_id/status/created_at e ordena por created_at');
select results_eq($$select t.id is not null, tt.name from tickets t join ticket_types tt on tt.id = t.ticket_type_id
  where t.event_id = 'e4000000-0000-4000-8000-0000000000e1' and t.status in ('active', 'used')
    and t.ticket_type_id = 'e4000000-0000-4000-8000-0000000000b1' and (t.checked_in_at is null or t.checked_in_at >= now() - interval '1 day')
  order by t.created_at$$,
  $$values (true, 'Pista'::text)$$,
  'produtor filtra tickets por event_id/status/ticket_type_id/checked_in_at, ordena por created_at e junta ticket_types');

-- Comprador -------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'e4000000-0000-4000-8000-00000000000c');
select results_eq($$select id, total, status from orders$$,
  $$values ('e4000000-0000-4000-8000-0000000000a1'::uuid, 100::numeric, 'paid'::text)$$,
  'comprador lê o próprio pedido pelas colunas da tela (Meus pedidos)');
select lives_ok($$select id, user_id, event_id, total, status, payment_method, gateway_payment_id, created_at, updated_at
  from orders$$, 'comprador lê todas as COLUNAS_PEDIDO');
select throws_ok($$select customer_cpf from orders$$, '42501', null, 'comprador não lê o próprio customer_cpf');
select results_eq($$with i as (
    insert into orders (user_id, event_id, total, status, payment_method, gateway_payment_id, customer_name, customer_email)
    values ('e4000000-0000-4000-8000-00000000000c', 'e4000000-0000-4000-8000-0000000000e1', 50, 'pending', 'pix',
      'PAY-TESTE', 'Caio', 'c@teste-e4.local')
    returning id, user_id, event_id, total, status, payment_method, gateway_payment_id, created_at, updated_at,
      customer_name, customer_email)
  select count(*) from i$$, array[1::bigint], 'checkout: insert com returning das colunas do select funciona');
select throws_ok($$insert into orders (user_id, event_id, total, status) values
  ('e4000000-0000-4000-8000-00000000000c', 'e4000000-0000-4000-8000-0000000000e1', 50, 'pending') returning *$$,
  '42501', null, 'insert com returning * (o .select() vazio de antes) dá 42501');
select lives_ok($$select id, order_id, event_id, ticket_type_id, user_id, qr_code, status, buyer_name, checked_in_at,
  created_at, updated_at from tickets$$, 'comprador lê todas as COLUNAS_INGRESSO (Meus ingressos)');
select throws_ok($$select buyer_cpf from tickets$$, '42501', null, 'comprador não lê o próprio buyer_cpf');

-- Admin -----------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'e4000000-0000-4000-8000-00000000000a', 'aal2');
select results_eq($$select count(*) from (select id, total, status, payment_method, created_at, customer_name, customer_email
  from orders where event_id = 'e4000000-0000-4000-8000-0000000000e1' and status = 'paid') s$$, array[1::bigint],
  'admin lê as colunas do Financeiro (useAdminFinance)');
select throws_ok($$select customer_cpf from orders$$, '42501', null, 'admin não lê customer_cpf pela API');

-- Anônimo ---------------------------------------------------------------------------------------------------------
select pg_temp.como('anon');
select throws_ok($$select id from orders$$, '42501', null, 'anon não lê orders');
select throws_ok($$select id from tickets$$, '42501', null, 'anon não lê tickets');

select * from finish();
rollback;
