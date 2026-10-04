-- pgTAP da E2 (docs/sql/20261010_producer_tasks_evento.sql). Só no banco local: `supabase start`, aplicar o SQL da E2
-- e rodar `supabase test db`.
-- Tudo em begin ... rollback: nada fica gravado. Nunca contra produção.
-- pg_temp.como() troca o papel e as claims do JWT como o PostgREST faz, igual a supabase/tests/favoritos.test.sql.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(14);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', p_role, true);
end $f$;
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- Dados (como postgres): p1 e p2 produtores, cada um com um evento; p3 produtor com 2FA
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('fb000000-0000-4000-8000-000000000001', 'p1@teste-tarefas.local', now(), '{"role":"producer","full_name":"Paula"}'),
  ('fb000000-0000-4000-8000-000000000002', 'p2@teste-tarefas.local', now(), '{"role":"producer","full_name":"Pedro"}'),
  ('fb000000-0000-4000-8000-000000000003', 'p3@teste-tarefas.local', now(), '{"role":"producer","full_name":"Paulo"}');
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values ('fb000000-0000-4000-8000-0000000000f3', 'fb000000-0000-4000-8000-000000000003', 'teste', 'totp', 'verified', now(), now());
insert into public.events (id, producer_id, title, slug, status, approval_status) values
  ('fb000000-0000-4000-8000-0000000000e1', 'fb000000-0000-4000-8000-000000000001', 'Do P1', 'tar-e1', 'draft', 'pending'),
  ('fb000000-0000-4000-8000-0000000000e2', 'fb000000-0000-4000-8000-000000000002', 'Do P2', 'tar-e2', 'draft', 'pending');
insert into public.producer_tasks (id, producer_id, event_id, title) values
  ('fb000000-0000-4000-8000-0000000000a3', 'fb000000-0000-4000-8000-000000000003', null, 'Tarefa do P3');

-- Estrutura -------------------------------------------------------------------------------------------------------
select policies_are('public', 'producer_tasks', array['Produtor gerencia tasks', 'gf_mfa_aal2'],
  'producer_tasks: as duas regras esperadas (a de 2FA continua)');
select is((select confdeltype::text from pg_constraint where conname = 'producer_tasks_event_id_fkey'), 'n',
  'producer_tasks_event_id_fkey é ON DELETE SET NULL');

-- P1 -----------------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'fb000000-0000-4000-8000-000000000001');
select lives_ok($$insert into public.producer_tasks (id, producer_id, event_id, title) values
  ('fb000000-0000-4000-8000-0000000000a1', 'fb000000-0000-4000-8000-000000000001', 'fb000000-0000-4000-8000-0000000000e1', 'Tarefa do evento')$$,
  'P1 cria tarefa ligada ao próprio evento');
select lives_ok($$insert into public.producer_tasks (producer_id, event_id, title) values
  ('fb000000-0000-4000-8000-000000000001', null, 'Tarefa solta')$$, 'P1 cria tarefa sem evento');
select throws_ok($$insert into public.producer_tasks (producer_id, event_id, title) values
  ('fb000000-0000-4000-8000-000000000001', 'fb000000-0000-4000-8000-0000000000e2', 'Evento alheio')$$,
  '42501', null, 'P1 não liga tarefa a evento de outro produtor');
select throws_ok($$update public.producer_tasks set event_id = 'fb000000-0000-4000-8000-0000000000e2'
  where id = 'fb000000-0000-4000-8000-0000000000a1'$$, '42501', null, 'P1 não troca a tarefa para evento de outro produtor');
select throws_ok($$insert into public.producer_tasks (producer_id, title) values
  ('fb000000-0000-4000-8000-000000000002', 'Em nome do P2')$$, '42501', null, 'P1 não cria tarefa em nome de P2');
select is((select count(*) from public.producer_tasks), 2::bigint, 'P1 enxerga só as 2 tarefas dele');

-- P2 não vê as do P1 ------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'fb000000-0000-4000-8000-000000000002');
select is((select count(*) from public.producer_tasks), 0::bigint, 'P2 não enxerga tarefa de P1');

-- 2FA: quem tem fator confirmado só enxerga com aal2 (regra gf_mfa_aal2 intacta) -----------------------------------
select pg_temp.como('authenticated', 'fb000000-0000-4000-8000-000000000003', 'aal1');
select is((select count(*) from public.producer_tasks), 0::bigint, 'P3 com 2FA em aal1 não enxerga nada');
select pg_temp.como('authenticated', 'fb000000-0000-4000-8000-000000000003', 'aal2');
select is((select count(*) from public.producer_tasks), 1::bigint, 'P3 com 2FA em aal2 enxerga a tarefa');

-- Apagar o evento deixa a tarefa, sem evento ------------------------------------------------------------------------
select pg_temp.como('postgres');
select lives_ok($$delete from public.events where id = 'fb000000-0000-4000-8000-0000000000e1'$$,
  'o evento com tarefa ligada pode ser apagado');
select is((select event_id from public.producer_tasks where id = 'fb000000-0000-4000-8000-0000000000a1'), null,
  'a tarefa continua, com event_id nulo');
select is((select count(*) from public.producer_tasks where producer_id = 'fb000000-0000-4000-8000-000000000001'), 2::bigint,
  'nenhuma tarefa de P1 foi apagada junto');

select * from finish();
rollback;
