-- pgTAP do Quadro e da Equipe (docs/sql/20261103_equipe_quadro_f01.sql). Só no banco local: `supabase start`, aplicar
-- 20261010, 20261017 e 20261103 e rodar `supabase test db`. Tudo em begin ... rollback: nada fica gravado. Nunca contra produção.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(44);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', p_role, true);
end $f$;
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- Dados (como postgres): p1 e p2 produtores; m1 membro sem ferramenta, m2 ver, m3 editar; x conta solta
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('fc000000-0000-4000-8000-000000000001', 'p1@teste-quadro.local', now(), '{"role":"producer","full_name":"Paula"}'),
  ('fc000000-0000-4000-8000-000000000002', 'p2@teste-quadro.local', now(), '{"role":"producer","full_name":"Pedro"}'),
  ('fc000000-0000-4000-8000-0000000000a1', 'm1@teste-quadro.local', now(), '{"full_name":"Sem ferramenta"}'),
  ('fc000000-0000-4000-8000-0000000000a2', 'm2@teste-quadro.local', now(), '{"full_name":"So ve"}'),
  ('fc000000-0000-4000-8000-0000000000a3', 'm3@teste-quadro.local', now(), '{"full_name":"Edita"}'),
  ('fc000000-0000-4000-8000-0000000000b1', 'x@teste-quadro.local', now(), '{"full_name":"Solta"}');
insert into public.events (id, producer_id, title, slug, status, approval_status) values
  ('fc000000-0000-4000-8000-0000000000e1', 'fc000000-0000-4000-8000-000000000001', 'Do P1', 'qd-e1', 'draft', 'pending'),
  ('fc000000-0000-4000-8000-0000000000e2', 'fc000000-0000-4000-8000-000000000002', 'Do P2', 'qd-e2', 'draft', 'pending');
insert into public.team_members (id, producer_id, user_id, role, accepted_at) values
  ('fc000000-0000-4000-8000-0000000000c1', 'fc000000-0000-4000-8000-000000000001', 'fc000000-0000-4000-8000-0000000000a1', 'editor', now()),
  ('fc000000-0000-4000-8000-0000000000c2', 'fc000000-0000-4000-8000-000000000001', 'fc000000-0000-4000-8000-0000000000a2', 'editor', now()),
  ('fc000000-0000-4000-8000-0000000000c3', 'fc000000-0000-4000-8000-000000000001', 'fc000000-0000-4000-8000-0000000000a3', 'editor', now());
insert into public.team_member_tools (member_id, ferramenta, nivel) values
  ('fc000000-0000-4000-8000-0000000000c2', 'quadro', 'ver'),
  ('fc000000-0000-4000-8000-0000000000c3', 'quadro', 'editar');

-- Tarefas antigas de P1 e P2 (sem quadro: gatilho desligado só para simular o estado de antes do SQL)
alter table public.producer_tasks disable trigger producer_tasks_quadro;
insert into public.producer_tasks (id, producer_id, event_id, title, status, created_at) values
  ('fc000000-0000-4000-8000-0000000000d1', 'fc000000-0000-4000-8000-000000000001', null, 'Antiga A', 'todo', now() - interval '3 days'),
  ('fc000000-0000-4000-8000-0000000000d2', 'fc000000-0000-4000-8000-000000000001', null, 'Antiga B', 'done', now() - interval '2 days'),
  ('fc000000-0000-4000-8000-0000000000d3', 'fc000000-0000-4000-8000-000000000001', 'fc000000-0000-4000-8000-0000000000e1', 'Antiga C', 'in_progress', now() - interval '1 day'),
  ('fc000000-0000-4000-8000-0000000000d4', 'fc000000-0000-4000-8000-000000000002', null, 'Do P2', 'todo', now());
alter table public.producer_tasks enable trigger producer_tasks_quadro;

-- Backfill (o mesmo UPDATE do SQL), duas vezes: o resultado tem de ser idêntico -------------------------------------------
create function pg_temp.backfill() returns void language sql as $$
  update public.producer_tasks t set position = r.pos
    from (select id, row_number() over (partition by producer_id, event_id order by created_at, id) * 1000 as pos
            from public.producer_tasks where board_id is null) r
    where t.id = r.id and t.board_id is null $$;
select pg_temp.backfill();
create temp table _foto1 as select id, board_id, column_id, position, status from public.producer_tasks;
select pg_temp.backfill();
select is((select count(*) from public.producer_tasks), 4::bigint, 'backfill: nenhuma tarefa perdida ou duplicada');
select is((select count(*) from public.producer_tasks where column_id is null or board_id is null), 0::bigint, 'backfill: todas com quadro e coluna');
select is((select count(*) from _foto1 f join public.producer_tasks t using (id)
           where (t.board_id, t.column_id, t.position, t.status) is distinct from (f.board_id, f.column_id, f.position, f.status)),
  0::bigint, 'backfill rodado 2x: mesmo resultado');
select is((select count(*) from public.task_boards where producer_id = 'fc000000-0000-4000-8000-000000000001'), 2::bigint,
  'P1 tem 2 quadros: o da produtora e o do evento');
select is((select c.kind from public.producer_tasks t join public.task_columns c on c.id = t.column_id
           where t.id = 'fc000000-0000-4000-8000-0000000000d2'), 'done', 'tarefa concluída foi para uma coluna done');
select is((select count(*) from public.producer_tasks t join public.task_columns c on c.id = t.column_id
           where t.status is distinct from case c.kind when 'doing' then 'in_progress' else c.kind end), 0::bigint,
  'status igual ao tipo da coluna em todas');

-- Estrutura -----------------------------------------------------------------------------------------------------------------
select policies_are('public', 'producer_tasks', array['gf_mfa_aal2', 'tasks_apagar', 'tasks_criar', 'tasks_editar', 'tasks_ver'],
  'producer_tasks: regras por operação e a de 2FA');
select policies_are('public', 'task_boards', array['gf_mfa_aal2', 'task_boards_ver'], 'task_boards: ver e 2FA');
select policies_are('public', 'task_columns',
  array['gf_mfa_aal2', 'task_columns_apagar', 'task_columns_criar', 'task_columns_editar', 'task_columns_ver'], 'task_columns: regras');
select policies_are('public', 'team_member_tools', array['gf_mfa_aal2', 'team_member_tools_dono'], 'team_member_tools: dono e 2FA');
select is((select count(*) from pg_policies where schemaname = 'public' and policyname = 'gf_mfa_aal2' and permissive = 'RESTRICTIVE'
           and tablename in ('producer_tasks', 'task_boards', 'task_columns', 'team_member_tools')), 4::bigint,
  'gf_mfa_aal2 RESTRICTIVE nas 4 tabelas');
select is((select count(*) from information_schema.role_table_grants where grantee = 'anon'
           and table_name in ('producer_tasks', 'task_boards', 'task_columns', 'team_member_tools')), 0::bigint, 'anon sem privilégio');

create temp table _ids as select board_id from public.producer_tasks where id = 'fc000000-0000-4000-8000-0000000000d1';
grant select on _ids to authenticated;

-- P1 (dono) e P2 ------------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000001');
select is((select count(*) from public.producer_tasks), 3::bigint, 'P1 vê só as 3 tarefas dele');
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000002');
select is((select count(*) from public.producer_tasks), 1::bigint, 'P2 vê só a dele (0 de P1)');
select is((select count(*) from public.task_boards), 1::bigint, 'P2 vê só o quadro dele');
with u as (update public.task_columns set name = 'X' where board_id = (select board_id from _ids) returning 1)
  select is((select count(*) from u), 0::bigint, 'P2 não renomeia coluna de P1 (0 linhas)');

-- M1: membro sem ferramenta --------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-0000000000a1');
select is((select count(*) from public.producer_tasks), 0::bigint, 'M1 (sem ferramenta) lê 0 tarefas');
select is((select count(*) from public.task_boards), 0::bigint, 'M1 lê 0 quadros');

-- M2: ver ---------------------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-0000000000a2');
select is((select count(*) from public.producer_tasks), 3::bigint, 'M2 (ver) lê as 3 tarefas de P1');
select is((select count(*) from public.task_columns), 8::bigint, 'M2 lê as 8 colunas dos 2 quadros de P1');
with u as (update public.producer_tasks set title = 'Mudou' returning 1) select is((select count(*) from u), 0::bigint, 'M2 (ver): UPDATE afeta 0 linhas');
select throws_ok($$insert into public.producer_tasks (producer_id, title) values ('fc000000-0000-4000-8000-000000000001', 'M2 criou')$$,
  '42501', null, 'M2 (ver) não cria tarefa');

-- M3: editar ------------------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-0000000000a3');
select lives_ok($$insert into public.producer_tasks (producer_id, title) values
  ('fc000000-0000-4000-8000-000000000001', 'M3 criou')$$, 'M3 (editar) cria tarefa no quadro de P1');
select pg_temp.como('postgres');
create temp table _novo as select id from public.producer_tasks where title = 'M3 criou';
grant select on _novo to authenticated;
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-0000000000a3');
select is((select created_by from public.producer_tasks where id = (select id from _novo)),
  'fc000000-0000-4000-8000-0000000000a3'::uuid, 'created_by gravado pelo gatilho');
select lives_ok($$update public.producer_tasks set column_id = (select c.id from public.task_columns c join public.producer_tasks t on t.board_id = c.board_id
  where t.id = (select id from _novo) and c.name = 'Em andamento'), position = 500
  where id = (select id from _novo)$$, 'M3 move o cartão para Em andamento');
select is((select status from public.producer_tasks where id = (select id from _novo)), 'in_progress',
  'mover para doing grava in_progress');
with d as (delete from public.producer_tasks where id = (select id from _novo) returning 1)
  select is((select count(*) from d), 0::bigint, 'M3 não apaga tarefa (só o dono apaga)');
select is((select count(*) from public.team_member_tools), 0::bigint, 'M3 não lê as permissões da equipe');
select throws_ok($$update public.producer_tasks set assigned_to = 'fc000000-0000-4000-8000-0000000000b1'
  where id = (select id from _novo)$$, '42501', null, 'responsável fora da equipe é recusado');
select lives_ok($$update public.producer_tasks set assigned_to = 'fc000000-0000-4000-8000-0000000000a2'
  where id = (select id from _novo)$$, 'responsável membro (M2) é aceito');
select lives_ok($$update public.producer_tasks set assigned_to = 'fc000000-0000-4000-8000-000000000001'
  where id = (select id from _novo)$$, 'responsável dono é aceito');
select is(public.equipe_pode('fc000000-0000-4000-8000-000000000001', 'quadro', 'editar', 'fc000000-0000-4000-8000-0000000000a2'),
  false, 'M3 (editor) pergunta por M2: responde sem vazar (M2 só vê)');
select throws_ok($$update public.producer_tasks set board_id = (select id from public.task_boards limit 1)
  where id = (select id from _novo)$$, '42501', null, 'board_id não é gravável no UPDATE (permissão por coluna)');

-- P1: gatilho --------------------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000001');
select lives_ok($$update public.producer_tasks set status = 'done' where id = 'fc000000-0000-4000-8000-0000000000d1'$$,
  'tela antiga: UPDATE só do status');
select is((select c.name from public.producer_tasks t join public.task_columns c on c.id = t.column_id
           where t.id = 'fc000000-0000-4000-8000-0000000000d1'), 'Feito', 'status done levou à coluna Feito');
select throws_ok($$insert into public.producer_tasks (producer_id, event_id, title) values
  ('fc000000-0000-4000-8000-000000000001', 'fc000000-0000-4000-8000-0000000000e2', 'Evento alheio')$$,
  '42501', null, 'evento de outro produtor é recusado pelo gatilho');
select throws_ok($$update public.producer_tasks set column_id = (select c.id from public.task_columns c
  join public.task_boards b on b.id = c.board_id where b.event_id is not null and c.name = 'Feito' limit 1)
  where id = 'fc000000-0000-4000-8000-0000000000d1'$$, '42501', null, 'coluna de outro quadro é recusada');
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000002');
select throws_ok($$insert into public.producer_tasks (producer_id, title, board_id) values
  ('fc000000-0000-4000-8000-000000000002', 'Invasor', (select board_id from _ids))$$,
  null, null, 'P2 não grava em quadro de P1');
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-000000000001');
select is((select count(*) from public.team_member_tools), 2::bigint, 'P1 lê as permissões da própria equipe');

-- Membro bloqueado e 2FA --------------------------------------------------------------------------------------------------------
select pg_temp.como('postgres');
update public.team_members set blocked_at = now() where id = 'fc000000-0000-4000-8000-0000000000c3';
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-0000000000a3');
select is((select count(*) from public.producer_tasks), 0::bigint, 'M3 bloqueado lê 0');
select pg_temp.como('postgres');
update public.team_members set blocked_at = null where id = 'fc000000-0000-4000-8000-0000000000c3';
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values ('fc000000-0000-4000-8000-0000000000f3', 'fc000000-0000-4000-8000-0000000000a3', 'teste', 'totp', 'verified', now(), now());
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-0000000000a3', 'aal1');
select is((select count(*) from public.producer_tasks), 0::bigint, 'M3 com 2FA em aal1 é barrado');
select pg_temp.como('authenticated', 'fc000000-0000-4000-8000-0000000000a3', 'aal2');
select is((select count(*) from public.producer_tasks), 4::bigint, 'M3 com 2FA em aal2 lê');

-- Apagar evento: tarefas voltam ao quadro da produtora ---------------------------------------------------------------------------
select pg_temp.como('postgres');
select lives_ok($$delete from public.events where id = 'fc000000-0000-4000-8000-0000000000e1'$$, 'evento com tarefas pode ser apagado');
select is((select count(*) from public.producer_tasks t join public.task_boards b on b.id = t.board_id
           where t.producer_id = 'fc000000-0000-4000-8000-000000000001' and b.event_id is null), 4::bigint,
  'as 4 tarefas de P1 estão no quadro da produtora');

select * from finish();
rollback;
