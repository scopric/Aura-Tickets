-- pgTAP de docs/sql/20261030a_venda_servidor_meia.sql. Só no banco local descartável: aplicar antes os de docs/sql até
-- 20261030a (e os anteriores, 20261028_limite_por_cpf inclusive; precisa de pr7_hmac e do segredo pr7_pii_key no Vault local)
-- e rodar `supabase test db`. Tudo em begin ... rollback. Nunca contra produção. NÃO precisa do arquivo B.
-- CPFs FICTÍCIOS, válidos só pelo algoritmo dos dígitos: 529.982.247-25, 111.444.777-35.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(56);

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

-- u01..u08 compradores (u01 maior de idade, para a coletiva); u09 = produtora
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select ('fd000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'u' || lpad(n::text, 2, '0') || '@teste-meia.local', now(),
       case when n = 9 then '{"role":"producer","full_name":"Paula"}' else '{"full_name":"Comprador"}' end::jsonb from generate_series(1, 9) n;
update public.profiles set birth_date = '1990-01-01' where id = 'fd000000-0000-4000-8000-000000000001';
insert into public.events (id, producer_id, title, slug, status, approval_status, start_date, venue_state) values
  ('fd000000-0000-4000-8000-0000000000e1', 'fd000000-0000-4000-8000-000000000009', 'Meia', 'meia-e1', 'published', 'approved', now() + interval '7 days', 'SP'),
  ('fd000000-0000-4000-8000-0000000000e2', 'fd000000-0000-4000-8000-000000000009', 'Rascunho', 'meia-e2', 'draft', 'pending', now() + interval '7 days', 'SP');
insert into public.ticket_types (id, event_id, name, price, quantity_total, type, is_active, max_por_cpf) values
  ('fd000000-0000-4000-8000-0000000000b1', 'fd000000-0000-4000-8000-0000000000e1', 'Pista', 100, 10, 'individual', true, null),
  ('fd000000-0000-4000-8000-0000000000b2', 'fd000000-0000-4000-8000-0000000000e1', 'Ímpar', 80, 7, 'individual', true, null),
  ('fd000000-0000-4000-8000-0000000000b3', 'fd000000-0000-4000-8000-0000000000e1', 'Mesa', 100, 10, 'mesa', true, null),
  ('fd000000-0000-4000-8000-0000000000b4', 'fd000000-0000-4000-8000-0000000000e1', 'Coletiva', 100, 10, 'coletiva', true, null),
  ('fd000000-0000-4000-8000-0000000000b5', 'fd000000-0000-4000-8000-0000000000e1', 'VIP', 60, 20, 'vip', true, null),
  ('fd000000-0000-4000-8000-0000000000b6', 'fd000000-0000-4000-8000-0000000000e1', 'Inativo', 50, 10, 'individual', false, null),
  ('fd000000-0000-4000-8000-0000000000b7', 'fd000000-0000-4000-8000-0000000000e1', 'Centavo', 0.01, 10, 'individual', true, null),
  ('fd000000-0000-4000-8000-0000000000b8', 'fd000000-0000-4000-8000-0000000000e1', 'Por CPF', 50, 20, 'individual', true, 1),
  ('fd000000-0000-4000-8000-0000000000b9', 'fd000000-0000-4000-8000-0000000000e1', 'Grátis', 0, 20, 'individual', true, null),
  ('fd000000-0000-4000-8000-0000000000ba', 'fd000000-0000-4000-8000-0000000000e1', 'Lugar marcado', 50, 20, 'individual', true, null),
  ('fd000000-0000-4000-8000-0000000000bb', 'fd000000-0000-4000-8000-0000000000e1', 'Livre', 50, 100, 'individual', true, null),
  ('fd000000-0000-4000-8000-0000000000bc', 'fd000000-0000-4000-8000-0000000000e1', 'Bandeira', 50, 20, 'individual', true, null),
  ('fd000000-0000-4000-8000-0000000000bd', 'fd000000-0000-4000-8000-0000000000e2', 'Do rascunho', 50, 20, 'individual', true, null);
insert into public.seating_maps (event_id, is_active, environments) values ('fd000000-0000-4000-8000-0000000000e1', true,
  '[{"id":"a","seats":[],"sections":[{"id":"s","ticketTypeId":"fd000000-0000-4000-8000-0000000000ba"}]}]');
-- cupons do produtor: 10% geral, 100%, fixo de R$ 5 com 1 uso
insert into public.coupons (producer_id, code, discount_type, discount_value, max_uses) values
  ('fd000000-0000-4000-8000-000000000009', 'DEZ', 'percent', 10, null),
  ('fd000000-0000-4000-8000-000000000009', 'GRATIS', 'percent', 100, null),
  ('fd000000-0000-4000-8000-000000000009', 'UMUSO', 'fixed', 5, 1);

-- 1. Vitrine (anon): só tipo ativo, sem dado pessoal, cota ceil, meia e taxa
select pg_temp.como('anon');
select is((select count(*)::int from public.vitrine_ingressos('fd000000-0000-4000-8000-0000000000e1')), 11, 'vitrine: 11 tipos ativos (sem o inativo)');
select is((select count(*)::int from public.vitrine_ingressos('fd000000-0000-4000-8000-0000000000e1') where ticket_type_id = 'fd000000-0000-4000-8000-0000000000b6'), 0, 'vitrine: tipo inativo não aparece');
select is((select count(*)::int from public.vitrine_ingressos('fd000000-0000-4000-8000-0000000000e2')), 0, 'vitrine: evento em rascunho não aparece');
select results_eq($$select preco, taxa, preco_meia, taxa_meia, permite_meia, disponiveis, meias_disponiveis, meias_total
  from public.vitrine_ingressos('fd000000-0000-4000-8000-0000000000e1') where ticket_type_id = 'fd000000-0000-4000-8000-0000000000b1'$$,
  $$values (100.00::numeric, 10.00::numeric, 50.00::numeric, 5.00::numeric, true, 6, 4, 4)$$,
  'vitrine: Pista R$100 lotação 10 = 6 inteiras livres (10 - cota 4), 4 meias a R$50 com taxa R$5');
select is((select meias_total from public.vitrine_ingressos('fd000000-0000-4000-8000-0000000000e1') where ticket_type_id = 'fd000000-0000-4000-8000-0000000000b2'), 3,
  'cota é ceil: 40% de 7 = 2,8 -> 3');
select results_eq($$select permite_meia, meias_total from public.vitrine_ingressos('fd000000-0000-4000-8000-0000000000e1')
   where ticket_type_id in ('fd000000-0000-4000-8000-0000000000b3', 'fd000000-0000-4000-8000-0000000000b9', 'fd000000-0000-4000-8000-0000000000ba') order by ticket_type_id$$,
  $$values (false, 0), (false, 0), (false, 0)$$, 'vitrine: mesa, grátis e lugar marcado sem meia');
select is((select permite_meia from public.vitrine_ingressos('fd000000-0000-4000-8000-0000000000e1') where ticket_type_id = 'fd000000-0000-4000-8000-0000000000b5'), true, 'vitrine: VIP tem meia');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'ticket_types' and column_name = 'permite_meia'), 1, 'coluna permite_meia existe');
select throws_ok($$select public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1', '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b1","quantidade":1}]')$$,
  '42501', null, 'anon não executa reservar_ingressos');

-- 2. Taxa e meia: casos de taxa.test.ts, meia de R$ 0,01 e plano B (trocando a constante)
select pg_temp.como('postgres');
select results_eq($$select public.evk_taxa_centavos(c, false) from unnest(array[0, 1000, 2999, 3000, 10000, 3333, 3005, 5000]::bigint[]) c$$,
  $$values (0::bigint), (300), (300), (300), (1000), (333), (301), (500)$$, 'taxa: 10%, mínimo R$ 3, gratuito 0 (casos de taxa.test.ts)');
select results_eq($$select public.evk_preco_meia(c) from unnest(array[0, 1, 2, 5001, 5000]::bigint[]) c$$,
  $$values (0::bigint), (1), (1), (2500), (2500)$$, 'meia: floor(preço/2), piso de 1 centavo');
select is((select public.evk_taxa_centavos(1, true)), 300::bigint, 'meia de 1 centavo paga o piso de R$ 3');
do $$ begin
  execute replace(pg_get_functiondef('public.evk_taxa_centavos(bigint, boolean)'::regprocedure), '300 /*PISO_MEIA*/', '0 /*PISO_MEIA*/');
end $$;
select results_eq($$select public.evk_taxa_centavos(1, true), public.evk_taxa_centavos(1, false), public.evk_taxa_centavos(5000, true)$$,
  $$values (0::bigint, 300::bigint, 500::bigint)$$, 'plano B: trocando UMA linha a meia perde o piso e a inteira não muda');
do $$ begin
  execute replace(pg_get_functiondef('public.evk_taxa_centavos(bigint, boolean)'::regprocedure), '0 /*PISO_MEIA*/', '300 /*PISO_MEIA*/');
end $$;

-- 3. Meia de R$ 0,01 pelo servidor: taxa R$ 3, total R$ 3,01; A1: sem CPF/telefone do perfil, e-mail do JWT
update public.profiles set cpf = '52998224725', phone = '11999999999' where id = 'fd000000-0000-4000-8000-000000000005';
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000005');
insert into pg_temp.res select 'centavo', public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b7","quantidade":1,"beneficio":"meia","meia_tipo":"estudante"}]');
select pg_temp.como('postgres');
select results_eq($$select (j->>'subtotal')::numeric, (j->>'taxa')::numeric, (j->>'total')::numeric from pg_temp.res where k = 'centavo'$$,
  $$values (0.01::numeric, 3.00::numeric, 3.01::numeric)$$, 'meia R$ 0,01: subtotal 0,01 + taxa 3,00 = 3,01');
select results_eq($$select o.customer_email, o.customer_cpf, o.customer_cpf_hmac is null, o.customer_phone, o.status, o.reservado_ate = o.created_at + interval '10 minutes'
  from public.orders o where o.id = (select (j->>'order_id')::uuid from pg_temp.res where k = 'centavo')$$,
  $$values ('u05@teste-meia.local'::text, null::text, true, null::text, 'pending'::text, true)$$,
  'A1/B3: e-mail do JWT, sem CPF nem telefone do perfil, pendente, reserva de 10 min fixos');
select results_eq($$select oi.beneficio, oi.meia_tipo, oi.unit_price, oi.taxa_unit from public.order_items oi
  where oi.order_id = (select (j->>'order_id')::uuid from pg_temp.res where k = 'centavo')$$,
  $$values ('meia'::text, 'estudante'::text, 0.01::numeric, 3.00::numeric)$$, 'item gravado como meia com tipo, preço e taxa');

-- 4. Cota e estoque: Pista (lotação 10, cota 4). u01 reserva 6 inteiras; a 7ª inteira de u02 é bloqueada pela reserva da meia
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000001');
select lives_ok($$insert into pg_temp.res select 'u1', public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b1","quantidade":6}]')$$, '6 inteiras da Pista (10 - cota 4) cabem');
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000002');
select throws_ok($$select public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b1","quantidade":1}]')$$, '22023',
  'Ingressos esgotados ou insuficientes (restam 0)', 'a 7ª inteira é bloqueada: as 4 vagas são da meia');
select lives_ok($$insert into pg_temp.res select 'u2', public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b1","quantidade":4,"beneficio":"meia","meia_tipo":"pcd"}]')$$, '4 meias (a cota) cabem');
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000003');
select throws_ok($$select public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b1","quantidade":1,"beneficio":"meia","meia_tipo":"estudante"}]')$$, '22023',
  'Restam 0 meias neste ingresso', 'a 5ª meia passa da cota');
-- reserva vencida libera o estoque sozinha
select pg_temp.como('postgres');
update public.orders set reservado_ate = now() - interval '1 minute' where id = (select (j->>'order_id')::uuid from pg_temp.res where k = 'u1');
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000003');
select lives_ok($$insert into pg_temp.res select 'u3', public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b1","quantidade":6}]')$$, 'reserva vencida (reservado_ate no passado) libera as 6 vagas');
select pg_temp.como('anon');
select results_eq($$select disponiveis, meias_disponiveis from public.vitrine_ingressos('fd000000-0000-4000-8000-0000000000e1') where ticket_type_id = 'fd000000-0000-4000-8000-0000000000b1'$$,
  $$values (0, 0)$$, 'vitrine reflete as reservas vivas (6 inteiras + 4 meias)');

-- 5. Recusas de benefício: mesa, coletiva, permite_meia=false (produtor liga/desliga), lugar marcado, tipo inválido, grátis
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000001');
select throws_ok($$select public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b3","quantidade":1,"beneficio":"meia","meia_tipo":"estudante"}]')$$, '22023',
  'Este ingresso não tem meia-entrada', 'mesa não tem meia');
select throws_ok($$select public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b4","quantidade":1,"beneficio":"meia","meia_tipo":"estudante"}]')$$, '22023',
  'Este ingresso não tem meia-entrada', 'coletiva não tem meia');
select throws_ok($$select public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b9","quantidade":1,"beneficio":"meia","meia_tipo":"estudante"}]')$$, '22023',
  'Este ingresso não tem meia-entrada', 'grátis não tem meia');
select throws_ok($$select public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000ba","quantidade":1,"beneficio":"meia","meia_tipo":"estudante"}]')$$, '22023',
  'Meia-entrada em lugar marcado ainda não está disponível', 'lugar marcado: meia recusada (reservar_assentos ainda não grava benefício)');
select throws_ok($$select public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b5","quantidade":1,"beneficio":"meia","meia_tipo":"idoso_sp"}]')$$, '22023',
  'Tipo de meia-entrada inválido para este evento', 'benefício estadual só vale se cadastrado para a UF do evento');
select pg_temp.como('postgres');
insert into public.beneficios_uf (uf, codigo, nome, documento) values ('SP', 'idoso_sp', 'Idoso', 'RG');
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000001');
select lives_ok($$select public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b5","quantidade":1,"beneficio":"meia","meia_tipo":"idoso_sp"}]')$$, 'benefício estadual cadastrado para SP vale (VIP tem meia)');
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000009');
select lives_ok($$update public.ticket_types set permite_meia = false where id = 'fd000000-0000-4000-8000-0000000000bc'$$, 'o produtor desliga a meia do tipo');
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000001');
select throws_ok($$select public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000bc","quantidade":1,"beneficio":"meia","meia_tipo":"estudante"}]')$$, '22023',
  'Este ingresso não tem meia-entrada', 'permite_meia=false recusa a meia');

-- 6. Cupom: não vale na meia; misto só nas inteiras; 100% gera total 0 e passa por confirmar_pedido_gratis; max_uses
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000004');
select throws_ok($$select public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b5","quantidade":1,"beneficio":"meia","meia_tipo":"estudante"}]', 'dez')$$, '22023',
  'O cupom não vale para meia-entrada: tire o cupom ou inclua ingressos inteiros', 'pedido só de meias com cupom é recusado');
insert into pg_temp.res select 'misto', public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b5","quantidade":2},{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b5","quantidade":1,"beneficio":"meia","meia_tipo":"estudante"}]', 'dez');
select pg_temp.como('postgres');
select results_eq($$select (j->>'subtotal')::numeric, (j->>'desconto')::numeric, (j->>'taxa')::numeric, (j->>'total')::numeric from pg_temp.res where k = 'misto'$$,
  $$values (150.00::numeric, 12.00::numeric, 13.80::numeric, 151.80::numeric)$$,
  'misto: 2 inteiras R$60 com 10% (desconto 12,00) + 1 meia R$30 sem desconto; taxa sobre o preço com desconto (2 x 5,40 + 3,00 = 13,80)');
select results_eq($$select oi.beneficio, oi.unit_price, oi.taxa_unit from public.order_items oi
  where oi.order_id = (select (j->>'order_id')::uuid from pg_temp.res where k = 'misto') order by oi.beneficio$$,
  $$values ('inteira'::text, 60.00::numeric, 5.40::numeric), ('meia'::text, 30.00::numeric, 3.00::numeric)$$, 'itens do misto: meia sem desconto, taxa da inteira sobre o preço com desconto');
select is((select coupon_id is not null from public.orders where id = (select (j->>'order_id')::uuid from pg_temp.res where k = 'misto')), true, 'pedido guarda o cupom');
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000005');
insert into pg_temp.res select 'gratis', public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b5","quantidade":1}]', 'GRATIS');
select results_eq($$select (j->>'taxa')::numeric, (j->>'total')::numeric, j->>'status' from pg_temp.res where k = 'gratis'$$,
  $$values (0.00::numeric, 0.00::numeric, 'pending'::text)$$, 'cupom de 100%: total 0, taxa 0 (item em 0 não paga taxa), pedido pendente');
select is((select public.confirmar_pedido_gratis((select (j->>'order_id')::uuid from pg_temp.res where k = 'gratis'))), 1,
  'confirmar_pedido_gratis aceita pedido de cupom com total 0 e emite o ingresso');
select pg_temp.como('postgres');
select results_eq($$select o.status, (select count(*)::int from public.tickets t where t.order_id = o.id) from public.orders o where o.id = (select (j->>'order_id')::uuid from pg_temp.res where k = 'gratis')$$,
  $$values ('paid'::text, 1)$$, 'pedido com cupom de 100% ficou pago com 1 ingresso');
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000006');
select lives_ok($$select public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000bb","quantidade":1}]', 'umuso')$$, 'cupom de 1 uso: 1ª reserva passa');
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000007');
select throws_ok($$select public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000bb","quantidade":1}]', 'UMUSO')$$, '22023', 'Este cupom esgotou', 'max_uses: a 2ª conta é recusada');
select throws_ok($$select public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000bb","quantidade":1}]', 'NAOEXISTE')$$, '22023', 'Cupom inválido ou indisponível', 'cupom inexistente');

-- 7. Limite por CPF preservado (tipo com max_por_cpf = 1)
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000008');
select throws_ok($$select public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b8","quantidade":1}]')$$, '22023',
  'Informe o CPF do comprador para este ingresso', 'tipo com limite por CPF exige o CPF');
select throws_ok($$select public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b8","quantidade":2}]', null, '529.982.247-25')$$, '22023',
  'Limite de 1 ingressos por CPF neste ingresso', 'o guard do limite por CPF continua valendo na reserva');
select lives_ok($$insert into pg_temp.res select 'cpf', public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1',
  '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b8","quantidade":1}]', null, '52998224725')$$, 'com o CPF e dentro do limite, reserva');
select pg_temp.como('postgres');
select is((select o.customer_cpf is null and o.customer_cpf_hmac is not null from public.orders o where o.id = (select (j->>'order_id')::uuid from pg_temp.res where k = 'cpf')), true, 'CPF puro não fica gravado; só o hash');

-- 8. Reserva anterior cancelada, aviso, e no máximo 5 reservas por hora
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000002');
insert into pg_temp.res select 'u2b', public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1', '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000bb","quantidade":1}]');
select pg_temp.como('postgres');
select results_eq($$select (select status from public.orders where id = (select (j->>'order_id')::uuid from pg_temp.res where k = 'u2')), (select j->>'aviso' is not null from pg_temp.res where k = 'u2b')$$,
  $$values ('cancelled'::text, true)$$, 'a nova reserva cancela a anterior da conta no evento e avisa');
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000008');
do $$ begin
  for i in 1..3 loop
    perform public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1', '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b9","quantidade":1}]');
  end loop;
end $$;
select pg_temp.como('postgres');
select is((select count(*)::int from public.orders where user_id = 'fd000000-0000-4000-8000-000000000008' and reservado_ate is not null), 4, 'u08: 4 reservas (1 do CPF + 3 grátis)');
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000008');
select lives_ok($$select public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1', '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b9","quantidade":1}]')$$, '5ª reserva da hora passa');
select throws_ok($$select public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1', '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000b9","quantidade":1}]')$$,
  '22023', 'Muitas reservas neste evento. Tente de novo em alguns minutos.', '6ª reserva na mesma hora é recusada');

-- 9. Validação de entrada
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000007');
select throws_ok($$select public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1', '[{"ticket_type_id":"fd000000-0000-4000-8000-0000000000bb","quantidade":101}]')$$,
  '22023', null, 'quantidade acima de 100 é recusada');
select throws_ok($$select public.reservar_ingressos('fd000000-0000-4000-8000-0000000000e1', '[]')$$, '22023', 'Informe de 1 a 10 itens', 'sem itens é recusado');

-- 10. RESTRICTIVE: o navegador não fabrica preço, meia, reserva nem desconto, mas o caminho antigo honesto continua
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000007');
insert into public.orders (id, user_id, event_id, total, status) values
  ('fd000000-0000-4000-8000-0000000000f1', 'fd000000-0000-4000-8000-000000000007', 'fd000000-0000-4000-8000-0000000000e1', 50, 'pending');
select lives_ok($$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fd000000-0000-4000-8000-0000000000f1', 'fd000000-0000-4000-8000-0000000000bb', 1, 50)$$, 'caminho antigo: item com o preço do tipo continua entrando');
select throws_ok($$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values
  ('fd000000-0000-4000-8000-0000000000f1', 'fd000000-0000-4000-8000-0000000000bb', 1, 1)$$, '42501', null, 'unit_price falso é barrado pela RESTRICTIVE');
select throws_ok($$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price, beneficio, meia_tipo) values
  ('fd000000-0000-4000-8000-0000000000f1', 'fd000000-0000-4000-8000-0000000000b2', 1, 40, 'meia', 'estudante')$$, '42501', null, 'meia fabricada pelo navegador é barrada');
select throws_ok($$insert into public.orders (user_id, event_id, total, status, reservado_ate) values
  ('fd000000-0000-4000-8000-000000000007', 'fd000000-0000-4000-8000-0000000000e1', 1, 'pending', now() + interval '1 hour')$$, '42501', null, 'reserva falsa (reservado_ate) é barrada');
select throws_ok($$insert into public.orders (user_id, event_id, total, status, discount) values
  ('fd000000-0000-4000-8000-000000000007', 'fd000000-0000-4000-8000-0000000000e1', 1, 'pending', 10)$$, '42501', null, 'desconto fabricado é barrado');
select throws_ok($$select public.confirmar_pedido_gratis('fd000000-0000-4000-8000-0000000000f1')$$, '22023', null, 'confirmar_pedido_gratis sem cupom continua recusando pedido pago');

select * from finish();
rollback;
