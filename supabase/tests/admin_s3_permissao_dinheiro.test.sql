-- pgTAP da S3 do admin (docs/sql/20261014_admin_s3_permissao_dinheiro.sql, Decisão 163): o banco exige a permissão da
-- tela nas tabelas de dinheiro. Só em banco descartável: aplicar baseline + docs/sql até o estado de produção + o SQL da S3
-- e rodar este arquivo (psql -f ou `supabase test db`). Tudo em begin ... rollback: nada fica gravado. Nunca contra produção.
-- pg_temp.como() troca papel e claims do JWT como o PostgREST (igual a produtor_seguranca_l4.test.sql).
-- pg_temp.n(sql) = primeira coluna bigint do select; pg_temp.upd(sql) = linhas afetadas por update/delete (RLS que
-- esconde a linha dá 0, sem erro). Contas (uma por permissão): ver o bloco de dados.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(340);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', case when p_role = 'postgres' then 'none' else p_role end, true);
end $f$;
create function pg_temp.n(p text) returns bigint language plpgsql as $f$
declare r bigint; begin execute p into r; return r; end $f$;
create function pg_temp.upd(p text) returns bigint language plpgsql as $f$
declare r bigint; begin execute p; get diagnostics r = row_count; return r; end $f$;
grant execute on function pg_temp.como(text, uuid, text), pg_temp.n(text), pg_temp.upd(text) to anon, authenticated, service_role;
grant execute on all functions in schema extensions to anon, authenticated, service_role;

-- Contas: adm_users=manage_users, adm_fin=manage_finance, adm_set=manage_settings, adm_cup=manage_coupons, adm_aff=manage_affiliates,
-- adm_ana=view_analytics, adm_tix=manage_tickets, adm_sup=manage_support, super=super_admin, adm_none=admin sem permissão,
-- adm_aal1=admin com todas as permissões e fator verificado, mas token aal1; p1 dono (com perfil), p2 outro produtor (com perfil),
-- comum=comprador, p3/p4/p5=sem perfil de produtor, afil=pessoa do afiliado.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('d5000000-0000-4000-8000-000000000001', 'adm_users@teste-s3.local', now(), '{"full_name":"adm_users"}'),
  ('d5000000-0000-4000-8000-000000000002', 'adm_fin@teste-s3.local', now(), '{"full_name":"adm_fin"}'),
  ('d5000000-0000-4000-8000-000000000003', 'adm_set@teste-s3.local', now(), '{"full_name":"adm_set"}'),
  ('d5000000-0000-4000-8000-000000000004', 'adm_cup@teste-s3.local', now(), '{"full_name":"adm_cup"}'),
  ('d5000000-0000-4000-8000-000000000005', 'adm_aff@teste-s3.local', now(), '{"full_name":"adm_aff"}'),
  ('d5000000-0000-4000-8000-000000000006', 'adm_ana@teste-s3.local', now(), '{"full_name":"adm_ana"}'),
  ('d5000000-0000-4000-8000-000000000007', 'adm_tix@teste-s3.local', now(), '{"full_name":"adm_tix"}'),
  ('d5000000-0000-4000-8000-000000000008', 'adm_sup@teste-s3.local', now(), '{"full_name":"adm_sup"}'),
  ('d5000000-0000-4000-8000-000000000009', 'super@teste-s3.local', now(), '{"full_name":"super"}'),
  ('d5000000-0000-4000-8000-000000000010', 'adm_none@teste-s3.local', now(), '{"full_name":"adm_none"}'),
  ('d5000000-0000-4000-8000-000000000011', 'adm_aal1@teste-s3.local', now(), '{"full_name":"adm_aal1"}'),
  ('d5000000-0000-4000-8000-000000000012', 'p1@teste-s3.local', now(), '{"full_name":"p1"}'),
  ('d5000000-0000-4000-8000-000000000013', 'p2@teste-s3.local', now(), '{"full_name":"p2"}'),
  ('d5000000-0000-4000-8000-000000000014', 'comum@teste-s3.local', now(), '{"full_name":"comum"}'),
  ('d5000000-0000-4000-8000-000000000015', 'p3@teste-s3.local', now(), '{"full_name":"p3"}'),
  ('d5000000-0000-4000-8000-000000000016', 'afil@teste-s3.local', now(), '{"full_name":"afil"}'),
  ('d5000000-0000-4000-8000-000000000017', 'p4@teste-s3.local', now(), '{"full_name":"p4"}'),
  ('d5000000-0000-4000-8000-000000000018', 'p5@teste-s3.local', now(), '{"full_name":"p5"}');
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at) values
  ('d5000000-0000-4000-8000-0000000000f1', 'd5000000-0000-4000-8000-000000000001', 'teste', 'totp', 'verified', now(), now()),
  ('d5000000-0000-4000-8000-0000000000f2', 'd5000000-0000-4000-8000-000000000002', 'teste', 'totp', 'verified', now(), now()),
  ('d5000000-0000-4000-8000-0000000000f3', 'd5000000-0000-4000-8000-000000000003', 'teste', 'totp', 'verified', now(), now()),
  ('d5000000-0000-4000-8000-0000000000f4', 'd5000000-0000-4000-8000-000000000004', 'teste', 'totp', 'verified', now(), now()),
  ('d5000000-0000-4000-8000-0000000000f5', 'd5000000-0000-4000-8000-000000000005', 'teste', 'totp', 'verified', now(), now()),
  ('d5000000-0000-4000-8000-0000000000f6', 'd5000000-0000-4000-8000-000000000006', 'teste', 'totp', 'verified', now(), now()),
  ('d5000000-0000-4000-8000-0000000000f7', 'd5000000-0000-4000-8000-000000000007', 'teste', 'totp', 'verified', now(), now()),
  ('d5000000-0000-4000-8000-0000000000f8', 'd5000000-0000-4000-8000-000000000008', 'teste', 'totp', 'verified', now(), now()),
  ('d5000000-0000-4000-8000-0000000000f9', 'd5000000-0000-4000-8000-000000000009', 'teste', 'totp', 'verified', now(), now()),
  ('d5000000-0000-4000-8000-0000000000fa', 'd5000000-0000-4000-8000-000000000010', 'teste', 'totp', 'verified', now(), now()),
  ('d5000000-0000-4000-8000-0000000000fb', 'd5000000-0000-4000-8000-000000000011', 'teste', 'totp', 'verified', now(), now());
update public.profiles set role = 'admin', admin_permissions = array['manage_users']::text[] where id = 'd5000000-0000-4000-8000-000000000001';
update public.profiles set role = 'admin', admin_permissions = array['manage_finance']::text[] where id = 'd5000000-0000-4000-8000-000000000002';
update public.profiles set role = 'admin', admin_permissions = array['manage_settings']::text[] where id = 'd5000000-0000-4000-8000-000000000003';
update public.profiles set role = 'admin', admin_permissions = array['manage_coupons']::text[] where id = 'd5000000-0000-4000-8000-000000000004';
update public.profiles set role = 'admin', admin_permissions = array['manage_affiliates']::text[] where id = 'd5000000-0000-4000-8000-000000000005';
update public.profiles set role = 'admin', admin_permissions = array['view_analytics']::text[] where id = 'd5000000-0000-4000-8000-000000000006';
update public.profiles set role = 'admin', admin_permissions = array['manage_tickets']::text[] where id = 'd5000000-0000-4000-8000-000000000007';
update public.profiles set role = 'admin', admin_permissions = array['manage_support']::text[] where id = 'd5000000-0000-4000-8000-000000000008';
update public.profiles set role = 'admin', admin_permissions = array['super_admin']::text[] where id = 'd5000000-0000-4000-8000-000000000009';
update public.profiles set role = 'admin', admin_permissions = array[]::text[] where id = 'd5000000-0000-4000-8000-000000000010';
update public.profiles set role = 'admin', admin_permissions = array['manage_users','manage_finance','manage_settings','manage_coupons','manage_affiliates','view_analytics','manage_support','super_admin']::text[] where id = 'd5000000-0000-4000-8000-000000000011';
insert into public.producer_profiles (id, company_name, pix_key, bank_account) values
  ('d5000000-0000-4000-8000-000000000012', 'Paula Eventos', 'p1@pix', '{"banco":"1"}'), ('d5000000-0000-4000-8000-000000000013', 'Pedro Eventos', 'p2@pix', '{"banco":"2"}');
insert into public.events (id, producer_id, title, slug, status, approval_status) values
  ('d5000000-0000-4000-8000-0000000000e1', 'd5000000-0000-4000-8000-000000000012', 'No ar', 's3-e1', 'published', 'approved');
insert into public.ticket_types (id, event_id, name) values ('d5000000-0000-4000-8000-0000000000f1', 'd5000000-0000-4000-8000-0000000000e1', 'Pista');
insert into public.orders (id, user_id, event_id, total, status) values ('d5000000-0000-4000-8000-0000000000a1', 'd5000000-0000-4000-8000-000000000014', 'd5000000-0000-4000-8000-0000000000e1', 100, 'paid');
insert into public.order_items (id, order_id, ticket_type_id, unit_price) values ('d5000000-0000-4000-8000-0000000000b1', 'd5000000-0000-4000-8000-0000000000a1', 'd5000000-0000-4000-8000-0000000000f1', 100);
insert into public.transactions (id, producer_id, type, amount) values ('d5000000-0000-4000-8000-0000000000c1', 'd5000000-0000-4000-8000-000000000012', 'fee', 5);
insert into public.withdrawals (id, producer_id, amount) values ('d5000000-0000-4000-8000-0000000000d1', 'd5000000-0000-4000-8000-000000000012', 50);
insert into public.revenue_advances (id, producer_id, event_id, amount) values
  ('d5000000-0000-4000-8000-0000000000a2', 'd5000000-0000-4000-8000-000000000012', 'd5000000-0000-4000-8000-0000000000e1', 100), ('d5000000-0000-4000-8000-0000000000a3', 'd5000000-0000-4000-8000-000000000012', 'd5000000-0000-4000-8000-0000000000e1', 200);
insert into public.platform_settings (key, value) values ('general', '{}'), ('segredo_s3', '{}');
insert into public.producer_subscriptions (producer_id, plan) values ('d5000000-0000-4000-8000-000000000012', 'free');
insert into public.user_custom_features (id, user_id, feature_key) values ('d5000000-0000-4000-8000-0000000000a4', 'd5000000-0000-4000-8000-000000000012', 'x');
insert into public.coupons (id, code, discount_type, discount_value, duration) values ('d5000000-0000-4000-8000-0000000000a5', 'S3PLANO', 'percent', 10, 'once');
insert into public.coupons (id, producer_id, code, discount_type, discount_value) values ('d5000000-0000-4000-8000-0000000000a6', 'd5000000-0000-4000-8000-000000000012', 'S3PAULA', 'percent', 10);
insert into public.platform_affiliates (id, user_id, referral_code, recurring_percent) values ('d5000000-0000-4000-8000-0000000000a7', 'd5000000-0000-4000-8000-000000000016', 'S3AFIL', 20);
insert into public.platform_affiliate_producers (id, producer_id, affiliate_id) values ('d5000000-0000-4000-8000-0000000000a8', 'd5000000-0000-4000-8000-000000000012', 'd5000000-0000-4000-8000-0000000000a7');
insert into public.affiliate_links (id, affiliate_id, slug, label) values ('d5000000-0000-4000-8000-0000000000a9', 'd5000000-0000-4000-8000-0000000000a7', 's3-slug', 'x');
insert into public.affiliate_coupon_requests (id, affiliate_id, discount_percent, valid_days) values ('d5000000-0000-4000-8000-0000000000aa', 'd5000000-0000-4000-8000-0000000000a7', 10, 7);

select ok(has_function_privilege('authenticated', 'public.gf_admin_can_any(text[])', 'execute')
  and not has_function_privilege('anon', 'public.gf_admin_can_any(text[])', 'execute'),
  'gf_admin_can_any: authenticated executa, anon não');
select is((select count(*) from pg_policies where schemaname = 'public' and permissive = 'PERMISSIVE' and tablename in ('affiliate_coupon_requests', 'affiliate_links', 'coupons', 'order_items', 'orders', 'platform_affiliate_producers', 'platform_affiliates', 'platform_settings', 'producer_profiles', 'producer_subscriptions', 'revenue_advances', 'transactions', 'user_custom_features', 'withdrawals') and (coalesce(qual, '') || coalesce(with_check, '')) like '%gf_is_admin%'), 0::bigint,
  'nenhuma regra permissiva das 14 tabelas de dinheiro usa gf_is_admin');
select is((select count(*) from pg_policies where schemaname = 'public' and policyname = 'gf_mfa_aal2' and permissive = 'RESTRICTIVE' and tablename in ('affiliate_coupon_requests', 'affiliate_links', 'coupons', 'order_items', 'orders', 'platform_affiliate_producers', 'platform_affiliates', 'platform_settings', 'producer_profiles', 'producer_subscriptions', 'revenue_advances', 'transactions', 'user_custom_features', 'withdrawals')), 14::bigint, 'gf_mfa_aal2 RESTRICTIVE continua nas 14 tabelas');
select policies_are('public', 'platform_settings', array['gf_mfa_aal2', 'gf_platform_settings_admin_all', 'gf_platform_settings_public_read'],
  'platform_settings: admin, leitura pública e 2FA');
select policies_are('public', 'platform_affiliates', array['Admin gerencia afiliados evokaa', 'Afiliado le o proprio cadastro', 'gf_mfa_aal2'],
  'platform_affiliates: só manage_affiliates e o próprio afiliado (manage_coupons fora)');
select policies_are('public', 'producer_subscriptions', array['gf_mfa_aal2', 'gf_producer_subscriptions_admin_all', 'gf_producer_subscriptions_owner_select', 'gf_producer_subscriptions_support_select'],
  'producer_subscriptions: admin, dono, leitura do suporte e 2FA');
-- leitura: producer_profiles aceita ['manage_users', 'manage_finance'] (+ super_admin)
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.n($$select count(*) from public.producer_profiles $$), 2::bigint, 'producer_profiles: adm_users lê 2');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.n($$select count(*) from public.producer_profiles $$), 2::bigint, 'producer_profiles: adm_fin lê 2');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000003', 'aal2');
select is(pg_temp.n($$select count(*) from public.producer_profiles $$), 0::bigint, 'producer_profiles: adm_set lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.n($$select count(*) from public.producer_profiles $$), 0::bigint, 'producer_profiles: adm_cup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.n($$select count(*) from public.producer_profiles $$), 0::bigint, 'producer_profiles: adm_aff lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000006', 'aal2');
select is(pg_temp.n($$select count(*) from public.producer_profiles $$), 0::bigint, 'producer_profiles: adm_ana lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000007', 'aal2');
select is(pg_temp.n($$select count(*) from public.producer_profiles $$), 0::bigint, 'producer_profiles: adm_tix lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000008', 'aal2');
select is(pg_temp.n($$select count(*) from public.producer_profiles $$), 0::bigint, 'producer_profiles: adm_sup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.n($$select count(*) from public.producer_profiles $$), 2::bigint, 'producer_profiles: super lê 2');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000010', 'aal2');
select is(pg_temp.n($$select count(*) from public.producer_profiles $$), 0::bigint, 'producer_profiles: adm_none lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.n($$select count(*) from public.producer_profiles $$), 0::bigint, 'producer_profiles: adm_aal1 lê 0');
-- leitura: withdrawals aceita ['manage_finance'] (+ super_admin)
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.n($$select count(*) from public.withdrawals $$), 0::bigint, 'withdrawals: adm_users lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.n($$select count(*) from public.withdrawals $$), 1::bigint, 'withdrawals: adm_fin lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000003', 'aal2');
select is(pg_temp.n($$select count(*) from public.withdrawals $$), 0::bigint, 'withdrawals: adm_set lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.n($$select count(*) from public.withdrawals $$), 0::bigint, 'withdrawals: adm_cup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.n($$select count(*) from public.withdrawals $$), 0::bigint, 'withdrawals: adm_aff lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000006', 'aal2');
select is(pg_temp.n($$select count(*) from public.withdrawals $$), 0::bigint, 'withdrawals: adm_ana lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000007', 'aal2');
select is(pg_temp.n($$select count(*) from public.withdrawals $$), 0::bigint, 'withdrawals: adm_tix lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000008', 'aal2');
select is(pg_temp.n($$select count(*) from public.withdrawals $$), 0::bigint, 'withdrawals: adm_sup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.n($$select count(*) from public.withdrawals $$), 1::bigint, 'withdrawals: super lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000010', 'aal2');
select is(pg_temp.n($$select count(*) from public.withdrawals $$), 0::bigint, 'withdrawals: adm_none lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.n($$select count(*) from public.withdrawals $$), 0::bigint, 'withdrawals: adm_aal1 lê 0');
-- leitura: revenue_advances aceita ['manage_finance'] (+ super_admin)
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.n($$select count(*) from public.revenue_advances $$), 0::bigint, 'revenue_advances: adm_users lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.n($$select count(*) from public.revenue_advances $$), 2::bigint, 'revenue_advances: adm_fin lê 2');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000003', 'aal2');
select is(pg_temp.n($$select count(*) from public.revenue_advances $$), 0::bigint, 'revenue_advances: adm_set lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.n($$select count(*) from public.revenue_advances $$), 0::bigint, 'revenue_advances: adm_cup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.n($$select count(*) from public.revenue_advances $$), 0::bigint, 'revenue_advances: adm_aff lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000006', 'aal2');
select is(pg_temp.n($$select count(*) from public.revenue_advances $$), 0::bigint, 'revenue_advances: adm_ana lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000007', 'aal2');
select is(pg_temp.n($$select count(*) from public.revenue_advances $$), 0::bigint, 'revenue_advances: adm_tix lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000008', 'aal2');
select is(pg_temp.n($$select count(*) from public.revenue_advances $$), 0::bigint, 'revenue_advances: adm_sup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.n($$select count(*) from public.revenue_advances $$), 2::bigint, 'revenue_advances: super lê 2');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000010', 'aal2');
select is(pg_temp.n($$select count(*) from public.revenue_advances $$), 0::bigint, 'revenue_advances: adm_none lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.n($$select count(*) from public.revenue_advances $$), 0::bigint, 'revenue_advances: adm_aal1 lê 0');
-- leitura: platform_settings aceita ['manage_settings'] (+ super_admin)
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_settings where key = 'segredo_s3'$$), 0::bigint, 'platform_settings: adm_users lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_settings where key = 'segredo_s3'$$), 0::bigint, 'platform_settings: adm_fin lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000003', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_settings where key = 'segredo_s3'$$), 1::bigint, 'platform_settings: adm_set lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_settings where key = 'segredo_s3'$$), 0::bigint, 'platform_settings: adm_cup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_settings where key = 'segredo_s3'$$), 0::bigint, 'platform_settings: adm_aff lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000006', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_settings where key = 'segredo_s3'$$), 0::bigint, 'platform_settings: adm_ana lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000007', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_settings where key = 'segredo_s3'$$), 0::bigint, 'platform_settings: adm_tix lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000008', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_settings where key = 'segredo_s3'$$), 0::bigint, 'platform_settings: adm_sup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_settings where key = 'segredo_s3'$$), 1::bigint, 'platform_settings: super lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000010', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_settings where key = 'segredo_s3'$$), 0::bigint, 'platform_settings: adm_none lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.n($$select count(*) from public.platform_settings where key = 'segredo_s3'$$), 0::bigint, 'platform_settings: adm_aal1 lê 0');
-- leitura: producer_subscriptions aceita ['manage_users', 'manage_support'] (+ super_admin)
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.n($$select count(*) from public.producer_subscriptions $$), 1::bigint, 'producer_subscriptions: adm_users lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.n($$select count(*) from public.producer_subscriptions $$), 0::bigint, 'producer_subscriptions: adm_fin lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000003', 'aal2');
select is(pg_temp.n($$select count(*) from public.producer_subscriptions $$), 0::bigint, 'producer_subscriptions: adm_set lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.n($$select count(*) from public.producer_subscriptions $$), 0::bigint, 'producer_subscriptions: adm_cup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.n($$select count(*) from public.producer_subscriptions $$), 0::bigint, 'producer_subscriptions: adm_aff lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000006', 'aal2');
select is(pg_temp.n($$select count(*) from public.producer_subscriptions $$), 0::bigint, 'producer_subscriptions: adm_ana lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000007', 'aal2');
select is(pg_temp.n($$select count(*) from public.producer_subscriptions $$), 0::bigint, 'producer_subscriptions: adm_tix lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000008', 'aal2');
select is(pg_temp.n($$select count(*) from public.producer_subscriptions $$), 1::bigint, 'producer_subscriptions: adm_sup lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.n($$select count(*) from public.producer_subscriptions $$), 1::bigint, 'producer_subscriptions: super lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000010', 'aal2');
select is(pg_temp.n($$select count(*) from public.producer_subscriptions $$), 0::bigint, 'producer_subscriptions: adm_none lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.n($$select count(*) from public.producer_subscriptions $$), 0::bigint, 'producer_subscriptions: adm_aal1 lê 0');
-- leitura: user_custom_features aceita ['manage_users'] (+ super_admin)
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.n($$select count(*) from public.user_custom_features $$), 1::bigint, 'user_custom_features: adm_users lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.n($$select count(*) from public.user_custom_features $$), 0::bigint, 'user_custom_features: adm_fin lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000003', 'aal2');
select is(pg_temp.n($$select count(*) from public.user_custom_features $$), 0::bigint, 'user_custom_features: adm_set lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.n($$select count(*) from public.user_custom_features $$), 0::bigint, 'user_custom_features: adm_cup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.n($$select count(*) from public.user_custom_features $$), 0::bigint, 'user_custom_features: adm_aff lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000006', 'aal2');
select is(pg_temp.n($$select count(*) from public.user_custom_features $$), 0::bigint, 'user_custom_features: adm_ana lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000007', 'aal2');
select is(pg_temp.n($$select count(*) from public.user_custom_features $$), 0::bigint, 'user_custom_features: adm_tix lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000008', 'aal2');
select is(pg_temp.n($$select count(*) from public.user_custom_features $$), 0::bigint, 'user_custom_features: adm_sup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.n($$select count(*) from public.user_custom_features $$), 1::bigint, 'user_custom_features: super lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000010', 'aal2');
select is(pg_temp.n($$select count(*) from public.user_custom_features $$), 0::bigint, 'user_custom_features: adm_none lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.n($$select count(*) from public.user_custom_features $$), 0::bigint, 'user_custom_features: adm_aal1 lê 0');
-- leitura: orders aceita ['manage_finance', 'view_analytics', 'manage_support'] (+ super_admin)
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.n($$select count(*) from public.orders $$), 0::bigint, 'orders: adm_users lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.n($$select count(*) from public.orders $$), 1::bigint, 'orders: adm_fin lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000003', 'aal2');
select is(pg_temp.n($$select count(*) from public.orders $$), 0::bigint, 'orders: adm_set lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.n($$select count(*) from public.orders $$), 0::bigint, 'orders: adm_cup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.n($$select count(*) from public.orders $$), 0::bigint, 'orders: adm_aff lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000006', 'aal2');
select is(pg_temp.n($$select count(*) from public.orders $$), 1::bigint, 'orders: adm_ana lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000007', 'aal2');
select is(pg_temp.n($$select count(*) from public.orders $$), 0::bigint, 'orders: adm_tix lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000008', 'aal2');
select is(pg_temp.n($$select count(*) from public.orders $$), 1::bigint, 'orders: adm_sup lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.n($$select count(*) from public.orders $$), 1::bigint, 'orders: super lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000010', 'aal2');
select is(pg_temp.n($$select count(*) from public.orders $$), 0::bigint, 'orders: adm_none lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.n($$select count(*) from public.orders $$), 0::bigint, 'orders: adm_aal1 lê 0');
-- leitura: order_items aceita ['manage_finance'] (+ super_admin)
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.n($$select count(*) from public.order_items $$), 0::bigint, 'order_items: adm_users lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.n($$select count(*) from public.order_items $$), 1::bigint, 'order_items: adm_fin lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000003', 'aal2');
select is(pg_temp.n($$select count(*) from public.order_items $$), 0::bigint, 'order_items: adm_set lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.n($$select count(*) from public.order_items $$), 0::bigint, 'order_items: adm_cup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.n($$select count(*) from public.order_items $$), 0::bigint, 'order_items: adm_aff lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000006', 'aal2');
select is(pg_temp.n($$select count(*) from public.order_items $$), 0::bigint, 'order_items: adm_ana lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000007', 'aal2');
select is(pg_temp.n($$select count(*) from public.order_items $$), 0::bigint, 'order_items: adm_tix lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000008', 'aal2');
select is(pg_temp.n($$select count(*) from public.order_items $$), 0::bigint, 'order_items: adm_sup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.n($$select count(*) from public.order_items $$), 1::bigint, 'order_items: super lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000010', 'aal2');
select is(pg_temp.n($$select count(*) from public.order_items $$), 0::bigint, 'order_items: adm_none lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.n($$select count(*) from public.order_items $$), 0::bigint, 'order_items: adm_aal1 lê 0');
-- leitura: transactions aceita ['manage_finance'] (+ super_admin)
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.n($$select count(*) from public.transactions $$), 0::bigint, 'transactions: adm_users lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.n($$select count(*) from public.transactions $$), 1::bigint, 'transactions: adm_fin lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000003', 'aal2');
select is(pg_temp.n($$select count(*) from public.transactions $$), 0::bigint, 'transactions: adm_set lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.n($$select count(*) from public.transactions $$), 0::bigint, 'transactions: adm_cup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.n($$select count(*) from public.transactions $$), 0::bigint, 'transactions: adm_aff lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000006', 'aal2');
select is(pg_temp.n($$select count(*) from public.transactions $$), 0::bigint, 'transactions: adm_ana lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000007', 'aal2');
select is(pg_temp.n($$select count(*) from public.transactions $$), 0::bigint, 'transactions: adm_tix lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000008', 'aal2');
select is(pg_temp.n($$select count(*) from public.transactions $$), 0::bigint, 'transactions: adm_sup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.n($$select count(*) from public.transactions $$), 1::bigint, 'transactions: super lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000010', 'aal2');
select is(pg_temp.n($$select count(*) from public.transactions $$), 0::bigint, 'transactions: adm_none lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.n($$select count(*) from public.transactions $$), 0::bigint, 'transactions: adm_aal1 lê 0');
-- leitura: coupons aceita ['manage_coupons'] (+ super_admin)
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.n($$select count(*) from public.coupons $$), 0::bigint, 'coupons: adm_users lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.n($$select count(*) from public.coupons $$), 0::bigint, 'coupons: adm_fin lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000003', 'aal2');
select is(pg_temp.n($$select count(*) from public.coupons $$), 0::bigint, 'coupons: adm_set lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.n($$select count(*) from public.coupons $$), 2::bigint, 'coupons: adm_cup lê 2');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.n($$select count(*) from public.coupons $$), 0::bigint, 'coupons: adm_aff lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000006', 'aal2');
select is(pg_temp.n($$select count(*) from public.coupons $$), 0::bigint, 'coupons: adm_ana lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000007', 'aal2');
select is(pg_temp.n($$select count(*) from public.coupons $$), 0::bigint, 'coupons: adm_tix lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000008', 'aal2');
select is(pg_temp.n($$select count(*) from public.coupons $$), 0::bigint, 'coupons: adm_sup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.n($$select count(*) from public.coupons $$), 2::bigint, 'coupons: super lê 2');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000010', 'aal2');
select is(pg_temp.n($$select count(*) from public.coupons $$), 0::bigint, 'coupons: adm_none lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.n($$select count(*) from public.coupons $$), 0::bigint, 'coupons: adm_aal1 lê 0');
-- leitura: affiliate_coupon_requests aceita ['manage_coupons'] (+ super_admin)
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.n($$select count(*) from public.affiliate_coupon_requests $$), 0::bigint, 'affiliate_coupon_requests: adm_users lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.n($$select count(*) from public.affiliate_coupon_requests $$), 0::bigint, 'affiliate_coupon_requests: adm_fin lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000003', 'aal2');
select is(pg_temp.n($$select count(*) from public.affiliate_coupon_requests $$), 0::bigint, 'affiliate_coupon_requests: adm_set lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.n($$select count(*) from public.affiliate_coupon_requests $$), 1::bigint, 'affiliate_coupon_requests: adm_cup lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.n($$select count(*) from public.affiliate_coupon_requests $$), 0::bigint, 'affiliate_coupon_requests: adm_aff lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000006', 'aal2');
select is(pg_temp.n($$select count(*) from public.affiliate_coupon_requests $$), 0::bigint, 'affiliate_coupon_requests: adm_ana lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000007', 'aal2');
select is(pg_temp.n($$select count(*) from public.affiliate_coupon_requests $$), 0::bigint, 'affiliate_coupon_requests: adm_tix lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000008', 'aal2');
select is(pg_temp.n($$select count(*) from public.affiliate_coupon_requests $$), 0::bigint, 'affiliate_coupon_requests: adm_sup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.n($$select count(*) from public.affiliate_coupon_requests $$), 1::bigint, 'affiliate_coupon_requests: super lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000010', 'aal2');
select is(pg_temp.n($$select count(*) from public.affiliate_coupon_requests $$), 0::bigint, 'affiliate_coupon_requests: adm_none lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.n($$select count(*) from public.affiliate_coupon_requests $$), 0::bigint, 'affiliate_coupon_requests: adm_aal1 lê 0');
-- leitura: platform_affiliates aceita ['manage_affiliates'] (+ super_admin)
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_affiliates $$), 0::bigint, 'platform_affiliates: adm_users lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_affiliates $$), 0::bigint, 'platform_affiliates: adm_fin lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000003', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_affiliates $$), 0::bigint, 'platform_affiliates: adm_set lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_affiliates $$), 0::bigint, 'platform_affiliates: adm_cup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_affiliates $$), 1::bigint, 'platform_affiliates: adm_aff lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000006', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_affiliates $$), 0::bigint, 'platform_affiliates: adm_ana lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000007', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_affiliates $$), 0::bigint, 'platform_affiliates: adm_tix lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000008', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_affiliates $$), 0::bigint, 'platform_affiliates: adm_sup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_affiliates $$), 1::bigint, 'platform_affiliates: super lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000010', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_affiliates $$), 0::bigint, 'platform_affiliates: adm_none lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.n($$select count(*) from public.platform_affiliates $$), 0::bigint, 'platform_affiliates: adm_aal1 lê 0');
-- leitura: platform_affiliate_producers aceita ['manage_affiliates'] (+ super_admin)
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_affiliate_producers $$), 0::bigint, 'platform_affiliate_producers: adm_users lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_affiliate_producers $$), 0::bigint, 'platform_affiliate_producers: adm_fin lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000003', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_affiliate_producers $$), 0::bigint, 'platform_affiliate_producers: adm_set lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_affiliate_producers $$), 0::bigint, 'platform_affiliate_producers: adm_cup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_affiliate_producers $$), 1::bigint, 'platform_affiliate_producers: adm_aff lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000006', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_affiliate_producers $$), 0::bigint, 'platform_affiliate_producers: adm_ana lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000007', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_affiliate_producers $$), 0::bigint, 'platform_affiliate_producers: adm_tix lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000008', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_affiliate_producers $$), 0::bigint, 'platform_affiliate_producers: adm_sup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_affiliate_producers $$), 1::bigint, 'platform_affiliate_producers: super lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000010', 'aal2');
select is(pg_temp.n($$select count(*) from public.platform_affiliate_producers $$), 0::bigint, 'platform_affiliate_producers: adm_none lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.n($$select count(*) from public.platform_affiliate_producers $$), 0::bigint, 'platform_affiliate_producers: adm_aal1 lê 0');
-- leitura: affiliate_links aceita ['manage_affiliates'] (+ super_admin)
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.n($$select count(*) from public.affiliate_links $$), 0::bigint, 'affiliate_links: adm_users lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.n($$select count(*) from public.affiliate_links $$), 0::bigint, 'affiliate_links: adm_fin lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000003', 'aal2');
select is(pg_temp.n($$select count(*) from public.affiliate_links $$), 0::bigint, 'affiliate_links: adm_set lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.n($$select count(*) from public.affiliate_links $$), 0::bigint, 'affiliate_links: adm_cup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.n($$select count(*) from public.affiliate_links $$), 1::bigint, 'affiliate_links: adm_aff lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000006', 'aal2');
select is(pg_temp.n($$select count(*) from public.affiliate_links $$), 0::bigint, 'affiliate_links: adm_ana lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000007', 'aal2');
select is(pg_temp.n($$select count(*) from public.affiliate_links $$), 0::bigint, 'affiliate_links: adm_tix lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000008', 'aal2');
select is(pg_temp.n($$select count(*) from public.affiliate_links $$), 0::bigint, 'affiliate_links: adm_sup lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.n($$select count(*) from public.affiliate_links $$), 1::bigint, 'affiliate_links: super lê 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000010', 'aal2');
select is(pg_temp.n($$select count(*) from public.affiliate_links $$), 0::bigint, 'affiliate_links: adm_none lê 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.n($$select count(*) from public.affiliate_links $$), 0::bigint, 'affiliate_links: adm_aal1 lê 0');
-- dono, outro produtor, comprador e anônimo
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select is(pg_temp.n($$select count(*) from public.producer_profiles $$), 1::bigint, 'p1 lê só o próprio perfil de produtor');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000013', 'aal1');
select is(pg_temp.n($$select count(*) from public.producer_profiles $$), 1::bigint, 'p2 lê só o próprio perfil de produtor');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000014', 'aal1');
select is(pg_temp.n($$select count(*) from public.producer_profiles $$), 0::bigint, 'comprador não lê perfil de produtor');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select is(pg_temp.n($$select count(*) from public.revenue_advances $$), 2::bigint, 'p1 lê as próprias antecipações');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000013', 'aal1');
select is(pg_temp.n($$select count(*) from public.revenue_advances $$), 0::bigint, 'p2 não lê antecipações de outro');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select is(pg_temp.n($$select count(*) from public.producer_subscriptions $$), 1::bigint, 'p1 lê a própria assinatura');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000013', 'aal1');
select is(pg_temp.n($$select count(*) from public.producer_subscriptions $$), 0::bigint, 'p2 não lê assinatura de outro');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select is(pg_temp.n($$select count(*) from public.user_custom_features $$), 1::bigint, 'p1 lê os próprios recursos');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000013', 'aal1');
select is(pg_temp.n($$select count(*) from public.user_custom_features $$), 0::bigint, 'p2 não lê recursos de outro');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select is(pg_temp.n($$select count(*) from public.withdrawals $$), 0::bigint, 'produtor não lê saques (não há regra de produtor)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select is(pg_temp.n($$select count(*) from public.orders $$), 1::bigint, 'p1 lê pedidos dos próprios eventos');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000014', 'aal1');
select is(pg_temp.n($$select count(*) from public.orders $$), 1::bigint, 'comprador lê o próprio pedido');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000013', 'aal1');
select is(pg_temp.n($$select count(*) from public.orders $$), 0::bigint, 'p2 não lê pedido de evento alheio');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select is(pg_temp.n($$select count(*) from public.order_items $$), 1::bigint, 'p1 lê itens dos próprios eventos');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000014', 'aal1');
select is(pg_temp.n($$select count(*) from public.platform_settings where key = 'general'$$), 1::bigint, 'comprador lê general (leitura pública)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000014', 'aal1');
select is(pg_temp.n($$select count(*) from public.platform_settings where key = 'segredo_s3'$$), 0::bigint, 'comprador não lê outra chave');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select is(pg_temp.n($$select count(*) from public.coupons $$), 1::bigint, 'p1 lê só o cupom próprio');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000016', 'aal1');
select is(pg_temp.n($$select count(*) from public.platform_affiliates $$), 1::bigint, 'afiliado lê o próprio cadastro');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000016', 'aal1');
select is(pg_temp.n($$select count(*) from public.affiliate_links $$), 1::bigint, 'afiliado lê os próprios links');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000016', 'aal1');
select is(pg_temp.n($$select count(*) from public.affiliate_coupon_requests $$), 1::bigint, 'afiliado lê os próprios pedidos de cupom');
select pg_temp.como('anon');
select is(pg_temp.n($$select count(*) from public.platform_settings$$), 1::bigint, 'anônimo lê só general e fees');
-- escrita: com a permissão grava (1 linha); sem ela, 0 linhas (RLS) ou 42501
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.upd($$update public.withdrawals set status = 'processing' where id = 'd5000000-0000-4000-8000-0000000000d1'$$), 0::bigint, 'withdrawals update: adm_users = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000003', 'aal2');
select is(pg_temp.upd($$update public.withdrawals set status = 'processing' where id = 'd5000000-0000-4000-8000-0000000000d1'$$), 0::bigint, 'withdrawals update: adm_set = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.upd($$update public.withdrawals set status = 'processing' where id = 'd5000000-0000-4000-8000-0000000000d1'$$), 0::bigint, 'withdrawals update: adm_cup = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.upd($$update public.withdrawals set status = 'processing' where id = 'd5000000-0000-4000-8000-0000000000d1'$$), 0::bigint, 'withdrawals update: adm_aal1 = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select is(pg_temp.upd($$update public.withdrawals set status = 'processing' where id = 'd5000000-0000-4000-8000-0000000000d1'$$), 0::bigint, 'withdrawals update: p1 = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.upd($$update public.withdrawals set status = 'processing' where id = 'd5000000-0000-4000-8000-0000000000d1'$$), 1::bigint, 'withdrawals update: adm_fin = 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.upd($$update public.withdrawals set status = 'processing' where id = 'd5000000-0000-4000-8000-0000000000d1'$$), 1::bigint, 'withdrawals update: super = 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.upd($$update public.revenue_advances set amount = amount where id = 'd5000000-0000-4000-8000-0000000000a2'$$), 0::bigint, 'revenue_advances update: adm_users = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select is(pg_temp.upd($$update public.revenue_advances set amount = amount where id = 'd5000000-0000-4000-8000-0000000000a2'$$), 0::bigint, 'revenue_advances update: p1 = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.upd($$update public.revenue_advances set amount = amount where id = 'd5000000-0000-4000-8000-0000000000a2'$$), 0::bigint, 'revenue_advances update: adm_aal1 = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.upd($$update public.revenue_advances set amount = amount where id = 'd5000000-0000-4000-8000-0000000000a2'$$), 1::bigint, 'revenue_advances update: adm_fin = 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.upd($$update public.revenue_advances set amount = amount where id = 'd5000000-0000-4000-8000-0000000000a2'$$), 1::bigint, 'revenue_advances update: super = 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.upd($$delete from public.revenue_advances where id = 'd5000000-0000-4000-8000-0000000000a3'$$), 0::bigint, 'revenue_advances delete: adm_users = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select is(pg_temp.upd($$delete from public.revenue_advances where id = 'd5000000-0000-4000-8000-0000000000a3'$$), 0::bigint, 'revenue_advances delete: p1 = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.upd($$delete from public.revenue_advances where id = 'd5000000-0000-4000-8000-0000000000a3'$$), 1::bigint, 'revenue_advances delete: adm_fin = 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.upd($$update public.platform_settings set value = '{"x":1}' where key = 'segredo_s3'$$), 0::bigint, 'platform_settings update: adm_fin = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.upd($$update public.platform_settings set value = '{"x":1}' where key = 'segredo_s3'$$), 0::bigint, 'platform_settings update: adm_users = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.upd($$update public.platform_settings set value = '{"x":1}' where key = 'segredo_s3'$$), 0::bigint, 'platform_settings update: adm_aal1 = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000003', 'aal2');
select is(pg_temp.upd($$update public.platform_settings set value = '{"x":1}' where key = 'segredo_s3'$$), 1::bigint, 'platform_settings update: adm_set = 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.upd($$update public.platform_settings set value = '{"x":1}' where key = 'segredo_s3'$$), 1::bigint, 'platform_settings update: super = 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$insert into public.platform_settings (key, value) values ('novo_s3', '{}')$$, '42501', null, 'platform_settings insert: manage_finance barrado');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000003', 'aal2');
select lives_ok($$insert into public.platform_settings (key, value) values ('novo_s3', '{}')$$, 'platform_settings insert: manage_settings grava');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.upd($$update public.producer_subscriptions set plan = 'starter' where producer_id = 'd5000000-0000-4000-8000-000000000012'$$), 0::bigint, 'producer_subscriptions update: adm_fin = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000003', 'aal2');
select is(pg_temp.upd($$update public.producer_subscriptions set plan = 'starter' where producer_id = 'd5000000-0000-4000-8000-000000000012'$$), 0::bigint, 'producer_subscriptions update: adm_set = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select is(pg_temp.upd($$update public.producer_subscriptions set plan = 'starter' where producer_id = 'd5000000-0000-4000-8000-000000000012'$$), 0::bigint, 'producer_subscriptions update: p1 = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.upd($$update public.producer_subscriptions set plan = 'starter' where producer_id = 'd5000000-0000-4000-8000-000000000012'$$), 0::bigint, 'producer_subscriptions update: adm_aal1 = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.upd($$update public.producer_subscriptions set plan = 'starter' where producer_id = 'd5000000-0000-4000-8000-000000000012'$$), 1::bigint, 'producer_subscriptions update: adm_users = 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.upd($$update public.producer_subscriptions set plan = 'starter' where producer_id = 'd5000000-0000-4000-8000-000000000012'$$), 1::bigint, 'producer_subscriptions update: super = 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.upd($$update public.user_custom_features set feature_key = 'y' where id = 'd5000000-0000-4000-8000-0000000000a4'$$), 0::bigint, 'user_custom_features update: adm_fin = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select is(pg_temp.upd($$update public.user_custom_features set feature_key = 'y' where id = 'd5000000-0000-4000-8000-0000000000a4'$$), 0::bigint, 'user_custom_features update: p1 = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.upd($$update public.user_custom_features set feature_key = 'y' where id = 'd5000000-0000-4000-8000-0000000000a4'$$), 0::bigint, 'user_custom_features update: adm_aal1 = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.upd($$update public.user_custom_features set feature_key = 'y' where id = 'd5000000-0000-4000-8000-0000000000a4'$$), 1::bigint, 'user_custom_features update: adm_users = 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.upd($$update public.user_custom_features set feature_key = 'y' where id = 'd5000000-0000-4000-8000-0000000000a4'$$), 1::bigint, 'user_custom_features update: super = 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$insert into public.user_custom_features (user_id, feature_key) values ('d5000000-0000-4000-8000-000000000013', 'z')$$, '42501', null, 'user_custom_features insert: manage_finance barrado');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select lives_ok($$insert into public.user_custom_features (user_id, feature_key) values ('d5000000-0000-4000-8000-000000000013', 'z')$$, 'user_custom_features insert: manage_users grava');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.upd($$update public.coupons set is_active = false where id = 'd5000000-0000-4000-8000-0000000000a5'$$), 0::bigint, 'cupom da plataforma update: adm_users = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.upd($$update public.coupons set is_active = false where id = 'd5000000-0000-4000-8000-0000000000a5'$$), 0::bigint, 'cupom da plataforma update: adm_fin = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.upd($$update public.coupons set is_active = false where id = 'd5000000-0000-4000-8000-0000000000a5'$$), 0::bigint, 'cupom da plataforma update: adm_aal1 = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.upd($$update public.coupons set is_active = false where id = 'd5000000-0000-4000-8000-0000000000a5'$$), 1::bigint, 'cupom da plataforma update: adm_cup = 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.upd($$update public.coupons set is_active = false where id = 'd5000000-0000-4000-8000-0000000000a5'$$), 1::bigint, 'cupom da plataforma update: super = 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.upd($$update public.coupons set is_active = false where id = 'd5000000-0000-4000-8000-0000000000a6'$$), 0::bigint, 'manage_coupons não altera cupom de produtor');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.upd($$update public.coupons set uses = 3 where id = 'd5000000-0000-4000-8000-0000000000a5'$$), 1::bigint, 'manage_coupons altera uses do cupom da plataforma (gatilho passa)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.upd($$update public.coupons set uses = 4 where id = 'd5000000-0000-4000-8000-0000000000a5'$$), 0::bigint, 'manage_users não altera cupom da plataforma');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select throws_ok($$update public.coupons set uses = 999 where id = 'd5000000-0000-4000-8000-0000000000a6'$$, '42501', null, 'p1 não altera uses do próprio cupom (gatilho)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$insert into public.coupons (code, discount_type, discount_value, duration) values ('S3X', 'percent', 5, 'once')$$, '42501', null, 'cupom da plataforma insert: manage_users barrado');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select lives_ok($$insert into public.coupons (code, discount_type, discount_value, duration) values ('S3X', 'percent', 5, 'once')$$, 'cupom da plataforma insert: manage_coupons grava');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.upd($$update public.affiliate_coupon_requests set admin_notes = 'ok' where id = 'd5000000-0000-4000-8000-0000000000aa'$$), 0::bigint, 'affiliate_coupon_requests update: adm_aff = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.upd($$update public.affiliate_coupon_requests set admin_notes = 'ok' where id = 'd5000000-0000-4000-8000-0000000000aa'$$), 0::bigint, 'affiliate_coupon_requests update: adm_fin = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.upd($$update public.affiliate_coupon_requests set admin_notes = 'ok' where id = 'd5000000-0000-4000-8000-0000000000aa'$$), 0::bigint, 'affiliate_coupon_requests update: adm_aal1 = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.upd($$update public.affiliate_coupon_requests set admin_notes = 'ok' where id = 'd5000000-0000-4000-8000-0000000000aa'$$), 1::bigint, 'affiliate_coupon_requests update: adm_cup = 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.upd($$update public.affiliate_coupon_requests set admin_notes = 'ok' where id = 'd5000000-0000-4000-8000-0000000000aa'$$), 1::bigint, 'affiliate_coupon_requests update: super = 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.upd($$update public.platform_affiliates set recurring_percent = 20 where id = 'd5000000-0000-4000-8000-0000000000a7'$$), 0::bigint, 'platform_affiliates update: adm_cup = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.upd($$update public.platform_affiliates set recurring_percent = 20 where id = 'd5000000-0000-4000-8000-0000000000a7'$$), 0::bigint, 'platform_affiliates update: adm_fin = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.upd($$update public.platform_affiliates set recurring_percent = 20 where id = 'd5000000-0000-4000-8000-0000000000a7'$$), 0::bigint, 'platform_affiliates update: adm_aal1 = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.upd($$update public.platform_affiliates set recurring_percent = 20 where id = 'd5000000-0000-4000-8000-0000000000a7'$$), 1::bigint, 'platform_affiliates update: adm_aff = 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.upd($$update public.platform_affiliates set recurring_percent = 20 where id = 'd5000000-0000-4000-8000-0000000000a7'$$), 1::bigint, 'platform_affiliates update: super = 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.upd($$update public.platform_affiliate_producers set source = 'manual' where id = 'd5000000-0000-4000-8000-0000000000a8'$$), 0::bigint, 'platform_affiliate_producers update: adm_cup = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.upd($$update public.platform_affiliate_producers set source = 'manual' where id = 'd5000000-0000-4000-8000-0000000000a8'$$), 0::bigint, 'platform_affiliate_producers update: adm_fin = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.upd($$update public.platform_affiliate_producers set source = 'manual' where id = 'd5000000-0000-4000-8000-0000000000a8'$$), 0::bigint, 'platform_affiliate_producers update: adm_aal1 = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.upd($$update public.platform_affiliate_producers set source = 'manual' where id = 'd5000000-0000-4000-8000-0000000000a8'$$), 1::bigint, 'platform_affiliate_producers update: adm_aff = 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.upd($$update public.platform_affiliate_producers set source = 'manual' where id = 'd5000000-0000-4000-8000-0000000000a8'$$), 1::bigint, 'platform_affiliate_producers update: super = 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.upd($$update public.affiliate_links set is_active = false where id = 'd5000000-0000-4000-8000-0000000000a9'$$), 0::bigint, 'affiliate_links update: adm_cup = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.upd($$update public.affiliate_links set is_active = false where id = 'd5000000-0000-4000-8000-0000000000a9'$$), 0::bigint, 'affiliate_links update: adm_fin = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.upd($$update public.affiliate_links set is_active = false where id = 'd5000000-0000-4000-8000-0000000000a9'$$), 0::bigint, 'affiliate_links update: adm_aal1 = 0');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.upd($$update public.affiliate_links set is_active = false where id = 'd5000000-0000-4000-8000-0000000000a9'$$), 1::bigint, 'affiliate_links update: adm_aff = 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.upd($$update public.affiliate_links set is_active = false where id = 'd5000000-0000-4000-8000-0000000000a9'$$), 1::bigint, 'affiliate_links update: super = 1');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.upd($$update public.affiliate_links set slug = 's3-novo' where id = 'd5000000-0000-4000-8000-0000000000a9'$$), 1::bigint, 'manage_affiliates troca o slug (gatilho passa)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000016', 'aal1');
select throws_ok($$update public.affiliate_links set slug = 's3-outro' where id = 'd5000000-0000-4000-8000-0000000000a9'$$, 'P0001', null, 'afiliado não troca o slug (gatilho continua barrando)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000016', 'aal1');
select is(pg_temp.upd($$update public.affiliate_links set label = 'novo nome' where id = 'd5000000-0000-4000-8000-0000000000a9'$$), 1::bigint, 'afiliado troca o nome de exibição');
-- producer_profiles por coluna
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select lives_ok($$update public.producer_profiles set pix_key = 'p1@novo' where id = 'd5000000-0000-4000-8000-000000000012'$$, 'dono troca o Pix: passa');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select lives_ok($$update public.producer_profiles set bank_account = '{"banco":"9"}'::jsonb, cnpj = '11222333000181', company_name = 'Paula Produções' where id = 'd5000000-0000-4000-8000-000000000012'$$, 'dono troca conta, CNPJ e nome: passa');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select lives_ok($$update public.producer_profiles set pix_key = pix_key, commission_rate = commission_rate, webhook_url = null where id = 'd5000000-0000-4000-8000-000000000012'$$, 'dono mandando o mesmo valor protegido: passa');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select throws_ok($$update public.producer_profiles set commission_rate = 1 where id = 'd5000000-0000-4000-8000-000000000012'$$, '42501', null, 'dono troca commission_rate: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select throws_ok($$update public.producer_profiles set is_verified = true where id = 'd5000000-0000-4000-8000-000000000012'$$, '42501', null, 'dono troca is_verified: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select throws_ok($$update public.producer_profiles set webhook_url = 'https://mal.example/x' where id = 'd5000000-0000-4000-8000-000000000012'$$, '42501', null, 'dono troca webhook_url: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select throws_ok($$update public.producer_profiles set stripe_account_id = 'acct_x' where id = 'd5000000-0000-4000-8000-000000000012'$$, '42501', null, 'dono troca stripe_account_id: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select throws_ok($$update public.producer_profiles set woovi_account_id = 'w_x' where id = 'd5000000-0000-4000-8000-000000000012'$$, '42501', null, 'dono troca woovi_account_id: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.upd($$update public.producer_profiles set pix_key = 'ladrao@pix' where id = 'd5000000-0000-4000-8000-000000000012'$$), 0::bigint, 'manage_finance não troca o Pix (RLS: lê e não grava)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.upd($$update public.producer_profiles set bank_account = '{}'::jsonb where id = 'd5000000-0000-4000-8000-000000000012'$$), 0::bigint, 'manage_finance não troca a conta (RLS)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.upd($$update public.producer_profiles set is_verified = true where id = 'd5000000-0000-4000-8000-000000000012'$$), 0::bigint, 'manage_finance não troca is_verified (RLS)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.upd($$update public.producer_profiles set commission_rate = 1 where id = 'd5000000-0000-4000-8000-000000000012'$$), 0::bigint, 'manage_finance não troca commission_rate (RLS)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.upd($$update public.producer_profiles set pix_key = pix_key where id = 'd5000000-0000-4000-8000-000000000012'$$), 0::bigint, 'manage_finance nem regrava o mesmo Pix (RLS)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select lives_ok($$update public.producer_profiles set is_verified = true where id = 'd5000000-0000-4000-8000-000000000012'$$, 'manage_users troca is_verified: passa');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$update public.producer_profiles set commission_rate = 5 where id = 'd5000000-0000-4000-8000-000000000012'$$, '42501', null, 'manage_users troca commission_rate: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$update public.producer_profiles set webhook_url = 'https://mal.example/x' where id = 'd5000000-0000-4000-8000-000000000012'$$, '42501', null, 'manage_users troca webhook_url: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$update public.producer_profiles set pix_key = 'ladrao@pix' where id = 'd5000000-0000-4000-8000-000000000012'$$, '42501', null, 'manage_users troca o Pix: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$update public.producer_profiles set cnpj = '00000000000191' where id = 'd5000000-0000-4000-8000-000000000012'$$, '42501', null, 'manage_users troca o CNPJ: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$update public.producer_profiles set company_name = 'Outro nome' where id = 'd5000000-0000-4000-8000-000000000012'$$, '42501', null, 'manage_users troca o nome da empresa: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select lives_ok($$update public.producer_profiles set commission_rate = 12 where id = 'd5000000-0000-4000-8000-000000000012'$$, 'super_admin troca commission_rate: passa');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select lives_ok($$update public.producer_profiles set stripe_account_id = 'acct_ok', woovi_account_id = 'w_ok', webhook_url = null where id = 'd5000000-0000-4000-8000-000000000012'$$, 'super_admin troca Stripe e Woovi: passa');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select lives_ok($$update public.producer_profiles set is_verified = false where id = 'd5000000-0000-4000-8000-000000000012'$$, 'super_admin troca is_verified: passa');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select throws_ok($$update public.producer_profiles set pix_key = 'ladrao@pix' where id = 'd5000000-0000-4000-8000-000000000012'$$, '42501', null, 'super_admin troca o Pix: 42501 (Decisão 163, item 8)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select throws_ok($$update public.producer_profiles set bank_account = '{}'::jsonb where id = 'd5000000-0000-4000-8000-000000000012'$$, '42501', null, 'super_admin troca a conta: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select throws_ok($$update public.producer_profiles set cnpj = '00000000000191' where id = 'd5000000-0000-4000-8000-000000000012'$$, '42501', null, 'super_admin troca o CNPJ: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select throws_ok($$update public.producer_profiles set id = 'd5000000-0000-4000-8000-000000000015' where id = 'd5000000-0000-4000-8000-000000000012'$$, '42501', null, 'dono troca o id: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$update public.producer_profiles set id = 'd5000000-0000-4000-8000-000000000015' where id = 'd5000000-0000-4000-8000-000000000012'$$, '42501', null, 'manage_users troca o id: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select throws_ok($$update public.producer_profiles set id = 'd5000000-0000-4000-8000-000000000015' where id = 'd5000000-0000-4000-8000-000000000012'$$, '42501', null, 'super_admin troca o id: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.upd($$update public.producer_profiles set id = 'd5000000-0000-4000-8000-000000000015' where id = 'd5000000-0000-4000-8000-000000000012'$$), 0::bigint, 'manage_finance troca o id: 0 linhas (RLS)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select throws_ok($$update public.producer_profiles set created_at = now() - interval '1 year' where id = 'd5000000-0000-4000-8000-000000000012'$$, '42501', null, 'dono troca created_at: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$update public.producer_profiles set created_at = now() - interval '1 year' where id = 'd5000000-0000-4000-8000-000000000012'$$, '42501', null, 'manage_users troca created_at: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$update public.producer_profiles set id = 'd5000000-0000-4000-8000-000000000001' where id = 'd5000000-0000-4000-8000-000000000013'$$, '42501', null, 'duas etapas, passo 1: mover a linha da vítima para o id do admin: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.upd($$update public.producer_profiles set pix_key = 'ladrao@pix' where id = 'd5000000-0000-4000-8000-000000000001'$$), 0::bigint, 'duas etapas, passo 2: sem linha no id do admin, nada é gravado');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000010', 'aal2');
select is(pg_temp.upd($$update public.producer_profiles set is_verified = true where id = 'd5000000-0000-4000-8000-000000000012'$$), 0::bigint, 'admin sem permissão não altera perfil (RLS)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select is(pg_temp.upd($$update public.producer_profiles set is_verified = true where id = 'd5000000-0000-4000-8000-000000000012'$$), 0::bigint, 'admin em aal1 não altera perfil (RLS)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000007', 'aal2');
select is(pg_temp.upd($$update public.producer_profiles set is_verified = true where id = 'd5000000-0000-4000-8000-000000000012'$$), 0::bigint, 'manage_tickets não altera perfil (RLS)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000013', 'aal1');
select is(pg_temp.upd($$update public.producer_profiles set is_verified = is_verified where id = 'd5000000-0000-4000-8000-000000000012'$$), 0::bigint, 'outro produtor não altera o perfil (RLS)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select lives_ok($$insert into public.producer_profiles (id, company_name, cnpj, bank_account, pix_key, notification_settings)
  values ('d5000000-0000-4000-8000-000000000012', 'Paula Eventos', null, '{"banco":"1"}', 'p1@upsert', '{}')
  on conflict (id) do update set company_name = excluded.company_name, cnpj = excluded.cnpj,
    bank_account = excluded.bank_account, pix_key = excluded.pix_key, notification_settings = excluded.notification_settings$$, 'upsert do produtor como em useProducerSettings (linha existente): passa');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select is(pg_temp.upd($$update public.producer_profiles set company_name = company_name$$), 1::bigint, 'dono segue atualizando a própria linha');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000015', 'aal1');
select lives_ok($$insert into public.producer_profiles (id, company_name, cnpj, bank_account, pix_key, notification_settings)
  values ('d5000000-0000-4000-8000-000000000015', 'Minha Empresa', null, '{}', '', '{}')$$, 'produtor cria o perfil como o front cria (INSERT inicial): passa');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000014', 'aal1');
select throws_ok($$insert into public.producer_profiles (id, company_name, commission_rate) values ('d5000000-0000-4000-8000-000000000014', 'X', 5)$$, '42501', null, 'comprador cria perfil com comissão própria: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000014', 'aal1');
select throws_ok($$insert into public.producer_profiles (id, company_name, is_verified) values ('d5000000-0000-4000-8000-000000000014', 'X', true)$$, '42501', null, 'dono cria o perfil já verificado: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000014', 'aal1');
select throws_ok($$insert into public.producer_profiles (id, company_name, woovi_account_id) values ('d5000000-0000-4000-8000-000000000014', 'X', 'w')$$, '42501', null, 'dono cria o perfil com woovi_account_id: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000014', 'aal1');
select throws_ok($$insert into public.producer_profiles (id, company_name) values ('d5000000-0000-4000-8000-000000000017', 'X')$$, '42501', null, 'comprador cria perfil de OUTRA pessoa: 42501 (RLS)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$insert into public.producer_profiles (id, company_name) values ('d5000000-0000-4000-8000-000000000017', 'X')$$, '42501', null, 'manage_finance cria perfil de outra pessoa: 42501 (RLS)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select throws_ok($$insert into public.producer_profiles (id, company_name) values ('d5000000-0000-4000-8000-000000000017', 'X')$$, '42501', null, 'admin em aal1 cria perfil de outra pessoa: 42501 (RLS)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$insert into public.producer_profiles (id, company_name, pix_key) values ('d5000000-0000-4000-8000-000000000017', 'X', 'z@pix')$$, '42501', null, 'manage_users cria perfil alheio com Pix: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$insert into public.producer_profiles (id, company_name, bank_account) values ('d5000000-0000-4000-8000-000000000017', 'X', '{"b":1}')$$, '42501', null, 'manage_users cria perfil alheio com conta: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$insert into public.producer_profiles (id, company_name, cnpj) values ('d5000000-0000-4000-8000-000000000017', 'X', '00000000000191')$$, '42501', null, 'manage_users cria perfil alheio com CNPJ: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$insert into public.producer_profiles (id, company_name, commission_rate) values ('d5000000-0000-4000-8000-000000000017', 'X', 12)$$, '42501', null, 'manage_users cria perfil alheio com comissão: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000001', 'aal2');
select lives_ok($$insert into public.producer_profiles (id, company_name, is_verified) values ('d5000000-0000-4000-8000-000000000017', 'Empresa do p4', true)$$, 'manage_users cria perfil alheio sem Pix, verificado: passa');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select throws_ok($$insert into public.producer_profiles (id, company_name, pix_key) values ('d5000000-0000-4000-8000-000000000018', 'X', 'z@pix')$$, '42501', null, 'super_admin cria perfil alheio com Pix: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select lives_ok($$insert into public.producer_profiles (id, company_name, commission_rate, webhook_url) values ('d5000000-0000-4000-8000-000000000018', 'Empresa do p5', 12, 'https://ok.example/h')$$, 'super_admin cria perfil alheio com comissão e webhook: passa');
-- withdrawals: o site só muda status e processed_at
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.upd($$update public.withdrawals set status = 'completed', processed_at = now() where id = 'd5000000-0000-4000-8000-0000000000d1'$$), 1::bigint, 'manage_finance muda status e processed_at: passa');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$update public.withdrawals set pix_key = 'ladrao@pix' where id = 'd5000000-0000-4000-8000-0000000000d1'$$, '42501', null, 'manage_finance muda pix_key do saque: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$update public.withdrawals set amount = 1 where id = 'd5000000-0000-4000-8000-0000000000d1'$$, '42501', null, 'manage_finance muda amount do saque: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$update public.withdrawals set producer_id = 'd5000000-0000-4000-8000-000000000013' where id = 'd5000000-0000-4000-8000-0000000000d1'$$, '42501', null, 'manage_finance muda producer_id do saque: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$update public.withdrawals set bank_account = '{"x":1}'::jsonb where id = 'd5000000-0000-4000-8000-0000000000d1'$$, '42501', null, 'manage_finance muda bank_account do saque: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select throws_ok($$update public.withdrawals set amount = 1 where id = 'd5000000-0000-4000-8000-0000000000d1'$$, '42501', null, 'super_admin muda amount do saque: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select lives_ok($$update public.withdrawals set amount = amount, pix_key = pix_key where id = 'd5000000-0000-4000-8000-0000000000d1'$$, 'mandar o mesmo valor travado passa');
select pg_temp.como('service_role');
select lives_ok($$update public.withdrawals set amount = 55 where id = 'd5000000-0000-4000-8000-0000000000d1'$$, 'service_role segue alterando o saque');
-- platform_affiliates: conta de recebimento só se preenche quando nula
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.upd($$update public.platform_affiliates set payout_account_id = 'acct_1' where id = 'd5000000-0000-4000-8000-0000000000a7'$$), 1::bigint, 'manage_affiliates preenche payout_account_id nulo: passa');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($$update public.platform_affiliates set payout_account_id = 'acct_2' where id = 'd5000000-0000-4000-8000-0000000000a7'$$, '42501', null, 'manage_affiliates troca payout_account_id preenchido: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($$update public.platform_affiliates set payout_account_id = null where id = 'd5000000-0000-4000-8000-0000000000a7'$$, '42501', null, 'manage_affiliates apaga payout_account_id: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select throws_ok($$update public.platform_affiliates set payout_account_id = 'acct_2' where id = 'd5000000-0000-4000-8000-0000000000a7'$$, '42501', null, 'super_admin troca payout_account_id: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.upd($$update public.platform_affiliates set payout_account_id = 'acct_1' where id = 'd5000000-0000-4000-8000-0000000000a7'$$), 1::bigint, 'mandar o mesmo payout_account_id passa');
select pg_temp.como('service_role');
select lives_ok($$update public.platform_affiliates set payout_account_id = 'acct_3' where id = 'd5000000-0000-4000-8000-0000000000a7'$$, 'service_role troca payout_account_id');
-- RPC afiliados_para_cupons
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.n($$select count(*) from public.afiliados_para_cupons()$$), 1::bigint, 'afiliados_para_cupons: adm_cup recebe 1 afiliado');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.n($$select count(*) from public.afiliados_para_cupons()$$), 1::bigint, 'afiliados_para_cupons: adm_aff recebe 1 afiliado');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select is(pg_temp.n($$select count(*) from public.afiliados_para_cupons()$$), 1::bigint, 'afiliados_para_cupons: super recebe 1 afiliado');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000004', 'aal2');
select results_eq($$select codigo, ativo from public.afiliados_para_cupons()$$, $$values ('S3AFIL'::text, true)$$, 'afiliados_para_cupons: devolve código e ativo');
select is((select nome from public.afiliados_para_cupons()), 'afil', 'afiliados_para_cupons: devolve o nome');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$select * from public.afiliados_para_cupons()$$, '42501', null, 'afiliados_para_cupons: adm_fin barrado (42501)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000011', 'aal1');
select throws_ok($$select * from public.afiliados_para_cupons()$$, '42501', null, 'afiliados_para_cupons: adm_aal1 barrado (42501)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000010', 'aal2');
select throws_ok($$select * from public.afiliados_para_cupons()$$, '42501', null, 'afiliados_para_cupons: adm_none barrado (42501)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000007', 'aal2');
select throws_ok($$select * from public.afiliados_para_cupons()$$, '42501', null, 'afiliados_para_cupons: adm_tix barrado (42501)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000012', 'aal1');
select throws_ok($$select * from public.afiliados_para_cupons()$$, '42501', null, 'afiliados_para_cupons: p1 barrado (42501)');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000014', 'aal1');
select throws_ok($$select * from public.afiliados_para_cupons()$$, '42501', null, 'afiliados_para_cupons: comum barrado (42501)');
select pg_temp.como('anon');
select throws_ok($$select * from public.afiliados_para_cupons()$$, '42501', null, 'afiliados_para_cupons: anônimo barrado (42501)');
-- desvio de comissão: affiliate_id do link, user_id e referral_code do afiliado nunca mudam pelo site
select pg_temp.como('postgres');
insert into public.platform_affiliates (id, user_id, referral_code, recurring_percent) values ('d5000000-0000-4000-8000-0000000000ab', 'd5000000-0000-4000-8000-000000000018', 'S3AFIL2', 20);
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($$update public.affiliate_links set affiliate_id = 'd5000000-0000-4000-8000-0000000000ab' where id = 'd5000000-0000-4000-8000-0000000000a9'$$, '42501', null, 'manage_affiliates troca affiliate_id do link: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select throws_ok($$update public.affiliate_links set affiliate_id = 'd5000000-0000-4000-8000-0000000000ab' where id = 'd5000000-0000-4000-8000-0000000000a9'$$, '42501', null, 'super_admin troca affiliate_id do link: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000016', 'aal1');
select throws_ok($$update public.affiliate_links set affiliate_id = 'd5000000-0000-4000-8000-0000000000ab' where id = 'd5000000-0000-4000-8000-0000000000a9'$$, '42501', null, 'afiliado troca affiliate_id do próprio link: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.upd($$update public.affiliate_links set affiliate_id = affiliate_id, label = 'mesmo afiliado' where id = 'd5000000-0000-4000-8000-0000000000a9'$$), 1::bigint, 'mandar o mesmo affiliate_id passa');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($$update public.platform_affiliates set user_id = 'd5000000-0000-4000-8000-000000000017' where id = 'd5000000-0000-4000-8000-0000000000a7'$$, '42501', null, 'manage_affiliates troca user_id do afiliado: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select throws_ok($$update public.platform_affiliates set user_id = 'd5000000-0000-4000-8000-000000000017' where id = 'd5000000-0000-4000-8000-0000000000a7'$$, '42501', null, 'super_admin troca user_id do afiliado: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($$update public.platform_affiliates set referral_code = 'S3OUTRO' where id = 'd5000000-0000-4000-8000-0000000000a7'$$, '42501', null, 'manage_affiliates troca referral_code: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000009', 'aal2');
select throws_ok($$update public.platform_affiliates set referral_code = 'S3OUTRO' where id = 'd5000000-0000-4000-8000-0000000000a7'$$, '42501', null, 'super_admin troca referral_code: 42501');
select pg_temp.como('authenticated', 'd5000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.upd($$update public.platform_affiliates set referral_code = referral_code, user_id = user_id, notes = 'ok' where id = 'd5000000-0000-4000-8000-0000000000a7'$$), 1::bigint, 'mandar o mesmo código e user_id passa (editar outra coisa)');
select pg_temp.como('service_role');
select lives_ok($$update public.platform_affiliates set referral_code = 'S3SERV' where id = 'd5000000-0000-4000-8000-0000000000a7'$$, 'service_role troca referral_code');
select pg_temp.como('postgres');
select is((select commission_rate::text || '/' || stripe_account_id || '/' || pix_key from public.producer_profiles where id = 'd5000000-0000-4000-8000-000000000012'), '12.00/acct_ok/p1@upsert', 'valores finais do p1: só as gravações permitidas ficaram');

select * from finish();
rollback;
