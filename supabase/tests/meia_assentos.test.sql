-- pgTAP de docs/sql/20261030f_meia_assentos.sql (meia-entrada em lugar marcado individual). Só no banco local descartável: aplicar antes os de
-- docs/sql até 20261030a e o próprio 20261030f, e rodar `supabase test db`. Tudo em begin ... rollback. Nunca contra produção.
-- Não usa CPF (reservar_assentos não pede); os CPFs fictícios de venda_servidor_meia.test.sql não são necessários aqui.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(37);

create function pg_temp.como(p_role text, p uuid default null) returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then 'aal2' end,
    'email', case when p is not null then 'u' || right(p::text, 2) || '@teste-meia.local' end))::text end, true);
  perform set_config('role', p_role, true);
end $f$;
grant execute on function pg_temp.como(text, uuid) to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;
create temp table res (k text primary key, j jsonb);
grant all on pg_temp.res to authenticated;

-- u01..u08 compradores; u09 = produtora
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select ('fe000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'u' || lpad(n::text, 2, '0') || '@teste-meia.local', now(),
       case when n = 9 then '{"role":"producer","full_name":"Paula"}' else '{"full_name":"Comprador"}' end::jsonb from generate_series(1, 9) n;
insert into public.events (id, producer_id, title, slug, status, approval_status, start_date, venue_state) values
  ('fe000000-0000-4000-8000-0000000000e1', 'fe000000-0000-4000-8000-000000000009', 'Meia no mapa', 'meia-mapa-e1', 'published', 'approved', now() + interval '7 days', 'SP');
-- b1 Plateia R$ 100 (lotação 10, cota de meia 4); b2 Mesa R$ 80; b3 Grátis; b4 R$ 50 sem meia (permite_meia=false); b5 VIP R$ 60 lotação 0 (sem teto)
insert into public.ticket_types (id, event_id, name, price, quantity_total, type, is_active) values
  ('fe000000-0000-4000-8000-0000000000b1', 'fe000000-0000-4000-8000-0000000000e1', 'Plateia', 100, 10, 'individual', true),
  ('fe000000-0000-4000-8000-0000000000b2', 'fe000000-0000-4000-8000-0000000000e1', 'Mesa', 80, 20, 'mesa', true),
  ('fe000000-0000-4000-8000-0000000000b3', 'fe000000-0000-4000-8000-0000000000e1', 'Grátis', 0, 20, 'individual', true),
  ('fe000000-0000-4000-8000-0000000000b4', 'fe000000-0000-4000-8000-0000000000e1', 'Sem meia', 50, 20, 'individual', true),
  ('fe000000-0000-4000-8000-0000000000b5', 'fe000000-0000-4000-8000-0000000000e1', 'VIP', 60, 0, 'vip', true);
update public.ticket_types set permite_meia = false where id = 'fe000000-0000-4000-8000-0000000000b4';
insert into public.seating_maps (event_id, is_active, environments) values ('fe000000-0000-4000-8000-0000000000e1', true,
  jsonb_build_array(jsonb_build_object('id', 'a',
    'sections', jsonb_build_array(
      jsonb_build_object('id', 'sa', 'ticketTypeId', 'fe000000-0000-4000-8000-0000000000b1'),
      jsonb_build_object('id', 'sm', 'ticketTypeId', 'fe000000-0000-4000-8000-0000000000b2'),
      jsonb_build_object('id', 'sg', 'ticketTypeId', 'fe000000-0000-4000-8000-0000000000b3'),
      jsonb_build_object('id', 'sn', 'ticketTypeId', 'fe000000-0000-4000-8000-0000000000b4'),
      jsonb_build_object('id', 'sv', 'ticketTypeId', 'fe000000-0000-4000-8000-0000000000b5')),
    'seats', (select jsonb_agg(jsonb_build_object('id', 'p' || n, 'type', 'seat', 'sectionId', 'sa', 'status', 'free')) from generate_series(1, 10) n)
      || jsonb_build_array(
      jsonb_build_object('id', 't1', 'type', 'table', 'sectionId', 'sa', 'status', 'free', 'seatsCount', 2),
      jsonb_build_object('id', 't2', 'type', 'table', 'sectionId', 'sa', 'status', 'free', 'seatsCount', 1),
      jsonb_build_object('id', 'm1', 'type', 'table', 'sectionId', 'sm', 'status', 'free', 'seatsCount', 4),
      jsonb_build_object('id', 'm2', 'type', 'seat', 'sectionId', 'sm', 'status', 'free'),
      jsonb_build_object('id', 'g1', 'type', 'seat', 'sectionId', 'sg', 'status', 'free'),
      jsonb_build_object('id', 'n1', 'type', 'seat', 'sectionId', 'sn', 'status', 'free'),
      jsonb_build_object('id', 'v1', 'type', 'seat', 'sectionId', 'sv', 'status', 'free'),
      jsonb_build_object('id', 'v2', 'type', 'seat', 'sectionId', 'sv', 'status', 'free'),
      jsonb_build_object('id', 'v3', 'type', 'seat', 'sectionId', 'sv', 'status', 'free')))));
insert into public.beneficios_uf (uf, codigo, nome, documento) values ('SP', 'doador', 'Doador de sangue', 'carteirinha');

-- 1. Permissões e assinatura
select is(to_regprocedure('public.reservar_assentos(uuid, text[])') is null, true, 'a assinatura antiga de 2 argumentos não existe mais (a chamada de 2 argumentos usa o default)');
select is(has_function_privilege('anon', 'public.reservar_assentos(uuid, text[], jsonb)', 'execute'), false, 'anon não executa reservar_assentos');
select is(has_function_privilege('authenticated', 'public.reservar_assentos(uuid, text[], jsonb)', 'execute'), true, 'authenticated executa reservar_assentos');
select is(position('20261030f' in pg_get_functiondef('public.order_items_estoque_guard()'::regprocedure)) > 0, true, 'guard com a marca 20261030f');

-- 2. Chamada antiga (2 argumentos): tudo inteira, preço e taxa pelo servidor
select pg_temp.como('authenticated', 'fe000000-0000-4000-8000-000000000001');
insert into pg_temp.res select 'inteira', public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:p1', 'a:p2']);
select pg_temp.como('postgres');
select results_eq($$select o.subtotal, o.service_fee, o.total from public.orders o where o.id = (select (j->>'order_id')::uuid from pg_temp.res where k = 'inteira')$$,
  $$values (200.00::numeric, 20.00::numeric, 220.00::numeric)$$, '2 lugares de R$ 100 como inteira: subtotal 200, taxa 20 (10%), total 220');
select results_eq($$select oi.beneficio, oi.meia_tipo, oi.quantity, oi.unit_price, oi.taxa_unit from public.order_items oi
  where oi.order_id = (select (j->>'order_id')::uuid from pg_temp.res where k = 'inteira')$$,
  $$values ('inteira'::text, null::text, 2, 100.00::numeric, 10.00::numeric)$$, 'um item inteira com taxa_unit gravada');
select is((select (j->>'meias')::int from pg_temp.res where k = 'inteira'), 0, 'retorno: 0 meias');

-- 3. Meia em lugar individual: u02 pega p3 meia estudante + p4 inteira
select pg_temp.como('authenticated', 'fe000000-0000-4000-8000-000000000002');
insert into pg_temp.res select 'mista', public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:p3', 'a:p4'],
  '[{"seat_key":"a:p3","meia_tipo":"estudante"}]');
select pg_temp.como('postgres');
select results_eq($$select o.subtotal, o.service_fee, o.total from public.orders o where o.id = (select (j->>'order_id')::uuid from pg_temp.res where k = 'mista')$$,
  $$values (150.00::numeric, 15.00::numeric, 165.00::numeric)$$, 'meia R$ 50 (taxa 5) + inteira R$ 100 (taxa 10): subtotal 150, taxa 15, total 165');
select results_eq($$select oi.beneficio, oi.meia_tipo, oi.quantity, oi.unit_price, oi.taxa_unit, oi.subtotal from public.order_items oi
  where oi.order_id = (select (j->>'order_id')::uuid from pg_temp.res where k = 'mista') order by oi.beneficio$$,
  $$values ('inteira'::text, null::text, 1, 100.00::numeric, 10.00::numeric, 100.00::numeric), ('meia', 'estudante', 1, 50.00, 5.00, 50.00)$$, 'itens separados: inteira e meia estudante');
select is((select (j->>'meias')::int from pg_temp.res where k = 'mista'), 1, 'retorno: 1 meia');
select is((select count(*)::int from public.pedido_assentos where order_id = (select (j->>'order_id')::uuid from pg_temp.res where k = 'mista') and liberada_em is null), 2, 'os 2 lugares ficaram presos ao pedido');

-- 4. Recusas de regra (mensagem uniforme para mesa, tipo mesa, grátis e permite_meia=false)
select pg_temp.como('authenticated', 'fe000000-0000-4000-8000-000000000003');
select throws_ok($$select public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:t1'], '[{"seat_key":"a:t1","meia_tipo":"estudante"}]')$$,
  '22023', 'Meia-entrada não disponível para algum dos lugares escolhidos', 'meia em mesa (table) de tipo individual é recusada');
select throws_ok($$select public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:m1'], '[{"seat_key":"a:m1","meia_tipo":"estudante"}]')$$,
  '22023', 'Meia-entrada não disponível para algum dos lugares escolhidos', 'meia em mesa de tipo mesa é recusada (mesma mensagem)');
select throws_ok($$select public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:m2'], '[{"seat_key":"a:m2","meia_tipo":"estudante"}]')$$,
  '22023', 'Meia-entrada não disponível para algum dos lugares escolhidos', 'meia em lugar de tipo mesa é recusada');
select throws_ok($$select public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:g1'], '[{"seat_key":"a:g1","meia_tipo":"estudante"}]')$$,
  '22023', 'Meia-entrada não disponível para algum dos lugares escolhidos', 'meia em tipo grátis é recusada');
select throws_ok($$select public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:n1'], '[{"seat_key":"a:n1","meia_tipo":"estudante"}]')$$,
  '22023', 'Meia-entrada não disponível para algum dos lugares escolhidos', 'meia em tipo com permite_meia=false é recusada');
select throws_ok($$select public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:p5'], '[{"seat_key":"a:p6","meia_tipo":"estudante"}]')$$,
  '22023', 'Meia inválida: informe o lugar (entre os escolhidos) e o tipo de meia-entrada', 'meia em lugar que não está entre os escolhidos é recusada');
select throws_ok($$select public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:p5'], '[{"seat_key":"a:p5","meia_tipo":"estudante"},{"seat_key":"a:p5","meia_tipo":"pcd"}]')$$,
  '22023', 'Meia inválida: informe o lugar (entre os escolhidos) e o tipo de meia-entrada', 'lugar repetido nas meias é recusado');
select throws_ok($$select public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:p5'], '{"seat_key":"a:p5"}')$$,
  '22023', 'Meia inválida: informe o lugar (entre os escolhidos) e o tipo de meia-entrada', 'p_meias que não é lista é recusado');
select throws_ok($$select public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:p5'], '[{"seat_key":"a:p5","meia_tipo":7}]')$$,
  '22023', 'Meia inválida: informe o lugar (entre os escolhidos) e o tipo de meia-entrada', 'meia_tipo que não é texto é recusado (sem erro de cast)');
select throws_ok($$select public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:p5'], '[{"seat_key":"a:p5","meia_tipo":"inventado"}]')$$,
  '22023', 'Tipo de meia-entrada inválido para este evento', 'meia_tipo desconhecido é recusado');
select is((select count(*)::int from public.orders where user_id = 'fe000000-0000-4000-8000-000000000003'), 0, 'nenhuma recusa deixou pedido');

-- 5. Tipo estadual (beneficios_uf da UF do evento) vale; preço enviado pelo cliente é ignorado
select pg_temp.como('authenticated', 'fe000000-0000-4000-8000-000000000003');
insert into pg_temp.res select 'estadual', public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:p5'],
  '[{"seat_key":"a:p5","meia_tipo":"doador","unit_price":1,"cent":1}]');
select pg_temp.como('postgres');
select results_eq($$select oi.beneficio, oi.meia_tipo, oi.unit_price, oi.taxa_unit from public.order_items oi
  where oi.order_id = (select (j->>'order_id')::uuid from pg_temp.res where k = 'estadual')$$,
  $$values ('meia'::text, 'doador'::text, 50.00::numeric, 5.00::numeric)$$, 'meia estadual cadastrada vale; unit_price enviado pelo cliente é ignorado (preço = metade do banco)');

-- 6. Cota de 40% (ceil) no lugar marcado: Plateia lotação 10 = 4 meias. Já há 2 (u02 p3, u03 p5); u04 pega mais 2
select pg_temp.como('authenticated', 'fe000000-0000-4000-8000-000000000004');
select lives_ok($$select public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:p6', 'a:p7'],
  '[{"seat_key":"a:p6","meia_tipo":"pcd"},{"seat_key":"a:p7","meia_tipo":"pcd_acompanhante"}]')$$, 'duas meias de tipos diferentes no mesmo pedido');
select pg_temp.como('authenticated', 'fe000000-0000-4000-8000-000000000005');
select throws_ok($$select public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:p8'], '[{"seat_key":"a:p8","meia_tipo":"estudante"}]')$$,
  '22023', 'Restam 0 meias neste ingresso', 'a 5ª meia é recusada pela cota de 40%');
select lives_ok($$select public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:p8'])$$,
  'a inteira ainda vende: no lugar marcado a cota limita a meia mas não guarda vagas');
-- lotação 10: já há 2 (u01) + 2 (u02) + 1 (u03) + 2 (u04) + 1 (u05) = 8; a cota não tira lugar da inteira

-- 7. Tipo sem lotação (VIP, lotação 0): sem base para a cota de 40%, meia recusada (M1); inteira vende
select pg_temp.como('authenticated', 'fe000000-0000-4000-8000-000000000006');
select throws_ok($$select public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:v1', 'a:v2'],
  '[{"seat_key":"a:v1","meia_tipo":"estudante"}]')$$, '22023', 'Meia-entrada não disponível para algum dos lugares escolhidos', 'VIP com lotação 0: meia recusada (cota sem base)');
insert into pg_temp.res select 'vip', public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:v1']);
select pg_temp.como('postgres');
select results_eq($$select oi.beneficio, oi.quantity, oi.unit_price from public.order_items oi
  where oi.order_id = (select (j->>'order_id')::uuid from pg_temp.res where k = 'vip')$$,
  $$values ('inteira'::text, 1, 60.00::numeric)$$, 'VIP lotação 0: a inteira continua vendendo');
select pg_temp.como('authenticated', 'fe000000-0000-4000-8000-000000000008');
select throws_ok($$select public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:p9', null], '[{"seat_key":"a:p10","meia_tipo":"estudante"}]')$$,
  '22023', 'Meia inválida: informe o lugar (entre os escolhidos) e o tipo de meia-entrada', 'NULL em p_seats não driblava a conferência: meia em lugar não escolhido é recusada');
select throws_ok($$select public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:t2'], '[{"seat_key":"a:t2","meia_tipo":"estudante"}]')$$,
  '22023', 'Meia-entrada não disponível para algum dos lugares escolhidos', 'mesa de 1 lugar em tipo individual: meia recusada');
-- 8. Mesa inteira continua vendendo (4 cadeiras do tipo mesa) e a recusa é a de sempre para quem já tem o lugar
select pg_temp.como('authenticated', 'fe000000-0000-4000-8000-000000000007');
insert into pg_temp.res select 'mesa', public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:m1']);
select pg_temp.como('postgres');
select results_eq($$select oi.beneficio, oi.quantity, oi.unit_price from public.order_items oi
  where oi.order_id = (select (j->>'order_id')::uuid from pg_temp.res where k = 'mesa')$$,
  $$values ('inteira'::text, 4, 80.00::numeric)$$, 'mesa inteira: 4 cadeiras a R$ 80 como antes');
select pg_temp.como('authenticated', 'fe000000-0000-4000-8000-000000000008');
select throws_ok($$select public.reservar_assentos('fe000000-0000-4000-8000-0000000000e1', array['a:p3'], '[{"seat_key":"a:p3","meia_tipo":"estudante"}]')$$,
  '22023', 'Lugar acabou de ser escolhido', 'meia em lugar já reservado por outra conta: a mesma recusa da inteira (e nada fica gravado)');

-- 9. O guard barra meia em tipo do mapa sem lugar individual preso ao pedido (inserção direta, como dono)
select pg_temp.como('postgres');
insert into public.orders (id, user_id, event_id, subtotal, service_fee, total, status)
values ('fe000000-0000-4000-8000-0000000000f1', 'fe000000-0000-4000-8000-000000000008', 'fe000000-0000-4000-8000-0000000000e1', 50, 5, 55, 'pending');
select throws_ok($$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price, subtotal, beneficio, meia_tipo, taxa_unit)
  values ('fe000000-0000-4000-8000-0000000000f1', 'fe000000-0000-4000-8000-0000000000b4', 1, 25, 25, 'meia', 'estudante', 5)$$,
  '22023', 'Este ingresso não tem meia-entrada', 'guard: tipo sem permite_meia continua recusando');
select throws_ok($$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price, subtotal, beneficio, meia_tipo, taxa_unit)
  values ('fe000000-0000-4000-8000-0000000000f1', 'fe000000-0000-4000-8000-0000000000b1', 1, 50, 50, 'meia', 'estudante', 5)$$,
  '22023', 'Meia-entrada em lugar marcado só vale em lugar individual escolhido', 'guard: meia em tipo do mapa sem lugar individual preso ao pedido é recusada');

-- 9b. Lotação 0 no guard e em reservar_ingressos (porta de tipo sem lugar marcado): meia recusada, inteira vende
insert into public.ticket_types (id, event_id, name, price, quantity_total, type, is_active) values
  ('fe000000-0000-4000-8000-0000000000b6', 'fe000000-0000-4000-8000-0000000000e1', 'Sem lotação', 40, 0, 'individual', true);
select throws_ok($$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price, subtotal, beneficio, meia_tipo, taxa_unit)
  values ('fe000000-0000-4000-8000-0000000000f1', 'fe000000-0000-4000-8000-0000000000b6', 1, 20, 20, 'meia', 'estudante', 3)$$,
  '22023', 'Meia-entrada não disponível para algum dos lugares escolhidos', 'guard: meia em tipo de lotação 0 é recusada');
select pg_temp.como('authenticated', 'fe000000-0000-4000-8000-000000000005');
select is((select public.reservar_ingressos('fe000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fe000000-0000-4000-8000-0000000000b6","quantidade":1,"beneficio":"meia","meia_tipo":"estudante"}]')->>'mensagem'),
  'Meia-entrada não disponível para algum dos lugares escolhidos', 'reservar_ingressos: meia em tipo de lotação 0 volta ok:false com a mensagem uniforme');

-- 10. Navegador (authenticated) não grava item de meia direto: política gf_order_items_so_inteira
select pg_temp.como('authenticated', 'fe000000-0000-4000-8000-000000000008');
select throws_ok($$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price, subtotal, beneficio, meia_tipo)
  values ('fe000000-0000-4000-8000-0000000000f1', 'fe000000-0000-4000-8000-0000000000b1', 1, 50, 50, 'meia', 'estudante')$$,
  '42501', null, 'INSERT direto de item meia como authenticated é negado pela política RESTRICTIVE');

select * from finish();
rollback;
