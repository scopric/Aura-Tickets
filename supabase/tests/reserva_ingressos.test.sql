-- pgTAP do M5.1 (docs/sql/20261007_m5_reserva.sql): reserva no servidor, lotes, meia por tipo, taxa espelho, vitrine.
-- Só no banco local: aplicar os docs/sql até 20261007 e rodar `supabase test db`. Tudo em begin ... rollback.
-- Casos 1 a 14 e a versão sequencial do 15 aqui; a corrida de verdade (dois comprador ao mesmo tempo, dados com
-- commit) está em supabase/tests/corrida_reserva.sh.
-- Dentro do pgTAP now() é fixo (uma transação só): reserva vencida e lote encerrado são simulados mexendo nas datas.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(102);

-- pg_temp.como() troca papel e claims do JWT como o PostgREST
create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', p_role, true);
end $f$;
-- ids: evento, grupo, usuário, tipo (grupo, lote) e pedido numerados
create function pg_temp.ev(n int) returns uuid language sql as $f$
  select ('c5000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $f$;
create function pg_temp.gr(n int) returns uuid language sql as $f$
  select ('c5000000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid $f$;
create function pg_temp.us(n int) returns uuid language sql as $f$
  select ('c5000000-0000-4000-8000-0000000002' || lpad(n::text, 2, '0'))::uuid $f$;
create function pg_temp.tid(g int, l int) returns uuid language sql as $f$
  select ('c5000000-0000-4000-8000-00000003' || lpad((g * 10 + l)::text, 4, '0'))::uuid $f$;
create function pg_temp.it(g int, b text, q int) returns jsonb language sql as $f$
  select jsonb_build_object('grupo', pg_temp.gr(g), 'beneficio', b, 'quantidade', q) $f$;
create function pg_temp.rv(e int, itens jsonb, cod text default null) returns jsonb language sql as $f$
  select public.reservar_ingressos(pg_temp.ev(e), itens, cod) $f$;
-- guarda o retorno da reserva em t.<k> (lido depois com current_setting)
create function pg_temp.res(k text, e int, itens jsonb, cod text default null) returns text language sql as $f$
  select set_config('t.' || k, pg_temp.rv(e, itens, cod)::text, true) $f$;
create function pg_temp.pedido_de(k text) returns uuid language sql as $f$
  select (current_setting('t.' || k)::jsonb ->> 'order_id')::uuid $f$;
grant execute on all functions in schema pg_temp to public;
grant execute on all functions in schema extensions to anon, authenticated, service_role;

-- usuários: 1 a 5 compradores, 6 menor de idade, 7 com 2FA, 8 sem nome no perfil, 9 produtor
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select pg_temp.us(n), 'res' || n || '@teste.local', now(), case when n = 9 then '{"role":"producer"}'::jsonb else '{}'::jsonb end
from generate_series(1, 9) n;
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values ('c5000000-0000-4000-8000-0000000000f7', pg_temp.us(7), 'teste', 'totp', 'verified', now(), now());
update public.profiles set full_name = 'Comprador ' || right(id::text, 2), birth_date = date '1990-01-01'
 where id in (select pg_temp.us(n) from generate_series(1, 7) n);
update public.profiles set birth_date = current_date - interval '10 years' where id = pg_temp.us(6);

-- eventos 1 a 16 publicados e aprovados; 17 rascunho
insert into public.events (id, producer_id, title, slug, status, approval_status, start_date)
select pg_temp.ev(n), pg_temp.us(9), 'Evento ' || n, 'res-e' || n, case when n = 17 then 'draft' else 'published' end,
       'approved', now() + interval '30 days'
from generate_series(1, 19) n;

-- tipos: (evento, grupo, lote, preço, capacidade, início, fim, mínimo, máximo, código, tipo). Nome "G<grupo>".
insert into public.ticket_types (id, event_id, name, grupo, lote, price, capacity, sale_start, sale_end,
                                 min_per_order, max_per_order, codigo, type)
select pg_temp.tid(g, l), pg_temp.ev(e), 'G' || g, pg_temp.gr(g), l, preco, cap, ini, fim, coalesce(mn, 1), mx, cod,
       coalesce(tp, 'individual')
from (values
  (1, 1, 1, 19.90, 100, null::timestamptz, null::timestamptz, null::int, 50, null::text, null::text),
  (1, 2, 1, 33.33, 100, null, null, null, 50, null, null),
  (2, 3, 1, 100.00, 10, null, null, null, 50, null, null),
  (2, 3, 2, 150.00, 10, null, null, null, 50, null, null),
  (2, 4, 1, 100.00, 10, null, null, null, 50, null, null),
  (2, 5, 1, 0.00, 5, null, null, null, 50, null, null),
  (3, 6, 1, 100.00, 5, null, null, null, 50, null, null),
  (3, 6, 2, 200.00, 5, null, null, null, 50, null, null),
  (4, 7, 1, 100.00, 5, null, now() - interval '1 day', null, 50, null, null),
  (4, 7, 2, 120.00, 5, null, null, null, 50, null, null),
  (5, 8, 1, 100.00, 5, null, now() - interval '1 day', null, 50, null, null),
  (5, 8, 2, 90.00, 5, now() + interval '1 day', null, null, 50, null, null),
  (6, 9, 1, 100.00, 10, null, now() - interval '1 day', null, 50, null, null),
  (6, 9, 2, 120.00, 10, null, null, null, 50, null, null),
  (7, 10, 1, 50.00, 10, null, null, null, 50, null, null),
  (8, 11, 1, 100.00, 5, null, null, null, 50, null, null),
  (8, 11, 2, 150.00, 5, null, null, null, 50, null, null),
  (9, 12, 1, 50.00, 10, null, null, null, 50, null, null),
  (10, 13, 1, 50.00, 100, null, null, 2, null, null, null),
  (10, 14, 1, 50.00, 100, null, null, null, null, null, null),
  (11, 15, 1, 60.00, 10, null, null, null, 50, null, null),
  (11, 16, 1, 40.00, 10, null, null, null, 50, 'LISTA-AMIGOS', null),
  (12, 17, 1, 0.00, 10, null, null, null, 50, null, null),
  (12, 18, 1, 40.00, 20, null, null, null, 50, null, null),
  (13, 19, 1, 30.00, 10, null, null, null, 50, null, null),
  (17, 20, 1, 30.00, 10, null, null, null, 50, null, null),
  (14, 21, 1, 80.00, 20, null, null, null, 50, null, 'coletiva'),
  (14, 22, 1, 0.00, 10, null, null, null, 50, null, 'coletiva'),
  (15, 23, 1, 50.00, 10, null, null, null, 50, null, null),
  (16, 24, 1, 50.00, 2, null, null, null, 50, null, null),
  (18, 25, 1, 100.00, 10, null, null, null, 50, null, null),
  (18, 25, 2, 150.00, 10, now() + interval '1 day', null, null, 50, null, null),
  (19, 26, 1, 0.00, 10, null, null, null, 50, null, null),
  (19, 27, 1, 40.00, 20, null, null, null, 50, null, null)
) v(e, g, l, preco, cap, ini, fim, mn, mx, cod, tp);

-- pedido direto (como o gateway: postgres): n, comprador, evento, grupo, lote, quantidade, status, validade
create function pg_temp.pedido(n int, u int, e int, g int, l int, q int, st text default 'paid',
                               ate timestamptz default null) returns void language sql as $f$
  with o as (insert into public.orders (id, user_id, event_id, status, reservado_ate, subtotal, total)
             values (('c5000000-0000-4000-8000-0000000004' || lpad(n::text, 2, '0'))::uuid, pg_temp.us(u), pg_temp.ev(e),
                     st, ate, q * 50, q * 50) returning id)
  insert into public.order_items (order_id, ticket_type_id, quantity, unit_price, subtotal)
  select o.id, pg_temp.tid(g, l), q, 50, q * 50 from o $f$;

-- 1. Taxa espelho de app/src/lib/taxa.ts e app/src/test/taxa.test.ts
select is(array(select public.evk_taxa_centavos(c) from unnest(array[0, 1000, 2999, 3000, 10000, 3333, 3005, 2000, 5000, -1000])
                  with ordinality t(c, i) order by i),
  array[0, 300, 300, 300, 1000, 333, 301, 300, 500, 0],
  'taxa em centavos: os 10 casos de taxa.test.ts (0, mínimo de R$ 3, 10%, arredondamento, negativo)');
select pg_temp.como('authenticated', pg_temp.us(1));
select lives_ok($$select pg_temp.res('r1', 1, jsonb_build_array(pg_temp.it(1, 'inteira', 3)))$$, 'reserva 3 x R$ 19,90');
select pg_temp.como('postgres');
select results_eq($$select (j ->> 'subtotal')::numeric, (j ->> 'taxa')::numeric, (j ->> 'total')::numeric
  from (select current_setting('t.r1')::jsonb j) s$$, $$values (59.70, 9.00, 68.70)$$,
  '3 x 19,90: subtotal 59,70, taxa 9,00 (3 x R$ 3), total 68,70');
select results_eq($$select unit_price, taxa_unit, quantity, subtotal, beneficio from order_items
  where order_id = pg_temp.pedido_de('r1')$$, $$values (19.90, 3.00, 3, 59.70, 'inteira')$$,
  'item guarda o preço sem taxa e a taxa por ingresso');
select results_eq($$select total, service_fee, status, reservado_ate - now() from orders where id = pg_temp.pedido_de('r1')$$,
  $$values (68.70, 9.00, 'pending', interval '10 minutes')$$, 'pedido pendente com total, taxa e 10 minutos de reserva');
select pg_temp.como('authenticated', pg_temp.us(2));
select lives_ok($$select pg_temp.res('r2', 1, jsonb_build_array(pg_temp.it(2, 'meia', 1)))$$, 'reserva 1 meia de R$ 33,33');
select pg_temp.como('postgres');
select results_eq($$select unit_price, taxa_unit, beneficio from order_items where order_id = pg_temp.pedido_de('r2')$$,
  $$values (16.66, 3.00, 'meia')$$, 'meia de 33,33 vale 16,66 (metade para baixo) e paga a taxa mínima de R$ 3');

-- 2. Cota de meia por tipo (grupo): 10 + 10 vagas, cota 8; inteiras até 12, meias até 8
select pg_temp.como('anon');
select results_eq($$select total_ingressos, total_meias from vitrine_ingressos(pg_temp.ev(2))
  where grupo = pg_temp.gr(3) and beneficio = 'inteira'$$, $$values (20, 8)$$,
  'vitrine: total do tipo 20 (soma dos lotes) e 8 meias (40%)');
select results_eq($$select beneficio, restantes from vitrine_ingressos(pg_temp.ev(2)) where grupo = pg_temp.gr(3)
  order by beneficio$$, $$values ('inteira', 10), ('meia', 8)$$, 'no lote 1: 10 inteiras e 8 meias à vista');
select pg_temp.como('authenticated', pg_temp.us(1));
select lives_ok($$select pg_temp.rv(2, jsonb_build_array(pg_temp.it(3, 'inteira', 10)))$$, 'u1 leva as 10 inteiras do lote 1');
select pg_temp.como('postgres');
update public.orders set status = 'paid' where event_id = pg_temp.ev(2);
select pg_temp.como('anon');
select results_eq($$select preco, restantes from vitrine_ingressos(pg_temp.ev(2)) where grupo = pg_temp.gr(3)
  and beneficio = 'inteira'$$, $$values (150.00, 2)$$, 'lote 2 vigente: só 2 inteiras (o resto do tipo é reserva de meia)');
select pg_temp.como('authenticated', pg_temp.us(2));
select throws_ok($$select pg_temp.rv(2, jsonb_build_array(pg_temp.it(3, 'inteira', 3)))$$, '22023',
  'Restam 2 ingresso(s) inteira de "G3"', 'terceira inteira acima da reserva de meia é recusada (restam 2)');
select lives_ok($$select pg_temp.rv(2, jsonb_build_array(pg_temp.it(3, 'inteira', 2)))$$, 'as 2 últimas inteiras passam');
select pg_temp.como('postgres');
update public.orders set status = 'paid' where event_id = pg_temp.ev(2);
select pg_temp.como('authenticated', pg_temp.us(3));
select lives_ok($$select pg_temp.res('r3', 2, jsonb_build_array(pg_temp.it(3, 'meia', 8)))$$, 'u3 leva as 8 meias');
select pg_temp.como('postgres');
select results_eq($$select unit_price, beneficio, quantity from order_items where order_id = pg_temp.pedido_de('r3')$$,
  $$values (75.00, 'meia', 8)$$, 'meia segue o preço do lote vigente (lote 2: 150 / 2)');
select pg_temp.como('authenticated', pg_temp.us(4));
select throws_ok($$select pg_temp.rv(2, jsonb_build_array(pg_temp.it(3, 'meia', 1)))$$, '22023',
  'Ingresso "G3" esgotado ou fora do período de vendas',
  'com tudo vendido e reservado, mais uma meia é recusada');
-- cota esgotada com vaga sobrando: 10 vagas, cota 4
select lives_ok($$select pg_temp.rv(2, jsonb_build_array(pg_temp.it(4, 'meia', 4)))$$, 'u4 leva as 4 meias da cota');
select pg_temp.como('postgres');
update public.orders set status = 'paid' where event_id = pg_temp.ev(2);
select pg_temp.como('authenticated', pg_temp.us(5));
select throws_ok($$select pg_temp.rv(2, jsonb_build_array(pg_temp.it(4, 'meia', 1)))$$, '22023',
  'Restam 0 meia(s) de "G4"', 'acima da cota a Evokaa não oferece mais meia (restam 0), mesmo com vaga na inteira');
select lives_ok($$select pg_temp.rv(2, jsonb_build_array(pg_temp.it(4, 'inteira', 6)))$$, 'as 6 vagas restantes vão para a inteira');
-- gratuito: sem cota e sem meia
select throws_ok($$select pg_temp.rv(2, jsonb_build_array(pg_temp.it(5, 'meia', 1)))$$, '22023',
  'O ingresso "G5" não tem meia-entrada', 'ingresso gratuito não tem meia');
select pg_temp.como('anon');
select results_eq($$select count(*), count(*) filter (where beneficio = 'inteira'), max(total_meias)
  from vitrine_ingressos(pg_temp.ev(2)) where grupo = pg_temp.gr(5)$$, $$values (1::bigint, 1::bigint, 0)$$,
  'vitrine do gratuito: só a linha da inteira e 0 meias');

-- 3. Lote que vira por quantidade: inteira e meia passam juntas ao lote 2
select results_eq($$select proximo_total from vitrine_ingressos(pg_temp.ev(3)) where beneficio = 'inteira'$$,
  $$values (220.00)$$, 'vitrine mostra o próximo lote: R$ 200 + taxa R$ 20 = R$ 220');
select pg_temp.como('authenticated', pg_temp.us(1));
select lives_ok($$select pg_temp.res('r4', 3, jsonb_build_array(pg_temp.it(6, 'inteira', 3), pg_temp.it(6, 'meia', 2)))$$,
  'u1 esgota o lote 1 com 3 inteiras e 2 meias no mesmo pedido');
select pg_temp.como('postgres');
select results_eq($$select beneficio, unit_price, ticket_type_id from order_items where order_id = pg_temp.pedido_de('r4')
  order by beneficio$$, $$values ('inteira', 100.00, pg_temp.tid(6, 1)), ('meia', 50.00, pg_temp.tid(6, 1))$$,
  'lote 1: inteira 100 e meia 50');
update public.orders set status = 'paid' where event_id = pg_temp.ev(3);
select pg_temp.como('authenticated', pg_temp.us(2));
select lives_ok($$select pg_temp.res('r5', 3, jsonb_build_array(pg_temp.it(6, 'inteira', 1), pg_temp.it(6, 'meia', 1)))$$,
  'u2 compra no lote que virou');
select pg_temp.como('postgres');
select results_eq($$select beneficio, unit_price, ticket_type_id from order_items where order_id = pg_temp.pedido_de('r5')
  order by beneficio$$, $$values ('inteira', 200.00, pg_temp.tid(6, 2)), ('meia', 100.00, pg_temp.tid(6, 2))$$,
  'lote 2: inteira 200 e meia 100 (metade da inteira do lote vigente)');

-- 4. Lote que vira por data: a sobra passa ao próximo (lote 1 encerrado com 3 de 5 vendidos)
select pg_temp.pedido(1, 1, 4, 7, 1, 3);
select pg_temp.como('anon');
select results_eq($$select lote, ticket_type_id, restantes from vitrine_ingressos(pg_temp.ev(4)) where beneficio = 'inteira'$$,
  $$values (2::smallint, pg_temp.tid(7, 2), 3)$$, 'lote 1 encerrado por data: vigente é o lote 2, com 3 inteiras');
select results_eq($$select restantes from vitrine_ingressos(pg_temp.ev(4)) where beneficio = 'meia'$$, $$values (4)$$,
  'e 4 meias (cota de 40% de 10)');
select pg_temp.como('authenticated', pg_temp.us(2));
select lives_ok($$select pg_temp.rv(4, jsonb_build_array(pg_temp.it(7, 'inteira', 3), pg_temp.it(7, 'meia', 4)))$$,
  '7 ingressos no lote 2, que tinha 5: as 2 sobras do lote 1 vieram junto');
select pg_temp.como('authenticated', pg_temp.us(3));
select throws_ok($$select pg_temp.rv(4, jsonb_build_array(pg_temp.it(7, 'inteira', 1)))$$, '22023',
  'Ingresso "G7" esgotado ou fora do período de vendas',
  'depois da sobra vendida, acabou');

-- 5. Lote futuro não vende; lote anterior reaberto não revende a sobra já vendida
select pg_temp.como('anon');
select results_eq($$select lote, ticket_type_id is null, restantes, vende_de is not null
  from vitrine_ingressos(pg_temp.ev(5)) where beneficio = 'inteira'$$, $$values (2::smallint, true, 0, true)$$,
  'só lote 2 futuro: vitrine mostra o lote que vai abrir, sem estoque');
select pg_temp.como('authenticated', pg_temp.us(1));
select throws_ok($$select pg_temp.rv(5, jsonb_build_array(pg_temp.it(8, 'inteira', 1)))$$, '22023',
  'Ingresso "G8" esgotado ou fora do período de vendas',
  'lote futuro não vende (e a sobra do encerrado não vale sem lote no período)');
select pg_temp.como('postgres');
select pg_temp.pedido(2, 1, 6, 9, 1, 5);
select pg_temp.pedido(3, 2, 6, 9, 2, 15);
update public.ticket_types set sale_end = null where id = pg_temp.tid(9, 1);
select pg_temp.como('anon');
select results_eq($$select ticket_type_id is null, restantes from vitrine_ingressos(pg_temp.ev(6)) where beneficio = 'inteira'$$,
  $$values (true, 0)$$, 'lote 1 reaberto: a sobra já foi vendida no lote 2, nada à venda');
select pg_temp.como('authenticated', pg_temp.us(3));
select throws_ok($$select pg_temp.rv(6, jsonb_build_array(pg_temp.it(9, 'inteira', 1)))$$, '22023',
  'Ingresso "G9" esgotado ou fora do período de vendas',
  'reabrir o lote 1 não revende a sobra já vendida');

-- 6. Reserva vencida libera o estoque
select pg_temp.como('authenticated', pg_temp.us(1));
select lives_ok($$select pg_temp.res('r6', 7, jsonb_build_array(pg_temp.it(10, 'inteira', 6)))$$, 'u1 reserva as 6 inteiras');
select pg_temp.como('anon');
select is((select restantes from vitrine_ingressos(pg_temp.ev(7)) where beneficio = 'inteira'), 0, 'reservadas: 0 inteiras à vista');
select pg_temp.como('authenticated', pg_temp.us(2));
select throws_ok($$select pg_temp.rv(7, jsonb_build_array(pg_temp.it(10, 'inteira', 1)))$$, '22023',
  'Restam 0 ingresso(s) inteira de "G10"',
  'outra conta não leva uma inteira reservada');
select pg_temp.como('postgres');
update public.orders set reservado_ate = now() - interval '1 minute' where id = pg_temp.pedido_de('r6');
select pg_temp.como('anon');
select is((select restantes from vitrine_ingressos(pg_temp.ev(7)) where beneficio = 'inteira'), 6,
  'reserva vencida: as 6 inteiras voltam à vitrine sozinhas');
select pg_temp.como('authenticated', pg_temp.us(2));
select lives_ok($$select pg_temp.rv(7, jsonb_build_array(pg_temp.it(10, 'inteira', 6)))$$, 'e a outra conta leva as 6');

-- 7. Preço travado
select pg_temp.como('authenticated', pg_temp.us(1));
select lives_ok($$select pg_temp.res('r7', 8, jsonb_build_array(pg_temp.it(11, 'inteira', 1)))$$, 'u1 reserva 1 a R$ 100 (lote 1)');
select pg_temp.como('authenticated', pg_temp.us(2));
select lives_ok($$select pg_temp.rv(8, jsonb_build_array(pg_temp.it(11, 'inteira', 4)))$$, 'u2 esgota o lote 1');
select pg_temp.como('postgres');
update public.ticket_types set price = 999 where id = pg_temp.tid(11, 1);
select pg_temp.como('anon');
select is((select preco from vitrine_ingressos(pg_temp.ev(8)) where beneficio = 'inteira'), 150.00,
  'a vitrine já mostra o lote 2 a R$ 150');
select pg_temp.como('postgres');
select results_eq($$select oi.unit_price, o.total from orders o join order_items oi on oi.order_id = o.id
  where o.id = pg_temp.pedido_de('r7')$$, $$values (100.00, 110.00)$$,
  'reserva feita antes continua R$ 100 + taxa (total 110), mesmo com o lote virado e o preço do lote 1 mudado');

-- 8. Uma reserva aberta por conta e evento
select pg_temp.como('authenticated', pg_temp.us(1));
select lives_ok($$select pg_temp.rv(9, jsonb_build_array(pg_temp.it(12, 'inteira', 2)))$$, 'primeira reserva (2)');
select lives_ok($$select pg_temp.rv(9, jsonb_build_array(pg_temp.it(12, 'inteira', 3)))$$, 'segunda reserva (3)');
select pg_temp.como('postgres');
select results_eq($$select count(*) filter (where status = 'cancelled'), count(*) filter (where status = 'pending')
  from orders where user_id = pg_temp.us(1) and event_id = pg_temp.ev(9)$$, $$values (1::bigint, 1::bigint)$$,
  'a segunda cancelou a primeira');
select pg_temp.como('authenticated', pg_temp.us(1));
select throws_ok($$select pg_temp.rv(9, jsonb_build_array(pg_temp.it(99, 'inteira', 1)))$$, '22023', 'Ingresso não encontrado',
  'reserva inválida é recusada');
select pg_temp.como('postgres');
select results_eq($$select count(*) filter (where status = 'cancelled'), count(*) filter (where status = 'pending')
  from orders where user_id = pg_temp.us(1) and event_id = pg_temp.ev(9)$$, $$values (1::bigint, 1::bigint)$$,
  'a recusa desfaz tudo: a reserva anterior continua pendente');
select throws_ok($$insert into orders (user_id, event_id, status, reservado_ate)
  values (pg_temp.us(1), pg_temp.ev(9), 'pending', now() + interval '1 minute')$$, '23505', null,
  'índice único: duas reservas abertas da mesma conta no evento não existem');
select pg_temp.como('anon');
select is((select restantes from vitrine_ingressos(pg_temp.ev(9)) where beneficio = 'inteira'), 3,
  'estoque: só a reserva de 3 conta (a cancelada liberou as 2)');

-- 9. Mínimo, máximo (nulo = 10) e limite por conta no tipo
select pg_temp.como('authenticated', pg_temp.us(1));
select throws_ok($$select pg_temp.rv(10, jsonb_build_array(pg_temp.it(13, 'inteira', 1)))$$, '22023',
  'Mínimo de 2 ingresso(s) por pedido em "G13"', 'abaixo do mínimo por pedido');
select throws_ok($$select pg_temp.rv(10, jsonb_build_array(pg_temp.it(13, 'inteira', 11)))$$, '22023',
  'Limite de 10 ingresso(s) por conta em "G13" (você já tem 0)', 'acima do máximo: sem max_per_order vale 10');
select lives_ok($$select pg_temp.rv(10, jsonb_build_array(pg_temp.it(13, 'inteira', 10)))$$, 'exatamente 10 passa');
select pg_temp.como('postgres');
select pg_temp.pedido(4, 2, 10, 13, 1, 8);
select pg_temp.pedido(5, 3, 10, 13, 1, 9, 'pending', now() - interval '1 minute');
select pg_temp.pedido(6, 4, 10, 13, 1, 8);
select pg_temp.como('authenticated', pg_temp.us(2));
select throws_ok($$select pg_temp.rv(10, jsonb_build_array(pg_temp.it(13, 'inteira', 3)))$$, '22023',
  'Limite de 10 ingresso(s) por conta em "G13" (você já tem 8)', '8 pagos + 3 passa do limite');
select lives_ok($$select pg_temp.rv(10, jsonb_build_array(pg_temp.it(13, 'inteira', 2)))$$, '8 pagos + 2 chega a 10');
select pg_temp.como('authenticated', pg_temp.us(3));
select lives_ok($$select pg_temp.rv(10, jsonb_build_array(pg_temp.it(13, 'inteira', 5)))$$,
  'reserva vencida de 9 não conta no limite');
select pg_temp.como('authenticated', pg_temp.us(4));
select lives_ok($$select pg_temp.rv(10, jsonb_build_array(pg_temp.it(14, 'inteira', 10)))$$,
  'o limite é por tipo: quem tem 8 em um compra 10 em outro');

-- 10. Código oculto
select pg_temp.como('anon');
select is((select count(*) from ticket_types where event_id = pg_temp.ev(11)), 1::bigint,
  'visitante não lê na tabela o lote com código');
select is((select count(*) from vitrine_ingressos(pg_temp.ev(11))), 2::bigint, 'vitrine sem código mostra só o lote público');
select is((select count(*) from vitrine_ingressos(pg_temp.ev(11), 'lista-amigos')), 4::bigint,
  'com o código em minúsculas o lote oculto aparece');
select is((select count(*) from vitrine_ingressos(pg_temp.ev(11), 'errado')), 2::bigint, 'código errado não mostra');
select pg_temp.como('authenticated', pg_temp.us(1));
select throws_ok($$select pg_temp.rv(11, jsonb_build_array(pg_temp.it(16, 'inteira', 1)))$$, '22023', 'Ingresso não encontrado',
  'reservar o lote oculto sem código é recusado');
select lives_ok($$select pg_temp.rv(11, jsonb_build_array(pg_temp.it(16, 'inteira', 1)), 'Lista-Amigos')$$,
  'com o código (maiúsculas e minúsculas misturadas) reserva');

-- 11. Gratuito emitido na hora; pago fica pendente
select lives_ok($$select pg_temp.res('r8', 12, jsonb_build_array(pg_temp.it(17, 'inteira', 3)))$$, 'u1 pega 3 ingressos gratuitos');
select pg_temp.como('postgres');
select results_eq($$select status, reservado_ate is null, total from orders where id = pg_temp.pedido_de('r8')$$,
  $$values ('paid', true, 0.00)$$, 'pedido gratuito nasce pago e sem cronômetro');
select results_eq($$select count(*), count(distinct qr_code),
  count(*) filter (where buyer_name = 'Comprador 01' and beneficio = 'inteira' and price_paid = 0 and status = 'active')
  from tickets where order_id = pg_temp.pedido_de('r8')$$, $$values (3::bigint, 3::bigint, 3::bigint)$$,
  '3 ingressos ativos, QR distintos, nome do perfil, beneficio e preço 0');
select pg_temp.como('authenticated', pg_temp.us(8));
select throws_ok($$select pg_temp.rv(12, jsonb_build_array(pg_temp.it(17, 'inteira', 1)))$$, '22023',
  'Complete seu nome no perfil antes de comprar', 'perfil sem nome: 22023');
select pg_temp.como('authenticated', pg_temp.us(2));
select lives_ok($$select pg_temp.res('r9', 12, jsonb_build_array(pg_temp.it(18, 'inteira', 2)))$$, 'u2 reserva 2 ingressos pagos');
select pg_temp.como('postgres');
select results_eq($$select o.status, o.total, o.service_fee, oi.taxa_unit, o.customer_name,
  (select count(*) from tickets t where t.order_id = o.id)
  from orders o join order_items oi on oi.order_id = o.id where o.id = pg_temp.pedido_de('r9')$$,
  $$values ('pending', 88.00, 8.00, 4.00, 'Comprador 02', 0::bigint)$$,
  'pago: pendente, sem ingresso, total = 2 x (40 + taxa 4) = 88');

-- 12. Acesso
select pg_temp.como('anon');
select throws_ok($$select public.reservar_ingressos(pg_temp.ev(13), jsonb_build_array(pg_temp.it(19, 'inteira', 1)))$$,
  '42501', null, 'visitante não executa reservar_ingressos');
select pg_temp.como('authenticated', pg_temp.us(1));
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', pg_temp.us(1), 'aal', 'aal1',
  'is_anonymous', true)::text, true);
select throws_ok($$select pg_temp.rv(13, jsonb_build_array(pg_temp.it(19, 'inteira', 1)))$$, '42501',
  'Entre na sua conta para comprar',
  'sessão anônima do Supabase não reserva');
select pg_temp.como('authenticated', pg_temp.us(7), 'aal1');
select throws_ok($$select pg_temp.rv(13, jsonb_build_array(pg_temp.it(19, 'inteira', 1)))$$, '42501', 'Confirme o código do 2FA',
  'conta com fator de 2FA em aal1 não reserva');
select pg_temp.como('authenticated', pg_temp.us(7), 'aal2');
select lives_ok($$select pg_temp.rv(13, jsonb_build_array(pg_temp.it(19, 'inteira', 1)))$$, 'em aal2 reserva');
select ok(not has_function_privilege('anon', 'public.evk_lotes(uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.evk_lotes(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.evk_taxa_centavos(int)', 'execute')
  and not has_function_privilege('authenticated', 'public.evk_taxa_centavos(int)', 'execute'),
  'evk_lotes e evk_taxa_centavos não são executáveis pela API');
select throws_ok($$select * from public.evk_lotes(pg_temp.ev(13), null)$$, '42501', null,
  'chamar evk_lotes como usuário logado dá permissão negada');
select pg_temp.como('authenticated', pg_temp.us(1));
select throws_ok($$select pg_temp.rv(17, jsonb_build_array(pg_temp.it(20, 'inteira', 1)))$$, '22023',
  'Evento indisponível para venda', 'evento em rascunho não vende');
select pg_temp.como('anon');
select is((select count(*) from vitrine_ingressos(pg_temp.ev(17))), 0::bigint, 'vitrine de evento em rascunho vem vazia');

-- 13. Match de Mesa (gatilhos mesa_pedido_guard e mesa_idade_guard)
select pg_temp.como('authenticated', pg_temp.us(1));
select throws_ok($$select pg_temp.rv(14, jsonb_build_array(pg_temp.it(21, 'inteira', 2)))$$, '22023',
  'Mesa Tinder: 1 lugar por conta em cada evento (quantidade deve ser 1)',
  'mesa coletiva: quantidade 2 é recusada');
select throws_ok($$select pg_temp.rv(14, jsonb_build_array(pg_temp.it(21, 'inteira', 1), pg_temp.it(21, 'meia', 1)))$$,
  '22023',
  'Mesa Tinder: 1 lugar por conta em cada evento (o pedido já tem uma mesa coletiva)', 'inteira e meia de mesa no mesmo pedido são recusadas');
select pg_temp.como('authenticated', pg_temp.us(6));
select throws_ok($$select pg_temp.rv(14, jsonb_build_array(pg_temp.it(21, 'inteira', 1)))$$, '22023',
  'Mesa coletiva: informe sua data de nascimento (só maiores de 18)',
  'menor de 18 não compra mesa');
select pg_temp.como('postgres');
select pg_temp.pedido(7, 3, 14, 21, 1, 1);
insert into public.tickets (order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email)
values ('c5000000-0000-4000-8000-000000000407', pg_temp.tid(21, 1), pg_temp.ev(14), pg_temp.us(3), 'Comprador 03', 'res3@teste.local');
select pg_temp.como('authenticated', pg_temp.us(3));
select throws_ok($$select pg_temp.rv(14, jsonb_build_array(pg_temp.it(21, 'inteira', 1)))$$, '22023',
  'Mesa Tinder: 1 lugar por conta em cada evento (você já tem um nesta mesa coletiva)',
  'quem já tem ingresso de mesa no evento não compra outro');
select pg_temp.como('authenticated', pg_temp.us(5));
select lives_ok($$select pg_temp.res('r10', 14, jsonb_build_array(pg_temp.it(21, 'inteira', 1)))$$,
  'adulto compra 1 lugar de mesa (pendente)');
select pg_temp.como('authenticated', pg_temp.us(1));
select lives_ok($$select pg_temp.res('r11', 14, jsonb_build_array(pg_temp.it(22, 'inteira', 1)))$$,
  'mesa gratuita para adulto: emite');
select pg_temp.como('postgres');
select is((select count(*) from tickets where order_id = pg_temp.pedido_de('r11') and status = 'active'), 1::bigint,
  'a mesa gratuita virou 1 ingresso ativo');
select pg_temp.como('authenticated', pg_temp.us(6));
select throws_ok($$select pg_temp.rv(14, jsonb_build_array(pg_temp.it(22, 'inteira', 1)))$$, '22023',
  'Mesa coletiva: informe sua data de nascimento (só maiores de 18)',
  'menor de 18 não pega nem a mesa gratuita');

-- 14. Buraco: o navegador não fabrica reserva
select pg_temp.como('authenticated', pg_temp.us(1));
select throws_ok($$insert into orders (user_id, event_id, total, status, reservado_ate)
  values (pg_temp.us(1), pg_temp.ev(15), 10, 'pending', now() + interval '10 minutes')$$, '42501', null,
  'navegador não insere pedido com reservado_ate');
select lives_ok($$select pg_temp.res('r12', 15, jsonb_build_array(pg_temp.it(23, 'inteira', 1)))$$, 'reserva do servidor');
select throws_ok($$insert into order_items (order_id, ticket_type_id, quantity, unit_price, subtotal)
  values (pg_temp.pedido_de('r12'), pg_temp.tid(23, 1), 1, 1, 1)$$, '42501', null,
  'navegador não acrescenta item numa reserva do servidor');
select pg_temp.como('authenticated', pg_temp.us(2));
select lives_ok($$insert into orders (id, user_id, event_id, total, status)
  values ('c5000000-0000-4000-8000-0000000004ff', pg_temp.us(2), pg_temp.ev(15), 10, 'pending')$$,
  'caminho antigo: pedido pendente sem reservado_ate continua passando');
select lives_ok($$insert into order_items (order_id, ticket_type_id, quantity, unit_price, subtotal)
  values ('c5000000-0000-4000-8000-0000000004ff', pg_temp.tid(23, 1), 1, 10, 10)$$,
  'caminho antigo: item no pedido do navegador continua passando');
select pg_temp.como('anon');
select is((select restantes from vitrine_ingressos(pg_temp.ev(15)) where beneficio = 'inteira'), 5,
  'pedido antigo sem reserva não conta no estoque (só a reserva do servidor: 10 - 4 de meia - 1 = 5)');

-- 15. Dois compradores no último lugar (sequencial; a corrida de verdade é corrida_reserva.sh)
select pg_temp.como('authenticated', pg_temp.us(1));
select lives_ok($$select pg_temp.rv(16, jsonb_build_array(pg_temp.it(24, 'inteira', 1)))$$, 'primeiro leva a última inteira');
select pg_temp.como('authenticated', pg_temp.us(2));
select throws_ok($$select pg_temp.rv(16, jsonb_build_array(pg_temp.it(24, 'inteira', 1)))$$, '22023',
  'Restam 0 ingresso(s) inteira de "G24"', 'segundo não leva a mesma inteira');
select lives_ok($$select pg_temp.rv(16, jsonb_build_array(pg_temp.it(24, 'meia', 1)))$$, 'o último lugar do tipo é da meia');
select pg_temp.como('authenticated', pg_temp.us(3));
select throws_ok($$select pg_temp.rv(16, jsonb_build_array(pg_temp.it(24, 'meia', 1)))$$, '22023',
  'Ingresso "G24" esgotado ou fora do período de vendas',
  'e depois dela acabou');
select pg_temp.como('postgres');
select is((select count(*) from orders where event_id = pg_temp.ev(16) and status = 'pending'), 2::bigint,
  'duas reservas pendentes (1 inteira + 1 meia), nunca mais que a capacidade');

-- 16. Cota com lote futuro: 10 + 10 (lote 2 ainda por abrir), cota 8 -> 10 inteiras no lote 1; com o lote 2, +2 e 8 meias
select pg_temp.como('anon');
select results_eq($$select beneficio, restantes from vitrine_ingressos(pg_temp.ev(18)) order by beneficio$$,
  $$values ('inteira', 10), ('meia', 8)$$, 'lote 2 futuro: 10 inteiras e 8 meias à vista no lote 1');
select pg_temp.como('authenticated', pg_temp.us(2));
select throws_ok($$select pg_temp.rv(18, jsonb_build_array(pg_temp.it(25, 'meia', 9)))$$, '22023',
  'Restam 8 meia(s) de "G25"', 'meia limitada à reserva restante (8), não às 10 vagas do lote');
select pg_temp.como('authenticated', pg_temp.us(1));
select lives_ok($$select pg_temp.rv(18, jsonb_build_array(pg_temp.it(25, 'inteira', 10)))$$,
  'as 10 inteiras do lote 1 passam (a reserva de meia conta com o lote futuro)');
select pg_temp.como('postgres');
update public.orders set status = 'paid' where event_id = pg_temp.ev(18);
update public.ticket_types set sale_start = null where id = pg_temp.tid(25, 2);
select pg_temp.como('anon');
select results_eq($$select beneficio, restantes from vitrine_ingressos(pg_temp.ev(18)) order by beneficio$$,
  $$values ('inteira', 2), ('meia', 8)$$, 'lote 2 aberto: mais 2 inteiras e 8 meias');

-- 17. Pedido misto (gratuito + pago): fica pendente, sem ingresso
select pg_temp.como('authenticated', pg_temp.us(1));
select lives_ok($$select pg_temp.res('r13', 19, jsonb_build_array(pg_temp.it(26, 'inteira', 2), pg_temp.it(27, 'inteira', 1)))$$,
  'pedido com 2 gratuitos e 1 pago');
select pg_temp.como('postgres');
select results_eq($$select o.status, o.total, o.reservado_ate is not null, (select count(*) from tickets t where t.order_id = o.id)
  from orders o where o.id = pg_temp.pedido_de('r13')$$, $$values ('pending', 44.00, true, 0::bigint)$$,
  'misto: pendente, total 44 (40 + taxa 4), com cronômetro e sem ingresso emitido');

select * from finish();
rollback;
