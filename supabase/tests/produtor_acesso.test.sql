-- pgTAP do B3 (docs/sql/20261005_produtor_acesso.sql). Só no banco local: `supabase start`, aplicar o SQL do B3
-- (e antes os de docs/sql que vieram depois do baseline e mexem nas mesmas regras: seg6 e seg4) e rodar
-- `supabase test db`. Tudo em begin ... rollback: nada fica gravado.
-- Sem os helpers do dbdev (precisam de internet no container): pg_temp.como() troca o papel e as claims do JWT
-- como o PostgREST faz, igual aos testes de docs/sql/20261001_seg6_menor_privilegio.sql.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(95);

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
-- p1/p2 produtores, af adulto, men menor, sem sem data de nascimento, part participante, p3 produtor com 2FA
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('b3000000-0000-4000-8000-000000000001', 'p1@teste.local', now(), '{"role":"producer","full_name":"Paula Um"}'),
  ('b3000000-0000-4000-8000-000000000002', 'p2@teste.local', now(), '{"role":"producer","full_name":"Pedro Dois"}'),
  ('b3000000-0000-4000-8000-000000000003', 'af@teste.local', now(), '{"full_name":"Ana Afiliada"}'),
  ('b3000000-0000-4000-8000-000000000004', 'men@teste.local', now(), '{"full_name":"Menor Idade"}'),
  ('b3000000-0000-4000-8000-000000000005', 'sem@teste.local', now(), '{"full_name":"Sem Data"}'),
  ('b3000000-0000-4000-8000-000000000006', 'part@teste.local', now(), '{"full_name":"Paulo Participante"}'),
  ('b3000000-0000-4000-8000-000000000007', 'p3@teste.local', now(), '{"role":"producer","full_name":"Tercio"}'),
  ('b3000000-0000-4000-8000-000000000008', 'p1@teste.local.br', null, '{"full_name":"Nao Confirmado"}'),
  ('b3000000-0000-4000-8000-000000000009', 'a@x.com', now(), '{"full_name":"Curto"}'),
  ('b3000000-0000-4000-8000-000000000010', 'novo@teste.local', now(), '{"role":"producer","full_name":"Novo"}'),
  ('b3000000-0000-4000-8000-000000000011', 'joana@teste.local', now(), '{"full_name":"Joana"}');
update public.profiles set birth_date = '1990-05-10' where id in ('b3000000-0000-4000-8000-000000000003',
  'b3000000-0000-4000-8000-000000000008', 'b3000000-0000-4000-8000-000000000009', 'b3000000-0000-4000-8000-000000000011');
-- produtores com cadastro (auth.users) de mais de 24 h; o novo (010) fica com a data de agora
update auth.users set created_at = now() where id = 'b3000000-0000-4000-8000-000000000010';
update auth.users set created_at = now() - interval '2 days' where id in ('b3000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000007');
update public.profiles set birth_date = current_date - interval '17 years' where id = 'b3000000-0000-4000-8000-000000000004';
update public.profiles set birth_date = '1980-01-01' where id = 'b3000000-0000-4000-8000-000000000001';
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values ('b3000000-0000-4000-8000-0000000000f7', 'b3000000-0000-4000-8000-000000000007', 'teste', 'totp', 'verified', now(), now());
insert into public.events (id, producer_id, title, slug) values
  ('b3000000-0000-4000-8000-0000000000e1', 'b3000000-0000-4000-8000-000000000001', 'Evento P1', 'b3-e1'),
  ('b3000000-0000-4000-8000-0000000000e2', 'b3000000-0000-4000-8000-000000000002', 'Evento P2', 'b3-e2'),
  ('b3000000-0000-4000-8000-0000000000e3', 'b3000000-0000-4000-8000-000000000010', 'Evento Novo', 'b3-e3');
-- ingressos no evento de P1: "sem" (005) e joana (011) ativos, menor (004) cancelado
insert into public.orders (id, user_id, event_id) values
  ('b3000000-0000-4000-8000-0000000000a5', 'b3000000-0000-4000-8000-000000000005', 'b3000000-0000-4000-8000-0000000000e1');
insert into public.ticket_types (id, event_id, name) values
  ('b3000000-0000-4000-8000-0000000000a6', 'b3000000-0000-4000-8000-0000000000e1', 'Pista');
insert into public.tickets (order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, status) values
  ('b3000000-0000-4000-8000-0000000000a5', 'b3000000-0000-4000-8000-0000000000a6', 'b3000000-0000-4000-8000-0000000000e1',
   'b3000000-0000-4000-8000-000000000005', 'Sem', 'sem@teste.local', 'active'),
  ('b3000000-0000-4000-8000-0000000000a5', 'b3000000-0000-4000-8000-0000000000a6', 'b3000000-0000-4000-8000-0000000000e1',
   'b3000000-0000-4000-8000-000000000004', 'Menor', 'men@teste.local', 'cancelled'),
  ('b3000000-0000-4000-8000-0000000000a5', 'b3000000-0000-4000-8000-0000000000a6', 'b3000000-0000-4000-8000-0000000000e1',
   'b3000000-0000-4000-8000-000000000011', 'Joana', 'joana@teste.local', 'active');
insert into public.certificates (id, event_id) values
  ('b3000000-0000-4000-8000-0000000000c1', 'b3000000-0000-4000-8000-0000000000e1'),
  ('b3000000-0000-4000-8000-0000000000c2', 'b3000000-0000-4000-8000-0000000000e2');
insert into public.issued_certificates (id, certificate_id, user_id) values
  ('b3000000-0000-4000-8000-0000000001c1', 'b3000000-0000-4000-8000-0000000000c1', 'b3000000-0000-4000-8000-000000000006'),
  ('b3000000-0000-4000-8000-0000000001c2', 'b3000000-0000-4000-8000-0000000000c1', 'b3000000-0000-4000-8000-000000000003'),
  ('b3000000-0000-4000-8000-0000000001c3', 'b3000000-0000-4000-8000-0000000000c2', 'b3000000-0000-4000-8000-000000000006');
insert into public.seating_maps (event_id) values ('b3000000-0000-4000-8000-0000000000e1');

-- Estrutura -------------------------------------------------------------------------------------------------------
select policies_are('public', 'coupons', array['Admin gerencia coupons da plataforma', 'Admin le coupons',
  'Afiliado le os proprios cupons', 'Produtor gerencia coupons', 'gf_mfa_aal2'],
  'coupons: regras de admin e afiliado intactas');
select policies_are('public', 'event_budget_boxes', array['Produtor gerencia budget boxes', 'gf_budget_boxes_all',
  'gf_mfa_aal2', 'gf_budget_boxes_insert_saldo_zero'], 'event_budget_boxes: só as 4 regras esperadas (a 4ª é do B3b, 20261006)');
select ok((select qual from pg_policies where tablename = 'event_budget_boxes' and policyname = 'gf_budget_boxes_all')
  not like '%producer_id%', 'gf_budget_boxes_all só para admin (sem o atalho do dono)');
select ok(not has_function_privilege('anon', 'public.vincular_afiliado(text, uuid, numeric)', 'execute')
  and not has_function_privilege('anon', 'public.listar_afiliados()', 'execute')
  and not has_function_privilege('anon', 'public.caixinha_movimentar(uuid, text, numeric, text)', 'execute')
  and not has_function_privilege('anon', 'public.crm_criar_etapas_padrao()', 'execute'),
  'anon não executa nenhuma das 4 funções');

-- CRM, etapas e cardápio: dono lê e grava -------------------------------------------------------------------------
select pg_temp.como('authenticated', 'b3000000-0000-4000-8000-000000000001');
select lives_ok($$insert into pipeline_stages (id, producer_id, name) values
  ('b3000000-0000-4000-8000-0000000005a1', 'b3000000-0000-4000-8000-000000000001', 'Minha etapa')$$,
  'P1 cria etapa própria');
select lives_ok($$insert into crm_leads (id, producer_id, stage_id, full_name) values
  ('b3000000-0000-4000-8000-0000000001a1', 'b3000000-0000-4000-8000-000000000001',
   'b3000000-0000-4000-8000-0000000005a1', 'Lead P1')$$, 'P1 cria lead na própria etapa');
select lives_ok($$insert into crm_interactions (id, lead_id, type, content) values
  ('b3000000-0000-4000-8000-0000000001b1', 'b3000000-0000-4000-8000-0000000001a1', 'note', 'oi')$$, 'P1 cria interação no próprio lead');
select lives_ok($$insert into menu_items (id, producer_id, event_id, name) values
  ('b3000000-0000-4000-8000-0000000001d1', 'b3000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-0000000000e1', 'Cerveja')$$,
  'P1 cria item de cardápio no próprio evento');
select results_eq($$select id from crm_leads union all select id from crm_interactions
  union all select id from pipeline_stages union all select id from menu_items order by 1$$,
  array['b3000000-0000-4000-8000-0000000001a1', 'b3000000-0000-4000-8000-0000000001b1',
        'b3000000-0000-4000-8000-0000000001d1', 'b3000000-0000-4000-8000-0000000005a1']::uuid[],
  'P1 lê as 4 linhas dele (ids conhecidos)');
select results_eq($$with u as (update crm_leads set notes = 'ok' where id = 'b3000000-0000-4000-8000-0000000001a1'
  returning 1) select count(*) from u$$, array[1::bigint], 'P1 altera o próprio lead');

-- Outro produtor não lê nem grava ---------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'b3000000-0000-4000-8000-000000000002');
select results_eq($$select (select count(*) from crm_leads) + (select count(*) from crm_interactions)
  + (select count(*) from pipeline_stages) + (select count(*) from menu_items)$$, array[0::bigint],
  'P2 não lê nada de P1 (leads, interações, etapas, cardápio)');
select throws_ok($$insert into crm_leads (producer_id, full_name) values
  ('b3000000-0000-4000-8000-000000000001', 'Intruso')$$, '42501', null, 'P2 não cria lead em nome de P1');
select results_eq($$with u as (update crm_leads set notes = 'hack' where id = 'b3000000-0000-4000-8000-0000000001a1'
  returning 1) select count(*) from u$$, array[0::bigint], 'P2 não altera lead de P1');
select results_eq($$with d as (delete from crm_leads where id = 'b3000000-0000-4000-8000-0000000001a1'
  returning 1) select count(*) from d$$, array[0::bigint], 'P2 não apaga lead de P1');
select throws_ok($$insert into crm_interactions (lead_id, type) values
  ('b3000000-0000-4000-8000-0000000001a1', 'note')$$, '42501', null, 'P2 não cria interação no lead de P1');
select throws_ok($$insert into crm_leads (producer_id, stage_id, full_name) values
  ('b3000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-0000000005a1', 'Lead P2')$$,
  '42501', null, 'P2 não prende o próprio lead na etapa de P1');
select throws_ok($$insert into pipeline_stages (producer_id, name) values
  ('b3000000-0000-4000-8000-000000000001', 'Intrusa')$$, '42501', null, 'P2 não cria etapa em nome de P1');
select throws_ok($$insert into menu_items (producer_id, event_id, name) values
  ('b3000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-0000000000e1', 'Item')$$,
  '42501', null, 'P2 não põe item no evento de P1');
select lives_ok($$insert into menu_items (producer_id, name) values
  ('b3000000-0000-4000-8000-000000000002', 'Item sem evento')$$, 'P2 cria item sem evento');

-- Cupons e caixinhas: evento tem de ser do produtor ---------------------------------------------------------------
select throws_ok($$insert into coupons (producer_id, event_id, code, discount_value) values
  ('b3000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-0000000000e1', 'B3HACK', 100)$$,
  '42501', null, 'cupom de P2 no evento de P1 é recusado');
select lives_ok($$insert into coupons (id, producer_id, event_id, code, discount_value) values
  ('b3000000-0000-4000-8000-0000000000d2', 'b3000000-0000-4000-8000-000000000002',
   'b3000000-0000-4000-8000-0000000000e2', 'B3P2', 10)$$, 'cupom de P2 no próprio evento passa');
select throws_ok($$update coupons set event_id = 'b3000000-0000-4000-8000-0000000000e1'
  where id = 'b3000000-0000-4000-8000-0000000000d2'$$, '42501', null,
  'P2 não move o próprio cupom para o evento de P1');
select lives_ok($$insert into coupons (producer_id, code, discount_value) values
  ('b3000000-0000-4000-8000-000000000002', 'B3GERAL', 5)$$, 'cupom de P2 sem evento passa');
select throws_ok($$insert into event_budget_boxes (producer_id, event_id, name) values
  ('b3000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-0000000000e1', 'Caixa')$$,
  '42501', null, 'caixinha de P2 no evento de P1 é recusada');
select pg_temp.como('authenticated', 'b3000000-0000-4000-8000-000000000001');
select lives_ok($$insert into event_budget_boxes (id, producer_id, event_id, name) values
  ('b3000000-0000-4000-8000-0000000000b1', 'b3000000-0000-4000-8000-000000000001',
   'b3000000-0000-4000-8000-0000000000e1', 'Som')$$, 'P1 cria caixinha no próprio evento');
select results_eq($$select count(*) from coupons$$, array[0::bigint], 'P1 não lê cupons de P2');

-- Caixinha atômica ------------------------------------------------------------------------------------------------
select is(caixinha_movimentar('b3000000-0000-4000-8000-0000000000b1', 'deposit', 100, 'entrada'), 100::numeric,
  'depósito de 100 devolve saldo 100');
select is(caixinha_movimentar('b3000000-0000-4000-8000-0000000000b1', 'withdraw', 30), 70::numeric,
  'retirada de 30 devolve saldo 70');
select throws_ok($$select caixinha_movimentar('b3000000-0000-4000-8000-0000000000b1', 'withdraw', 100)$$,
  '23514', null, 'retirada maior que o saldo é recusada');
select throws_ok($$select caixinha_movimentar('b3000000-0000-4000-8000-0000000000b1', 'deposit', 0)$$,
  '22023', null, 'valor zero é recusado');
select throws_ok($$select caixinha_movimentar('b3000000-0000-4000-8000-0000000000b1', 'roubo', 10)$$,
  '22023', null, 'tipo inválido é recusado');
select throws_ok($$select caixinha_movimentar('b3000000-0000-4000-8000-0000000000b1', 'withdraw', 'NaN')$$,
  '22023', null, 'NaN é recusado');
select throws_ok($$select caixinha_movimentar('b3000000-0000-4000-8000-0000000000b1', 'deposit', 'Infinity')$$,
  '22023', null, 'Infinity é recusado');
select throws_ok($$select caixinha_movimentar('b3000000-0000-4000-8000-0000000000b1', 'deposit', 1e9)$$,
  '22023', null, 'valor no teto (1 bilhão) é recusado');
select results_eq($$select saved, (select count(*) from piggy_transactions where box_id = b.id)
  from event_budget_boxes b where id = 'b3000000-0000-4000-8000-0000000000b1'$$,
  $$values (70::numeric, 2::bigint)$$, 'saldo 70 e só 2 movimentos gravados');
select pg_temp.como('authenticated', 'b3000000-0000-4000-8000-000000000002');
select throws_ok($$select caixinha_movimentar('b3000000-0000-4000-8000-0000000000b1', 'withdraw', 10)$$,
  '42501', null, 'P2 não movimenta a caixinha de P1');

-- vincular_afiliado -----------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'b3000000-0000-4000-8000-000000000001');
select is(vincular_afiliado('  AF@Teste.Local ', 'b3000000-0000-4000-8000-0000000000e1', 12.5), 'ok',
  'adulto com conta: ok (e-mail sem diferença de maiúscula e espaço)');
select is(vincular_afiliado('af@teste.local', 'b3000000-0000-4000-8000-0000000000e1', 10), 'ja_vinculado',
  'segunda vez: ja_vinculado');
select is(vincular_afiliado('ninguem@teste.local', 'b3000000-0000-4000-8000-0000000000e1', 10), 'nao_encontrado',
  'e-mail sem conta: nao_encontrado');
select is(vincular_afiliado('men@teste.local', 'b3000000-0000-4000-8000-0000000000e1', 10), 'nao_encontrado',
  'menor de 18: mesma resposta de quem não tem conta');
select is(vincular_afiliado('sem@teste.local', 'b3000000-0000-4000-8000-0000000000e1', 10), 'nao_encontrado',
  'sem data de nascimento: mesma resposta de quem não tem conta');
select is(vincular_afiliado('p1@teste.local.br', 'b3000000-0000-4000-8000-0000000000e1', 10), 'nao_encontrado',
  'e-mail não confirmado: nao_encontrado');
select is(vincular_afiliado('p1@teste.local', 'b3000000-0000-4000-8000-0000000000e1', 10), 'proprio',
  'o próprio produtor: proprio');
select is(vincular_afiliado('af@teste.local', 'b3000000-0000-4000-8000-0000000000e2', 10), 'sem_permissao',
  'evento de outro produtor: sem_permissao');
select is(vincular_afiliado('af@teste.local', 'b3000000-0000-4000-8000-0000000000e1', 0), 'comissao_invalida',
  'comissão 0: comissao_invalida');
select is(vincular_afiliado('af@teste.local', 'b3000000-0000-4000-8000-0000000000e1', 100.01), 'comissao_invalida',
  'comissão acima de 100: comissao_invalida');
select throws_ok($$insert into affiliates (producer_id, event_id, affiliate_user_id) values
  ('b3000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-0000000000e1',
   'b3000000-0000-4000-8000-000000000004')$$, '42501', null, 'insert direto em affiliates é barrado (só pela função)');
select throws_ok($$update affiliates set total_earned = 999$$, '42501', null,
  'produtor não altera total_earned pela API');
select throws_ok($$update affiliates set sales = 999$$, '42501', null, 'produtor não altera sales');
select throws_ok($$update affiliates set producer_id = 'b3000000-0000-4000-8000-000000000002'$$, '42501', null,
  'produtor não altera producer_id');
select throws_ok($$update affiliates set event_id = null$$, '42501', null, 'produtor não altera event_id');
select throws_ok($$update affiliates set affiliate_user_id = 'b3000000-0000-4000-8000-000000000009'$$, '42501', null,
  'produtor não altera affiliate_user_id');
select throws_ok($$delete from affiliates$$, '42501', null, 'produtor não apaga vínculo (encerra por status)');
select throws_ok($$select affiliate_user_id from affiliates$$, '42501', null,
  'produtor não lê o uuid do afiliado na tabela');
select results_eq($$with u as (update affiliates set commission_percent = 15, status = 'inactive' returning 1)
  select count(*) from u$$, array[1::bigint], 'produtor altera comissão e status do próprio afiliado');
select is(vincular_afiliado('a@x.com', 'b3000000-0000-4000-8000-0000000000e1', 10), 'ok', 'a@x.com vinculado');
select is(vincular_afiliado('joana@teste.local', 'b3000000-0000-4000-8000-0000000000e1', 10), 'ok', 'joana vinculada');
select results_eq($$select email_mascarado, commission_percent, status from listar_afiliados() order by 1$$,
  $$values ('****@teste.local'::text, 15.00::numeric, 'inactive'::text), ('****@x.com', 10.00, 'active'),
           ('jo***@teste.local', 10.00, 'active')$$,
  'listar_afiliados: e-mail mascarado (1 ou 2 letras viram "*")');
select ok(not exists (select 1 from pg_proc where proname = 'listar_afiliados'
  and proargnames && array['primeiro_nome', 'full_name', 'affiliate_user_id', 'user_id']),
  'listar_afiliados não devolve nome nem uuid do usuário');
select is(vincular_afiliado('   ', 'b3000000-0000-4000-8000-0000000000e1', 10), 'email_invalido', 'e-mail vazio');
select is(vincular_afiliado(repeat('a', 250) || '@x.com', 'b3000000-0000-4000-8000-0000000000e1', 10), 'email_invalido',
  'e-mail acima de 254 caracteres');
select throws_ok($$select count(*) from afiliado_tentativas$$, '42501', null, 'tabela do limite fechada para a API');
select pg_temp.como('authenticated', 'b3000000-0000-4000-8000-000000000006');
select is(vincular_afiliado('af@teste.local', 'b3000000-0000-4000-8000-0000000000e1', 10), 'sem_permissao',
  'participante (não produtor): sem_permissao');
select pg_temp.como('authenticated', 'b3000000-0000-4000-8000-000000000007');
select throws_ok($$select vincular_afiliado('af@teste.local', 'b3000000-0000-4000-8000-0000000000e1', 10)$$,
  '42501', 'Confirme o código do 2FA', 'produtor com 2FA sem o código (aal1): barrado');
select pg_temp.como('authenticated', 'b3000000-0000-4000-8000-000000000007', 'aal2');
select is(vincular_afiliado('af@teste.local', 'b3000000-0000-4000-8000-0000000000e1', 10), 'sem_permissao',
  'o mesmo produtor com aal2 passa do 2FA (e para no dono do evento)');
select pg_temp.como('authenticated', 'b3000000-0000-4000-8000-000000000010');
select is(vincular_afiliado('af@teste.local', 'b3000000-0000-4000-8000-0000000000e3', 10), 'conta_recente',
  'produtor com conta de menos de 24 h: conta_recente');
-- o próprio usuário "envelhece" a conta em profiles (a API deixa) e continua barrado
select results_eq($$with u as (update profiles set created_at = '2020-01-01' where id = 'b3000000-0000-4000-8000-000000000010'
  returning 1) select count(*) from u$$, array[1::bigint], 'produtor novo altera profiles.created_at pela API');
select is(vincular_afiliado('af@teste.local', 'b3000000-0000-4000-8000-0000000000e3', 10), 'conta_recente',
  'mesmo com profiles.created_at em 2020: conta_recente (vale a data de auth.users)');
select pg_temp.como('postgres');
update auth.users set created_at = null where id = 'b3000000-0000-4000-8000-000000000010';
select pg_temp.como('authenticated', 'b3000000-0000-4000-8000-000000000010');
select is(vincular_afiliado('af@teste.local', 'b3000000-0000-4000-8000-0000000000e3', 10), 'conta_recente',
  'cadastro sem data em auth.users: conta_recente (falha fechada)');
select pg_temp.como('anon');
select throws_ok($$select vincular_afiliado('af@teste.local', 'b3000000-0000-4000-8000-0000000000e1', 10)$$,
  '42501', null, 'visitante não executa vincular_afiliado');

-- Afiliado só lê a própria linha; outro produtor não vê nada ------------------------------------------------------
select pg_temp.como('authenticated', 'b3000000-0000-4000-8000-000000000003');
select results_eq($$select event_id, commission_percent from affiliates$$,
  $$values ('b3000000-0000-4000-8000-0000000000e1'::uuid, 15.00::numeric)$$, 'afiliado lê a própria linha');
select throws_ok($$select * from affiliates$$, '42501', null,
  'select * em affiliates dá 42501 (colunas listadas; efeito documentado)');
select results_eq($$with u as (update affiliates set commission_percent = 100 returning 1) select count(*) from u$$,
  array[0::bigint], 'afiliado não altera a própria comissão');
select pg_temp.como('authenticated', 'b3000000-0000-4000-8000-000000000002');
select results_eq($$select count(*) from affiliates$$, array[0::bigint], 'P2 não lê afiliados de P1');
select results_eq($$select count(*) from listar_afiliados()$$, array[0::bigint], 'listar_afiliados não vaza para P2');

-- Limites (as tentativas de P1 são montadas como postgres) --------------------------------------------------------
select pg_temp.como('postgres');
delete from afiliado_tentativas where producer_id = 'b3000000-0000-4000-8000-000000000001';
insert into afiliado_tentativas (producer_id, criado_em)
select 'b3000000-0000-4000-8000-000000000001', now() - interval '2 hours' from generate_series(1, 100);
select pg_temp.como('authenticated', 'b3000000-0000-4000-8000-000000000001');
select is(vincular_afiliado('ninguem@teste.local', 'b3000000-0000-4000-8000-0000000000e1', 10), 'limite',
  '100 tentativas no dia (nenhuma na última hora): limite');
select pg_temp.como('postgres');
delete from afiliado_tentativas where producer_id = 'b3000000-0000-4000-8000-000000000001';
insert into afiliado_tentativas (producer_id)
select 'b3000000-0000-4000-8000-000000000001' from generate_series(1, 20);
select pg_temp.como('authenticated', 'b3000000-0000-4000-8000-000000000001');
select is(vincular_afiliado('ninguem@teste.local', 'b3000000-0000-4000-8000-0000000000e1', 10), 'limite',
  '21ª chamada na hora: limite');

-- Certificados emitidos -------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'b3000000-0000-4000-8000-000000000006');
select results_eq($$select id from issued_certificates order by id$$,
  array['b3000000-0000-4000-8000-0000000001c1'::uuid, 'b3000000-0000-4000-8000-0000000001c3'::uuid],
  'participante lê só os próprios certificados emitidos');
select throws_ok($$insert into issued_certificates (certificate_id, user_id) values
  ('b3000000-0000-4000-8000-0000000000c1', 'b3000000-0000-4000-8000-000000000006')$$,
  '42501', null, 'participante não emite certificado');
select pg_temp.como('authenticated', 'b3000000-0000-4000-8000-000000000001');
select results_eq($$select id from issued_certificates order by id$$,
  array['b3000000-0000-4000-8000-0000000001c1'::uuid, 'b3000000-0000-4000-8000-0000000001c2'::uuid],
  'P1 lê os emitidos do próprio evento (e não os de P2)');
select lives_ok($$insert into issued_certificates (certificate_id, user_id) values
  ('b3000000-0000-4000-8000-0000000000c1', 'b3000000-0000-4000-8000-000000000005')$$,
  'P1 emite certificado do próprio evento para quem tem ingresso ativo');
select throws_ok($$insert into issued_certificates (certificate_id, user_id) values
  ('b3000000-0000-4000-8000-0000000000c1', 'b3000000-0000-4000-8000-000000000005')$$,
  '23505', null, 'mesmo certificado não sai duas vezes para a mesma pessoa');
select throws_ok($$insert into issued_certificates (certificate_id, user_id, code) values
  ('b3000000-0000-4000-8000-0000000000c1', 'b3000000-0000-4000-8000-000000000011', 'CODIGO-ESCOLHIDO')$$,
  '42501', null, 'produtor não escolhe o code do certificado');
select throws_ok($$insert into issued_certificates (certificate_id, user_id) values
  ('b3000000-0000-4000-8000-0000000000c1', 'b3000000-0000-4000-8000-000000000004')$$,
  '42501', null, 'P1 não emite para ingresso cancelado');
select throws_ok($$insert into issued_certificates (certificate_id, user_id) values
  ('b3000000-0000-4000-8000-0000000000c1', 'b3000000-0000-4000-8000-000000000003')$$,
  '42501', null, 'P1 não emite para quem não tem ingresso do evento');
select results_eq($$with u as (update issued_certificates set user_id = 'b3000000-0000-4000-8000-000000000005'
  where id = 'b3000000-0000-4000-8000-0000000001c2' returning 1) select count(*) from u$$, array[0::bigint],
  'P1 não altera certificado emitido (sem UPDATE)');
select results_eq($$with d as (delete from issued_certificates where id = 'b3000000-0000-4000-8000-0000000001c2'
  returning 1) select count(*) from d$$, array[1::bigint], 'P1 revoga (apaga) certificado do próprio evento');
select pg_temp.como('authenticated', 'b3000000-0000-4000-8000-000000000002');
select throws_ok($$insert into issued_certificates (certificate_id, user_id) values
  ('b3000000-0000-4000-8000-0000000000c1', 'b3000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'P2 não emite certificado do evento de P1');

-- Etapas padrão do CRM --------------------------------------------------------------------------------------------
select results_eq($$select name from crm_criar_etapas_padrao()$$,
  array['Novo', 'Contato feito', 'Interessado', 'Negociando', 'Fechado'], 'P2 cria as 5 etapas padrão');
select results_eq($$select count(*) from crm_criar_etapas_padrao()$$, array[5::bigint],
  'segunda chamada não duplica (continua 5)');
select pg_temp.como('authenticated', 'b3000000-0000-4000-8000-000000000001');
select results_eq($$select name from crm_criar_etapas_padrao()$$, array['Minha etapa'],
  'P1 já tinha etapa: nada é criado');

-- Chaves únicas e CNPJ (como postgres) ----------------------------------------------------------------------------
select pg_temp.como('postgres');
select throws_ok($$insert into certificates (event_id) values ('b3000000-0000-4000-8000-0000000000e1')$$,
  '23505', null, 'segundo certificado no mesmo evento é recusado');
select throws_ok($$insert into seating_maps (event_id) values ('b3000000-0000-4000-8000-0000000000e1')$$,
  '23505', null, 'segundo mapa de lugares no mesmo evento é recusado');
select lives_ok($$insert into producer_profiles (id, company_name, cnpj) values
  ('b3000000-0000-4000-8000-000000000001', 'P1 Ltda', null), ('b3000000-0000-4000-8000-000000000002', 'P2 Ltda', null)$$,
  'dois produtores com CNPJ nulo não colidem');
select throws_ok($$insert into producer_profiles (id, company_name, cnpj) values
  ('b3000000-0000-4000-8000-000000000007', 'P3 Ltda', '11222333000181'),
  ('b3000000-0000-4000-8000-000000000003', 'AF Ltda', '11222333000181')$$,
  '23505', null, 'CNPJ preenchido continua único');

select * from finish();
rollback;
