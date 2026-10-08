-- pgTAP de docs/sql/20261022_pedido_gratis_e_estoque.sql. Só no banco local: `supabase start`, aplicar o SQL (e antes os de docs/sql
-- que vieram depois do baseline: 20261017_f1_pr3e_visibilidade traz pode_comprar) e rodar `supabase test db`.
-- Tudo em begin ... rollback: nada fica gravado. Nunca contra produção. Mesmo esquema de papel/claims de favoritos.test.sql.
-- O 2º pedido pendente do mesmo usuário e evento NÃO falha: cancela o anterior (gatilho orders_um_pendente).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(16);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', p_role, true);
end $f$;
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- Dados (como postgres): a compradora, p produtora; evento aberto daqui a 7 dias
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('fb000000-0000-4000-8000-00000000000a', 'a@teste-gratis.local', now(), '{"full_name":"Ana"}'),
  ('fb000000-0000-4000-8000-000000000009', 'p@teste-gratis.local', now(), '{"role":"producer","full_name":"Paula"}');
insert into public.events (id, producer_id, title, slug, status, approval_status, start_date) values
  ('fb000000-0000-4000-8000-0000000000e1', 'fb000000-0000-4000-8000-000000000009', 'Gratis', 'gratis-e1', 'published', 'approved', now() + interval '7 days');
-- b1 pago; b2 grátis (lotação 5, máximo 5); b3 grátis com vendas só a partir de amanhã; b5 grátis sem máximo (teto 10) e lotação 50
insert into public.ticket_types (id, event_id, name, price, quantity_total, max_per_order, sale_start) values
  ('fb000000-0000-4000-8000-0000000000b1', 'fb000000-0000-4000-8000-0000000000e1', 'Pago', 50, 10, null, null),
  ('fb000000-0000-4000-8000-0000000000b2', 'fb000000-0000-4000-8000-0000000000e1', 'Grátis', 0, 5, 5, null),
  ('fb000000-0000-4000-8000-0000000000b3', 'fb000000-0000-4000-8000-0000000000e1', 'Futuro', 0, 5, null, now() + interval '1 day'),
  ('fb000000-0000-4000-8000-0000000000b5', 'fb000000-0000-4000-8000-0000000000e1', 'Grátis sem máximo', 0, 50, null, null),
  ('fb000000-0000-4000-8000-0000000000b6', 'fb000000-0000-4000-8000-0000000000e1', 'Pago sem máximo', 50, 50, null, null),
  ('fb000000-0000-4000-8000-0000000000b7', 'fb000000-0000-4000-8000-0000000000e1', 'Grátis 6+4', 0, 50, 10, null);

select pg_temp.como('authenticated', 'fb000000-0000-4000-8000-00000000000a', 'aal2'); -- com aal2: a RLS (inclui gf_mfa_aal2) é exercida como em produção
-- o1: pedido de total 0 com item do tipo PAGO (preço do item adulterado para 0)
insert into public.orders (id, user_id, event_id, total, status) values
  ('fb000000-0000-4000-8000-0000000000f1', 'fb000000-0000-4000-8000-00000000000a', 'fb000000-0000-4000-8000-0000000000e1', 0, 'pending');
-- item adulterado (preço 0 em tipo pago): o navegador já não consegue (RESTRICTIVE de 20261030a); entra como dono para provar a defesa da função
select pg_temp.como('postgres');
insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fb000000-0000-4000-8000-0000000000f1', 'fb000000-0000-4000-8000-0000000000b1', 1, 0);
select pg_temp.como('authenticated', 'fb000000-0000-4000-8000-00000000000a', 'aal2');
select throws_ok($$select public.confirmar_pedido_gratis('fb000000-0000-4000-8000-0000000000f1')$$, '22023', null, 'pago via RPC grátis falha');

-- o2: 2º pendente do mesmo usuário e evento cancela o 1º
insert into public.orders (id, user_id, event_id, total, status) values
  ('fb000000-0000-4000-8000-0000000000f2', 'fb000000-0000-4000-8000-00000000000a', 'fb000000-0000-4000-8000-0000000000e1', 0, 'pending');
select is((select status from public.orders where id = 'fb000000-0000-4000-8000-0000000000f1'), 'cancelled', '2º pendente cancela o 1º');
select is((select count(*) from public.orders where user_id = 'fb000000-0000-4000-8000-00000000000a' and status = 'pending'), 1::bigint, 'só 1 pendente por usuário e evento');

select throws_ok($$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fb000000-0000-4000-8000-0000000000f2', 'fb000000-0000-4000-8000-0000000000b2', 6, 0)$$, '22023', null, 'quantidade acima do máximo falha');
select throws_ok($$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fb000000-0000-4000-8000-0000000000f2', 'fb000000-0000-4000-8000-0000000000b3', 1, 0)$$, '22023', null, 'fora da janela de venda falha');

-- grátis ok
insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fb000000-0000-4000-8000-0000000000f2', 'fb000000-0000-4000-8000-0000000000b2', 2, 0);
-- o máximo (5) vale por pedido e tipo, não por linha: 2 + 4 em duas linhas do mesmo tipo passa de 5
select throws_ok($$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fb000000-0000-4000-8000-0000000000f2', 'fb000000-0000-4000-8000-0000000000b2', 4, 0)$$, '22023', null, 'várias linhas do mesmo tipo somam acima do máximo falha');
select is(public.confirmar_pedido_gratis('fb000000-0000-4000-8000-0000000000f2'), 2, 'grátis: RPC devolve 2 ingressos emitidos');
select pg_temp.como('postgres');
select is((select count(*) from public.tickets where order_id = 'fb000000-0000-4000-8000-0000000000f2'), 2::bigint, 'grátis: 2 tickets gravados');
select is((select sold from public.ticket_types where id = 'fb000000-0000-4000-8000-0000000000b2'), 2, 'grátis: sold somou 2');
select is((select status from public.orders where id = 'fb000000-0000-4000-8000-0000000000f2'), 'paid', 'grátis: pedido virou paid');

-- lotação: pedido de 3 passa no gatilho (sold 2 + 3 = 5), mas se sold subir antes da confirmação a RPC recusa
select pg_temp.como('authenticated', 'fb000000-0000-4000-8000-00000000000a', 'aal2');
insert into public.orders (id, user_id, event_id, total, status) values
  ('fb000000-0000-4000-8000-0000000000f3', 'fb000000-0000-4000-8000-00000000000a', 'fb000000-0000-4000-8000-0000000000e1', 0, 'pending');
insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fb000000-0000-4000-8000-0000000000f3', 'fb000000-0000-4000-8000-0000000000b2', 3, 0);
select pg_temp.como('postgres');
update public.ticket_types set sold = 4 where id = 'fb000000-0000-4000-8000-0000000000b2';
select pg_temp.como('authenticated', 'fb000000-0000-4000-8000-00000000000a', 'aal2');
select throws_ok($$select public.confirmar_pedido_gratis('fb000000-0000-4000-8000-0000000000f3')$$, '22023', null, 'lotação: RPC recusa quando sold + quantidade passa da lotação');

-- limite por conta (teto 10 do tipo sem máximo): 6 ingressos pagos + 5 em outro pedido = 11 > 10
insert into public.orders (id, user_id, event_id, total, status) values
  ('fb000000-0000-4000-8000-0000000000f4', 'fb000000-0000-4000-8000-00000000000a', 'fb000000-0000-4000-8000-0000000000e1', 0, 'pending');
insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fb000000-0000-4000-8000-0000000000f4', 'fb000000-0000-4000-8000-0000000000b5', 6, 0);
select is(public.confirmar_pedido_gratis('fb000000-0000-4000-8000-0000000000f4'), 6, 'por conta: 1º pedido de 6 passa');
insert into public.orders (id, user_id, event_id, total, status) values
  ('fb000000-0000-4000-8000-0000000000f5', 'fb000000-0000-4000-8000-00000000000a', 'fb000000-0000-4000-8000-0000000000e1', 0, 'pending');
insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fb000000-0000-4000-8000-0000000000f5', 'fb000000-0000-4000-8000-0000000000b5', 5, 0);
select throws_ok($$select public.confirmar_pedido_gratis('fb000000-0000-4000-8000-0000000000f5')$$, '22023', 'Limite de 10 ingressos por pessoa em "Grátis sem máximo": você já tem 11 (com este pedido)', 'por conta: 2º pedido que soma 11 > 10 é recusado');

-- tipo PAGO sem max_per_order: teto de 10 por pedido desde 20261030a (antes era sem teto)
insert into public.orders (id, user_id, event_id, total, status) values
  ('fb000000-0000-4000-8000-0000000000f6', 'fb000000-0000-4000-8000-00000000000a', 'fb000000-0000-4000-8000-0000000000e1', 600, 'pending');
select lives_ok($$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fb000000-0000-4000-8000-0000000000f6', 'fb000000-0000-4000-8000-0000000000b6', 10, 50)$$, 'pago sem máximo aceita 10 (teto novo)');
select throws_ok($$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fb000000-0000-4000-8000-0000000000f6', 'fb000000-0000-4000-8000-0000000000b5', 11, 0)$$, '22023', 'Limite de 10 ingressos por pedido deste tipo', 'grátis sem máximo continua com teto 10 por pedido');

-- confirmação com 2 linhas do mesmo tipo grátis: 6 + 4 passam no gatilho (máx. 10); com o máximo baixado para 8, a soma (10) falha
insert into public.orders (id, user_id, event_id, total, status) values
  ('fb000000-0000-4000-8000-0000000000f7', 'fb000000-0000-4000-8000-00000000000a', 'fb000000-0000-4000-8000-0000000000e1', 0, 'pending');
insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fb000000-0000-4000-8000-0000000000f7', 'fb000000-0000-4000-8000-0000000000b7', 6, 0),
  ('fb000000-0000-4000-8000-0000000000f7', 'fb000000-0000-4000-8000-0000000000b7', 4, 0);
select pg_temp.como('postgres');
update public.ticket_types set max_per_order = 8 where id = 'fb000000-0000-4000-8000-0000000000b7';
select pg_temp.como('authenticated', 'fb000000-0000-4000-8000-00000000000a', 'aal2');
select throws_ok($$select public.confirmar_pedido_gratis('fb000000-0000-4000-8000-0000000000f7')$$, '22023', 'Limite de 8 ingressos por pessoa em "Grátis 6+4": você já tem 10 (com este pedido)', 'confirmação: 2 linhas do mesmo tipo somando acima do teto falha');

select * from finish();
rollback;
