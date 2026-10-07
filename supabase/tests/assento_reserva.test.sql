-- pgTAP de docs/sql/20261008_assento_reserva.sql. Só no banco local descartável: aplicar antes 20261017_f1_pr3e_visibilidade (traz evento_acesso),
-- 20261021, 20261022 e o próprio 20261008, e rodar `supabase test db`. Tudo em begin ... rollback: nada fica gravado. Nunca contra produção.
-- Dentro do pgTAP now() é fixo (uma transação só): vencimento é simulado mexendo em expira_em e created_at. A corrida de verdade
-- (dois compradores ao mesmo tempo, com commit) está em supabase/tests/corrida_assento.sh.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(31);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', p_role, true);
end $f$;
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- a, b, c, d, e = compradores; p = produtora. Evento e1 (aberto) com mapa; e2 (rascunho)
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('fc000000-0000-4000-8000-00000000000a', 'a@teste-assento.local', now(), '{"full_name":"Ana"}'),
  ('fc000000-0000-4000-8000-00000000000b', 'b@teste-assento.local', now(), '{"full_name":"Bia"}'),
  ('fc000000-0000-4000-8000-00000000000c', 'c@teste-assento.local', now(), '{"full_name":"Caio"}'),
  ('fc000000-0000-4000-8000-00000000000d', 'd@teste-assento.local', now(), '{"full_name":"Duda"}'),
  ('fc000000-0000-4000-8000-000000000009', 'p@teste-assento.local', now(), '{"role":"producer","full_name":"Paula"}');
insert into public.events (id, producer_id, title, slug, status, approval_status, start_date) values
  ('fc000000-0000-4000-8000-0000000000e1', 'fc000000-0000-4000-8000-000000000009', 'Mapa', 'assento-e1', 'published', 'approved', now() + interval '7 days'),
  ('fc000000-0000-4000-8000-0000000000e2', 'fc000000-0000-4000-8000-000000000009', 'Rascunho', 'assento-e2', 'draft', 'pending', now() + interval '7 days');
-- b1 pago R$ 50 (lotação 20); b2 grátis (lotação 20)
insert into public.ticket_types (id, event_id, name, price, quantity_total, max_per_order) values
  ('fc000000-0000-4000-8000-0000000000b1', 'fc000000-0000-4000-8000-0000000000e1', 'Pago', 50, 20, null),
  ('fc000000-0000-4000-8000-0000000000b2', 'fc000000-0000-4000-8000-0000000000e1', 'Grátis', 0, 20, 10);
insert into public.seating_maps (event_id, environments, is_active) values
  ('fc000000-0000-4000-8000-0000000000e1', jsonb_build_array(jsonb_build_object('id', 'terreo',
    'sections', jsonb_build_array(
      jsonb_build_object('id', 'vip', 'ticketTypeId', 'fc000000-0000-4000-8000-0000000000b1'),
      jsonb_build_object('id', 'livre', 'ticketTypeId', 'fc000000-0000-4000-8000-0000000000b2'),
      jsonb_build_object('id', 'sem')),
    'seats', jsonb_build_array(
      jsonb_build_object('id', 's1', 'type', 'seat', 'sectionId', 'vip', 'status', 'free'),
      jsonb_build_object('id', 's2', 'type', 'seat', 'sectionId', 'vip', 'status', 'free'),
      jsonb_build_object('id', 's3', 'type', 'seat', 'sectionId', 'vip', 'status', 'blocked'),
      jsonb_build_object('id', 's4', 'type', 'seat', 'sectionId', 'vip', 'status', 'contact'),
      jsonb_build_object('id', 's5', 'type', 'seat', 'sectionId', 'sem', 'status', 'free'),
      jsonb_build_object('id', 'g1', 'type', 'seat', 'sectionId', 'livre', 'status', 'free'),
      jsonb_build_object('id', 'm1', 'type', 'table', 'sectionId', 'vip', 'status', 'free', 'seatsCount', 4),
      jsonb_build_object('id', 'x1', 'type', 'wall', 'sectionId', 'vip', 'status', 'free')))), true);
insert into public.seating_maps (event_id, environments) values
  ('fc000000-0000-4000-8000-0000000000e2', '[]');
select is((select is_active from public.seating_maps where event_id = 'fc000000-0000-4000-8000-0000000000e2'), false, 'mapa novo nasce desligado (is_active false)');

-- 1. reserva básica (Ana, aal2 como em produção)
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-00000000000a', 'aal2');
create temp table r1 as select public.reservar_assentos('fc000000-0000-4000-8000-0000000000e1', array['terreo:s1']) as r;
grant select on r1 to authenticated;
select ok((select (r->>'order_id') is not null and (r->>'expira_em')::timestamptz > now() + interval '9 minutes' from r1), 'reserva devolve order_id e expira_em em 10 min');
select results_eq($$select status, subtotal, service_fee, total from public.orders where id = (select (r->>'order_id')::uuid from r1)$$,
  $$values ('pending'::text, 50.00::numeric, 5.00::numeric, 55.00::numeric)$$, 'pedido pendente com preço do banco (50 + taxa 10% = 55)');
select results_eq($$select quantity, unit_price from public.order_items where order_id = (select (r->>'order_id')::uuid from r1)$$,
  $$values (1, 50.00::numeric)$$, 'item com 1 ingresso a R$ 50 (preço do banco)');
select pg_temp.como('anon');
select results_eq($$select seat_key, estado from public.assentos_ocupados('fc000000-0000-4000-8000-0000000000e1')$$,
  $$values ('terreo:s1'::text, 'reservado'::text)$$, 'anon vê o lugar como reservado, sem dado pessoal');
select throws_ok($$select * from public.pedido_assentos$$, '42501', null, 'anon não lê pedido_assentos');
select throws_ok($$select public.reservar_assentos('fc000000-0000-4000-8000-0000000000e1', array['terreo:s2'])$$, '42501', null, 'anon não reserva');

-- 2. conflito: Bia tenta o lugar da Ana
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-00000000000b', 'aal2');
select throws_ok($$select public.reservar_assentos('fc000000-0000-4000-8000-0000000000e1', array['terreo:s1'])$$, '22023', 'Lugar acabou de ser escolhido', 'conflito: lugar já reservado por outra conta');
select is((select count(*) from public.orders where user_id = 'fc000000-0000-4000-8000-00000000000b'), 0::bigint, 'conflito não deixa pedido da Bia (transação desfeita)');

-- 3. lugares inválidos
select throws_ok($$select public.reservar_assentos('fc000000-0000-4000-8000-0000000000e1', array['terreo:s3'])$$, '22023', null, 'lugar bloqueado recusado');
select throws_ok($$select public.reservar_assentos('fc000000-0000-4000-8000-0000000000e1', array['terreo:s4'])$$, '22023', null, 'lugar "contato" recusado');
select throws_ok($$select public.reservar_assentos('fc000000-0000-4000-8000-0000000000e1', array['terreo:s5'])$$, '22023', null, 'setor sem tipo de ingresso recusado');
select throws_ok($$select public.reservar_assentos('fc000000-0000-4000-8000-0000000000e1', array['terreo:x1'])$$, '22023', null, 'elemento que não é assento nem mesa recusado');
select throws_ok($$select public.reservar_assentos('fc000000-0000-4000-8000-0000000000e1', array['terreo:nao-existe'])$$, '22023', null, 'chave inexistente recusada');
select throws_ok($$select public.reservar_assentos('fc000000-0000-4000-8000-0000000000e2', array['terreo:s1'])$$, '22023', null, 'evento fora do ar recusado');

-- 4. liberação após 10 min: vence a reserva da Ana; Bia pega o lugar e o pedido da Ana é cancelado
select pg_temp.como('postgres');
update public.pedido_assentos set expira_em = now() - interval '1 minute';
select pg_temp.como('anon');
select is((select count(*) from public.assentos_ocupados('fc000000-0000-4000-8000-0000000000e1')), 0::bigint, 'reserva vencida some de assentos_ocupados');
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-00000000000b', 'aal2');
create temp table r2 as select public.reservar_assentos('fc000000-0000-4000-8000-0000000000e1', array['terreo:s1']) as r;
grant select on r2 to authenticated;
select ok((select (r->>'order_id') is not null from r2), 'depois de vencer, outra conta reserva o mesmo lugar');
select pg_temp.como('postgres');
select is((select status from public.orders where id = (select (r->>'order_id')::uuid from r1)), 'cancelled', 'pedido vencido da Ana foi cancelado');
select throws_ok($$update public.orders set status = 'paid' where id = (select (r->>'order_id')::uuid from r1)$$, '22023', null, 'pagamento tardio do pedido cujo lugar foi liberado é recusado (D2)');

-- 5. pago com reserva dentro do prazo vira vendido
update public.orders set status = 'paid' where id = (select (r->>'order_id')::uuid from r2);
select pg_temp.como('anon');
select results_eq($$select seat_key, estado from public.assentos_ocupados('fc000000-0000-4000-8000-0000000000e1')$$,
  $$values ('terreo:s1'::text, 'vendido'::text)$$, 'pedido pago: o lugar vira vendido');
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-00000000000a', 'aal2');
select throws_ok($$select public.reservar_assentos('fc000000-0000-4000-8000-0000000000e1', array['terreo:s1'])$$, '22023', 'Lugar acabou de ser escolhido', 'lugar vendido não é reservável nem depois do prazo');

-- 6. mesa = 4 ingressos
create temp table r3 as select public.reservar_assentos('fc000000-0000-4000-8000-0000000000e1', array['terreo:m1', 'terreo:s2']) as r;
select is((select sum(quantity)::int from public.order_items where order_id = (select (r->>'order_id')::uuid from r3)), 5, 'mesa de 4 + 1 assento = 5 ingressos no pedido');

-- 7. pedido com lugar vence em 10 min no cron, sem lugar só em 30
select pg_temp.como('postgres');
update public.orders set created_at = now() - interval '11 minutes' where id = (select (r->>'order_id')::uuid from r3);
select is(public.pedidos_pendentes_expirar(30), 1, 'cron: pedido com lugar de 11 min é cancelado');
select is((select status from public.orders where id = (select (r->>'order_id')::uuid from r3)), 'cancelled', 'cron: o pedido com lugar ficou cancelado');

-- 8. grátis com lugar dentro do prazo funciona
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-00000000000d', 'aal2');
create temp table r4 as select public.reservar_assentos('fc000000-0000-4000-8000-0000000000e1', array['terreo:g1']) as r;
grant select on r4 to authenticated;
select is(public.confirmar_pedido_gratis((select (r->>'order_id')::uuid from r4)), 1, 'grátis com lugar: confirma e emite 1 ingresso');
select pg_temp.como('anon');
select ok(exists (select 1 from public.assentos_ocupados('fc000000-0000-4000-8000-0000000000e1') where seat_key = 'terreo:g1' and estado = 'vendido'), 'grátis com lugar: lugar vendido');

-- 9. 6º pedido na hora recusado (Caio): 5 reservas passam, a 6ª não
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-00000000000c', 'aal2');
select lives_ok($q$do $b$ begin for i in 1..5 loop perform public.reservar_assentos('fc000000-0000-4000-8000-0000000000e1', array['terreo:s2']); end loop; end $b$$q$, '5 pedidos na hora passam');
select throws_ok($$select public.reservar_assentos('fc000000-0000-4000-8000-0000000000e1', array['terreo:s2'])$$, '22023', 'Você já fez 5 pedidos neste evento na última hora. Tente de novo mais tarde.', '6º pedido na hora recusado');

-- 10. pago com a reserva vencida (ainda não liberada por ninguém) recusado
select pg_temp.como('postgres');
update public.pedido_assentos set expira_em = now() - interval '1 second'
 where order_id = (select id from public.orders where user_id = 'fc000000-0000-4000-8000-00000000000c' and status = 'pending');
select throws_ok($$update public.orders set status = 'paid' where user_id = 'fc000000-0000-4000-8000-00000000000c' and status = 'pending'$$, '22023', null, 'pagamento com a reserva vencida é recusado (D2)');

-- 11. mapa inativo recusado
update public.seating_maps set is_active = false where event_id = 'fc000000-0000-4000-8000-0000000000e1';
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-00000000000d', 'aal2');
select throws_ok($$select public.reservar_assentos('fc000000-0000-4000-8000-0000000000e1', array['terreo:g1'])$$, '22023', 'Este evento não tem mapa de lugares disponível', 'mapa inativo recusado');

-- 12. assunto de chat
select pg_temp.como('postgres');
select is((select count(*) from public.chat_topics where label = 'Denunciar evento' and audience in ('site', 'participant_evokaa')), 2::bigint, 'assunto "Denunciar evento" em site e participant_evokaa');

select * from finish();
rollback;
