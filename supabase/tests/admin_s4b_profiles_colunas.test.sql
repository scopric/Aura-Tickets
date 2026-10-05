-- pgTAP da S4b do admin (docs/sql/20261018_admin_s4b_profiles_colunas.sql, Decisão 163 itens 3 e 11): profiles mínimo.
-- Só em banco descartável: baseline + docs/sql até o estado de produção + S3 (20261014) + S4 (20261015) + S4b, e rodar
-- este arquivo (psql -f ou `supabase test db`). Tudo em begin ... rollback. Nunca contra produção.
-- pg_temp.como() troca papel e claims do JWT como o PostgREST; pg_temp.n(sql) = primeira coluna bigint do select;
-- pg_temp.t(sql) = primeira coluna text; pg_temp.upd(sql) = linhas afetadas por update.
-- Contas: adm_users (manage_users), adm_team (manage_team), adm_support (manage_support), adm_fin (manage_finance),
-- super1 e super2, adm_aal1 (as 3 permissões, token aal1), comum (sem 2FA, com telefone e CPF), p1 (produtor),
-- comum_mfa (2FA confirmado, token aal1).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(66);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', case when p_role = 'postgres' then 'none' else p_role end, true);
end $f$;
create function pg_temp.n(p text) returns bigint language plpgsql as $f$
declare r bigint; begin execute p into r; return r; end $f$;
create function pg_temp.t(p text) returns text language plpgsql as $f$
declare r text; begin execute p into r; return r; end $f$;
create function pg_temp.upd(p text) returns bigint language plpgsql as $f$
declare r bigint; begin execute p; get diagnostics r = row_count; return r; end $f$;
grant execute on function pg_temp.como(text, uuid, text), pg_temp.n(text), pg_temp.t(text), pg_temp.upd(text) to anon, authenticated, service_role;
grant execute on all functions in schema extensions to anon, authenticated, service_role;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('d8000000-0000-4000-8000-000000000001', 'adm_users@teste-s4b.local', now(), '{"full_name":"adm_users"}'),
  ('d8000000-0000-4000-8000-000000000002', 'adm_team@teste-s4b.local', now(), '{"full_name":"adm_team"}'),
  ('d8000000-0000-4000-8000-000000000003', 'adm_support@teste-s4b.local', now(), '{"full_name":"adm_support"}'),
  ('d8000000-0000-4000-8000-000000000004', 'adm_fin@teste-s4b.local', now(), '{"full_name":"adm_fin"}'),
  ('d8000000-0000-4000-8000-000000000005', 'super1@teste-s4b.local', now(), '{"full_name":"super1"}'),
  ('d8000000-0000-4000-8000-000000000006', 'super2@teste-s4b.local', now(), '{"full_name":"super2"}'),
  ('d8000000-0000-4000-8000-000000000007', 'adm_aal1@teste-s4b.local', now(), '{"full_name":"adm_aal1"}'),
  ('d8000000-0000-4000-8000-000000000008', 'comum@teste-s4b.local', now(), '{"full_name":"comum"}'),
  ('d8000000-0000-4000-8000-000000000009', 'p1@teste-s4b.local', now(), '{"full_name":"p1"}'),
  ('d8000000-0000-4000-8000-000000000010', 'comum_mfa@teste-s4b.local', now(), '{"full_name":"comum_mfa"}');
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at) values
  ('d8000000-0000-4000-9000-000000000101', 'd8000000-0000-4000-8000-000000000001', 'teste', 'totp', 'verified', now(), now()),
  ('d8000000-0000-4000-9000-000000000102', 'd8000000-0000-4000-8000-000000000002', 'teste', 'totp', 'verified', now(), now()),
  ('d8000000-0000-4000-9000-000000000103', 'd8000000-0000-4000-8000-000000000003', 'teste', 'totp', 'verified', now(), now()),
  ('d8000000-0000-4000-9000-000000000104', 'd8000000-0000-4000-8000-000000000004', 'teste', 'totp', 'verified', now(), now()),
  ('d8000000-0000-4000-9000-000000000105', 'd8000000-0000-4000-8000-000000000005', 'teste', 'totp', 'verified', now(), now()),
  ('d8000000-0000-4000-9000-000000000106', 'd8000000-0000-4000-8000-000000000006', 'teste', 'totp', 'verified', now(), now()),
  ('d8000000-0000-4000-9000-000000000107', 'd8000000-0000-4000-8000-000000000007', 'teste', 'totp', 'verified', now(), now()),
  ('d8000000-0000-4000-9000-000000000110', 'd8000000-0000-4000-8000-000000000010', 'teste', 'totp', 'verified', now(), now());
update public.profiles set role = 'admin', admin_permissions = array['manage_users']::text[] where id = 'd8000000-0000-4000-8000-000000000001';
update public.profiles set role = 'admin', admin_permissions = array['manage_team']::text[] where id = 'd8000000-0000-4000-8000-000000000002';
update public.profiles set role = 'admin', admin_permissions = array['manage_support']::text[] where id = 'd8000000-0000-4000-8000-000000000003';
update public.profiles set role = 'admin', admin_permissions = array['manage_finance']::text[] where id = 'd8000000-0000-4000-8000-000000000004';
update public.profiles set role = 'admin', admin_permissions = array['super_admin']::text[] where id in ('d8000000-0000-4000-8000-000000000005', 'd8000000-0000-4000-8000-000000000006');
update public.profiles set role = 'admin', admin_permissions = array['manage_users', 'manage_team', 'manage_support']::text[] where id = 'd8000000-0000-4000-8000-000000000007';
update public.profiles set role = 'producer' where id = 'd8000000-0000-4000-8000-000000000009';
update public.profiles set phone = '11999990008', cpf = '12345678900', stripe_customer_id = 'cus_teste', city = 'Cuiabá', birth_date = '1990-05-05'
  where id = 'd8000000-0000-4000-8000-000000000008';
insert into public.producer_subscriptions (producer_id, plan) values ('d8000000-0000-4000-8000-000000000009', 'pro');
insert into public.user_custom_features (user_id, feature_key) values ('d8000000-0000-4000-8000-000000000009', 'crm');

-- 1. Privilégios por coluna (catálogo) ---------------------------------------------------------------------------------
select ok((select bool_and(has_column_privilege('authenticated', 'public.profiles', c, 'select'))
           from unnest(array['id', 'email', 'full_name', 'avatar_url', 'role', 'created_at', 'avatar_moderacao']) c),
  'authenticated lê as 7 colunas liberadas');
select ok(not (select bool_or(has_column_privilege('authenticated', 'public.profiles', c, 'select'))
           from unnest(array['phone', 'cpf', 'bio', 'city', 'birth_date', 'instagram', 'tiktok', 'linkedin', 'stripe_customer_id',
             'is_verified', 'updated_at', 'website', 'admin_permissions', 'avatar_moderado_em', 'avatar_moderacao_hash',
             'avatar_moderacao_tentativas', 'avatar_moderacao_reservada_ate']) c),
  'authenticated não lê nenhuma das 17 colunas retidas');
select is((select count(*) from pg_attribute where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped), 24::bigint,
  'profiles tem 24 colunas (7 liberadas + 17 retidas): coluna nova exige reclassificar no SQL');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'select'), 'authenticated sem SELECT na tabela inteira');
select ok(not has_table_privilege('anon', 'public.profiles', 'select') and not has_any_column_privilege('anon', 'public.profiles', 'select'),
  'anon sem SELECT em coluna nenhuma');
select ok(has_table_privilege('service_role', 'public.profiles', 'select'), 'service_role segue lendo tudo (Edge Functions)');
select ok(has_table_privilege('authenticated', 'public.profiles', 'update') and has_table_privilege('authenticated', 'public.profiles', 'insert'),
  'INSERT e UPDATE de authenticated não mudaram');
select ok(has_function_privilege('authenticated', 'public.meu_perfil()', 'execute') and has_function_privilege('authenticated', 'public.admin_equipe()', 'execute')
  and has_function_privilege('authenticated', 'public.chat_atendentes()', 'execute') and has_function_privilege('authenticated', 'public.admin_usuarios_lista()', 'execute'),
  'authenticated executa as 4 RPCs');
select ok(not (has_function_privilege('anon', 'public.meu_perfil()', 'execute') or has_function_privilege('anon', 'public.admin_equipe()', 'execute')
  or has_function_privilege('anon', 'public.chat_atendentes()', 'execute') or has_function_privilege('anon', 'public.admin_usuarios_lista()', 'execute')),
  'anon não executa nenhuma das 4 RPCs');
select ok(not has_function_privilege('anon', 'public.gf_ha_outro_super_admin(uuid)', 'execute'), 'anon não executa gf_ha_outro_super_admin');
select ok(not (select prosecdef from pg_proc where oid = 'public.gf_protect_profile_privileges()'::regprocedure)
  and position('from public.profiles' in pg_get_functiondef('public.gf_protect_profile_privileges()'::regprocedure)) = 0,
  'gatilho gf_protect_profile_privileges segue INVOKER e sem leitura direta de profiles');

-- 2. Usuário comum: própria linha, só colunas liberadas ---------------------------------------------------------------
select pg_temp.como('authenticated', 'd8000000-0000-4000-8000-000000000008');
select is(pg_temp.t($$select full_name from public.profiles where id = 'd8000000-0000-4000-8000-000000000008'$$), 'comum', 'comum: lê o próprio nome');
select is(pg_temp.n($$select count(*) from public.profiles where id = 'd8000000-0000-4000-8000-000000000008'$$), 1::bigint, 'comum: lê id da própria linha');
select throws_ok($$select phone from public.profiles where id = 'd8000000-0000-4000-8000-000000000008'$$, '42501', null, 'comum: select phone da própria linha dá 42501');
select throws_ok($$select * from public.profiles where id = 'd8000000-0000-4000-8000-000000000008'$$, '42501', null, 'comum: select * dá 42501');
select throws_ok($$select cpf from public.profiles where id = 'd8000000-0000-4000-8000-000000000008'$$, '42501', null, 'comum: select cpf dá 42501');
select throws_ok($$select id from public.profiles where phone is not null$$, '42501', null, 'comum: filtrar por phone também dá 42501');
select throws_ok($$select id from public.profiles where id = 'd8000000-0000-4000-8000-000000000008' and birth_date is null$$, '42501', null,
  'comum: filtrar por birth_date dá 42501 (o Checkout confere no cliente)');
select is(pg_temp.n($$select count(*) from public.profiles where id <> 'd8000000-0000-4000-8000-000000000008'$$), 0::bigint, 'comum: não vê perfil de terceiro');

-- 3. meu_perfil() ---------------------------------------------------------------------------------------------------
select is(pg_temp.t($$select meu_perfil() ->> 'phone'$$), '11999990008', 'meu_perfil: devolve o próprio telefone');
select is(pg_temp.t($$select meu_perfil() ->> 'city'$$), 'Cuiabá', 'meu_perfil: devolve a própria cidade');
select is(pg_temp.t($$select meu_perfil() ->> 'birth_date'$$), '1990-05-05', 'meu_perfil: devolve o próprio nascimento');
select ok(pg_temp.t($$select (not meu_perfil() ? 'cpf' and not meu_perfil() ? 'stripe_customer_id')::text$$) = 'true', 'meu_perfil: sem cpf e sem stripe_customer_id');
select is(pg_temp.t($$select meu_perfil() ->> 'role'$$), 'user', 'meu_perfil: devolve o papel');
select is(pg_temp.t($$select meu_perfil() ->> 'id'$$), 'd8000000-0000-4000-8000-000000000008', 'meu_perfil: é a linha de auth.uid()');

-- 4. Atualizar o próprio perfil continua valendo ------------------------------------------------------------------------
select is(pg_temp.upd($$update public.profiles set phone = '11888880008', city = 'Várzea Grande', birth_date = '1991-06-06' where id = 'd8000000-0000-4000-8000-000000000008'$$),
  1::bigint, 'comum: update do próprio perfil (telefone, cidade, nascimento) passa');
select is(pg_temp.t($$select id::text from public.profiles where id = 'd8000000-0000-4000-8000-000000000008'$$), 'd8000000-0000-4000-8000-000000000008', 'comum: ainda lê o id depois do update');
select is(pg_temp.t($$select meu_perfil() ->> 'phone'$$), '11888880008', 'meu_perfil: devolve o telefone gravado');
select throws_ok($$update public.profiles set bio = 'x' where id = 'd8000000-0000-4000-8000-000000000008' and birth_date is null$$, '42501', null,
  'comum: update com filtro em birth_date dá 42501');
select is(pg_temp.upd($$update public.profiles set full_name = 'Outro' where id = 'd8000000-0000-4000-8000-000000000009'$$), 0::bigint, 'comum: update de perfil alheio afeta 0 linha');

-- 5. Anônimo ----------------------------------------------------------------------------------------------------------
select pg_temp.como('anon');
select throws_ok($$select id from public.profiles$$, '42501', null, 'anon: select em profiles dá 42501');
select throws_ok($$select public.meu_perfil()$$, '42501', null, 'anon: meu_perfil dá 42501');
select throws_ok($$select * from public.admin_usuarios_lista()$$, '42501', null, 'anon: admin_usuarios_lista dá 42501');

-- 6. 2FA: mesma regra RESTRICTIVE gf_mfa_aal2 da tabela ----------------------------------------------------------------
select pg_temp.como('authenticated', 'd8000000-0000-4000-8000-000000000010', 'aal1');
select is(pg_temp.n($$select count(*) from public.profiles where id = 'd8000000-0000-4000-8000-000000000010'$$), 0::bigint, 'comum_mfa em aal1: a tabela não devolve nem o próprio perfil');
select ok(pg_temp.t($$select (meu_perfil() is null)::text$$) = 'true', 'comum_mfa em aal1: meu_perfil também devolve nulo');
select pg_temp.como('authenticated', 'd8000000-0000-4000-8000-000000000010', 'aal2');
select is(pg_temp.t($$select meu_perfil() ->> 'id'$$), 'd8000000-0000-4000-8000-000000000010', 'comum_mfa em aal2: meu_perfil devolve a linha');

-- 7. Admin com outra permissão: nome e e-mail de terceiro sim; telefone não; RPCs sem a permissão, 42501 --------------
select pg_temp.como('authenticated', 'd8000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.t($$select email from public.profiles where id = 'd8000000-0000-4000-8000-000000000008'$$), 'comum@teste-s4b.local', 'adm_fin: lê e-mail de terceiro');
select is(pg_temp.t($$select full_name from public.profiles where id = 'd8000000-0000-4000-8000-000000000008'$$), 'comum', 'adm_fin: lê nome de terceiro');
select throws_ok($$select phone from public.profiles where id = 'd8000000-0000-4000-8000-000000000008'$$, '42501', null, 'adm_fin: phone de terceiro dá 42501');
select throws_ok($$select cpf from public.profiles where id = 'd8000000-0000-4000-8000-000000000008'$$, '42501', null, 'adm_fin: cpf de terceiro dá 42501');
select throws_ok($$select * from public.profiles where id = 'd8000000-0000-4000-8000-000000000008'$$, '42501', null, 'adm_fin: select * dá 42501');
select throws_ok($$select admin_permissions from public.profiles where role = 'admin'$$, '42501', null, 'adm_fin: admin_permissions pela tabela dá 42501');
select throws_ok($$select * from public.admin_usuarios_lista()$$, '42501', 'acesso negado: precisa da permissão manage_users', 'adm_fin: admin_usuarios_lista dá 42501');
select throws_ok($$select * from public.admin_equipe()$$, '42501', 'acesso negado: precisa da permissão manage_team', 'adm_fin: admin_equipe dá 42501');
select throws_ok($$select * from public.chat_atendentes()$$, '42501', 'acesso negado: precisa da permissão manage_support', 'adm_fin: chat_atendentes dá 42501');
select pg_temp.como('authenticated', 'd8000000-0000-4000-8000-000000000008');
select throws_ok($$select * from public.admin_equipe()$$, '42501', null, 'comum: admin_equipe dá 42501');
select throws_ok($$select * from public.chat_atendentes()$$, '42501', null, 'comum: chat_atendentes dá 42501');
select throws_ok($$select public.admin_usuarios_lista()$$, '42501', null, 'comum: admin_usuarios_lista dá 42501');
select pg_temp.como('authenticated', 'd8000000-0000-4000-8000-000000000007', 'aal1');
select throws_ok($$select * from public.admin_equipe()$$, '42501', null, 'admin com as permissões mas token aal1: admin_equipe dá 42501');
select throws_ok($$select public.admin_usuarios_lista()$$, '42501', null, 'admin em aal1: admin_usuarios_lista dá 42501');
select throws_ok($$select * from public.chat_atendentes()$$, '42501', null, 'admin em aal1: chat_atendentes dá 42501');

-- 8. admin_equipe, chat_atendentes, admin_usuarios_lista com a permissão -------------------------------------------------
select pg_temp.como('authenticated', 'd8000000-0000-4000-8000-000000000002', 'aal2');
select is(pg_temp.n($$select count(*) from public.admin_equipe()$$), pg_temp.n($$select count(*) from public.profiles where role = 'admin'$$),
  'adm_team: admin_equipe devolve todos os admins');
select is(pg_temp.t($$select admin_permissions::text from public.admin_equipe() where id = 'd8000000-0000-4000-8000-000000000003'$$), '{manage_support}', 'adm_team: vê as permissões de outro admin');
select is(pg_temp.n($$select count(*) from public.admin_equipe() where id = 'd8000000-0000-4000-8000-000000000008'$$), 0::bigint, 'adm_team: admin_equipe não traz quem não é admin');
select pg_temp.como('authenticated', 'd8000000-0000-4000-8000-000000000003', 'aal2');
select is((select array_agg(id order by id) from public.chat_atendentes() where id::text like 'd8000000%'),
  array['d8000000-0000-4000-8000-000000000003', 'd8000000-0000-4000-8000-000000000005', 'd8000000-0000-4000-8000-000000000006', 'd8000000-0000-4000-8000-000000000007']::uuid[],
  'adm_support: chat_atendentes traz só admins com manage_support ou super_admin (sem adm_users, adm_team e adm_fin)');
select is(pg_temp.t($$select email from public.chat_atendentes() where id = 'd8000000-0000-4000-8000-000000000003'$$), 'adm_support@teste-s4b.local', 'adm_support: chat_atendentes traz o e-mail');
select pg_temp.como('authenticated', 'd8000000-0000-4000-8000-000000000001', 'aal2');
select is(pg_temp.n($$select jsonb_array_length(public.admin_usuarios_lista())$$), pg_temp.n($$select count(*) from public.profiles$$),
  'adm_users: admin_usuarios_lista devolve todos os perfis');
select is(pg_temp.t($$select x ->> 'phone' from jsonb_array_elements(public.admin_usuarios_lista()) x where x ->> 'id' = 'd8000000-0000-4000-8000-000000000008'$$),
  '11888880008', 'adm_users: a lista traz o telefone (Decisão 163 item 11)');
select is(pg_temp.t($$select x -> 'producer_subscriptions' ->> 'plan' from jsonb_array_elements(public.admin_usuarios_lista()) x where x ->> 'id' = 'd8000000-0000-4000-8000-000000000009'$$),
  'pro', 'adm_users: assinatura como objeto');
select is(pg_temp.t($$select x -> 'user_custom_features' -> 0 ->> 'feature_key' from jsonb_array_elements(public.admin_usuarios_lista()) x where x ->> 'id' = 'd8000000-0000-4000-8000-000000000009'$$),
  'crm', 'adm_users: recursos como lista');
select ok(pg_temp.t($$select (x -> 'producer_subscriptions' = 'null'::jsonb and x -> 'user_custom_features' = '[]'::jsonb)::text from jsonb_array_elements(public.admin_usuarios_lista()) x where x ->> 'id' = 'd8000000-0000-4000-8000-000000000008'$$) = 'true',
  'adm_users: sem assinatura, nulo; sem recursos, lista vazia');
select ok(pg_temp.t($$select (not x ? 'cpf' and not x ? 'stripe_customer_id' and not x ? 'birth_date')::text from jsonb_array_elements(public.admin_usuarios_lista()) x where x ->> 'id' = 'd8000000-0000-4000-8000-000000000008'$$) = 'true',
  'adm_users: a lista não traz cpf, stripe_customer_id nem nascimento');
select pg_temp.como('authenticated', 'd8000000-0000-4000-8000-000000000005', 'aal2');
select ok(pg_temp.n($$select jsonb_array_length(public.admin_usuarios_lista())$$) > 0 and pg_temp.n($$select count(*) from public.admin_equipe()$$) > 0
  and pg_temp.n($$select count(*) from public.chat_atendentes()$$) > 0, 'super_admin passa nas três RPCs');

-- 9. Trava "nunca zero super_admin" sem o SELECT em admin_permissions (gatilho INVOKER) ---------------------------------
select pg_temp.como('authenticated', 'd8000000-0000-4000-8000-000000000005', 'aal2');
select is(pg_temp.upd($$update public.profiles set role = 'user' where id = 'd8000000-0000-4000-8000-000000000006'$$), 1::bigint,
  'super_admin rebaixa outro super_admin (restando outro): passa, sem 42501 de coluna');
select throws_ok($$update public.profiles set role = 'user' where id = 'd8000000-0000-4000-8000-000000000005'$$, '42501', 'Ninguém altera o próprio papel nem as próprias permissões',
  'super_admin não rebaixa a si mesmo');
select pg_temp.como('postgres');
update public.profiles set admin_permissions = array['manage_users']::text[], role = 'admin'
  where role = 'admin' and 'super_admin' = any(admin_permissions) and id <> 'd8000000-0000-4000-8000-000000000005';
select throws_ok($$update public.profiles set role = 'user' where id = 'd8000000-0000-4000-8000-000000000005'$$, '42501', 'A plataforma precisa de pelo menos um super_admin',
  'o último super_admin não sai (nem pelo dono do banco)');

select * from finish();
rollback;
