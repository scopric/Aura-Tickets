-- pgTAP de docs/sql/20261101_pagbank_base.sql. Só no banco local: `supabase start`, aplicar o SQL e rodar `supabase test db`.
-- Tudo em begin ... rollback: nada fica gravado. Nunca contra produção. Mesmo esquema de papel/claims de pedido_gratis_estoque.test.sql.
-- Não cobre orders_pago_cpf_guard (20261028, depende de pr7_hmac): o mesmo caminho (gatilho 22023 -> 'estorno') é provado com orders_pago_assento_guard.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(23);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', p_role, true);
end $f$;
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated, service_role;
grant execute on all functions in schema extensions to anon, authenticated, service_role;

-- Dados (como postgres): a compradora, p produtora; evento aberto daqui a 7 dias; tipo pago de R$ 50, lotação 10
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('fc000000-0000-4000-8000-00000000000a', 'a@teste-pagbank.local', now(), '{"full_name":"Ana"}'),
  ('fc000000-0000-4000-8000-000000000009', 'p@teste-pagbank.local', now(), '{"role":"producer","full_name":"Paula"}');
insert into public.events (id, producer_id, title, slug, status, approval_status, start_date) values
  ('fc000000-0000-4000-8000-0000000000e1', 'fc000000-0000-4000-8000-000000000009', 'Pagbank', 'pagbank-e1', 'published', 'approved', now() + interval '7 days');
insert into public.ticket_types (id, event_id, name, price, quantity_total) values
  ('fc000000-0000-4000-8000-0000000000b1', 'fc000000-0000-4000-8000-0000000000e1', 'Pago', 50, 10);

-- f1: 2 ingressos de R$ 50 + taxa R$ 10 = R$ 110 (11000 centavos)
insert into public.orders (id, user_id, event_id, subtotal, service_fee, total, status, payment_method) values
  ('fc000000-0000-4000-8000-0000000000f1', 'fc000000-0000-4000-8000-00000000000a', 'fc000000-0000-4000-8000-0000000000e1', 100, 10, 110, 'pending', 'pix');
insert into public.order_items (order_id, ticket_type_id, quantity, unit_price, subtotal) values
  ('fc000000-0000-4000-8000-0000000000f1', 'fc000000-0000-4000-8000-0000000000b1', 2, 50, 100);

-- permissão
select pg_temp.como('anon');
select throws_ok($$select public.confirmar_pedido_pago('fc000000-0000-4000-8000-0000000000f1', 'ORDE_1', 11000)$$, '42501', null, 'anon não executa');
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-00000000000a', 'aal2');
select throws_ok($$select public.confirmar_pedido_pago('fc000000-0000-4000-8000-0000000000f1', 'ORDE_1', 11000)$$, '42501', null, 'authenticated não executa');
select throws_ok($$select * from public.webhook_events$$, '42501', null, 'authenticated não lê webhook_events');

-- pago ok (service_role)
select pg_temp.como('service_role');
select is(public.confirmar_pedido_pago('fc000000-0000-4000-8000-0000000000f1', 'ORDE_1', 11000), 'pago', 'service_role executa: pago');
select is((select count(*) from public.tickets where order_id = 'fc000000-0000-4000-8000-0000000000f1'), 2::bigint, 'pago: 2 ingressos emitidos');
select is((select sold from public.ticket_types where id = 'fc000000-0000-4000-8000-0000000000b1'), 2, 'pago: sold somou 2');
select is((select status || '/' || payment_gateway || '/' || gateway_payment_id from public.orders where id = 'fc000000-0000-4000-8000-0000000000f1'), 'paid/pagbank/ORDE_1', 'pago: pedido paid com id do gateway');
select is((select price_paid from public.tickets where order_id = 'fc000000-0000-4000-8000-0000000000f1' limit 1), 50.00, 'pago: price_paid = preço do item');
select is((select count(*) from public.payments where order_id = 'fc000000-0000-4000-8000-0000000000f1' and gateway = 'pagbank'), 1::bigint, 'pago: 1 linha em payments');

-- reenvio do mesmo pagamento: idempotente
select is(public.confirmar_pedido_pago('fc000000-0000-4000-8000-0000000000f1', 'ORDE_1', 11000), 'ja_pago', 'reenvio: ja_pago');
select is((select count(*) from public.tickets where order_id = 'fc000000-0000-4000-8000-0000000000f1'), 2::bigint, 'reenvio: não duplica ingresso');
select is((select sold from public.ticket_types where id = 'fc000000-0000-4000-8000-0000000000b1'), 2, 'reenvio: sold não soma de novo');
select is((select count(*) from public.webhook_events where event_id = 'ORDE_1'), 1::bigint, 'reenvio: 1 só linha em webhook_events');

-- outro gateway_payment_id em pedido já pago: conflito
select is(public.confirmar_pedido_pago('fc000000-0000-4000-8000-0000000000f1', 'ORDE_OUTRO', 11000), 'conflito', 'pedido pago com outro id: conflito');

-- f2: valor divergente (pago R$ 100 em pedido de R$ 110)
select pg_temp.como('postgres');
insert into public.orders (id, user_id, event_id, subtotal, service_fee, total, status, payment_method) values
  ('fc000000-0000-4000-8000-0000000000f2', 'fc000000-0000-4000-8000-00000000000a', 'fc000000-0000-4000-8000-0000000000e1', 100, 10, 110, 'pending', 'pix');
insert into public.order_items (order_id, ticket_type_id, quantity, unit_price, subtotal) values
  ('fc000000-0000-4000-8000-0000000000f2', 'fc000000-0000-4000-8000-0000000000b1', 2, 50, 100);
select pg_temp.como('service_role');
select is(public.confirmar_pedido_pago('fc000000-0000-4000-8000-0000000000f2', 'ORDE_2', 10000), 'valor_divergente', 'valor menor que o total: valor_divergente');
select is((select status from public.orders where id = 'fc000000-0000-4000-8000-0000000000f2') || '/' || (select count(*) from public.tickets where order_id = 'fc000000-0000-4000-8000-0000000000f2'), 'pending/0', 'divergente: pedido não paga e não emite');

-- f3: pagamento tardio (pedido cancelado pelo cron) não revive
select pg_temp.como('postgres');
update public.orders set status = 'cancelled' where id = 'fc000000-0000-4000-8000-0000000000f2';
select pg_temp.como('service_role');
select is(public.confirmar_pedido_pago('fc000000-0000-4000-8000-0000000000f2', 'ORDE_3', 11000), 'estorno', 'pedido cancelado: estorno');
select is((select resultado from public.webhook_events where event_id = 'ORDE_3'), 'pagamento_tardio', 'tardio: registrado em webhook_events');

-- f4: gateway_payment_id já usado em outro pedido (índice único) -> conflito, pedido segue pending
select pg_temp.como('postgres');
insert into public.orders (id, user_id, event_id, subtotal, service_fee, total, status, payment_method) values
  ('fc000000-0000-4000-8000-0000000000f4', 'fc000000-0000-4000-8000-00000000000a', 'fc000000-0000-4000-8000-0000000000e1', 100, 10, 110, 'pending', 'pix');
insert into public.order_items (order_id, ticket_type_id, quantity, unit_price, subtotal) values
  ('fc000000-0000-4000-8000-0000000000f4', 'fc000000-0000-4000-8000-0000000000b1', 2, 50, 100);
select pg_temp.como('service_role');
select is(public.confirmar_pedido_pago('fc000000-0000-4000-8000-0000000000f4', 'ORDE_1', 11000), 'conflito', 'id do gateway de outro pedido: conflito');
select is((select status from public.orders where id = 'fc000000-0000-4000-8000-0000000000f4') || '/' || (select count(*) from public.tickets where order_id = 'fc000000-0000-4000-8000-0000000000f4'), 'pending/0', 'conflito de id: pedido segue pending, sem ingresso');

-- f4 com o lugar vencido: gatilho orders_pago_assento_guard recusa -> estorno, nada emitido, sold intacto
select pg_temp.como('postgres');
insert into public.pedido_assentos (order_id, event_id, seat_key, ticket_type_id, lugares, expira_em) values
  ('fc000000-0000-4000-8000-0000000000f4', 'fc000000-0000-4000-8000-0000000000e1', 'A1', 'fc000000-0000-4000-8000-0000000000b1', 2, now() - interval '1 minute');
select pg_temp.como('service_role');
select is(public.confirmar_pedido_pago('fc000000-0000-4000-8000-0000000000f4', 'ORDE_4', 11000) || '/' || (select count(*) from public.tickets where order_id = 'fc000000-0000-4000-8000-0000000000f4') || '/' || (select sold from public.ticket_types where id = 'fc000000-0000-4000-8000-0000000000b1'), 'estorno/0/2', 'gatilho recusa (lugar vencido): estorno, sem ingresso, sold intacto');

-- pedido inexistente
select is(public.confirmar_pedido_pago('fc000000-0000-4000-8000-0000000000ff', 'ORDE_9', 11000), 'nao_encontrado', 'pedido inexistente: nao_encontrado');

-- unicidade de webhook_events (como dono)
select pg_temp.como('postgres');
select throws_ok($$insert into public.webhook_events (gateway, event_id) values ('pagbank', 'ORDE_1')$$, '23505', null, 'webhook_events: (gateway, event_id) repetido falha');

select * from finish();
rollback;
