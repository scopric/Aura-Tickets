-- pgTAP da L4 (docs/sql/20261012_produtor_seguranca_l4.sql). Só no banco local: `supabase start`, aplicar o SQL da L4
-- e rodar `supabase test db`.
-- Tudo em begin ... rollback: nada fica gravado. Nunca contra produção.
-- pg_temp.como() troca o papel e as claims do JWT como o PostgREST faz, igual a supabase/tests/favoritos.test.sql.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(35);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', p_role, true);
end $f$;
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated, service_role;
grant execute on all functions in schema extensions to anon, authenticated, service_role;

-- Dados (como postgres): p1 e p2 produtores, c1 comprador, c2 comprador com 2FA, adm admin com 2FA
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('d4000000-0000-4000-8000-000000000001', 'p1@teste-l4.local', now(), '{"role":"producer","full_name":"Paula"}'),
  ('d4000000-0000-4000-8000-000000000002', 'p2@teste-l4.local', now(), '{"role":"producer","full_name":"Pedro"}'),
  ('d4000000-0000-4000-8000-000000000003', 'c1@teste-l4.local', now(), '{"full_name":"Carla"}'),
  ('d4000000-0000-4000-8000-000000000004', 'c2@teste-l4.local', now(), '{"full_name":"Caio"}'),
  ('d4000000-0000-4000-8000-000000000005', 'adm@teste-l4.local', now(), '{"full_name":"Ada"}');
update public.profiles set role = 'admin', admin_permissions = array['super_admin'] where id = 'd4000000-0000-4000-8000-000000000005'; -- S3: o admin precisa de permissão (Decisão 163)
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at) values
  ('d4000000-0000-4000-8000-0000000000f4', 'd4000000-0000-4000-8000-000000000004', 'teste', 'totp', 'verified', now(), now()),
  ('d4000000-0000-4000-8000-0000000000f5', 'd4000000-0000-4000-8000-000000000005', 'teste', 'totp', 'verified', now(), now());
insert into public.producer_profiles (id, company_name) values ('d4000000-0000-4000-8000-000000000001', 'Paula Eventos');
insert into public.events (id, producer_id, title, slug, status, approval_status) values
  ('d4000000-0000-4000-8000-0000000000e1', 'd4000000-0000-4000-8000-000000000001', 'No ar', 'l4-e1', 'published', 'approved'),
  ('d4000000-0000-4000-8000-0000000000e2', 'd4000000-0000-4000-8000-000000000001', 'Em análise', 'l4-e2', 'published', 'pending'),
  ('d4000000-0000-4000-8000-0000000000e3', 'd4000000-0000-4000-8000-000000000001', 'Rascunho', 'l4-e3', 'draft', 'pending');
insert into public.menu_items (id, event_id, producer_id, name, price, is_available) values
  ('d4000000-0000-4000-8000-0000000000a1', 'd4000000-0000-4000-8000-0000000000e1', 'd4000000-0000-4000-8000-000000000001', 'Água', 5, true),
  ('d4000000-0000-4000-8000-0000000000a2', 'd4000000-0000-4000-8000-0000000000e1', 'd4000000-0000-4000-8000-000000000001', 'Esgotado', 5, false),
  ('d4000000-0000-4000-8000-0000000000a3', 'd4000000-0000-4000-8000-0000000000e2', 'd4000000-0000-4000-8000-000000000001', 'Em análise', 5, true),
  ('d4000000-0000-4000-8000-0000000000a4', 'd4000000-0000-4000-8000-0000000000e3', 'd4000000-0000-4000-8000-000000000001', 'Rascunho', 5, true);
insert into public.coupons (id, producer_id, event_id, code, discount_type, discount_value) values
  ('d4000000-0000-4000-8000-0000000000c1', 'd4000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-0000000000e1', 'L4PAULA', 'percent', 10);
insert into public.coupons (id, code, discount_type, discount_value, duration) values
  ('d4000000-0000-4000-8000-0000000000c2', 'L4PLANO', 'percent', 10, 'once');

-- Estrutura -------------------------------------------------------------------------------------------------------
select policies_are('public', 'revenue_advances',
  array['gf_mfa_aal2', 'gf_revenue_advances_admin_delete', 'gf_revenue_advances_admin_update', 'gf_revenue_advances_select'],
  'revenue_advances: sem a regra de INSERT do produtor; as outras ficam');
select policies_are('public', 'menu_items', array['gf_menu_items_dono', 'gf_menu_items_evento_aprovado', 'gf_mfa_aal2'],
  'menu_items: dono, leitura do cardápio de evento aprovado e 2FA');
select ok(exists (select 1 from pg_index i join pg_class c on c.oid = i.indexrelid
  where c.relname = 'onboarding_logs_user_step_key' and i.indisunique),
  'onboarding_logs_user_step_key é único');

-- a. revenue_advances ---------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'd4000000-0000-4000-8000-000000000001');
select throws_ok($$insert into public.revenue_advances (producer_id, event_id, amount, net_amount) values
  ('d4000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-0000000000e1', 1000000, 1000000)$$,
  '42501', null, 'P1 não cria pedido de antecipação pela API');
select pg_temp.como('service_role');
select lives_ok($$insert into public.revenue_advances (id, producer_id, event_id, amount) values
  ('d4000000-0000-4000-8000-0000000000b1', 'd4000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-0000000000e1', 100)$$,
  'a chave de serviço continua criando');
select pg_temp.como('authenticated', 'd4000000-0000-4000-8000-000000000001');
select is((select count(*) from public.revenue_advances), 1::bigint, 'P1 continua lendo o próprio pedido');

-- b. producer_profiles (pós-passo 2 do PR 7: Pix, conta e CNPJ só existem cifrados, em *_enc bytea; convert_to faz de "cifra" nas fixtures) --------------------------------------------------------------------------------------------
select lives_ok($$update public.producer_profiles set company_name = 'Paula Produções', pix_key_enc = convert_to('p1@pix', 'UTF8')
  where id = 'd4000000-0000-4000-8000-000000000001'$$, 'P1 salva nome e Pix');
select lives_ok($$update public.producer_profiles set webhook_url = null, stripe_account_id = null
  where id = 'd4000000-0000-4000-8000-000000000001'$$, 'P1 mandando o mesmo valor (nulo) passa');
select throws_ok($$update public.producer_profiles set webhook_url = 'https://mal.example/x'
  where id = 'd4000000-0000-4000-8000-000000000001'$$, '42501', null, 'P1 não grava webhook_url');
select throws_ok($$update public.producer_profiles set stripe_account_id = 'acct_x'
  where id = 'd4000000-0000-4000-8000-000000000001'$$, '42501', null, 'P1 não grava stripe_account_id');
select throws_ok($$update public.producer_profiles set woovi_account_id = 'woovi_x'
  where id = 'd4000000-0000-4000-8000-000000000001'$$, '42501', null, 'P1 não grava woovi_account_id');
select throws_ok($$update public.producer_profiles set commission_rate = 1
  where id = 'd4000000-0000-4000-8000-000000000001'$$, '42501', null, 'P1 continua sem alterar commission_rate');
select lives_ok($$insert into public.producer_profiles (id, company_name, pix_key_enc) values
  ('d4000000-0000-4000-8000-000000000001', 'Paula', convert_to('outra@pix', 'UTF8'))
  on conflict (id) do update set pix_key_enc = excluded.pix_key_enc$$, 'upsert do Salvar (só colunas livres) passa');

select pg_temp.como('authenticated', 'd4000000-0000-4000-8000-000000000002');
select throws_ok($$insert into public.producer_profiles (id, company_name, woovi_account_id) values
  ('d4000000-0000-4000-8000-000000000002', 'Pedro', 'woovi_x')$$, '42501', null, 'P2 não cria o perfil já com woovi_account_id');
select lives_ok($$insert into public.producer_profiles (id, company_name, cnpj_enc, bank_account_enc, pix_key_enc, notification_settings)
  values ('d4000000-0000-4000-8000-000000000002', 'Pedro', null, convert_to('{}', 'UTF8'), convert_to('', 'UTF8'), '{}')$$, 'P2 cria o perfil como o front cria');

select pg_temp.como('authenticated', 'd4000000-0000-4000-8000-000000000005', 'aal2');
select lives_ok($$update public.producer_profiles set stripe_account_id = 'acct_ok'
  where id = 'd4000000-0000-4000-8000-000000000001'$$, 'admin (aal2) grava stripe_account_id');
select pg_temp.como('service_role');
select lives_ok($$update public.producer_profiles set woovi_account_id = 'woovi_ok', webhook_url = null
  where id = 'd4000000-0000-4000-8000-000000000001'$$, 'a chave de serviço grava woovi_account_id');
select pg_temp.como('postgres');
select is((select stripe_account_id || '/' || woovi_account_id from public.producer_profiles
  where id = 'd4000000-0000-4000-8000-000000000001'), 'acct_ok/woovi_ok', 'gravações de admin e serviço ficaram');

-- c. coupons ------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'd4000000-0000-4000-8000-000000000001');
select throws_ok($$update public.coupons set uses = 999 where id = 'd4000000-0000-4000-8000-0000000000c1'$$,
  '42501', null, 'P1 não altera uses do próprio cupom');
select lives_ok($$update public.coupons set is_active = false, updated_at = now()
  where id = 'd4000000-0000-4000-8000-0000000000c1'$$, 'P1 desativa o cupom (o que a tela faz)');
select throws_ok($$insert into public.coupons (producer_id, code, discount_type, discount_value, uses) values
  ('d4000000-0000-4000-8000-000000000001', 'L4CHEIO', 'percent', 10, 500)$$, '42501', null, 'P1 não cria cupom já com uses');
select lives_ok($$insert into public.coupons (producer_id, code, discount_type, discount_value) values
  ('d4000000-0000-4000-8000-000000000001', 'L4NOVO', 'percent', 10)$$, 'P1 cria cupom sem uses');
select pg_temp.como('service_role');
select lives_ok($$update public.coupons set uses = uses + 1 where id = 'd4000000-0000-4000-8000-0000000000c1'$$,
  'a chave de serviço incrementa uses');
select pg_temp.como('authenticated', 'd4000000-0000-4000-8000-000000000005', 'aal2');
select lives_ok($$update public.coupons set uses = 3 where id = 'd4000000-0000-4000-8000-0000000000c2'$$,
  'admin (aal2) altera uses do cupom da plataforma');
select pg_temp.como('postgres');
select is((select uses from public.coupons where id = 'd4000000-0000-4000-8000-0000000000c1'), 1,
  'uses do cupom do P1 = só o incremento do serviço');

-- d. menu_items ---------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'd4000000-0000-4000-8000-000000000003');
select results_eq($$select name from public.menu_items order by name$$, array['Água'],
  'comprador lê só o item disponível de evento publicado e aprovado');
select pg_temp.como('authenticated', 'd4000000-0000-4000-8000-000000000002');
select is((select count(*) from public.menu_items), 1::bigint, 'outro produtor também só vê o cardápio no ar');
select pg_temp.como('authenticated', 'd4000000-0000-4000-8000-000000000001');
select is((select count(*) from public.menu_items), 4::bigint, 'o dono continua vendo os 4 itens');
select pg_temp.como('authenticated', 'd4000000-0000-4000-8000-000000000004', 'aal1');
select is((select count(*) from public.menu_items), 0::bigint, 'comprador com 2FA em aal1 não vê (gf_mfa_aal2 intacta)');
select pg_temp.como('anon');
select is((select count(*) from public.menu_items), 0::bigint, 'anônimo não vê o cardápio');
select pg_temp.como('authenticated', 'd4000000-0000-4000-8000-000000000003');
select results_eq($$with u as (update public.menu_items set price = 0 returning id) select count(*) from u$$,
  array[0::bigint], 'a leitura nova não deixa o comprador alterar item do cardápio');

-- e. onboarding_logs ----------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'd4000000-0000-4000-8000-000000000001');
select lives_ok($$insert into public.onboarding_logs (user_id, step_name, completed_at, skipped) values
  ('d4000000-0000-4000-8000-000000000001', 'tour:inicio', now(), false)$$, 'P1 registra o tour');
select throws_ok($$insert into public.onboarding_logs (user_id, step_name, completed_at, skipped) values
  ('d4000000-0000-4000-8000-000000000001', 'tour:inicio', now(), true)$$, '23505', null, 'insert repetido é barrado');
select lives_ok($$insert into public.onboarding_logs (user_id, step_name, completed_at, skipped) values
  ('d4000000-0000-4000-8000-000000000001', 'tour:inicio', now(), true)
  on conflict (user_id, step_name) do update set completed_at = excluded.completed_at, skipped = excluded.skipped$$,
  'upsert (o do front) no mesmo passo passa');
select is((select count(*)::text || '/' || bool_and(skipped)::text from public.onboarding_logs), '1/true',
  'uma linha só, com o último estado (pulado)');

select * from finish();
rollback;
