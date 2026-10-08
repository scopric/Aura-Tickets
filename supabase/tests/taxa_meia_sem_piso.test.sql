-- pgTAP de docs/sql/20261031_taxa_meia_sem_piso.sql. Só no banco local descartável: aplicar antes os de docs/sql até
-- 20261030a_venda_servidor_meia.sql (com os pré-requisitos dela: 20261028_limite_por_cpf e 20261007_pr7_cripto_passo2) e
-- depois 20261031 (com o md5 do bloco 0 trocado pelo da 20261030a local); rodar `supabase test db`. Nunca contra produção.
-- Tudo em begin ... rollback.
-- MUTAÇÃO (rodar à mão, o teste tem de FALHAR): recriar evk_taxa_centavos com a guarda removida, ou seja,
--   `case when p_meia then 0 else 300 end` trocado por `300`, e rodar este arquivo de novo: o teste 1 (tabela da meia) falha
--   e os que passam pela meia em reservar_ingressos/vitrine_ingressos também; o da inteira continua verde.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(9);

create function pg_temp.como(p_role text, p uuid default null) returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then 'aal2' end,
    'email', case when p is not null then 'u' || right(p::text, 2) || '@teste-taxa.local' end))::text end, true);
  perform set_config('role', p_role, true);
end $f$;
grant execute on function pg_temp.como(text, uuid) to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;
create temp table res (k text primary key, j jsonb);
grant all on pg_temp.res to authenticated;

-- u01..u04 compradores; u09 = produtora
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select ('fd100000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'u' || lpad(n::text, 2, '0') || '@teste-taxa.local', now(),
       case when n = 9 then '{"role":"producer","full_name":"Paula"}' else '{"full_name":"Comprador"}' end::jsonb from generate_series(1, 9) n;
insert into public.events (id, producer_id, title, slug, status, approval_status, start_date, venue_state) values
  ('fd100000-0000-4000-8000-0000000000e1', 'fd100000-0000-4000-8000-000000000009', 'Taxa da meia', 'taxa-meia-e1', 'published', 'approved', now() + interval '7 days', 'SP');
insert into public.ticket_types (id, event_id, name, price, quantity_total, type, is_active, max_por_cpf) values
  ('fd100000-0000-4000-8000-0000000000b1', 'fd100000-0000-4000-8000-0000000000e1', 'R$ 20', 20, 50, 'individual', true, null),
  ('fd100000-0000-4000-8000-0000000000b2', 'fd100000-0000-4000-8000-0000000000e1', 'R$ 100', 100, 50, 'individual', true, null),
  ('fd100000-0000-4000-8000-0000000000b3', 'fd100000-0000-4000-8000-0000000000e1', 'Centavo', 0.01, 50, 'individual', true, null),
  ('fd100000-0000-4000-8000-0000000000b4', 'fd100000-0000-4000-8000-0000000000e1', 'R$ 60', 60, 50, 'individual', true, null),
  ('fd100000-0000-4000-8000-0000000000b5', 'fd100000-0000-4000-8000-0000000000e1', 'R$ 40', 40, 50, 'individual', true, null);
insert into public.coupons (producer_id, code, discount_type, discount_value, max_uses) values
  ('fd100000-0000-4000-8000-000000000009', 'DEZ', 'percent', 10, null);

-- 1. Função: meia 10% sem mínimo (1665 -> 166,5 arredonda para 167; 4 -> 0,4 -> 0; 5 -> 0,5 -> 1); inteira com mínimo R$ 3
select pg_temp.como('postgres');
select results_eq($$select public.evk_taxa_centavos(c, true) from unnest(array[0, 1, 4, 5, 1000, 1665, 3333]::bigint[]) c$$,
  $$values (0::bigint), (0), (0), (1), (100), (167), (333)$$, 'meia: 10% sem piso (R$ 10 -> R$ 1,00; 1 centavo -> 0; half-up)');
select results_eq($$select public.evk_taxa_centavos(c, false) from unnest(array[0, 1000, 3333, 10000]::bigint[]) c$$,
  $$values (0::bigint), (300), (333), (1000)$$, 'inteira: 10% com mínimo R$ 3, gratuito 0');

-- 2. reservar_ingressos: meia de R$ 20 = preço 10,00 e taxa 1,00 (não 3,00)
select pg_temp.como('authenticated', 'fd100000-0000-4000-8000-000000000001');
insert into pg_temp.res select 'meia', public.reservar_ingressos('fd100000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd100000-0000-4000-8000-0000000000b1","quantidade":1,"beneficio":"meia","meia_tipo":"estudante"}]');
select pg_temp.como('postgres');
select results_eq($$select (j->>'subtotal')::numeric, (j->>'taxa')::numeric, (j->>'total')::numeric from pg_temp.res where k = 'meia'$$,
  $$values (10.00::numeric, 1.00::numeric, 11.00::numeric)$$, 'meia de R$ 20: preço 10,00 + taxa 1,00 = 11,00');
select results_eq($$select oi.beneficio, oi.unit_price, oi.taxa_unit from public.order_items oi
  where oi.order_id = (select (j->>'order_id')::uuid from pg_temp.res where k = 'meia')$$,
  $$values ('meia'::text, 10.00::numeric, 1.00::numeric)$$, 'item da meia gravado com taxa_unit 1,00');

-- 3. Meia de 1 centavo: sem taxa (antes pagava R$ 3)
select pg_temp.como('authenticated', 'fd100000-0000-4000-8000-000000000002');
insert into pg_temp.res select 'centavo', public.reservar_ingressos('fd100000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd100000-0000-4000-8000-0000000000b3","quantidade":1,"beneficio":"meia","meia_tipo":"estudante"}]');
select pg_temp.como('postgres');
select results_eq($$select (j->>'subtotal')::numeric, (j->>'taxa')::numeric from pg_temp.res where k = 'centavo'$$,
  $$values (0.01::numeric, 0.00::numeric)$$, 'meia de R$ 0,01: taxa 0');

-- 4. Misto sem cupom: inteira R$ 20 (taxa 3,00 pelo mínimo) + meia R$ 20 (preço 10, taxa 1,00)
select pg_temp.como('authenticated', 'fd100000-0000-4000-8000-000000000003');
insert into pg_temp.res select 'misto', public.reservar_ingressos('fd100000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd100000-0000-4000-8000-0000000000b1","quantidade":1},{"ticket_type_id":"fd100000-0000-4000-8000-0000000000b1","quantidade":1,"beneficio":"meia","meia_tipo":"estudante"}]');
select pg_temp.como('postgres');
select results_eq($$select (j->>'subtotal')::numeric, (j->>'taxa')::numeric, (j->>'total')::numeric from pg_temp.res where k = 'misto'$$,
  $$values (30.00::numeric, 4.00::numeric, 34.00::numeric)$$, 'misto: inteira 20 (taxa 3,00) + meia 10 (taxa 1,00) = 30,00 + 4,00');

-- 5. Misto com cupom DEZ: só a inteira tem desconto; taxa da inteira sobre o preço com desconto; meia sem cupom
select pg_temp.como('authenticated', 'fd100000-0000-4000-8000-000000000004');
insert into pg_temp.res select 'cupom', public.reservar_ingressos('fd100000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd100000-0000-4000-8000-0000000000b4","quantidade":1},{"ticket_type_id":"fd100000-0000-4000-8000-0000000000b5","quantidade":1,"beneficio":"meia","meia_tipo":"estudante"}]', 'dez');
select pg_temp.como('postgres');
select results_eq($$select (j->>'subtotal')::numeric, (j->>'desconto')::numeric, (j->>'taxa')::numeric, (j->>'total')::numeric from pg_temp.res where k = 'cupom'$$,
  $$values (80.00::numeric, 6.00::numeric, 7.40::numeric, 81.40::numeric)$$,
  'cupom: inteira 60 -> 54 (taxa 5,40); meia 20 sem cupom (taxa 2,00); taxa 7,40');
select results_eq($$select oi.beneficio, oi.unit_price, oi.taxa_unit from public.order_items oi
  where oi.order_id = (select (j->>'order_id')::uuid from pg_temp.res where k = 'cupom') order by oi.beneficio$$,
  $$values ('inteira'::text, 60.00::numeric, 5.40::numeric), ('meia'::text, 20.00::numeric, 2.00::numeric)$$,
  'itens do cupom: taxa_unit 5,40 (inteira) e 2,00 (meia)');

-- 6. Vitrine (anon): taxa_meia sem piso; taxa da inteira com piso
select pg_temp.como('anon');
select results_eq($$select taxa, preco_meia, taxa_meia from public.vitrine_ingressos('fd100000-0000-4000-8000-0000000000e1')
  where ticket_type_id in ('fd100000-0000-4000-8000-0000000000b1', 'fd100000-0000-4000-8000-0000000000b2', 'fd100000-0000-4000-8000-0000000000b3')
  order by preco$$,
  $$values (3.00::numeric, 0.01::numeric, 0.00::numeric), (3.00::numeric, 10.00::numeric, 1.00::numeric), (10.00::numeric, 50.00::numeric, 5.00::numeric)$$,
  'vitrine: R$ 0,01 e R$ 20 com taxa 3,00; taxa_meia 0,00 (meia 0,01) e 1,00 (meia 10,00); R$ 100 com taxa 10,00 e taxa_meia 5,00');

select * from finish();
rollback;
