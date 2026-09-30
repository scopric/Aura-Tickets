-- PR 6 do plano de segurança: menor privilégio no banco (30/09/2026).
-- Tira do visitante anônimo o que ele não usa, fecha TRUNCATE para os papéis da API, fixa o
-- search_path que faltava e apaga duas colunas legadas que ninguém lê.
--
-- ORDEM DE APLICAÇÃO (obrigatória):
--   1. Publicar a Edge Function `delete-account` deste PR ANTES de rodar este SQL. A versão atual grava
--      `api_key: null` em producer_profiles; sem a coluna, a exclusão de conta de produtor falha no passo 2.
--   2. Colar este arquivo inteiro no SQL Editor (uma transação: se a conferência do fim falhar, nada é gravado).
--   3. Conferir: bloco "Conferência" do fim já roda sozinho; depois o Security Advisor.
-- Idempotente. Rodar de novo depois de reaplicar docs/sql/20260927_security_hardening.sql: ele volta a dar
-- EXECUTE de gf_is_admin a anon e recria gf_tasks_owner sem "to" (vale para anon).
--
-- DECISÕES
-- 1. Regras que chamam gf_is_admin() e valiam para todos os papéis (sem "to" = public). Tirar o EXECUTE de
--    anon faz toda consulta anônima nessas tabelas dar "permission denied for function gf_is_admin" (testado no
--    banco local com tasks). As 14 abaixo só deixam passar admin ou o dono (auth.uid() = coluna); anônimo tem
--    uid nulo e nunca passou por nenhuma. Decisão a) para todas: passam a valer só para authenticated. Nada
--    muda para ninguém; anônimo continua lendo cursos, eventos aprovados e platform_settings públicos pelas
--    regras próprias dele ("Cursos publicos", gf_academy_read, "Eventos públicos ou do produtor",
--    gf_platform_settings_public_read).
--      academy_courses.gf_academy_admin_write, contact_messages.gf_contact_admin_read,
--      customers.gf_customers_owner, event_banners.gf_event_banners_all, event_budget_boxes.gf_budget_boxes_all,
--      event_photos.gf_event_photos_all, event_surveys.gf_event_surveys_owner,
--      event_timeline_items.gf_event_timeline_all, event_zones.gf_event_zones_owner,
--      piggy_transactions.gf_piggy_tx_owner, support_sessions.gf_support_sessions_owner, tasks.gf_tasks_owner,
--      user_custom_features.gf_custom_features_admin_write, user_custom_features.gf_custom_features_read.
--    Os gatilhos gf_protect_affiliate_link e gf_protect_producer_profile_privileges também chamam gf_is_admin
--    com o papel de quem escreve; anônimo não escreve em affiliate_links nem em producer_profiles, e o
--    affiliate_link_hit (clique de visitante) é SECURITY DEFINER: roda como dono. Testado.
-- 2. handle_new_user (gatilho de auth.users) e rls_auto_enable (gatilho de evento): sem EXECUTE para public,
--    anon e authenticated. O Postgres não confere EXECUTE de quem dispara o gatilho: o cadastro segue criando
--    o perfil e tabela nova segue nascendo com RLS e gf_mfa_aal2 (testado no banco local).
--    affiliate_link_hit fica aberto a anon de propósito: é o contador de clique do visitante do link de afiliado.
-- 3. handle_updated_at sem search_path fixo: o corpo só usa NOW() (pg_catalog, que vale mesmo com search_path
--    vazio), então basta fixar.
-- 4. TRUNCATE: nenhuma função do banco e nenhum código do app usa (no app, "truncate" é só classe CSS).
--    O "alter default privileges" vale para tabelas criadas pelo papel que roda este SQL (postgres no SQL Editor).
-- 5. is_authorized NÃO entra no gatilho de profiles: a coluna não existe na produção (baseline de 30/09;
--    erro 2.3 de "Erros que não se repetem"). Citar new.is_authorized quebraria toda edição de perfil.
-- 6. events.password: 0 linhas com valor (produção, 30/09); nada no app nem nas Edge Functions lê ou grava
--    (só aparece no tipo DbEvent e nos eventos de exemplo do front); nenhuma view, materialized view ou função
--    depende da coluna (pg_depend e corpos conferidos no banco local). Apagada.
-- 7. producer_profiles.api_key: sem API para produtor (Decisão 37); só o delete-account gravava null. Apagada.
begin;

-- 1. Regras com gf_is_admin só para usuários logados
alter policy gf_academy_admin_write on public.academy_courses to authenticated;
alter policy gf_contact_admin_read on public.contact_messages to authenticated;
alter policy gf_customers_owner on public.customers to authenticated;
alter policy gf_event_banners_all on public.event_banners to authenticated;
alter policy gf_budget_boxes_all on public.event_budget_boxes to authenticated;
alter policy gf_event_photos_all on public.event_photos to authenticated;
alter policy gf_event_surveys_owner on public.event_surveys to authenticated;
alter policy gf_event_timeline_all on public.event_timeline_items to authenticated;
alter policy gf_event_zones_owner on public.event_zones to authenticated;
alter policy gf_piggy_tx_owner on public.piggy_transactions to authenticated;
alter policy gf_support_sessions_owner on public.support_sessions to authenticated;
alter policy gf_tasks_owner on public.tasks to authenticated;
alter policy gf_custom_features_admin_write on public.user_custom_features to authenticated;
alter policy gf_custom_features_read on public.user_custom_features to authenticated;

-- 2. Funções
revoke execute on function public.gf_is_admin() from public, anon;
grant execute on function public.gf_is_admin() to authenticated, service_role;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 3. search_path fixo
alter function public.handle_updated_at() set search_path = '';

-- 4. TRUNCATE fora da API
revoke truncate on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate on tables from anon, authenticated;

-- 6 e 7. Colunas legadas
alter table public.events drop column if exists password;
alter table public.producer_profiles drop column if exists api_key;

-- Conferência obrigatória: se algo faltar, nada deste arquivo é gravado.
do $$
begin
  if has_function_privilege('anon', 'public.gf_is_admin()', 'execute')
     or not has_function_privilege('authenticated', 'public.gf_is_admin()', 'execute') then
    raise exception 'gf_is_admin: anon ainda executa ou authenticated perdeu';
  end if;
  if has_function_privilege('authenticated', 'public.handle_new_user()', 'execute')
     or has_function_privilege('anon', 'public.handle_new_user()', 'execute')
     or has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute')
     or has_function_privilege('anon', 'public.rls_auto_enable()', 'execute') then
    raise exception 'handle_new_user/rls_auto_enable ainda executáveis pela API';
  end if;
  -- nenhuma regra que chama gf_is_admin pode valer para anon (senão a consulta anônima dá erro)
  if exists (select 1 from pg_policies
             where schemaname in ('public', 'storage') and roles && array['public', 'anon']::name[]
               and (coalesce(qual, '') || coalesce(with_check, '')) like '%gf_is_admin%') then
    raise exception 'há regra com gf_is_admin valendo para anon: conferir antes de aplicar';
  end if;
  if not exists (select 1 from pg_proc where oid = 'public.handle_updated_at'::regproc
                 and proconfig @> array['search_path=""']) then
    raise exception 'handle_updated_at sem search_path fixo';
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
               and (has_table_privilege('anon', c.oid, 'truncate')
                    or has_table_privilege('authenticated', c.oid, 'truncate'))) then
    raise exception 'ainda há tabela com TRUNCATE para anon/authenticated';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
             and ((table_name = 'events' and column_name = 'password')
                  or (table_name = 'producer_profiles' and column_name = 'api_key'))) then
    raise exception 'coluna legada ainda existe';
  end if;
end;
$$;

commit;

-- Desfazer (colunas voltam vazias; o valor apagado não volta, e era nulo):
-- begin;
-- alter table public.events add column if not exists password text;
-- alter table public.producer_profiles add column if not exists api_key text;
-- grant truncate on all tables in schema public to anon, authenticated;
-- alter default privileges in schema public grant truncate on tables to anon, authenticated;
-- alter function public.handle_updated_at() reset search_path;
-- grant execute on function public.gf_is_admin(), public.handle_new_user(), public.rls_auto_enable() to public, anon, authenticated;
-- alter policy gf_academy_admin_write on public.academy_courses to public;  -- e as outras 13 do item 1
-- commit;

-- =============================================================================
-- TESTES (rodar à mão num banco local ou descartável, NUNCA em produção: tire o "-- " do começo das linhas
-- abaixo e rode tudo de uma vez; está num begin … rollback e não deixa nada gravado). Rodados em 30/09/2026
-- no `supabase start` do repositório (baseline de produção 20260930134600), com este arquivo aplicado duas
-- vezes. Cada teste termina com "NOTICE: Tn OK"; falha = ERROR com o que deu errado. pg_temp.como() troca
-- o papel da sessão E as claims do JWT, como o PostgREST.
-- =============================================================================
-- begin;
-- create function pg_temp.como(p_role text, p uuid default null) returns void language plpgsql as $f$
-- begin
--   perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
--     'role', p_role, 'sub', p, 'aal', case when p is not null then 'aal1' end))::text end, true);
--   perform set_config('role', p_role, true);
-- end $f$;
-- create function pg_temp.erro(q text) returns text language plpgsql as $f$
-- begin execute q; return 'ok'; exception when others then return sqlstate || ' ' || sqlerrm; end $f$;
--
-- -- T0. Dados: evento aprovado e rascunho, curso, settings pública e privada, link de afiliado.
-- --     O cadastro em auth.users já testa o gatilho handle_new_user (sem EXECUTE para a API).
-- insert into auth.users (id, email, raw_user_meta_data) values
--   ('5e600000-0000-4000-8000-000000000001', 'produtor@teste-seg6.evokaa.invalid', '{"role":"producer"}'),
--   ('5e600000-0000-4000-8000-000000000002', 'admin@teste-seg6.evokaa.invalid', '{}');
-- do $t$ begin
--   assert (select count(*) from public.profiles where id in ('5e600000-0000-4000-8000-000000000001',
--     '5e600000-0000-4000-8000-000000000002')) = 2, 'cadastro em auth.users não criou o perfil';
--   assert (select role from public.profiles where id = '5e600000-0000-4000-8000-000000000001') = 'producer', 'papel do cadastro';
--   raise notice 'T0 OK: auth.users cria o perfil (handle_new_user sem EXECUTE da API)';
-- end $t$;
-- update public.profiles set role = 'admin', admin_permissions = '{super_admin}' where id = '5e600000-0000-4000-8000-000000000002';
-- insert into public.events (id, producer_id, title, slug, status, approval_status, updated_at) values
--   ('5e600000-0000-4000-8000-000000000101', '5e600000-0000-4000-8000-000000000001', 'Aprovado', 'seg6-a', 'published', 'approved', '2000-01-01'),
--   ('5e600000-0000-4000-8000-000000000102', '5e600000-0000-4000-8000-000000000001', 'Rascunho', 'seg6-b', 'draft', 'pending', '2000-01-01');
-- insert into public.academy_courses (title) values ('Curso seg6');
-- insert into public.platform_settings (key, value) values ('general', '{}'), ('seg6_privada', '{}') on conflict (key) do nothing;
-- insert into public.tasks (title, event_id) values ('Tarefa seg6', '5e600000-0000-4000-8000-000000000101');
-- insert into public.platform_affiliates (id, user_id, referral_code, status, recurring_percent)
--   values ('5e600000-0000-4000-8000-000000000201', '5e600000-0000-4000-8000-000000000001', 'SEG6', 'active', 15);
-- insert into public.affiliate_links (affiliate_id, slug, is_active) values ('5e600000-0000-4000-8000-000000000201', 'seg6', true);
--
-- -- T1. Anônimo: não executa gf_is_admin; lê o que lia; tabelas com regra de admin/dono dão 0 linhas, sem erro.
-- do $t$ begin
--   perform pg_temp.como('anon');
--   assert pg_temp.erro('select public.gf_is_admin()') like '42501%', 'anon ainda executa gf_is_admin';
--   assert (select count(*) from public.events where slug like 'seg6-%') = 1, 'anon não lê só o evento aprovado';
--   assert (select count(*) from public.academy_courses where title = 'Curso seg6') = 1, 'anon não lê cursos';
--   assert (select count(*) from public.platform_settings where key in ('general', 'seg6_privada')) = 1, 'anon e platform_settings';
--   assert (select count(*) from public.tasks) = 0, 'anon lê tasks';
--   assert pg_temp.erro('select count(*) from public.contact_messages') = 'ok', 'anon: erro em contact_messages';
--   assert pg_temp.erro('select count(*) from public.user_custom_features') = 'ok', 'anon: erro em user_custom_features';
--   assert pg_temp.erro('select public.affiliate_link_hit(''SEG6'', ''seg6'')') = 'ok', 'clique de afiliado falhou';
--   perform pg_temp.como('postgres');
--   assert (select clicks from public.affiliate_links where slug = 'seg6') = 1, 'clique não contou';
--   raise notice 'T1 OK: anon sem gf_is_admin, leituras públicas e clique de afiliado intactos';
-- end $t$;
--
-- -- T2. Logado: produtor vê as próprias tarefas, admin vê tudo; TRUNCATE barrado.
-- do $t$ begin
--   perform pg_temp.como('authenticated', '5e600000-0000-4000-8000-000000000001');
--   assert (select count(*) from public.tasks where title = 'Tarefa seg6') = 1, 'produtor não vê a própria tarefa';
--   assert (select count(*) from public.events where slug like 'seg6-%') = 2, 'produtor não vê o rascunho';
--   assert pg_temp.erro('truncate public.events') like '42501%', 'authenticated ainda trunca events';
--   perform pg_temp.como('authenticated', '5e600000-0000-4000-8000-000000000002');
--   assert public.gf_is_admin(), 'admin perdeu gf_is_admin';
--   assert (select count(*) from public.tasks where title = 'Tarefa seg6') = 1, 'admin não vê a tarefa';
--   perform pg_temp.como('anon');
--   assert pg_temp.erro('truncate public.events') like '42501%', 'anon ainda trunca events';
--   perform pg_temp.como('postgres');
--   raise notice 'T2 OK: regras de dono/admin seguem para logados; TRUNCATE barrado';
-- end $t$;
--
-- -- T3. Tabela nova nasce com RLS e gf_mfa_aal2 (rls_auto_enable sem EXECUTE da API); updated_at segue.
-- create table public.seg6_teste (id int);
-- do $t$ begin
--   assert (select relrowsecurity from pg_class where oid = 'public.seg6_teste'::regclass), 'tabela nova sem RLS';
--   assert exists (select 1 from pg_policies where tablename = 'seg6_teste' and policyname = 'gf_mfa_aal2'), 'tabela nova sem gf_mfa_aal2';
--   perform pg_temp.como('authenticated', '5e600000-0000-4000-8000-000000000001');
--   update public.events set title = 'Aprovado 2' where id = '5e600000-0000-4000-8000-000000000101';
--   perform pg_temp.como('postgres');
--   assert (select updated_at = now() from public.events where id = '5e600000-0000-4000-8000-000000000101'), 'updated_at parou';
--   raise notice 'T3 OK: tabela nova com RLS e gf_mfa_aal2; handle_updated_at funciona com search_path vazio';
-- end $t$;
-- rollback;
