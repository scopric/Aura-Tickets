-- pgTAP da S5 do admin (docs/sql/20261016_admin_s5_trilha.sql, Decisão 163 item 6): trilha de auditoria imutável.
-- Só em banco descartável: baseline + docs/sql até o estado de produção + SQL da S3 (20261014) + o da S5 (a S4 pode estar
-- ou não) e rodar este arquivo (psql -f ou `supabase test db`). Tudo em begin ... rollback. Nunca contra produção.
-- A tabela da trilha não se apaga nem se limpa, então os testes marcam o último id (pg_temp.marca) e contam só o que veio depois.
-- pg_temp.como() troca papel e claims do JWT como o PostgREST; pg_temp.hdr() põe request.headers; pg_temp.n(sql) = primeira
-- coluna bigint do select; pg_temp.nlog(cond) e pg_temp.ult(cond) olham a trilha (só como postgres) depois da marca.
-- Contas: adm_users (manage_users), adm_fin (manage_finance), adm_set (manage_settings), adm_ana (view_analytics),
-- adm_audit (view_audit), super, comum (sem papel), p1 (produtor dono).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(128);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.headers', '', true);
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', case when p_role = 'postgres' then 'none' else p_role end, true);
end $f$;
create function pg_temp.hdr(p text) returns void language plpgsql as $f$
begin perform set_config('request.headers', p, true); end $f$;
create function pg_temp.n(p text) returns bigint language plpgsql as $f$
declare r bigint; begin execute p into r; return r; end $f$;
create function pg_temp.marca() returns void language plpgsql as $f$
begin perform set_config('test.marca', (select coalesce(max(id), 0) from public.admin_audit_log)::text, true); end $f$;
create function pg_temp.nlog(p text) returns bigint language plpgsql as $f$
declare r bigint; begin
  execute 'select count(*) from public.admin_audit_log where id > current_setting(''test.marca'')::bigint and (' || p || ')' into r;
  return r; end $f$;
create function pg_temp.ult(p text) returns jsonb language plpgsql as $f$
declare r jsonb; begin
  execute 'select to_jsonb(a) from public.admin_audit_log a where id > current_setting(''test.marca'')::bigint and (' || p || ') order by id desc limit 1' into r;
  return r; end $f$;
grant execute on function pg_temp.como(text, uuid, text), pg_temp.hdr(text), pg_temp.n(text), pg_temp.marca(), pg_temp.nlog(text),
  pg_temp.ult(text) to anon, authenticated, service_role;
grant execute on all functions in schema extensions to anon, authenticated, service_role;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('d7000000-0000-4000-8000-000000000001', 'adm_users@teste-s5.local', now(), '{"full_name":"adm_users"}'),
  ('d7000000-0000-4000-8000-000000000002', 'adm_fin@teste-s5.local', now(), '{"full_name":"adm_fin"}'),
  ('d7000000-0000-4000-8000-000000000003', 'adm_set@teste-s5.local', now(), '{"full_name":"adm_set"}'),
  ('d7000000-0000-4000-8000-000000000004', 'adm_ana@teste-s5.local', now(), '{"full_name":"adm_ana"}'),
  ('d7000000-0000-4000-8000-000000000005', 'adm_audit@teste-s5.local', now(), '{"full_name":"adm_audit"}'),
  ('d7000000-0000-4000-8000-000000000006', 'super@teste-s5.local', now(), '{"full_name":"super"}'),
  ('d7000000-0000-4000-8000-000000000007', 'comum@teste-s5.local', now(), '{"full_name":"comum"}'),
  ('d7000000-0000-4000-8000-000000000008', 'p1@teste-s5.local', now(), '{"full_name":"p1"}'),
  ('d7000000-0000-4000-8000-000000000009', 'alvo@teste-s5.local', now(), '{"full_name":"alvo"}');
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at) values
  ('d7000000-0000-4000-9000-0000000000f1', 'd7000000-0000-4000-8000-000000000001', 'teste', 'totp', 'verified', now(), now()),
  ('d7000000-0000-4000-9000-0000000000f2', 'd7000000-0000-4000-8000-000000000002', 'teste', 'totp', 'verified', now(), now()),
  ('d7000000-0000-4000-9000-0000000000f3', 'd7000000-0000-4000-8000-000000000003', 'teste', 'totp', 'verified', now(), now()),
  ('d7000000-0000-4000-9000-0000000000f4', 'd7000000-0000-4000-8000-000000000004', 'teste', 'totp', 'verified', now(), now()),
  ('d7000000-0000-4000-9000-0000000000f5', 'd7000000-0000-4000-8000-000000000005', 'teste', 'totp', 'verified', now(), now()),
  ('d7000000-0000-4000-9000-0000000000f6', 'd7000000-0000-4000-8000-000000000006', 'teste', 'totp', 'verified', now(), now());
update public.profiles set role = 'admin', admin_permissions = array['manage_users']::text[] where id = 'd7000000-0000-4000-8000-000000000001';
update public.profiles set role = 'admin', admin_permissions = array['manage_finance']::text[] where id = 'd7000000-0000-4000-8000-000000000002';
update public.profiles set role = 'admin', admin_permissions = array['manage_settings']::text[] where id = 'd7000000-0000-4000-8000-000000000003';
update public.profiles set role = 'admin', admin_permissions = array['view_analytics']::text[] where id = 'd7000000-0000-4000-8000-000000000004';
update public.profiles set role = 'admin', admin_permissions = array['view_audit']::text[] where id = 'd7000000-0000-4000-8000-000000000005';
update public.profiles set role = 'admin', admin_permissions = array['super_admin']::text[] where id = 'd7000000-0000-4000-8000-000000000006';
insert into public.producer_profiles (id, company_name, pix_key, bank_account, cnpj) values
  ('d7000000-0000-4000-8000-000000000008', 'Paula Eventos', 'p1@pix-secreto', '{"banco":"341-secreto"}', '11222333000181');
insert into public.events (id, producer_id, title, slug, status, approval_status) values
  ('d7000000-0000-4000-8000-0000000000e1', 'd7000000-0000-4000-8000-000000000008', 'No ar', 's5-e1', 'published', 'pending');
insert into public.orders (id, user_id, event_id, total, status) values
  ('d7000000-0000-4000-8000-0000000000a1', 'd7000000-0000-4000-8000-000000000009', 'd7000000-0000-4000-8000-0000000000e1', 100, 'paid');
insert into public.ticket_types (id, event_id, name) values ('d7000000-0000-4000-8000-0000000000f1', 'd7000000-0000-4000-8000-0000000000e1', 'Pista');
insert into public.tickets (id, order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, status) values
  ('d7000000-0000-4000-8000-0000000000b1', 'd7000000-0000-4000-8000-0000000000a1', 'd7000000-0000-4000-8000-0000000000f1',
   'd7000000-0000-4000-8000-0000000000e1', 'd7000000-0000-4000-8000-000000000009', 'x', 'x@x.local', 'active');
insert into public.user_activities (id, session_id, event_type, user_id) values
  ('d7000000-0000-4000-8000-0000000000c1', 's5', 'page_view', 'd7000000-0000-4000-8000-000000000009');
insert into public.withdrawals (id, producer_id, amount) values ('d7000000-0000-4000-8000-0000000000d1', 'd7000000-0000-4000-8000-000000000008', 50);
insert into public.platform_settings (key, value) values ('general', '{"a":1}'), ('fees', '{"taxa":10}');
insert into public.coupons (id, code, discount_type, discount_value, duration) values ('d7000000-0000-4000-8000-0000000000a5', 'S5PLANO', 'percent', 10, 'once');
insert into public.coupons (id, producer_id, code, discount_type, discount_value) values ('d7000000-0000-4000-8000-0000000000a6', 'd7000000-0000-4000-8000-000000000008', 'S5PAULA', 'percent', 10);
insert into public.platform_affiliates (id, user_id, referral_code, recurring_percent, cpf) values
  ('d7000000-0000-4000-8000-0000000000a7', 'd7000000-0000-4000-8000-000000000009', 'S5AFIL', 20, '52998224725');
insert into public.feedback (id, message) values ('d7000000-0000-4000-8000-0000000000a8', 'texto-secreto-do-feedback');
insert into public.contact_messages (id, name, email, message) values ('d7000000-0000-4000-8000-0000000000a9', 'Fulano Secreto', 'fulano-secreto@x.local', 'msg-secreta');
insert into public.kb_articles (id, title, body) values ('d7000000-0000-4000-8000-0000000000aa', 'Titulo', 'corpo-secreto-do-artigo');
insert into public.producer_subscriptions (id, producer_id, plan) values ('d7000000-0000-4000-8000-0000000000ab', 'd7000000-0000-4000-8000-000000000008', 'free');

-- A. Tabela fechada ----------------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.admin_audit_log'::regclass), 'admin_audit_log: RLS ligada');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'admin_audit_log' and permissive = 'PERMISSIVE'),
  0::bigint, 'admin_audit_log: nenhuma regra permissiva');
select ok(not has_table_privilege('anon', 'public.admin_audit_log', 'select, insert, update, delete, truncate')
  and not has_table_privilege('authenticated', 'public.admin_audit_log', 'select, insert, update, delete, truncate')
  and not has_table_privilege('service_role', 'public.admin_audit_log', 'select, insert, update, delete, truncate'),
  'admin_audit_log: nenhum privilégio para anon, authenticated e service_role');
select pg_temp.como('authenticated', 'd7000000-0000-4000-8000-000000000005', 'aal2');
select throws_ok('select count(*) from public.admin_audit_log', '42501', null, 'admin com view_audit não lê a tabela direto (só pela RPC da S6)');
select throws_ok($$insert into public.admin_audit_log (tipo, acao, tabela) values ('acao', 'x', 'x')$$, '42501', null, 'admin não insere na trilha');
select pg_temp.como('authenticated', 'd7000000-0000-4000-8000-000000000006', 'aal2');
select throws_ok('select count(*) from public.admin_audit_log', '42501', null, 'super_admin não lê a tabela direto');
select pg_temp.como('authenticated', 'd7000000-0000-4000-8000-000000000001', 'aal2');
select throws_ok('select count(*) from public.admin_audit_log', '42501', null, 'admin de outra área não lê a tabela');
select pg_temp.como('anon');
select throws_ok('select count(*) from public.admin_audit_log', '42501', null, 'anon não lê a tabela');
select pg_temp.como('service_role');
select throws_ok('select count(*) from public.admin_audit_log', '42501', null, 'service_role não lê a tabela');
select throws_ok($$delete from public.admin_audit_log$$, '42501', null, 'service_role não apaga da tabela');

-- B. Imutável até para o dono ---------------------------------------------------------------------------------------------
select pg_temp.como('postgres');
select pg_temp.marca();
select throws_ok($$update public.admin_audit_log set motivo = 'x'$$, '42501', 'A trilha de auditoria não se altera nem se apaga.', 'UPDATE recusado (dono do banco)');
select throws_ok($$delete from public.admin_audit_log$$, '42501', 'A trilha de auditoria não se altera nem se apaga.', 'DELETE recusado (dono do banco)');
select throws_ok($$truncate public.admin_audit_log$$, '42501', 'A trilha de auditoria não se altera nem se apaga.', 'TRUNCATE recusado (dono do banco)');
select throws_ok($$truncate public.admin_audit_log, public.withdrawals cascade$$, '42501', null, 'TRUNCATE junto com outra tabela também recusado');

-- C. Pix mudado aparece só como «oculto» ----------------------------------------------------------------------------------
select pg_temp.marca();
select pg_temp.como('authenticated', 'd7000000-0000-4000-8000-000000000008', 'aal1');
update public.producer_profiles set pix_key = 'novo-pix-secreto@x', bank_account = '{"banco":"001-novo-secreto"}', cnpj = '99888777000166'
  where id = 'd7000000-0000-4000-8000-000000000008';
select pg_temp.como('postgres');
select is(pg_temp.nlog($$tabela = 'producer_profiles' and objeto_id = 'd7000000-0000-4000-8000-000000000008'$$), 1::bigint, 'Pix, conta e CNPJ mudados: 1 linha na trilha');
select is(pg_temp.ult($$tabela = 'producer_profiles'$$) #>> '{depois,pix_key}', '«oculto»', 'Pix aparece como «oculto» (depois)');
select is(pg_temp.ult($$tabela = 'producer_profiles'$$) #>> '{antes,pix_key}', '«oculto»', 'Pix aparece como «oculto» (antes)');
select is(pg_temp.ult($$tabela = 'producer_profiles'$$) #>> '{depois,bank_account}', '«oculto»', 'conta bancária oculta');
select is(pg_temp.ult($$tabela = 'producer_profiles'$$) #>> '{depois,cnpj}', '«oculto»', 'CNPJ oculto');
select is(position('secreto' in (select (antes::text || depois::text) from public.admin_audit_log order by id desc limit 1)), 0,
  'nenhum valor real de Pix, conta ou CNPJ na linha (antes + depois)');
select is(pg_temp.ult($$tabela = 'producer_profiles'$$) ->> 'autor', 'd7000000-0000-4000-8000-000000000008', 'autor = quem mudou');
select is(pg_temp.ult($$tabela = 'producer_profiles'$$) ->> 'acao', 'alterar', 'acao = alterar');
select is((select count(*) from jsonb_object_keys(pg_temp.ult($$tabela = 'producer_profiles'$$) -> 'depois')), 3::bigint,
  'diff só do que mudou (3 colunas; updated_at fora)');
select pg_temp.marca();
update public.producer_profiles set company_name = 'Paula Eventos 2' where id = 'd7000000-0000-4000-8000-000000000008';
select is(pg_temp.nlog($$tabela = 'producer_profiles'$$), 0::bigint, 'mudar só o nome da empresa não grava');

-- D. profiles: só papel, permissão e selo ---------------------------------------------------------------------------------
select pg_temp.marca();
update public.profiles set full_name = 'Outro Nome', phone = '11999990000' where id = 'd7000000-0000-4000-8000-000000000009';
select is(pg_temp.nlog($$tabela = 'profiles'$$), 0::bigint, 'mudança de nome e telefone em profiles não grava');
select pg_temp.como('authenticated', 'd7000000-0000-4000-8000-000000000006', 'aal2');
update public.profiles set admin_permissions = array['view_audit', 'manage_events']::text[] where id = 'd7000000-0000-4000-8000-000000000005';
select pg_temp.como('postgres');
select is(pg_temp.nlog($$tabela = 'profiles'$$), 1::bigint, 'mudança de permissão grava 1 linha');
select is(pg_temp.ult($$tabela = 'profiles'$$) ->> 'autor', 'd7000000-0000-4000-8000-000000000006', 'profiles: autor = o super_admin que mudou');
select is(pg_temp.ult($$tabela = 'profiles'$$) -> 'depois' ->> 'admin_permissions', '["view_audit", "manage_events"]', 'profiles: depois traz a permissão nova');
select is((select count(*) from jsonb_object_keys(pg_temp.ult($$tabela = 'profiles'$$) -> 'depois')), 1::bigint, 'profiles: depois só com a coluna que mudou (admin_permissions)');
select is(pg_temp.ult($$tabela = 'profiles'$$) -> 'antes' ->> 'admin_permissions', '["view_audit"]', 'profiles: antes traz a permissão antiga');

-- E. updated_by, motivo (cabeçalho em base64 UTF-8), IP e taxa ---------------------------------------------------------------
select pg_temp.marca();
select pg_temp.como('authenticated', 'd7000000-0000-4000-8000-000000000003', 'aal2');
update public.platform_settings set value = '{"a":2}', updated_by = 'd7000000-0000-4000-8000-000000000001' where key = 'general';
select pg_temp.como('postgres');
select is((select updated_by from public.platform_settings where key = 'general'), 'd7000000-0000-4000-8000-000000000003'::uuid,
  'platform_settings.updated_by = quem gravou (mesmo mandando outro)');
select is(pg_temp.nlog($$tabela = 'platform_settings' and objeto_id = (select id::text from public.platform_settings where key = 'general')$$), 1::bigint,
  'platform_settings (general) grava 1 linha');
select is(pg_temp.ult($$tabela = 'platform_settings'$$) ->> 'motivo', null, 'sem cabeçalho, motivo nulo');
select pg_temp.marca();
update public.platform_settings set updated_by = 'd7000000-0000-4000-8000-000000000001', updated_at = now() where key = 'general';
select is(pg_temp.nlog($$tabela = 'platform_settings'$$), 0::bigint, 'platform_settings: só updated_by e updated_at mudando não grava');
select pg_temp.como('authenticated', 'd7000000-0000-4000-8000-000000000003', 'aal2');
select lives_ok($$update public.platform_settings set value = '{"taxa":11}' where key = 'fees'$$, 'taxa sem motivo passa (motivo ainda não é obrigatório)');
select pg_temp.hdr('{"x-evokaa-motivo":"' || encode(convert_to('Revisão da taxa, às 10h: ação áçã', 'UTF8'), 'base64')
  || '","cf-connecting-ip":"203.0.113.7","x-forwarded-for":"10.0.0.1, 198.51.100.9"}');
select lives_ok($$update public.platform_settings set value = '{"taxa":12}' where key = 'fees'$$, 'taxa com motivo no cabeçalho passa');
select pg_temp.como('postgres');
select is(pg_temp.ult($$tabela = 'platform_settings'$$) ->> 'motivo', 'Revisão da taxa, às 10h: ação áçã', 'motivo lido do cabeçalho em UTF-8');
select is(pg_temp.ult($$tabela = 'platform_settings'$$) ->> 'ip', null, 'IP desligado: mesmo com cf-connecting-ip, nada é gravado');
select pg_temp.hdr('{"x-forwarded-for":"10.0.0.1, 198.51.100.9"}');
update public.platform_settings set value = '{"a":3}' where key = 'general';
select is(pg_temp.ult($$tabela = 'platform_settings'$$) ->> 'ip', null, 'IP desligado: x-forwarded-for também não é gravado');
select pg_temp.hdr('isto não é json');
update public.platform_settings set value = '{"a":4}' where key = 'general';
select is(pg_temp.ult($$tabela = 'platform_settings'$$) ->> 'ip', null, 'cabeçalhos inválidos: sem erro');
select pg_temp.hdr('{"x-evokaa-motivo":"@@@não-base64"}');
update public.platform_settings set value = '{"a":5}' where key = 'general';
select is(pg_temp.ult($$tabela = 'platform_settings'$$) ->> 'motivo', null, 'motivo inválido no cabeçalho: nulo, sem erro');
select pg_temp.hdr('{"x-evokaa-motivo":"' || replace(encode(convert_to(repeat('m', 800), 'UTF8'), 'base64'), E'\n', '') || '"}');
update public.platform_settings set value = '{"a":6}' where key = 'general';
select is(char_length(pg_temp.ult($$tabela = 'platform_settings'$$) ->> 'motivo'), 500, 'motivo cortado em 500 caracteres');
select pg_temp.hdr('');
select pg_temp.marca();
update public.platform_settings set value = '{"taxa":15}' where key = 'fees';
select is(pg_temp.nlog($$tabela = 'platform_settings'$$), 1::bigint, 'SQL Editor (dono) muda a taxa sem motivo: passa e grava');
select is(pg_temp.ult($$tabela = 'platform_settings'$$) ->> 'autor', null, 'autor nulo fora da API');

-- F. Comissão; coupons e events ---------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'd7000000-0000-4000-8000-000000000006', 'aal2');
select lives_ok($$update public.producer_profiles set commission_rate = 9 where id = 'd7000000-0000-4000-8000-000000000008'$$, 'comissão sem motivo passa (motivo ainda não é obrigatório)');
select pg_temp.como('postgres');
select is(pg_temp.ult($$tabela = 'producer_profiles'$$) -> 'motivo', 'null'::jsonb, 'comissão sem motivo: grava com motivo nulo');
select pg_temp.como('authenticated', 'd7000000-0000-4000-8000-000000000006', 'aal2');
select pg_temp.hdr('{"x-evokaa-motivo":"' || encode(convert_to('contrato novo', 'UTF8'), 'base64') || '"}');
select lives_ok($$update public.producer_profiles set commission_rate = 8 where id = 'd7000000-0000-4000-8000-000000000008'$$, 'comissão com motivo passa');
select pg_temp.como('postgres');
select is(pg_temp.ult($$tabela = 'producer_profiles'$$) ->> 'motivo', 'contrato novo', 'comissão: motivo guardado');
select is(pg_temp.ult($$tabela = 'producer_profiles'$$) #>> '{depois,commission_rate}', '8.00', 'comissão: valor novo na trilha (não é dado sensível)');
select pg_temp.marca();
update public.coupons set uses = uses + 1 where id = 'd7000000-0000-4000-8000-0000000000a5';
select is(pg_temp.nlog($$tabela = 'coupons'$$), 0::bigint, 'cupom da plataforma: contar uso não grava');
update public.coupons set is_active = false where id = 'd7000000-0000-4000-8000-0000000000a5';
select is(pg_temp.nlog($$tabela = 'coupons'$$), 1::bigint, 'cupom da plataforma: desativar grava');
update public.coupons set is_active = false where id = 'd7000000-0000-4000-8000-0000000000a6';
select is(pg_temp.nlog($$tabela = 'coupons'$$), 1::bigint, 'cupom de produtor: não grava');
select pg_temp.marca();
update public.events set title = 'Novo título' where id = 'd7000000-0000-4000-8000-0000000000e1';
select is(pg_temp.nlog($$tabela = 'events'$$), 0::bigint, 'evento: mudar título não grava');
update public.events set approval_status = 'approved', approved_at = now() where id = 'd7000000-0000-4000-8000-0000000000e1';
select is(pg_temp.nlog($$tabela = 'events'$$), 1::bigint, 'evento: moderação grava');

-- G. Conteúdo mascarado -------------------------------------------------------------------------------------------------------
select pg_temp.marca();
delete from public.feedback where id = 'd7000000-0000-4000-8000-0000000000a8';
delete from public.contact_messages where id = 'd7000000-0000-4000-8000-0000000000a9';
update public.kb_articles set body = 'corpo-novo-secreto', title = 'Titulo 2' where id = 'd7000000-0000-4000-8000-0000000000aa';
update public.platform_affiliates set cpf = '11144477735', recurring_percent = 25 where id = 'd7000000-0000-4000-8000-0000000000a7';
select is(pg_temp.ult($$tabela = 'feedback' and acao = 'excluir'$$) #>> '{antes,message}', '«oculto»', 'DELETE de feedback: mensagem oculta');
select is(pg_temp.ult($$tabela = 'contact_messages' and acao = 'excluir'$$) #>> '{antes,email}', '«oculto»', 'DELETE de contato: e-mail oculto');
select is(pg_temp.ult($$tabela = 'contact_messages' and acao = 'excluir'$$) #>> '{antes,name}', '«oculto»', 'DELETE de contato: nome oculto');
select is(pg_temp.ult($$tabela = 'kb_articles'$$) #>> '{depois,body}', '«oculto»', 'artigo da base: corpo oculto');
select is(pg_temp.ult($$tabela = 'platform_affiliates'$$) #>> '{depois,cpf}', '«oculto»', 'afiliado: CPF oculto');
select is(pg_temp.ult($$tabela = 'platform_affiliates'$$) #>> '{depois,recurring_percent}', '25', 'afiliado: comissão aparece');
select is((select count(*) from public.admin_audit_log where id > current_setting('test.marca')::bigint
  and (antes::text || depois::text) ~ 'secret|52998224725|11144477735'), 0::bigint, 'nenhum texto, CPF ou segredo vazou nas linhas acima');
select pg_temp.marca();
insert into public.admin_invites (id, email, cargo, permissions, token_hash) values
  ('d7000000-0000-4000-8000-0000000000ac', 'novo@teste-s5.local', 'Analista', array['view_audit']::text[], repeat('ab', 32));
select is(pg_temp.ult($$tabela = 'admin_invites'$$) #>> '{depois,token_hash}', '«oculto»', 'convite: hash do token oculto');
select is(pg_temp.ult($$tabela = 'admin_invites'$$) ->> 'acao', 'criar', 'convite: acao = criar');
select is(position(repeat('ab', 32) in (pg_temp.ult($$tabela = 'admin_invites'$$))::text), 0, 'convite: hash real fora da trilha');
select pg_temp.marca();
update public.producer_subscriptions set plan = 'pro' where id = 'd7000000-0000-4000-8000-0000000000ab';
select is(pg_temp.nlog($$tabela = 'producer_subscriptions'$$), 1::bigint, 'plano do produtor mudado: grava');

-- H. withdrawals.processed_by passa pela proteção da S3 ---------------------------------------------------------------------
select is((select array_agg(tgname::text order by tgname collate "C") from pg_trigger
  where tgrelid = 'public.withdrawals'::regclass and not tgisinternal and (tgtype & 2) = 2),
  array['gf_protect_withdrawals', 'withdrawals_quem_processou'], 'ordem dos BEFORE de withdrawals: a proteção da S3 primeiro');
select pg_temp.marca();
select pg_temp.como('authenticated', 'd7000000-0000-4000-8000-000000000002', 'aal2');
select lives_ok($$update public.withdrawals set status = 'processing' where id = 'd7000000-0000-4000-8000-0000000000d1'$$,
  'manage_finance muda o status do saque (a proteção da S3 deixa passar)');
select pg_temp.como('postgres');
select is((select processed_by from public.withdrawals where id = 'd7000000-0000-4000-8000-0000000000d1'),
  'd7000000-0000-4000-8000-000000000002'::uuid, 'processed_by preenchido com quem processou');
select is(pg_temp.ult($$tabela = 'withdrawals'$$) #>> '{depois,processed_by}', 'd7000000-0000-4000-8000-000000000002', 'trilha do saque traz processed_by');
select is(pg_temp.ult($$tabela = 'withdrawals'$$) #>> '{depois,status}', 'processing', 'trilha do saque traz o status novo');
select pg_temp.como('authenticated', 'd7000000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$update public.withdrawals set processed_by = 'd7000000-0000-4000-8000-000000000001' where id = 'd7000000-0000-4000-8000-0000000000d1'$$,
  '42501', null, 'pelo site, processed_by não se grava sozinho (proteção da S3)');
select throws_ok($$update public.withdrawals set status = 'completed', processed_by = 'd7000000-0000-4000-8000-000000000001' where id = 'd7000000-0000-4000-8000-0000000000d1'$$,
  '42501', null, 'pelo site, não dá para forjar processed_by junto com o status');
select throws_ok($$update public.withdrawals set amount = 1 where id = 'd7000000-0000-4000-8000-0000000000d1'$$,
  '42501', null, 'a proteção da S3 segue valendo para as outras colunas');
select pg_temp.como('postgres');
insert into public.withdrawals (id, producer_id, amount, processed_by) values
  ('d7000000-0000-4000-8000-0000000000d2', 'd7000000-0000-4000-8000-000000000008', 10, 'd7000000-0000-4000-8000-000000000001');
select is((select processed_by from public.withdrawals where id = 'd7000000-0000-4000-8000-0000000000d2'), null::uuid,
  'saque novo nasce sem processed_by');
select pg_temp.como('service_role');
update public.withdrawals set status = 'completed' where id = 'd7000000-0000-4000-8000-0000000000d1';
select pg_temp.como('postgres');
select is((select processed_by from public.withdrawals where id = 'd7000000-0000-4000-8000-0000000000d1'), null::uuid,
  'status mudado sem sessão (service_role): processed_by zera, não fica o admin anterior');

-- I. Exportação -----------------------------------------------------------------------------------------------------------------
select pg_temp.marca();
select pg_temp.como('authenticated', 'd7000000-0000-4000-8000-000000000004', 'aal2');
select throws_ok($$select public.admin_registrar_exportacao('orders', 10, null)$$, '42501', 'Sem permissão para exportar esta área.', 'view_analytics não exporta orders');
select throws_ok($$select public.admin_registrar_exportacao('profiles', 10, null)$$, '42501', null, 'view_analytics não exporta usuários');
select lives_ok($$select public.admin_registrar_exportacao('user_activities', 200, 'relatório mensal')$$, 'view_analytics exporta user_activities');
select pg_temp.como('authenticated', 'd7000000-0000-4000-8000-000000000001', 'aal2');
select lives_ok($$select public.admin_registrar_exportacao('users', 5, null)$$, 'manage_users exporta users');
select throws_ok($$select public.admin_registrar_exportacao('orders', 5, null)$$, '42501', null, 'manage_users não exporta orders');
select throws_ok($$select public.admin_registrar_exportacao('segredos', 5, null)$$, '22023', 'Tabela de exportação desconhecida.', 'tabela fora da lista');
select throws_ok($$select public.admin_registrar_exportacao('users', -1, null)$$, '22023', 'Número de linhas inválido.', 'linhas negativas recusadas');
select pg_temp.como('authenticated', 'd7000000-0000-4000-8000-000000000002', 'aal2');
select lives_ok($$select public.admin_registrar_exportacao('transactions', 3, null)$$, 'manage_finance exporta transactions');
select pg_temp.como('authenticated', 'd7000000-0000-4000-8000-000000000007', 'aal2');
select throws_ok($$select public.admin_registrar_exportacao('events', 1, null)$$, '42501', null, 'quem não é admin não exporta');
select pg_temp.como('anon');
select throws_ok($$select public.admin_registrar_exportacao('events', 1, null)$$, '42501', null, 'anon não executa a RPC');
select pg_temp.como('postgres');
select is(pg_temp.nlog($$acao = 'exportar'$$), 3::bigint, 'só as 3 exportações permitidas entraram na trilha');
select is(pg_temp.ult($$tabela = 'user_activities'$$) ->> 'tipo', 'leitura', 'exportação é do tipo leitura');
select is(pg_temp.ult($$tabela = 'user_activities'$$) #>> '{depois,linhas}', '200', 'exportação guarda o número de linhas');
select is(pg_temp.ult($$tabela = 'user_activities'$$) ->> 'motivo', 'relatório mensal', 'exportação guarda o motivo do argumento');

-- J. Ficha do usuário ---------------------------------------------------------------------------------------------------------------
select pg_temp.marca();
select pg_temp.como('authenticated', 'd7000000-0000-4000-8000-000000000001', 'aal2');
select is(public.admin_usuario_ficha('d7000000-0000-4000-8000-000000000008', 'denúncia 123') #>> '{perfil,full_name}', 'p1',
  'ficha: perfil com o nome do usuário');
select is(jsonb_array_length(public.admin_usuario_ficha('d7000000-0000-4000-8000-000000000008', null) #> '{perfil,producer_subscriptions}'), 1,
  'ficha: perfil traz a assinatura');
select is(jsonb_array_length(public.admin_usuario_ficha('d7000000-0000-4000-8000-000000000009', null) -> 'atividades'), 1, 'ficha: atividades do usuário');
select is(public.admin_usuario_ficha('d7000000-0000-4000-8000-000000000009', null) #>> '{ingressos,0,event_id}', 'd7000000-0000-4000-8000-0000000000e1',
  'ficha: ingressos com event_id');
select throws_ok($$select public.admin_usuario_ficha('d7000000-0000-4000-8000-0000000000ff', null)$$, 'P0001', 'Usuário não encontrado.', 'ficha de quem não existe');
select pg_temp.como('authenticated', 'd7000000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$select public.admin_usuario_ficha('d7000000-0000-4000-8000-000000000008', null)$$, '42501', null, 'sem manage_users, sem ficha');
select pg_temp.como('authenticated', 'd7000000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($$select public.admin_usuario_ficha('d7000000-0000-4000-8000-000000000008', null)$$, '42501', null, 'sem aal2, sem ficha');
select pg_temp.como('postgres');
select is(pg_temp.nlog($$acao = 'ver_ficha'$$), 4::bigint, 'só as 4 leituras que deram certo entraram na trilha');
select is(pg_temp.ult($$acao = 'ver_ficha' and motivo is not null$$) ->> 'motivo', 'denúncia 123', 'ficha guarda o motivo');
select is(pg_temp.ult($$acao = 'ver_ficha'$$) ->> 'autor', 'd7000000-0000-4000-8000-000000000001', 'ficha guarda quem leu');

-- K. Registro por serviço e funções internas fechadas ----------------------------------------------------------------------
select pg_temp.marca();
select pg_temp.como('service_role');
select lives_ok($$select public.audit_registrar_servico('d7000000-0000-4000-8000-000000000001', 'disparar_campanha', 'newsletters', 'n1', '{"destinatarios":120}', 'promo')$$,
  'service_role registra pela RPC de serviço');
select pg_temp.como('authenticated', 'd7000000-0000-4000-8000-000000000006', 'aal2');
select throws_ok($$select public.audit_registrar_servico(null, 'x', 'x')$$, '42501', null, 'authenticated não executa a RPC de serviço');
select throws_ok($$select public.audit_limpar()$$, '42501', null, 'authenticated não executa audit_limpar');
select pg_temp.como('anon');
select throws_ok($$select public.audit_registrar_servico(null, 'x', 'x')$$, '42501', null, 'anon não executa a RPC de serviço');
select pg_temp.como('postgres');
select is(pg_temp.ult($$acao = 'disparar_campanha'$$) ->> 'motivo', 'promo', 'registro de serviço guarda o motivo');
select is(pg_temp.nlog($$acao = 'disparar_campanha'$$), 1::bigint, 'só o registro permitido entrou');

-- L. Limpeza: só apaga o vencido -------------------------------------------------------------------------------------------------
select pg_temp.marca();
insert into public.admin_audit_log (criado_em, tipo, acao, tabela, objeto_id) values
  (now() - interval '3 years', 'acao', 'velha', 't', 'v1'),
  (now() - interval '1 year', 'acao', 'recente', 't', 'v2'),
  (now() - interval '7 months', 'leitura', 'velha', 't', 'v3'),
  (now() - interval '1 month', 'leitura', 'recente', 't', 'v4');
select is(public.audit_limpar(), 2::bigint, 'audit_limpar apagou só as 2 vencidas (acao > 2 anos, leitura > 6 meses)');
select is(pg_temp.nlog($$objeto_id in ('v1', 'v3')$$), 0::bigint, 'as vencidas sumiram');
select is(pg_temp.nlog($$objeto_id in ('v2', 'v4')$$), 2::bigint, 'as dentro do prazo ficaram');
select throws_ok($$delete from public.admin_audit_log where objeto_id = 'v2'$$, '42501', null, 'DELETE direto de linha dentro do prazo segue recusado');
select pg_temp.hdr('');
select lives_ok($$select set_config('evokaa.audit_limpeza', 'on', true)$$, 'chave local ligada à mão');
select throws_ok($$delete from public.admin_audit_log where objeto_id = 'v2'$$, '42501', null, 'mesmo com a chave ligada, linha dentro do prazo não sai');
select ok(exists (select 1 from cron.job where jobname = 'limpar_admin_audit_log' and schedule = '41 3 * * *'), 'limpeza agendada às 03:41');

-- M. view_audit no convite --------------------------------------------------------------------------------------------------------------
select ok(public.convite_permissoes_ok(array['view_audit']), 'convite aceita view_audit');
select ok(public.convite_permissoes_ok(array['manage_team', 'manage_users', 'view_audit']), 'convite: view_audit junto com as outras');
select ok(not public.convite_permissoes_ok(array['super_admin']), 'convite continua recusando super_admin');
select ok(not public.convite_permissoes_ok(array['view_auditoria']), 'convite recusa permissão inventada');

-- N. UPDATE do delete-account: dado pessoal nunca entra (lista de colunas vigiadas) ------------------------------------------
select pg_temp.como('postgres');
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('d7000000-0000-4000-8000-000000000010', 'saida-secreta@teste-s5.local', now(), '{"full_name":"Nome Secreto Saida"}');
update public.profiles set full_name = 'Nome Secreto Saida', phone = '11988887777', cpf = '39053344705', bio = 'bio-secreta',
  city = 'Cidade-Secreta', birth_date = '1990-01-01', instagram = '@insta-secreto', tiktok = '@tik-secreto', linkedin = 'in/lk-secreto',
  website = 'https://site-secreto.example', stripe_customer_id = 'cus_secreto', avatar_url = 'https://img-secreto.example',
  role = 'admin', admin_permissions = array['manage_users']::text[], is_verified = true
  where id = 'd7000000-0000-4000-8000-000000000010';
insert into public.producer_profiles (id, company_name, pix_key, bank_account, cnpj, webhook_url, notification_settings, is_verified) values
  ('d7000000-0000-4000-8000-000000000010', 'Empresa-Secreta', 'pix-secreto-saida', '{"banco":"conta-secreta"}', '12345678000195',
   'https://hook-secreto.example', '{"k":"notif-secreta"}', true);
insert into public.withdrawals (id, producer_id, amount, pix_key, bank_account) values
  ('d7000000-0000-4000-8000-0000000000d3', 'd7000000-0000-4000-8000-000000000010', 5, 'pix-saque-secreto', '{"x":"conta-saque-secreta"}');
select pg_temp.marca();
select pg_temp.como('service_role');
-- os mesmos UPDATE de supabase/functions/delete-account/index.ts (passos profiles, producer_profiles e withdrawals)
update public.profiles set email = 'removido-x@teste-s5.local', full_name = 'Usuário removido', phone = null, cpf = null, avatar_url = null,
  bio = null, city = null, birth_date = null, instagram = null, tiktok = null, linkedin = null, website = null,
  stripe_customer_id = null, role = 'user', admin_permissions = '{}', is_verified = false where id = 'd7000000-0000-4000-8000-000000000010';
update public.producer_profiles set company_name = 'Removido', cnpj = 'REMOVIDO-x', stripe_account_id = null, woovi_account_id = null,
  bank_account = '{}', pix_key = null, webhook_url = null, notification_settings = '{}', is_verified = false
  where id = 'd7000000-0000-4000-8000-000000000010';
update public.withdrawals set pix_key = null, bank_account = '{}' where producer_id = 'd7000000-0000-4000-8000-000000000010';
select pg_temp.como('postgres');
select is(pg_temp.nlog($$tabela = 'profiles'$$), 1::bigint, 'delete-account: profiles grava 1 linha (papel e permissão mudaram)');
select is((select array_agg(k order by k) from jsonb_object_keys(pg_temp.ult($$tabela = 'profiles'$$) -> 'depois') k),
  array['admin_permissions', 'is_verified', 'role'], 'delete-account: só role, admin_permissions e is_verified entram');
select is(pg_temp.nlog($$tabela = 'producer_profiles'$$), 1::bigint, 'delete-account: producer_profiles grava 1 linha');
select is(pg_temp.nlog($$tabela = 'withdrawals'$$), 0::bigint, 'delete-account: limpar Pix do saque (status igual) não grava');
select is((select count(*) from public.admin_audit_log where id > current_setting('test.marca')::bigint
  and (coalesce(antes::text, '') || coalesce(depois::text, '')) ~* 'secret|removido|39053344705|11988887777|1990-01-01|12345678000195|saida'),
  0::bigint, 'delete-account: nenhum e-mail, nome, telefone, CPF, Pix, conta, CNPJ ou webhook em antes/depois');

-- O. INSERT e DELETE seguem a lista de vigiadas (coluna futura e texto livre nunca entram) -------------------------------------
select pg_temp.como('postgres');
alter table public.kb_termos add column teste_futuro text;
select pg_temp.marca();
insert into public.kb_termos (id, forma, normal, teste_futuro) values ('d7000000-0000-4000-8000-0000000000ad', 'formax', 'normalx', 'futuro-secreto');
delete from public.kb_termos where id = 'd7000000-0000-4000-8000-0000000000ad';
select is(pg_temp.nlog($$tabela = 'kb_termos'$$), 2::bigint, 'kb_termos: INSERT e DELETE gravam');
select is(pg_temp.ult($$tabela = 'kb_termos' and acao = 'criar'$$) #>> '{depois,forma}', 'formax', 'INSERT grava a coluna vigiada');
select is(pg_temp.ult($$tabela = 'kb_termos' and acao = 'criar'$$) ->> 'objeto_id', 'd7000000-0000-4000-8000-0000000000ad', 'objeto_id segue com o id');
select is((select count(*) from public.admin_audit_log where id > current_setting('test.marca')::bigint
  and (coalesce(antes::text, '') || coalesce(depois::text, '')) like '%futuro-secreto%'), 0::bigint, 'coluna nova (teste_futuro) não entra em INSERT nem em DELETE');
select pg_temp.marca();
insert into public.affiliate_coupon_requests (id, affiliate_id, discount_percent, valid_days, prospect, reason) values
  ('d7000000-0000-4000-8000-0000000000ae', 'd7000000-0000-4000-8000-0000000000a7', 10, 7, 'prospect-secreto', 'razao-secreta');
delete from public.affiliate_coupon_requests where id = 'd7000000-0000-4000-8000-0000000000ae';
select is(pg_temp.nlog($$tabela = 'affiliate_coupon_requests' and acao = 'excluir'$$), 1::bigint, 'pedido de cupom apagado: grava');
select is((select count(*) from public.admin_audit_log where id > current_setting('test.marca')::bigint
  and (coalesce(antes::text, '') || coalesce(depois::text, '')) ~ 'secret'), 0::bigint, 'pedido de cupom apagado: prospect e reason fora da trilha');
select pg_temp.marca();
insert into public.admin_invites (id, email, cargo, permissions, token_hash) values
  ('d7000000-0000-4000-8000-0000000000af', 'outro@teste-s5.local', 'Cargo-Secreto', array['view_audit']::text[], repeat('cd', 32));
select is((select count(*) from public.admin_audit_log where id > current_setting('test.marca')::bigint
  and (coalesce(antes::text, '') || coalesce(depois::text, '')) ~ 'Secreto|outro@'), 0::bigint, 'convite: cargo e e-mail fora da trilha');

select * from finish();
rollback;
