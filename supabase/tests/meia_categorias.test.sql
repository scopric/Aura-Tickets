-- pgTAP de docs/sql/20261102_meia_categorias.sql (meia por categoria: idoso, categorias estaduais, vitrine em lugar marcado, meia_beneficios).
-- Só no banco local descartável: aplicar antes os de docs/sql até 20261031 (e o próprio 20261102) e rodar `supabase test db`.
-- Tudo em begin ... rollback. Nunca contra produção. Sem CPF real: nenhum tipo aqui tem max_por_cpf.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(29);

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
-- mensagem da recusa de regra de negócio (devolvida como {ok:false, mensagem}) ou 'OK'; p_event: e1 (ES) ou e2 (UF vazia)
create function pg_temp.msg(p_itens text) returns text language sql as $f$
  select coalesce(j->>'mensagem', 'OK') from (select public.reservar_ingressos('fc000000-0000-4000-8000-0000000000e1', p_itens::jsonb) j) x $f$;
grant execute on function pg_temp.msg(text) to authenticated;
-- um item de reservar_ingressos
create function pg_temp.it(p_tt text, p_qtd int, p_tipo text) returns text language sql as $f$
  select jsonb_build_array(jsonb_build_object('ticket_type_id', 'fc000000-0000-4000-8000-0000000000' || p_tt, 'quantidade', p_qtd,
                                              'beneficio', 'meia', 'meia_tipo', p_tipo))::text $f$;
create temp table vit (k text primary key, disp int, md int, mt int);
grant all on pg_temp.vit to anon, authenticated;

-- u01..u08 compradores; u09 = produtora
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select ('fc000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'u' || lpad(n::text, 2, '0') || '@teste-meia.local', now(),
       case when n = 9 then '{"role":"producer","full_name":"Paula"}' else '{"full_name":"Comprador"}' end::jsonb from generate_series(1, 9) n;
insert into public.events (id, producer_id, title, slug, status, approval_status, start_date, venue_state) values
  ('fc000000-0000-4000-8000-0000000000e1', 'fc000000-0000-4000-8000-000000000009', 'Meia ES', 'meia-cat-e1', 'published', 'approved', now() + interval '7 days', 'ES'),
  ('fc000000-0000-4000-8000-0000000000e2', 'fc000000-0000-4000-8000-000000000009', 'Meia sem UF', 'meia-cat-e2', 'published', 'approved', now() + interval '7 days', ''),
  ('fc000000-0000-4000-8000-0000000000e3', 'fc000000-0000-4000-8000-000000000009', 'Rascunho', 'meia-cat-e3', 'draft', 'approved', now() + interval '7 days', 'ES');
-- a1 e a2: individuais R$ 100 e R$ 50, lotação 10 (cota de meia = 4); b1: lugar marcado R$ 100, lotação 10
insert into public.ticket_types (id, event_id, name, price, quantity_total, type, is_active) values
  ('fc000000-0000-4000-8000-0000000000a1', 'fc000000-0000-4000-8000-0000000000e1', 'Pista', 100, 10, 'individual', true),
  ('fc000000-0000-4000-8000-0000000000a2', 'fc000000-0000-4000-8000-0000000000e1', 'Camarote', 50, 10, 'individual', true),
  ('fc000000-0000-4000-8000-0000000000b1', 'fc000000-0000-4000-8000-0000000000e1', 'Plateia', 100, 10, 'individual', true);
insert into public.seating_maps (event_id, is_active, environments) values ('fc000000-0000-4000-8000-0000000000e1', true,
  jsonb_build_array(jsonb_build_object('id', 'a',
    'sections', jsonb_build_array(jsonb_build_object('id', 'sb', 'ticketTypeId', 'fc000000-0000-4000-8000-0000000000b1')),
    'seats', (select jsonb_agg(jsonb_build_object('id', 'p' || n, 'type', 'seat', 'sectionId', 'sb', 'status', 'free')) from generate_series(1, 10) n))));

-- 1. Idoso e código de outra UF na venda sem mapa (reservar_ingressos)
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000001');
select is(pg_temp.msg(pg_temp.it('a1', 1, 'idoso')), 'OK', 'reservar_ingressos aceita meia idoso');
select throws_ok($$select pg_temp.msg(pg_temp.it('a1', 1, 'sp_professor'))$$, '22023', 'Tipo de meia-entrada inválido para este evento', 'código de outra UF (SP) é recusado em evento do ES');
select is(pg_temp.msg(pg_temp.it('a1', 1, 'es_professor')), 'OK', 'código do ES é aceito em evento do ES');

-- 2. Idoso não consome a cota: u02 enche os 4 de a1 com estudante (já há 1 idoso e 1 es_professor de u01: a cota conta só o es_professor)
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000002');
select is(pg_temp.msg(pg_temp.it('a1', 3, 'estudante')), 'OK', 'cota de 4: 3 estudantes + 1 estadual (u01) = 4, o idoso não conta');
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000003');
select is(pg_temp.msg(pg_temp.it('a1', 1, 'estudante')), 'Restam 0 meias neste ingresso', 'a 5ª meia de cota é recusada');
select is(pg_temp.msg(pg_temp.it('a1', 1, 'idoso')), 'OK', 'com a cota cheia o idoso ainda passa');
select is(pg_temp.msg(pg_temp.it('a1', 2, 'idoso')), 'OK', 'mais idosos ainda passam (cada compra nova substitui a reserva anterior do mesmo comprador: u03 fica com 2)');
select pg_temp.como('postgres');
select is((select coalesce(sum(oi.quantity), 0)::int from public.order_items oi join public.orders o on o.id = oi.order_id where oi.ticket_type_id = 'fc000000-0000-4000-8000-0000000000a1' and o.status = 'pending'), 6,
  'reservas vivas de a1: 1 estadual + 3 estudantes + 2 idosos = 6 (o idoso conta no estoque)');
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000004');
select is(pg_temp.msg(pg_temp.it('a1', 5, 'idoso')), 'Ingressos esgotados ou insuficientes (restam 4)', 'o idoso respeita o estoque total (restam 4)');

-- 3. Estadual + estudante somam na mesma cota (a2: 2 estudante + 2 es_professor = 4; o 5º, qualquer tipo, é recusado)
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000005');
select is(pg_temp.msg(jsonb_build_array(
  jsonb_build_object('ticket_type_id', 'fc000000-0000-4000-8000-0000000000a2', 'quantidade', 2, 'beneficio', 'meia', 'meia_tipo', 'estudante'),
  jsonb_build_object('ticket_type_id', 'fc000000-0000-4000-8000-0000000000a2', 'quantidade', 2, 'beneficio', 'meia', 'meia_tipo', 'es_professor'))::text),
  'OK', '2 estudante + 2 estadual no mesmo pedido: 4 = a cota');
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000006');
select is(pg_temp.msg(pg_temp.it('a2', 1, 'es_cancer')), 'Restam 0 meias neste ingresso', 'estadual e estudante somam: a 5ª meia estadual é recusada');
select is(pg_temp.msg(pg_temp.it('a2', 1, 'estudante')), 'Restam 0 meias neste ingresso', 'idem para estudante');

-- 4. Lugar marcado (reservar_assentos): idoso aceito, UF errada recusada
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000007');
select throws_ok($$select public.reservar_assentos('fc000000-0000-4000-8000-0000000000e1', array['a:p1'], '[{"seat_key":"a:p1","meia_tipo":"sp_professor"}]')$$,
  '22023', 'Tipo de meia-entrada inválido para este evento', 'reservar_assentos recusa código de outra UF');
select lives_ok($$select public.reservar_assentos('fc000000-0000-4000-8000-0000000000e1', array['a:p1'], '[{"seat_key":"a:p1","meia_tipo":"idoso"}]')$$,
  'reservar_assentos aceita meia idoso em lugar individual');

-- 5. Vitrine x gatilho no lugar marcado: o mesmo número
select pg_temp.como('anon');
insert into pg_temp.vit select 'v0', v.disponiveis, v.meias_disponiveis, v.meias_total from public.vitrine_ingressos('fc000000-0000-4000-8000-0000000000e1') v
 where v.ticket_type_id = 'fc000000-0000-4000-8000-0000000000b1';
select results_eq($$select md, mt, disp from pg_temp.vit where k = 'v0'$$, $$values (4, 4, 9)$$,
  'vitrine: lugar marcado tem meia (4 de cota), o idoso fora da contagem e sem vagas guardadas (disponíveis 9)');
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000008');
select lives_ok($$select public.reservar_assentos('fc000000-0000-4000-8000-0000000000e1', array['a:p2', 'a:p3'],
  '[{"seat_key":"a:p2","meia_tipo":"estudante"},{"seat_key":"a:p3","meia_tipo":"es_cancer"}]')$$, '2 meias de cota no mapa');
select pg_temp.como('anon');
insert into pg_temp.vit select 'v1', v.disponiveis, v.meias_disponiveis, v.meias_total from public.vitrine_ingressos('fc000000-0000-4000-8000-0000000000e1') v
 where v.ticket_type_id = 'fc000000-0000-4000-8000-0000000000b1';
select results_eq($$select md, disp from pg_temp.vit where k = 'v1'$$, $$values (2, 7)$$, 'vitrine depois de 2 meias: restam 2 meias, 7 lugares');
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000001');
select throws_ok($$select public.reservar_assentos('fc000000-0000-4000-8000-0000000000e1', array['a:p4', 'a:p5', 'a:p6'],
  '[{"seat_key":"a:p4","meia_tipo":"estudante"},{"seat_key":"a:p5","meia_tipo":"estudante"},{"seat_key":"a:p6","meia_tipo":"estudante"}]')$$,
  '22023', 'Restam 2 meias neste ingresso', 'gatilho diz o mesmo número da vitrine (restam 2)');
select lives_ok($$select public.reservar_assentos('fc000000-0000-4000-8000-0000000000e1', array['a:p4'])$$, 'a inteira no mapa não perde lugar para a cota (disponíveis 7 → vende)');

-- 6. meia_beneficios
select pg_temp.como('anon');
select is(jsonb_array_length(public.meia_beneficios('fc000000-0000-4000-8000-0000000000e1')), 8, 'UF=ES: 5 nacionais + 3 do ES');
select is((select array_agg(x->>'codigo' order by x->>'codigo') from jsonb_array_elements(public.meia_beneficios('fc000000-0000-4000-8000-0000000000e1')) x
            where x->>'codigo' like 'es\_%'), array['es_cancer', 'es_doadora_leite', 'es_professor'], 'inclui os 3 do ES');
select is(exists (select 1 from jsonb_array_elements(public.meia_beneficios('fc000000-0000-4000-8000-0000000000e1')) x where x->>'codigo' like 'sp\_%'), false, 'nenhum de SP no evento do ES');
select is((select (x->>'cota')::boolean from jsonb_array_elements(public.meia_beneficios('fc000000-0000-4000-8000-0000000000e1')) x where x->>'codigo' = 'idoso'), false, 'idoso: cota false');
select is((select count(*)::int from jsonb_array_elements(public.meia_beneficios('fc000000-0000-4000-8000-0000000000e1')) x where (x->>'cota')::boolean), 7, 'os outros 7 têm cota true');
select is((select count(*)::int from jsonb_array_elements(public.meia_beneficios('fc000000-0000-4000-8000-0000000000e1')) x
            where coalesce(x->>'nome', '') = '' or coalesce(x->>'documento', '') = ''), 0, 'todos com nome e documento legíveis');
select is(jsonb_array_length(public.meia_beneficios('fc000000-0000-4000-8000-0000000000e2')), 5, 'UF vazia: só os 5 nacionais');
select is(public.meia_beneficios('fc000000-0000-4000-8000-0000000000e3'), '[]'::jsonb, 'evento em rascunho: lista vazia');
select is(public.meia_beneficios(gen_random_uuid()), '[]'::jsonb, 'evento inexistente: lista vazia');
select is(has_function_privilege('anon', 'public.meia_beneficios(uuid)', 'execute'), true, 'anon executa meia_beneficios');

select * from finish();
rollback;
