-- pgTAP da fatia 2C do Quadro (docs/sql/20261107_quadro_f2c_botoes_modelos.sql): papéis, botões, modelos, recorrência, checklist que move.
-- Só no banco local: aplicar 20261017_team_members_rls, 20261103, 20261105, 20261106 e 20261107 e rodar `supabase test db`.
-- Tudo em begin ... rollback: nada fica gravado. Nunca contra produção. Sem pg_cron local, o cron é chamado direto (função interna).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(306);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  -- 'postgres' = o papel da sessão (postgres ou supabase_admin, dono das tabelas): o teste vale para os dois
  if p_role = 'postgres' then execute 'reset role'; else perform set_config('role', p_role, true); end if;
end $f$;
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated;
-- atalho para os ids fixos: i('a2') = ff000000-0000-4000-8000-0000000000a2
create function pg_temp.i(p text) returns uuid language sql immutable as $f$
  select ('ff000000-0000-4000-8000-' || lpad(p, 12, '0'))::uuid $f$;
grant execute on function pg_temp.i(text) to anon, authenticated;
-- hoje em São Paulo, quadro do evento (e1) e da produtora, coluna pelo nome
create function pg_temp.hoje() returns date language sql stable as $f$ select (now() at time zone 'America/Sao_Paulo')::date $f$;
create function pg_temp.dia(p timestamptz) returns date language sql immutable as $f$ select (p at time zone 'America/Sao_Paulo')::date $f$;
create function pg_temp.bE() returns uuid language sql stable as $f$
  select id from public.task_boards where producer_id = pg_temp.i('01') and event_id = pg_temp.i('e1') $f$;
create function pg_temp.bP() returns uuid language sql stable as $f$
  select id from public.task_boards where producer_id = pg_temp.i('01') and event_id is null $f$;
create function pg_temp.col(p_b uuid, p_n text) returns uuid language sql stable as $f$
  select id from public.task_columns where board_id = p_b and name = p_n $f$;
grant execute on function pg_temp.hoje(), pg_temp.dia(timestamptz), pg_temp.bE(), pg_temp.bP(), pg_temp.col(uuid, text) to anon, authenticated;
do $g$ declare r record; begin
  for r in select p.oid::regprocedure as f from pg_proc p join pg_depend d on d.objid = p.oid and d.deptype = 'e'
           join pg_extension e on e.oid = d.refobjid where e.extname = 'pgtap' loop
    begin execute 'grant execute on function ' || r.f || ' to anon, authenticated';
    exception when others then null; end;
  end loop;
end $g$;

-- Dados (como postgres): p1 dono; p2 outro produtor; mv membro 'ver'; me membro 'editar'; mb bloqueado; mp membro sem quadro; x conta solta
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  (pg_temp.i('01'), 'p1@teste-f2c.local', now(), '{"role":"producer","full_name":"Paula"}'),
  (pg_temp.i('02'), 'p2@teste-f2c.local', now(), '{"role":"producer","full_name":"Pedro"}'),
  (pg_temp.i('a2'), 'mv@teste-f2c.local', now(), '{"full_name":"So ve"}'),
  (pg_temp.i('a3'), 'me@teste-f2c.local', now(), '{"full_name":"Edita"}'),
  (pg_temp.i('a4'), 'mb@teste-f2c.local', now(), '{"full_name":"Bloqueado"}'),
  (pg_temp.i('a5'), 'mp@teste-f2c.local', now(), '{"full_name":"Sem quadro"}'),
  (pg_temp.i('b1'), 'x@teste-f2c.local', now(), '{"full_name":"Solta"}');
insert into public.events (id, producer_id, title, slug, status, approval_status, date) values
  (pg_temp.i('e1'), pg_temp.i('01'), 'Do P1', 'f2c-e1', 'draft', 'pending', pg_temp.hoje() + 30),
  (pg_temp.i('e2'), pg_temp.i('01'), 'Passado', 'f2c-e2', 'draft', 'pending', pg_temp.hoje() - 10),
  (pg_temp.i('e9'), pg_temp.i('02'), 'Do P2', 'f2c-e9', 'draft', 'pending', pg_temp.hoje() + 30);
insert into public.team_members (id, producer_id, user_id, role, accepted_at, blocked_at) values
  (pg_temp.i('c2'), pg_temp.i('01'), pg_temp.i('a2'), 'editor', now(), null),
  (pg_temp.i('c3'), pg_temp.i('01'), pg_temp.i('a3'), 'editor', now(), null),
  (pg_temp.i('c4'), pg_temp.i('01'), pg_temp.i('a4'), 'editor', now(), now()),
  (pg_temp.i('c5'), pg_temp.i('01'), pg_temp.i('a5'), 'editor', now(), null);
insert into public.team_member_tools (member_id, ferramenta, nivel) values
  (pg_temp.i('c2'), 'quadro', 'ver'), (pg_temp.i('c3'), 'quadro', 'editar'), (pg_temp.i('c4'), 'quadro', 'editar');
select public.quadro_criar_interno(pg_temp.i('01'), pg_temp.i('e1'));
select public.quadro_criar_interno(pg_temp.i('01'), null);
select public.quadro_criar_interno(pg_temp.i('01'), pg_temp.i('e2'));
select public.quadro_criar_interno(pg_temp.i('02'), pg_temp.i('e9'));
-- cartões: c1..c5 em "A fazer" do evento; c6 e c7 em "Feito"; d9 do outro produtor; dP no quadro da produtora
insert into public.producer_tasks (id, producer_id, event_id, title) values
  (pg_temp.i('d1'), pg_temp.i('01'), pg_temp.i('e1'), 'c1'), (pg_temp.i('d2'), pg_temp.i('01'), pg_temp.i('e1'), 'c2'),
  (pg_temp.i('d3'), pg_temp.i('01'), pg_temp.i('e1'), 'c3'), (pg_temp.i('d4'), pg_temp.i('01'), pg_temp.i('e1'), 'c4'),
  (pg_temp.i('d5'), pg_temp.i('01'), pg_temp.i('e1'), 'c5'), (pg_temp.i('dd'), pg_temp.i('01'), null, 'dP'),
  (pg_temp.i('d9'), pg_temp.i('02'), pg_temp.i('e9'), 'Z');
insert into public.producer_tasks (id, producer_id, event_id, title, board_id, column_id) values
  (pg_temp.i('d6'), pg_temp.i('01'), pg_temp.i('e1'), 'c6', pg_temp.bE(), pg_temp.col(pg_temp.bE(), 'Feito')),
  (pg_temp.i('d7'), pg_temp.i('01'), pg_temp.i('e1'), 'c7', pg_temp.bE(), pg_temp.col(pg_temp.bE(), 'Feito'));
insert into public.task_labels (id, board_id, name, color) values
  (pg_temp.i('1a'), pg_temp.bE(), 'Etiqueta', '#112233'), (pg_temp.i('1b'), pg_temp.bP(), 'Do outro quadro', '#445566');

-- Estrutura ----------------------------------------------------------------------------------------------------------------------
select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'task\_%' and not c.relrowsecurity), 0::bigint, 'toda tabela task_* tem RLS ligada');
select policies_are('public', 'task_roles', array['gf_mfa_aal2', 'task_roles_apagar', 'task_roles_criar', 'task_roles_editar', 'task_roles_ver'], 'task_roles: regras por operação e 2FA');
select policies_are('public', 'task_buttons', array['gf_mfa_aal2', 'task_buttons_apagar', 'task_buttons_criar', 'task_buttons_editar', 'task_buttons_ver'], 'task_buttons: regras por operação e 2FA');
select policies_are('public', 'task_templates', array['gf_mfa_aal2', 'task_templates_ver'], 'task_templates: só ver e 2FA');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename in ('task_roles', 'task_buttons', 'task_templates')
           and policyname = 'gf_mfa_aal2' and permissive = 'RESTRICTIVE'), 3::bigint, 'gf_mfa_aal2 restritiva nas 3 tabelas');
select is((select count(*) from information_schema.role_table_grants where grantee in ('anon', 'public') and table_schema = 'public'
           and table_name like 'task\_%'), 0::bigint, 'anon sem privilégio em tabela task_*');
select is((select count(*) from information_schema.columns where table_schema = 'public'
           and (table_name like 'task\_%' or table_name = 'producer_tasks') and column_name ~* '(^|_)ip(_|$)'), 0::bigint, 'nenhuma coluna de IP nas tabelas do quadro (LGPD)');
select is(bool_and(has_function_privilege('authenticated', f, 'execute') and not has_function_privilege('anon', f, 'execute')), true,
  'funções públicas: authenticated executa, anon não')
  from unnest(array['public.quadro_rodar_botao(uuid, uuid)', 'public.quadro_aplicar_modelo(uuid, text, int[])', 'public.quadro_gerar_recorrente(uuid)',
                    'public.quadro_papeis_sugerir(uuid)', 'public.quadro_steps_ok(jsonb)']) f;
select is(bool_or(has_function_privilege('authenticated', f, 'execute') or has_function_privilege('anon', f, 'execute')), false,
  'funções internas e de gatilho: nem authenticated nem anon executam')
  from unnest(array['public.quadro_gerar_recorrentes_vencidas()', 'public.quadro_gerar_recorrente_interno(uuid)', 'public.quadro_tem_ferramenta(uuid, uuid)',
                    'public.task_roles_tg()', 'public.task_buttons_tg()', 'public.producer_tasks_rec_tg()', 'public.task_checklist_items_ckmove_tg()',
                    'public.task_columns_review_tg()', 'public.task_boards_review_tg()']) f;
select is(has_any_column_privilege('authenticated', 'public.task_templates', 'insert,update') or has_table_privilege('authenticated', 'public.task_templates', 'delete'),
  false, 'authenticated não grava em task_templates');
select is((select count(*) from public.task_templates), 4::bigint, '4 modelos semeados');
select is((select sum(jsonb_array_length(items)) from public.task_templates), 29::bigint, 'os 4 modelos têm 9 + 6 + 6 + 8 itens do v9');
select is((select items -> 0 ->> 'titulo' from public.task_templates where key = 'show'), 'Contratar som, luz e palco', 'primeiro item do modelo Show é o do v9');
select is((select items -> 4 ->> 'papel' from public.task_templates where key = 'congresso'), 'fornecedores', 'papel é um slug');
select is((select review_column_id from public.task_boards where id = pg_temp.bE()), pg_temp.col(pg_temp.bE(), 'Em revisão'),
  'quadro novo ganha review_column_id = "Em revisão" pelo gatilho de task_columns');

-- Anon ---------------------------------------------------------------------------------------------------------------------------------
select pg_temp.como('anon');
select throws_ok('select count(*) from public.task_roles', '42501', null, 'anon não lê task_roles');
select throws_ok('select count(*) from public.task_buttons', '42501', null, 'anon não lê task_buttons');
select throws_ok('select count(*) from public.task_templates', '42501', null, 'anon não lê task_templates');
select throws_ok($$select public.quadro_rodar_botao(pg_temp.i('b1'))$$, '42501', null, 'anon não chama quadro_rodar_botao');
select throws_ok($$select public.quadro_aplicar_modelo(pg_temp.bE(), 'show')$$, '42501', null, 'anon não chama quadro_aplicar_modelo');
select throws_ok($$select public.quadro_gerar_recorrente(pg_temp.i('d1'))$$, '42501', null, 'anon não chama quadro_gerar_recorrente');
select throws_ok($$select public.quadro_papeis_sugerir(pg_temp.bE())$$, '42501', null, 'anon não chama quadro_papeis_sugerir');
select throws_ok($$select public.quadro_gerar_recorrentes_vencidas()$$, '42501', null, 'anon não chama a função do cron');

-- Papéis (task_roles) ----------------------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$insert into public.task_roles (board_id, papel, user_id) values (pg_temp.bE(), 'financeiro', pg_temp.i('a3'))$$, 'editor define quem é o financeiro');
select lives_ok($$insert into public.task_roles (board_id, papel, user_id) values (pg_temp.bE(), 'revisao', pg_temp.i('a2'))$$, 'editor define o revisor (membro ''ver'')');
select lives_ok($$insert into public.task_roles (board_id, papel, user_id) values (pg_temp.bE(), 'juridico', pg_temp.i('01'))$$, 'o dono também pode ser um papel');
select throws_ok($$insert into public.task_roles (board_id, papel, user_id) values (pg_temp.bE(), 'portaria', pg_temp.i('a5'))$$, '23514',
  'Essa pessoa não tem acesso ao quadro deste produtor.', 'membro sem a ferramenta quadro não vira papel');
select throws_ok($$insert into public.task_roles (board_id, papel, user_id) values (pg_temp.bE(), 'portaria', pg_temp.i('a4'))$$, '23514', null, 'membro bloqueado não vira papel');
select throws_ok($$insert into public.task_roles (board_id, papel, user_id) values (pg_temp.bE(), 'portaria', pg_temp.i('02'))$$, '23514', null, 'outro produtor não vira papel');
select throws_ok($$insert into public.task_roles (board_id, papel, user_id) values (pg_temp.bE(), 'portaria', pg_temp.i('b1'))$$, '23514', null, 'conta solta não vira papel');
select throws_ok($$insert into public.task_roles (board_id, papel, user_id) values (pg_temp.bE(), 'chefe', pg_temp.i('a3'))$$, '23514', null, 'papel inventado é recusado');
select throws_ok($$insert into public.task_roles (board_id, papel, user_id) values (pg_temp.bE(), 'financeiro', pg_temp.i('a2'))$$, '23505', null, 'um papel tem uma pessoa só (chave do quadro + papel)');
select lives_ok($$update public.task_roles set user_id = pg_temp.i('01') where board_id = pg_temp.bE() and papel = 'financeiro'$$, 'editor troca a pessoa do papel');
select throws_ok($$update public.task_roles set user_id = pg_temp.i('a5') where board_id = pg_temp.bE() and papel = 'financeiro'$$, '23514', null, 'trocar para quem não tem a ferramenta é recusado');
select throws_ok($$update public.task_roles set board_id = pg_temp.bP() where papel = 'financeiro'$$, '42501', null, 'o quadro do papel não muda (sem permissão de coluna)');
select lives_ok($$update public.task_roles set user_id = pg_temp.i('a3') where board_id = pg_temp.bE() and papel = 'financeiro'$$, 'volta o financeiro para o editor');
select pg_temp.como('authenticated', pg_temp.i('a2'));
select is((select count(*) from public.task_roles), 3::bigint, '''ver'' lê os papéis');
select throws_ok($$insert into public.task_roles (board_id, papel, user_id) values (pg_temp.bE(), 'portaria', pg_temp.i('a3'))$$, '42501', null, '''ver'' não grava papel');
select throws_ok($$insert into public.task_roles (board_id, papel, user_id) values (pg_temp.bE(), 'portaria', pg_temp.i('a5'))$$, '42501', null, '''ver'' com pessoa inválida recebe 42501 e não 23514 (sem oráculo)');
with u as (update public.task_roles set user_id = pg_temp.i('a2') returning 1) select is((select count(*) from u), 0::bigint, '''ver'' não altera papel (0 linhas)');
with d as (delete from public.task_roles returning 1) select is((select count(*) from d), 0::bigint, '''ver'' não apaga papel (0 linhas)');
select pg_temp.como('authenticated', pg_temp.i('a4'));
select is((select count(*) from public.task_roles), 0::bigint, 'bloqueado não lê papéis');
select pg_temp.como('authenticated', pg_temp.i('02'));
select is((select count(*) from public.task_roles), 0::bigint, 'outro produtor não lê papéis');
select throws_ok($$insert into public.task_roles (board_id, papel, user_id) values (pg_temp.bE(), 'portaria', pg_temp.i('02'))$$, '42501', null, 'outro produtor não grava papel');
select pg_temp.como('authenticated', pg_temp.i('b1'));
select is((select count(*) from public.task_roles), 0::bigint, 'conta solta não lê papéis');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$delete from public.task_roles where board_id = pg_temp.bE() and papel = 'juridico'$$, 'editor apaga papel');

-- Botões: regras (RLS) e passos ------------------------------------------------------------------------------------------------------------
select lives_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'Enviar para revisão', 'card',
  jsonb_build_array(jsonb_build_object('t', 'mover', 'v', pg_temp.col(pg_temp.bE(), 'Em revisão')), jsonb_build_object('t', 'atribuir', 'v', 'revisao'),
                    jsonb_build_object('t', 'prazo', 'v', 2), jsonb_build_object('t', 'avisar', 'v', 'financeiro')))$$, 'editor cria botão de cartão com 4 passos');
select is((select created_by from public.task_buttons where name = 'Enviar para revisão'), pg_temp.i('a3'), 'created_by é de quem criou (gatilho)');
select lives_ok($$insert into public.task_buttons (board_id, name, scope, column_id, steps) values (pg_temp.bE(), 'Arquivar o que está em Feito', 'board',
  pg_temp.col(pg_temp.bE(), 'Feito'), '[{"t":"arquivar"}]')$$, 'botão de quadro com coluna');
select lives_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'Etiquetar', 'card',
  jsonb_build_array(jsonb_build_object('t', 'etiqueta', 'v', pg_temp.i('1a'))))$$, 'passo etiqueta com etiqueta do quadro');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card', '[{"t":"pagar","v":"1"}]')$$, '23514', null, 'passo desconhecido é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card', '[{"t":"cupom","v":"1"}]')$$, '23514', null, 'passo de cupom é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card', '[]')$$, '23514', null, 'lista vazia é recusada');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card',
  '[{"t":"arquivar"},{"t":"arquivar"},{"t":"arquivar"},{"t":"arquivar"},{"t":"arquivar"},{"t":"arquivar"},{"t":"arquivar"}]')$$, '23514', null, 'mais de 6 passos é recusado');
select lives_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'seis', 'card',
  '[{"t":"arquivar"},{"t":"arquivar"},{"t":"arquivar"},{"t":"arquivar"},{"t":"arquivar"},{"t":"arquivar"}]')$$, 'exatamente 6 passos passa');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card',
  jsonb_build_array(jsonb_build_object('t', 'mover', 'v', pg_temp.col(pg_temp.bP(), 'Feito'))))$$, '23514', 'Passo mover com coluna de outro quadro.', 'passo mover com coluna de outro quadro é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card',
  jsonb_build_array(jsonb_build_object('t', 'etiqueta', 'v', pg_temp.i('1b'))))$$, '23514', 'Passo etiqueta com etiqueta de outro quadro.', 'passo etiqueta com etiqueta de outro quadro é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card', '[{"t":"mover","v":"nao-e-uuid"}]')$$, '23514', null, 'mover com v que não é uuid é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card', '[{"t":"atribuir","v":"chefe"}]')$$, '23514', null, 'papel inventado no passo é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card', '[{"t":"avisar","v":"chefe"}]')$$, '23514', null, 'papel inventado em avisar é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card', '[{"t":"prazo","v":0}]')$$, '23514', null, 'prazo 0 é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card', '[{"t":"prazo","v":31}]')$$, '23514', null, 'prazo 31 é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card', '[{"t":"prazo","v":2.5}]')$$, '23514', null, 'prazo fracionado é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card', '[{"t":"prazo","v":"3"}]')$$, '23514', null, 'prazo como texto é recusado');
select lives_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'prazos', 'card', '[{"t":"prazo","v":1},{"t":"prazo","v":30}]')$$, 'prazo 1 e 30 passam');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card', '[{"t":"arquivar","v":"1"}]')$$, '23514', null, 'arquivar com v é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card', '[{"t":"prazo","v":2,"extra":1}]')$$, '23514', null, 'chave extra no passo é recusada');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card', '["arquivar"]')$$, '23514', null, 'passo que não é objeto é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card', '{"t":"arquivar"}')$$, '23514', null, 'steps que não é lista é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card', '[{"v":"1"}]')$$, '23514', null, 'passo sem t é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), '<b>x</b>', 'card', '[{"t":"arquivar"}]')$$, '23514', null, 'HTML no nome é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), repeat('n', 41), 'card', '[{"t":"arquivar"}]')$$, '23514', null, 'nome com 41 caracteres é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), '', 'card', '[{"t":"arquivar"}]')$$, '23514', null, 'nome vazio é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), E'a\u202Eb', 'card', '[{"t":"arquivar"}]')$$, '23514', null, 'nome com inversão bidirecional (U+202E) é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), E'a\u2067b', 'card', '[{"t":"arquivar"}]')$$, '23514', null, 'nome com isolamento bidirecional (U+2067) é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), E'a\nb', 'card', '[{"t":"arquivar"}]')$$, '23514', null, 'nome com quebra de linha é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), E'a\tb', 'card', '[{"t":"arquivar"}]')$$, '23514', null, 'nome com tabulação é recusado');
select lives_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'Avisar Jurídico — já', 'card', '[{"t":"arquivar"}]')$$, 'nome com acento e travessão passa');
select pg_temp.como('postgres');
delete from public.task_buttons where name = 'Avisar Jurídico — já';
select pg_temp.como('authenticated', pg_temp.i('a3'));
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'board', '[{"t":"arquivar"}]')$$, '23514', null, 'botão de quadro sem coluna é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, column_id, steps) values (pg_temp.bE(), 'x', 'card', pg_temp.col(pg_temp.bE(), 'Feito'), '[{"t":"arquivar"}]')$$, '23514', null, 'botão de cartão com coluna é recusado');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, column_id, steps) values (pg_temp.bE(), 'x', 'board', pg_temp.col(pg_temp.bP(), 'Feito'), '[{"t":"arquivar"}]')$$, '23514', 'Coluna de outro quadro.', 'coluna do botão de outro quadro é recusada');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps, created_by) values (pg_temp.bE(), 'x', 'card', '[{"t":"arquivar"}]', pg_temp.i('01'))$$, '42501', null, 'created_by não é gravável pelo cliente');
select lives_ok($$update public.task_buttons set name = 'Etiquetar já', position = 5 where name = 'Etiquetar'$$, 'editor renomeia botão');
select throws_ok($$update public.task_buttons set steps = '[{"t":"pagar"}]' where name = 'Etiquetar já'$$, '23514', null, 'editar para passo inválido é recusado');
select throws_ok($$update public.task_buttons set scope = 'board' where name = 'Etiquetar já'$$, '42501', null, 'o escopo do botão não muda');
-- 'ver' lê, não grava, e não vira oráculo
select pg_temp.como('authenticated', pg_temp.i('a2'));
select is((select count(*) from public.task_buttons), 5::bigint, '''ver'' lê os botões');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card', '[{"t":"arquivar"}]')$$, '42501', null, '''ver'' não cria botão');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card',
  jsonb_build_array(jsonb_build_object('t', 'mover', 'v', pg_temp.col(pg_temp.bP(), 'Feito'))))$$, '42501', null, '''ver'' com passo inválido recebe 42501 (sem oráculo)');
with u as (update public.task_buttons set name = 'hack' returning 1) select is((select count(*) from u), 0::bigint, '''ver'' não altera botão (0 linhas)');
with d as (delete from public.task_buttons returning 1) select is((select count(*) from d), 0::bigint, '''ver'' não apaga botão (0 linhas)');
select pg_temp.como('authenticated', pg_temp.i('a4'));
select is((select count(*) from public.task_buttons), 0::bigint, 'bloqueado não lê botões');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card', '[{"t":"arquivar"}]')$$, '42501', null, 'bloqueado não cria botão');
select pg_temp.como('authenticated', pg_temp.i('02'));
select is((select count(*) from public.task_buttons), 0::bigint, 'outro produtor não lê botões');
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card', '[{"t":"arquivar"}]')$$, '42501', null, 'outro produtor não cria botão');
select pg_temp.como('authenticated', pg_temp.i('01'));
select is((select count(*) from public.task_buttons), 5::bigint, 'o dono lê os botões');
-- teto de 50 por quadro (os 5 existentes + 45)
select pg_temp.como('postgres');
insert into public.task_buttons (board_id, name, scope, steps) select pg_temp.bE(), 'b' || g, 'card', '[{"t":"arquivar"}]' from generate_series(1, 45) g;
select pg_temp.como('authenticated', pg_temp.i('a3'));
select throws_ok($$insert into public.task_buttons (board_id, name, scope, steps) values (pg_temp.bE(), 'x', 'card', '[{"t":"arquivar"}]')$$, '23514', 'Limite de 50 botões por quadro.', 'o 51º botão é recusado');
select pg_temp.como('postgres');
delete from public.task_buttons where name ~ '^b[0-9]+$' or name = 'seis' or name = 'prazos';

-- Rodar botão: cartão -----------------------------------------------------------------------------------------------------------------------
select pg_temp.como('postgres');
insert into public.task_buttons (id, board_id, name, scope, steps) values
  (pg_temp.i('b2'), pg_temp.bE(), 'Papel sem pessoa', 'card', '[{"t":"atribuir","v":"portaria"},{"t":"avisar","v":"portaria"}]'),
  (pg_temp.i('b3'), pg_temp.bE(), 'Etiqueta e portaria', 'card', jsonb_build_array(jsonb_build_object('t', 'atribuir', 'v', 'portaria'), jsonb_build_object('t', 'etiqueta', 'v', pg_temp.i('1a'))));
update public.task_buttons set id = pg_temp.i('b1') where name = 'Enviar para revisão';
update public.task_buttons set id = pg_temp.i('b4') where name = 'Arquivar o que está em Feito';
update public.task_buttons set id = pg_temp.i('b5') where name = 'Etiquetar já';
select pg_temp.como('authenticated', pg_temp.i('01'));
select is(public.quadro_rodar_botao(pg_temp.i('b1'), pg_temp.i('d1')) - 'motivos', '{"afetados": 1, "ignorados": 0}'::jsonb, 'botão de cartão: 4 passos aplicados, 1 afetado');
select pg_temp.como('postgres');
select is((select column_id from public.producer_tasks where id = pg_temp.i('d1')), pg_temp.col(pg_temp.bE(), 'Em revisão'), 'passo mover: o cartão foi para "Em revisão"');
select is((select status from public.producer_tasks where id = pg_temp.i('d1')), 'in_progress', 'o status acompanha a coluna');
select is((select count(*) from public.task_card_members where task_id = pg_temp.i('d1') and user_id = pg_temp.i('a2')), 1::bigint, 'passo atribuir: o revisor virou membro do cartão');
select is(pg_temp.dia((select due_date from public.producer_tasks where id = pg_temp.i('d1'))), pg_temp.hoje() + 2, 'passo prazo: daqui a 2 dias (data de São Paulo)');
select is((select body from public.notifications where user_id = pg_temp.i('a3') and metadata ->> 'tipo' = 'automacao'),
  'Botão “Enviar para revisão” precisa da sua atenção.', 'passo avisar: texto do aviso do botão');
select is((select count(*) from public.notifications where user_id = pg_temp.i('a3') and metadata ->> 'tipo' = 'automacao'), 1::bigint, 'passo avisar: um aviso de automação ao financeiro');
select is((select data ->> 'botao' || '|' || (data ->> 'afetados') || '|' || (data ->> 'ignorados') from public.task_activity where kind = 'botao' and task_id = pg_temp.i('d1')),
  'Enviar para revisão|1|0', 'histórico: nome do botão e contagens');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(public.quadro_rodar_botao(pg_temp.i('b1'), pg_temp.i('d1')), '{"afetados": 1, "ignorados": 0, "motivos": ["Sem mudança."]}'::jsonb,
  'rodar de novo: mover, atribuir e prazo viram "Sem mudança."; só o aviso conta como feito');
select pg_temp.como('postgres');
select is((select count(*) from public.task_card_members where task_id = pg_temp.i('d1')), 1::bigint, 'sem membro duplicado');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(public.quadro_rodar_botao(pg_temp.i('b3'), pg_temp.i('d2')), '{"afetados": 1, "ignorados": 0, "motivos": ["Papel “Portaria” sem pessoa definida."]}'::jsonb,
  'papel sem pessoa: o passo é pulado com motivo e a etiqueta vale');
select pg_temp.como('postgres');
select is((select count(*) from public.task_card_labels where task_id = pg_temp.i('d2') and label_id = pg_temp.i('1a')), 1::bigint, 'passo etiqueta aplicado');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(public.quadro_rodar_botao(pg_temp.i('b2'), pg_temp.i('d2')),
  '{"afetados": 0, "ignorados": 1, "motivos": ["Papel “Portaria” sem pessoa definida."]}'::jsonb, 'só passos de papel sem pessoa: cartão ignorado');
select throws_ok($$select public.quadro_rodar_botao(pg_temp.i('b1'))$$, '22023', 'O cartão não é deste quadro.', 'botão de cartão sem cartão é recusado');
select throws_ok($$select public.quadro_rodar_botao(pg_temp.i('b1'), pg_temp.i('dd'))$$, '22023', 'O cartão não é deste quadro.', 'cartão de outro quadro (do mesmo produtor) é recusado');
select throws_ok($$select public.quadro_rodar_botao(pg_temp.i('b1'), pg_temp.i('d9'))$$, '22023', 'O cartão não é deste quadro.', 'cartão de outro produtor dá a mesma resposta de cartão inexistente');
select throws_ok($$select public.quadro_rodar_botao(pg_temp.i('ee'), pg_temp.i('d1'))$$, '42501', 'Sem permissão para este botão.', 'botão inexistente: 42501');
-- contar só o que mudou: tudo já feito = ignorado com "Sem mudança."
select pg_temp.como('postgres');
insert into public.task_buttons (id, board_id, name, scope, steps) values (pg_temp.i('b9'), pg_temp.bE(), 'Já feito', 'card',
  jsonb_build_array(jsonb_build_object('t', 'mover', 'v', pg_temp.col(pg_temp.bE(), 'Em revisão')), '{"t":"prazo","v":2}'::jsonb));
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(public.quadro_rodar_botao(pg_temp.i('b9'), pg_temp.i('d1')), '{"afetados": 0, "ignorados": 1, "motivos": ["Sem mudança."]}'::jsonb,
  'mover para onde já está e prazo igual: nada mudou, cartão ignorado');
-- erro nativo do banco não vaza texto de constraint
select pg_temp.como('postgres');
insert into public.producer_tasks (id, producer_id, event_id, title) values (pg_temp.i('fb'), pg_temp.i('01'), null, 'NATIVO');
create function pg_temp.nativo() returns trigger language plpgsql as $f$ begin
  if new.title = 'NATIVO' and new.due_date is not null then
    raise exception 'duplicate key value violates unique constraint "segredo_idx"' using errcode = '23505'; end if; return new; end $f$;
create trigger zz_nativo before update on public.producer_tasks for each row execute function pg_temp.nativo();
insert into public.task_buttons (id, board_id, name, scope, steps) values (pg_temp.i('ba'), pg_temp.bP(), 'Quebra nativo', 'card', '[{"t":"prazo","v":5}]');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(public.quadro_rodar_botao(pg_temp.i('ba'), pg_temp.i('fb')), '{"afetados": 0, "ignorados": 1, "motivos": ["Um passo falhou neste cartão."]}'::jsonb,
  'erro nativo: motivo genérico, sem texto de constraint');
select pg_temp.como('postgres');
drop trigger zz_nativo on public.producer_tasks;
select is((select count(*) from public.task_activity where kind = 'botao' and task_id = pg_temp.i('fb') and data ->> 'erro' like '%segredo_idx%' and data ->> 'sqlstate' = '23505'), 1::bigint,
  'o erro real foi gravado no histórico');
select pg_temp.como('authenticated', pg_temp.i('a3'));
-- botão cujo passo guarda etiqueta apagada
select pg_temp.como('postgres');
insert into public.task_labels (id, board_id, name, color) values (pg_temp.i('1c'), pg_temp.bE(), 'Vai sumir', '#abcdef');
insert into public.task_buttons (id, board_id, name, scope, steps) values (pg_temp.i('b6'), pg_temp.bE(), 'Etiqueta velha', 'card', jsonb_build_array(jsonb_build_object('t', 'etiqueta', 'v', pg_temp.i('1c'))));
delete from public.task_labels where id = pg_temp.i('1c');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(public.quadro_rodar_botao(pg_temp.i('b6'), pg_temp.i('d2')), '{"afetados": 0, "ignorados": 1, "motivos": ["A etiqueta do passo não existe mais."]}'::jsonb,
  'etiqueta apagada: passo pulado com motivo');
-- pessoa do papel saiu da equipe
select pg_temp.como('postgres');
insert into public.task_roles (board_id, papel, user_id) values (pg_temp.bE(), 'portaria', pg_temp.i('a2'));
delete from public.team_member_tools where member_id = pg_temp.i('c2');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(public.quadro_rodar_botao(pg_temp.i('b2'), pg_temp.i('d2')),
  '{"afetados": 0, "ignorados": 1, "motivos": ["Papel “Portaria”: a pessoa saiu da equipe."]}'::jsonb, 'pessoa do papel sem acesso ao quadro: passo pulado com motivo');
select pg_temp.como('postgres');
insert into public.team_member_tools (member_id, ferramenta, nivel) values (pg_temp.i('c2'), 'quadro', 'ver');
delete from public.task_roles where papel = 'portaria';

-- Rodar botão: quadro, dependência aberta e arquivar --------------------------------------------------------------------------------------
select pg_temp.como('postgres');
insert into public.task_dependencies (task_id, depends_on) values (pg_temp.i('d3'), pg_temp.i('d4'));
insert into public.task_buttons (id, board_id, name, scope, column_id, steps) values (pg_temp.i('b7'), pg_temp.bE(), 'Tudo para andamento', 'board',
  pg_temp.col(pg_temp.bE(), 'A fazer'), jsonb_build_array(jsonb_build_object('t', 'mover', 'v', pg_temp.col(pg_temp.bE(), 'Em andamento')), '{"t":"prazo","v":3}'::jsonb));
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(public.quadro_rodar_botao(pg_temp.i('b7')),
  '{"afetados": 3, "ignorados": 1, "motivos": ["Este cartão depende de outro que ainda não foi concluído."]}'::jsonb,
  'botão de quadro: dependência aberta vira ignorado com motivo e os outros 3 seguem');
select pg_temp.como('postgres');
select is((select count(*) from public.producer_tasks where id in (pg_temp.i('d2'), pg_temp.i('d4'), pg_temp.i('d5'))
           and column_id = pg_temp.col(pg_temp.bE(), 'Em andamento') and due_date is not null), 3::bigint, 'os 3 cartões livres foram movidos e ganharam prazo');
select is((select column_id from public.producer_tasks where id = pg_temp.i('d3')), pg_temp.col(pg_temp.bE(), 'A fazer'), 'o cartão com dependência aberta ficou onde estava');
select is((select due_date from public.producer_tasks where id = pg_temp.i('d3')), null::timestamptz, 'e os passos dele foram desfeitos (prazo não gravado)');
select is((select data ->> 'afetados' || '/' || (data ->> 'ignorados') from public.task_activity where kind = 'botao' and task_id is null and data ->> 'botao' = 'Tudo para andamento'),
  '3/1', 'histórico do botão de quadro (sem cartão): contagens');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(public.quadro_rodar_botao(pg_temp.i('b4')), '{"afetados": 2, "ignorados": 0, "motivos": []}'::jsonb, 'botão de quadro: arquiva os 2 cartões de "Feito"');
select pg_temp.como('postgres');
select is((select count(*) from public.producer_tasks where id in (pg_temp.i('d6'), pg_temp.i('d7')) and archived_at is not null), 2::bigint, 'passo arquivar aplicado');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(public.quadro_rodar_botao(pg_temp.i('b4')), '{"afetados": 0, "ignorados": 0, "motivos": []}'::jsonb, 'segunda rodada: coluna sem cartão não arquivado, nada a fazer');
select is(public.quadro_rodar_botao(pg_temp.i('b2'), pg_temp.i('d6')), '{"afetados": 0, "ignorados": 1, "motivos": ["Cartão arquivado."]}'::jsonb, 'botão de cartão em cartão arquivado: ignorado');
-- permissões
select pg_temp.como('authenticated', pg_temp.i('a2'));
select throws_ok($$select public.quadro_rodar_botao(pg_temp.i('b1'), pg_temp.i('d1'))$$, '42501', 'Sem permissão para este botão.', '''ver'' não roda botão');
select pg_temp.como('authenticated', pg_temp.i('a4'));
select throws_ok($$select public.quadro_rodar_botao(pg_temp.i('b1'), pg_temp.i('d1'))$$, '42501', 'Sem permissão para este botão.', 'bloqueado não roda botão');
select pg_temp.como('authenticated', pg_temp.i('02'));
select throws_ok($$select public.quadro_rodar_botao(pg_temp.i('b1'), pg_temp.i('d1'))$$, '42501', 'Sem permissão para este botão.', 'outro produtor não roda botão');
select pg_temp.como('authenticated', pg_temp.i('b1'));
select throws_ok($$select public.quadro_rodar_botao(pg_temp.i('b1'), pg_temp.i('d1'))$$, '42501', 'Sem permissão para este botão.', 'conta solta não roda botão');
-- teto de 200
select pg_temp.como('postgres');
insert into public.producer_tasks (producer_id, title) select pg_temp.i('01'), 'T' || g from generate_series(1, 201) g;
insert into public.task_buttons (id, board_id, name, scope, column_id, steps) values (pg_temp.i('b8'), pg_temp.bP(), 'Prazo em massa', 'board',
  pg_temp.col(pg_temp.bP(), 'A fazer'), '[{"t":"prazo","v":1}]');
update public.producer_tasks set due_date = null where board_id = pg_temp.bP();
select pg_temp.como('authenticated', pg_temp.i('01'));
select is(public.quadro_rodar_botao(pg_temp.i('b8')),
  '{"afetados": 200, "ignorados": 3, "motivos": ["Limite de 200 cartões por execução: rode de novo para os demais."]}'::jsonb,
  'teto: 200 cartões por execução (dP + NATIVO + 201 = 203 na coluna: os 3 que sobram contam como ignorados)');
select pg_temp.como('postgres');
select is((select count(*) from public.producer_tasks where board_id = pg_temp.bP() and due_date is not null), 200::bigint, 'só 200 cartões receberam o prazo');
delete from public.producer_tasks where title like 'T%' and board_id = pg_temp.bP();
-- teto de 3000 cartões por quadro, contando os arquivados
insert into public.producer_tasks (producer_id, board_id, title)
  select pg_temp.i('01'), pg_temp.bP(), 'L' || g from generate_series(1, 3000 - (select count(*) from public.producer_tasks where board_id = pg_temp.bP())::int) g;
select is((select count(*) from public.producer_tasks where board_id = pg_temp.bP()), 3000::bigint, 'o quadro chegou a 3000 cartões');
select throws_ok($$insert into public.producer_tasks (producer_id, board_id, title) values (pg_temp.i('01'), pg_temp.bP(), 'o 3001')$$, '23514',
  'Limite de 3000 cartões por quadro.', 'o 3001º cartão é recusado');
update public.producer_tasks set archived_at = now() where board_id = pg_temp.bP() and title like 'L1%';
select throws_ok($$insert into public.producer_tasks (producer_id, board_id, title) values (pg_temp.i('01'), pg_temp.bP(), 'o 3001')$$, '23514',
  'Limite de 3000 cartões por quadro.', 'arquivados continuam contando para o teto');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$insert into public.producer_tasks (producer_id, event_id, title) values (pg_temp.i('01'), pg_temp.i('e1'), 'outro quadro não é afetado')$$, 'o teto é por quadro');
select pg_temp.como('postgres');
delete from public.producer_tasks where board_id = pg_temp.bP() and title ~ '^L[0-9]+$';

-- Modelos ------------------------------------------------------------------------------------------------------------------------------------
select pg_temp.como('postgres');
insert into public.task_roles (board_id, papel, user_id) values (pg_temp.bE(), 'fornecedores', pg_temp.i('a3'));
select pg_temp.como('authenticated', pg_temp.i('a3'));
select throws_ok($$select public.quadro_aplicar_modelo(pg_temp.bP(), 'show')$$, '22023', 'Escolha um evento: o modelo usa a data dele.', 'quadro sem evento: erro claro');
select throws_ok($$select public.quadro_aplicar_modelo(pg_temp.bE(), 'baile')$$, '22023', 'Modelo desconhecido.', 'tipo de modelo inexistente é recusado');
select throws_ok($$select public.quadro_aplicar_modelo(pg_temp.bE(), 'show', (select array_agg(g) from generate_series(1, 61) g))$$, '22023', 'No máximo 60 cartões por vez.', 'mais de 60 índices é recusado');
select is(public.quadro_aplicar_modelo(pg_temp.bE(), 'show'), '{"criados": 9, "existentes": 0}'::jsonb, 'modelo Show cria os 9 cartões');
select pg_temp.como('postgres');
select is((select count(*) from public.producer_tasks where board_id = pg_temp.bE() and description = 'Criado pelo modelo “Show”.'), 9::bigint, 'os 9 estão no quadro do evento, com a descrição do modelo');
select is((select count(*) from public.producer_tasks where board_id = pg_temp.bE() and description like 'Criado pelo modelo%' and column_id = pg_temp.col(pg_temp.bE(), 'A fazer')), 9::bigint, 'todos na primeira coluna');
select is(pg_temp.dia((select due_date from public.producer_tasks where title = 'Contratar som, luz e palco' and board_id = pg_temp.bE())), pg_temp.hoje(),
  'prazo que já passou (45 dias antes de um evento daqui a 30) vira hoje');
select is(pg_temp.dia((select due_date from public.producer_tasks where title = 'Conferir licenças e alvará' and board_id = pg_temp.bE())), pg_temp.hoje(), '30 dias antes = hoje');
select is(pg_temp.dia((select due_date from public.producer_tasks where title = 'Definir o plano de segurança e brigada' and board_id = pg_temp.bE())), pg_temp.hoje() + 9, 'D-21: evento daqui a 30 dias dá hoje + 9');
select is(pg_temp.dia((select due_date from public.producer_tasks where title = 'Ensaio geral e passagem de som' and board_id = pg_temp.bE())), pg_temp.hoje() + 29, 'D-1: um dia antes do evento');
select is((select count(*) from public.task_card_members m join public.producer_tasks t on t.id = m.task_id
           where t.board_id = pg_temp.bE() and t.title = 'Contratar som, luz e palco' and m.user_id = pg_temp.i('a3')), 1::bigint, 'responsável pelo papel (fornecedores)');
select is((select count(*) from public.task_card_members m join public.producer_tasks t on t.id = m.task_id
           where t.board_id = pg_temp.bE() and t.title = 'Abrir a venda do primeiro lote'), 0::bigint, 'papel sem pessoa: cartão sem responsável');
select is((select count(*) from public.task_links l join public.producer_tasks t on t.id = l.task_id
           where t.title = 'Contratar som, luz e palco' and t.board_id = pg_temp.bE() and l.kind = 'parceiro'), 1::bigint, 'atalho do modelo gravado em task_links');
select is((select count(*) from public.task_links l join public.producer_tasks t on t.id = l.task_id where t.board_id = pg_temp.bE() and t.description like 'Criado pelo modelo%'), 9::bigint,
  'um atalho por cartão do modelo Show');
select is((select data ->> 'modelo' || '|' || (data ->> 'criados') || '|' || (data ->> 'existentes') from public.task_activity where kind = 'modelo'), 'show|9|0', 'histórico: modelo e contagens');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(public.quadro_aplicar_modelo(pg_temp.bE(), 'show'), '{"criados": 0, "existentes": 9}'::jsonb, 'aplicar de novo: tudo pulado (títulos já existem)');
select pg_temp.como('postgres');
update public.producer_tasks set archived_at = now() where board_id = pg_temp.bE() and title = 'Testar o check-in';
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(public.quadro_aplicar_modelo(pg_temp.bE(), 'show'), '{"criados": 1, "existentes": 8}'::jsonb, 'título arquivado não conta como existente');
select is(public.quadro_aplicar_modelo(pg_temp.bE(), 'festa', array[0, 2, 2]), '{"criados": 2, "existentes": 0}'::jsonb, 'p_itens escolhe os índices 0 e 2 (o repetido não cria duas vezes)');
select is(public.quadro_aplicar_modelo(pg_temp.bE(), 'festa', array[0, 2]), '{"criados": 0, "existentes": 2}'::jsonb, 'e repetir a escolha só encontra os existentes');
select is(public.quadro_aplicar_modelo(pg_temp.bE(), 'festa', array[99, -1]), '{"criados": 0, "existentes": 0}'::jsonb, 'índices fora do modelo não criam nada');
select is(public.quadro_aplicar_modelo(pg_temp.bE(), 'festa', array[null]::int[]), '{"criados": 0, "existentes": 0}'::jsonb, 'índice nulo não cria nada');
select is(public.quadro_aplicar_modelo(pg_temp.bE(), 'festa', '{}'), '{"criados": 0, "existentes": 0}'::jsonb, 'lista vazia não cria nada');
select is(public.quadro_aplicar_modelo(pg_temp.bE(), 'curso', (select array_agg(g) from generate_series(0, 59) g)), '{"criados": 6, "existentes": 0}'::jsonb, '60 índices é o limite aceito (o modelo só tem 6)');
-- evento no passado: tudo vira hoje
select pg_temp.como('postgres');
select is((select count(*) from public.task_boards where event_id = pg_temp.i('e2')), 1::bigint, 'quadro do evento passado existe');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(public.quadro_aplicar_modelo((select id from public.task_boards where event_id = pg_temp.i('e2')), 'curso'), '{"criados": 6, "existentes": 0}'::jsonb, 'modelo Curso no evento passado');
select pg_temp.como('postgres');
select is((select count(*) from public.producer_tasks where board_id = (select id from public.task_boards where event_id = pg_temp.i('e2'))
           and pg_temp.dia(due_date) = pg_temp.hoje()), 6::bigint, 'evento passado: todos os prazos viram hoje (inclusive D+1)');
-- checklist opcional do modelo
update public.task_templates set items = jsonb_set(items, '{0,checklist}', '["Primeiro", "Segundo"]') where key = 'congresso';
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(public.quadro_aplicar_modelo(pg_temp.bE(), 'congresso', array[0]), '{"criados": 1, "existentes": 0}'::jsonb, 'modelo com checklist cria o cartão');
select pg_temp.como('postgres');
select is((select count(*) from public.task_checklist_items i join public.task_checklists c on c.id = i.checklist_id join public.producer_tasks t on t.id = c.task_id
           where t.title = 'Fechar o espaço e a infraestrutura' and t.board_id = pg_temp.bE()), 2::bigint, 'checklist do modelo: 2 itens');
-- evento sem data: não usa start_date (o baseline grava now()) e não cria nada
select pg_temp.como('postgres');
insert into public.events (id, producer_id, title, slug, status, approval_status, date) values (pg_temp.i('e3'), pg_temp.i('01'), 'Sem data', 'f2c-e3', 'draft', 'pending', null);
select public.quadro_criar_interno(pg_temp.i('01'), pg_temp.i('e3'));
select pg_temp.como('authenticated', pg_temp.i('a3'));
select throws_ok($$select public.quadro_aplicar_modelo((select id from public.task_boards where event_id = pg_temp.i('e3')), 'show')$$, '22023',
  'Defina a data do evento antes de aplicar o modelo.', 'evento com date nula: erro claro');
select pg_temp.como('postgres');
select is((select count(*) from public.producer_tasks where board_id = (select id from public.task_boards where event_id = pg_temp.i('e3'))), 0::bigint, 'e nenhum cartão foi criado');
-- permissões
select pg_temp.como('authenticated', pg_temp.i('a2'));
select throws_ok($$select public.quadro_aplicar_modelo(pg_temp.bE(), 'show')$$, '42501', 'Sem permissão para este quadro.', '''ver'' não aplica modelo');
select pg_temp.como('authenticated', pg_temp.i('a4'));
select throws_ok($$select public.quadro_aplicar_modelo(pg_temp.bE(), 'show')$$, '42501', 'Sem permissão para este quadro.', 'bloqueado não aplica modelo');
select pg_temp.como('authenticated', pg_temp.i('02'));
select throws_ok($$select public.quadro_aplicar_modelo(pg_temp.bE(), 'show')$$, '42501', 'Sem permissão para este quadro.', 'outro produtor não aplica modelo');
select throws_ok($$select public.quadro_aplicar_modelo(pg_temp.i('ee'), 'show')$$, '42501', 'Sem permissão para este quadro.', 'quadro inexistente dá a mesma resposta');
select is((select count(*) from public.task_templates), 4::bigint, 'qualquer logado lê os 4 modelos');
select throws_ok($$insert into public.task_templates (key, name, items) values ('show', 'x', '[]')$$, '42501', null, 'authenticated não grava modelo');
select throws_ok($$update public.task_templates set name = 'x'$$, '42501', null, 'authenticated não altera modelo');
select throws_ok($$delete from public.task_templates$$, '42501', null, 'authenticated não apaga modelo');

-- Recorrência ----------------------------------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$update public.producer_tasks set recur_days = 7 where id = pg_temp.i('dd')$$, 'editor liga a recorrência');
select is((select recur_next from public.producer_tasks where id = pg_temp.i('dd')), pg_temp.hoje() + 7, 'ligar recur_days preenche recur_next = hoje + dias');
select lives_ok($$update public.producer_tasks set recur_days = 14 where id = pg_temp.i('dd')$$, 'editor troca o intervalo');
select is((select recur_next from public.producer_tasks where id = pg_temp.i('dd')), pg_temp.hoje() + 14, 'trocar o intervalo recalcula recur_next');
select lives_ok($$update public.producer_tasks set recur_days = 30, recur_next = current_date + 100 where id = pg_temp.i('dd')$$, 'editor troca o intervalo e escolhe a data');
select is((select recur_next from public.producer_tasks where id = pg_temp.i('dd')), current_date + 100, 'recur_next escolhido na mesma gravação é respeitado');
select lives_ok($$update public.producer_tasks set recur_days = null where id = pg_temp.i('dd')$$, 'editor desliga a recorrência');
select is((select recur_next from public.producer_tasks where id = pg_temp.i('dd')), null::date, 'desligar zera recur_next');
select pg_temp.como('postgres');
insert into public.producer_tasks (id, producer_id, event_id, title, recur_days) values (pg_temp.i('f0'), pg_temp.i('01'), null, 'Nasce repetindo', 1);
select is((select recur_next from public.producer_tasks where id = pg_temp.i('f0')), pg_temp.hoje() + 1, 'cartão criado já repetindo ganha recur_next');
-- cartão rico para a cópia
insert into public.producer_tasks (id, producer_id, event_id, title, description, priority, cover, location, fields, assigned_to, recur_days)
  values (pg_temp.i('f1'), pg_temp.i('01'), pg_temp.i('e1'), 'Relatório semanal', 'Descrição', 'high', '#123456',
          '{"txt":"Sala 3","lat":-23.5,"lng":-46.6}', '{"campo_x":"y"}', pg_temp.i('a3'), 7);
update public.team_members set blocked_at = null where id = pg_temp.i('c4'); -- o bloqueio entra depois que ele é membro do cartão
insert into public.task_card_members (task_id, user_id) values (pg_temp.i('f1'), pg_temp.i('a3')), (pg_temp.i('f1'), pg_temp.i('a2')), (pg_temp.i('f1'), pg_temp.i('a4'));
update public.team_members set blocked_at = now() where id = pg_temp.i('c4');
insert into public.task_card_labels (task_id, label_id) values (pg_temp.i('f1'), pg_temp.i('1a'));
insert into public.task_links (task_id, kind, ref) values (pg_temp.i('f1'), 'ingresso', 'abc');
insert into public.task_dependencies (task_id, depends_on) values (pg_temp.i('f1'), pg_temp.i('d5'));
insert into public.task_checklists (id, task_id, title, position) values (pg_temp.i('f2'), pg_temp.i('f1'), 'Lista A', 1), (pg_temp.i('f3'), pg_temp.i('f1'), 'Lista B', 2);
insert into public.task_checklist_items (checklist_id, text, done, position) values
  (pg_temp.i('f2'), 'um', true, 1), (pg_temp.i('f2'), 'dois', true, 2), (pg_temp.i('f3'), 'três', false, 1);
select pg_temp.como('authenticated', pg_temp.i('a3'));
create temp table _rec as select public.quadro_gerar_recorrente(pg_temp.i('f1')) as id;
grant select on _rec to authenticated;
select ok((select id is not null and id <> pg_temp.i('f1') from _rec), 'a cópia manual devolve o id de um cartão novo');
select pg_temp.como('postgres');
select is((select title || '|' || description || '|' || priority || '|' || cover || '|' || (location ->> 'txt') || '|' || (fields ->> 'campo_x') from public.producer_tasks where id = (select id from _rec)),
  'Relatório semanal|Descrição|high|#123456|Sala 3|y', 'cópia: título, descrição, prioridade, cor, local e campos');
select is((select column_id from public.producer_tasks where id = (select id from _rec)), pg_temp.col(pg_temp.bE(), 'A fazer'), 'cópia na primeira coluna');
select is((select recur_days from public.producer_tasks where id = (select id from _rec)), null::int, 'a cópia não repete');
select is((select recur_next from public.producer_tasks where id = (select id from _rec)), null::date, 'e não tem recur_next');
select is(pg_temp.dia((select due_date from public.producer_tasks where id = (select id from _rec))), pg_temp.hoje() + 7, 'prazo da cópia = hoje + recur_days');
select is((select assigned_to from public.producer_tasks where id = (select id from _rec)), pg_temp.i('a3'), 'responsável copiado');
select is((select array_agg(user_id order by user_id) from public.task_card_members where task_id = (select id from _rec)), array[pg_temp.i('a2'), pg_temp.i('a3')],
  'membros copiados, menos quem não é mais da equipe (bloqueado)');
select is((select count(*) from public.task_card_labels where task_id = (select id from _rec) and label_id = pg_temp.i('1a')), 1::bigint, 'etiquetas copiadas');
select is((select count(*) from public.task_links where task_id = (select id from _rec) and kind = 'ingresso' and ref = 'abc'), 1::bigint, 'atalhos copiados');
select is((select count(*) from public.task_checklists where task_id = (select id from _rec)), 2::bigint, 'as 2 listas copiadas');
select is((select count(*) from public.task_checklist_items i join public.task_checklists c on c.id = i.checklist_id where c.task_id = (select id from _rec)), 3::bigint, 'os 3 itens copiados');
select is((select count(*) from public.task_checklist_items i join public.task_checklists c on c.id = i.checklist_id where c.task_id = (select id from _rec) and i.done), 0::bigint, 'itens da cópia desmarcados');
select is((select count(*) from public.task_checklist_items i where i.checklist_id in (pg_temp.i('f2'), pg_temp.i('f3')) and i.done), 2::bigint, 'o original não perdeu as marcas');
select is((select count(*) from public.task_dependencies where task_id = (select id from _rec)), 0::bigint, 'dependências não vão para a cópia');
select is((select recur_next from public.producer_tasks where id = pg_temp.i('f1')), pg_temp.hoje() + 7, 'o original avança recur_next');
select is((select count(*) from public.task_activity where kind = 'recorrente' and task_id = (select id from _rec)), 1::bigint, 'histórico: cópia registrada');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select throws_ok($$select public.quadro_gerar_recorrente(pg_temp.i('d1'))$$, '22023', 'Este cartão não se repete.', 'cartão sem recorrência: erro claro');
select pg_temp.como('postgres');
update public.producer_tasks set archived_at = now() where id = pg_temp.i('f0');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select throws_ok($$select public.quadro_gerar_recorrente(pg_temp.i('f0'))$$, '22023', 'Cartão arquivado não se repete.', 'cartão arquivado não gera cópia');
select pg_temp.como('authenticated', pg_temp.i('a2'));
select throws_ok($$select public.quadro_gerar_recorrente(pg_temp.i('f1'))$$, '42501', 'Sem permissão para este cartão.', '''ver'' não gera cópia');
select pg_temp.como('authenticated', pg_temp.i('a4'));
select throws_ok($$select public.quadro_gerar_recorrente(pg_temp.i('f1'))$$, '42501', 'Sem permissão para este cartão.', 'bloqueado não gera cópia');
select pg_temp.como('authenticated', pg_temp.i('02'));
select throws_ok($$select public.quadro_gerar_recorrente(pg_temp.i('f1'))$$, '42501', 'Sem permissão para este cartão.', 'outro produtor não gera cópia');
select throws_ok($$select public.quadro_gerar_recorrente(pg_temp.i('ee'))$$, '42501', 'Sem permissão para este cartão.', 'cartão inexistente dá a mesma resposta');
select throws_ok($$select public.quadro_gerar_recorrentes_vencidas()$$, '42501', null, 'authenticated não chama a função do cron');
select throws_ok($$select public.quadro_gerar_recorrente_interno(pg_temp.i('f1'))$$, '42501', null, 'authenticated não chama a interna');
-- uma cópia manual por cartão por dia
select pg_temp.como('authenticated', pg_temp.i('a3'));
select throws_ok($$select public.quadro_gerar_recorrente(pg_temp.i('f1'))$$, '22023', 'Já foi gerada uma cópia hoje. A próxima pode ser gerada amanhã.', 'segunda cópia manual no mesmo dia é recusada');
select pg_temp.como('postgres');
select is((select count(*) from public.producer_tasks where title = 'Relatório semanal'), 2::bigint, 'e nenhuma cópia a mais foi criada');
update public.task_activity set created_at = created_at - interval '1 day' where kind = 'recorrente' and data ->> 'origem' = pg_temp.i('f1')::text;
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$select public.quadro_gerar_recorrente(pg_temp.i('f1'))$$, 'no dia seguinte a cópia manual volta a valer');
-- cron (função interna)
select pg_temp.como('postgres');
delete from public.producer_tasks where recur_days is not null and id <> pg_temp.i('f1');
update public.producer_tasks set recur_next = pg_temp.hoje() where id = pg_temp.i('f1');
insert into public.producer_tasks (id, producer_id, event_id, title, recur_days) values
  (pg_temp.i('f5'), pg_temp.i('01'), null, 'Vence hoje', 1), (pg_temp.i('f6'), pg_temp.i('01'), null, 'Só amanhã', 1),
  (pg_temp.i('f7'), pg_temp.i('01'), null, 'Arquivado vencido', 1);
update public.producer_tasks set recur_next = pg_temp.hoje() where id = pg_temp.i('f5');
update public.producer_tasks set archived_at = now() where id = pg_temp.i('f7');
update public.producer_tasks set recur_next = pg_temp.hoje() where id = pg_temp.i('f7');
select is(public.quadro_gerar_recorrentes_vencidas(), 2, 'cron: gera cópia só dos vencidos e não arquivados');
select is((select count(*) from public.producer_tasks where title = 'Vence hoje'), 2::bigint, 'o cartão que vence hoje ganhou cópia');
select is((select count(*) from public.producer_tasks where title = 'Só amanhã'), 1::bigint, 'o de amanhã não');
select is((select count(*) from public.producer_tasks where title = 'Arquivado vencido'), 1::bigint, 'o arquivado não');
select is((select recur_next from public.producer_tasks where id = pg_temp.i('f1')), pg_temp.hoje() + 7, 'vencido avança para hoje + dias');
select is(public.quadro_gerar_recorrentes_vencidas(), 0, 'cron de novo no mesmo dia: nada repetido');
-- recur_next nunca no passado
update public.producer_tasks set recur_next = date '0001-01-01' where id = pg_temp.i('f6');
select is((select recur_next from public.producer_tasks where id = pg_temp.i('f6')), pg_temp.hoje(), 'UPDATE com recur_next no passado vira hoje');
insert into public.producer_tasks (id, producer_id, title, recur_days, recur_next) values (pg_temp.i('f4'), pg_temp.i('01'), 'Passado', 7, date '0001-01-01');
select is((select recur_next from public.producer_tasks where id = pg_temp.i('f4')), pg_temp.hoje(), 'INSERT com recur_next no passado vira hoje');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$update public.producer_tasks set recur_next = date '1999-01-01' where id = pg_temp.i('f4')$$, 'editor tenta data antiga');
select is((select recur_next from public.producer_tasks where id = pg_temp.i('f4')), pg_temp.hoje(), 'e continua sendo hoje');
select pg_temp.como('postgres');
delete from public.producer_tasks where id in (pg_temp.i('f4'), pg_temp.i('f6'));
-- justo por produtor: 60 cartões de um produtor não tomam a vez do cartão vencido de outro
insert into public.producer_tasks (producer_id, title, recur_days) select pg_temp.i('01'), 'Massa' || g, 1 from generate_series(1, 60) g;
update public.producer_tasks set recur_next = pg_temp.hoje() where title like 'Massa%';
insert into public.producer_tasks (id, producer_id, title, recur_days) values (pg_temp.i('f3'), pg_temp.i('02'), 'Outro produtor', 1);
update public.producer_tasks set recur_next = pg_temp.hoje() where id = pg_temp.i('f3');
select is(public.quadro_gerar_recorrentes_vencidas(), 11, 'cron: 10 do produtor com 60 cartões + o cartão do outro produtor');
select is((select count(*) from public.producer_tasks where title = 'Outro produtor'), 2::bigint, 'o cartão vencido do outro produtor foi atendido na primeira execução');
select is((select count(*) from public.producer_tasks where title like 'Massa%'), 70::bigint, 'o produtor com 60 cartões teve só 10 cópias');
select is(public.quadro_gerar_recorrentes_vencidas(), 10, 'segunda execução: mais 10');
select is(public.quadro_gerar_recorrentes_vencidas() + public.quadro_gerar_recorrentes_vencidas() + public.quadro_gerar_recorrentes_vencidas()
          + public.quadro_gerar_recorrentes_vencidas(), 40, 'e o resto sai nas execuções seguintes (40 até zerar os 60)');
select is(public.quadro_gerar_recorrentes_vencidas(), 0, 'depois de 6 execuções não há mais nada vencido');
-- teto geral de 300: 31 produtores com 11 cartões vencidos
delete from public.producer_tasks where recur_days is not null and id <> pg_temp.i('f1');
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  select ('ff000000-0000-4000-8000-' || lpad((70000 + g)::text, 12, '0'))::uuid, 'g' || g || '@teste-f2c.local', now(), '{"role":"producer","full_name":"G"}' from generate_series(1, 31) g;
insert into public.producer_tasks (producer_id, title, recur_days)
  select ('ff000000-0000-4000-8000-' || lpad((70000 + g)::text, 12, '0'))::uuid, 'G' || g || '-' || k, 1 from generate_series(1, 31) g, generate_series(1, 11) k;
update public.producer_tasks set recur_next = pg_temp.hoje() where title ~ '^G[0-9]+-[0-9]+$';
select is(public.quadro_gerar_recorrentes_vencidas(), 300, 'cron: teto geral de 300 por execução (31 produtores x 10 = 310)');
delete from public.producer_tasks where title ~ '^G[0-9]+-[0-9]+$';
-- uma cópia que falha não trava as outras: o original avança e a falha fica no histórico
insert into public.producer_tasks (id, producer_id, title, recur_days) values (pg_temp.i('f8'), pg_temp.i('01'), 'EXPLODE', 1);
update public.producer_tasks set recur_next = pg_temp.hoje() where id = pg_temp.i('f8');
-- o gatilho nasce depois do original: só a CÓPIA (mesmo título) dispara o erro
create function pg_temp.quebra() returns trigger language plpgsql as $f$ begin
  if new.title = 'EXPLODE' then raise exception 'cópia quebrada de propósito'; end if; return new; end $f$;
create trigger zz_quebra before insert on public.producer_tasks for each row execute function pg_temp.quebra();
insert into public.producer_tasks (id, producer_id, title, recur_days) values (pg_temp.i('f9'), pg_temp.i('01'), 'Boa', 1);
update public.producer_tasks set recur_next = pg_temp.hoje() where id = pg_temp.i('f9');
select is(public.quadro_gerar_recorrentes_vencidas(), 1, 'cron: a cópia que falha não impede a outra (1 gerada)');
select is((select recur_next from public.producer_tasks where id = pg_temp.i('f8')), pg_temp.hoje() + 1, 'o original que falhou avança');
select is((select count(*) from public.task_activity where kind = 'recorrente' and task_id = pg_temp.i('f8') and data ? 'falhou'), 1::bigint, 'e a falha fica no histórico');
drop trigger zz_quebra on public.producer_tasks;
delete from public.producer_tasks where recur_days is not null and id <> pg_temp.i('f1');
-- a cópia só leva gente com a ferramenta quadro: responsável sem ela e membro que a perdeu ficam de fora
insert into public.producer_tasks (id, producer_id, event_id, title, assigned_to, recur_days) values (pg_temp.i('fa'), pg_temp.i('01'), pg_temp.i('e1'), 'Equipe mudou', pg_temp.i('a5'), 1);
insert into public.task_card_members (task_id, user_id) values (pg_temp.i('fa'), pg_temp.i('a5')), (pg_temp.i('fa'), pg_temp.i('a2')), (pg_temp.i('fa'), pg_temp.i('a3'));
update public.producer_tasks set recur_next = pg_temp.hoje() where id = pg_temp.i('fa');
delete from public.team_member_tools where member_id = pg_temp.i('c2');
select is(public.quadro_gerar_recorrentes_vencidas(), 1, 'cron: cartão da equipe que mudou');
select is((select assigned_to from public.producer_tasks where title = 'Equipe mudou' and id <> pg_temp.i('fa')), null::uuid, 'responsável sem a ferramenta quadro não é copiado');
select is((select array_agg(user_id) from public.task_card_members m join public.producer_tasks t on t.id = m.task_id where t.title = 'Equipe mudou' and t.id <> pg_temp.i('fa')),
  array[pg_temp.i('a3')], 'membro sem a ferramenta (a5) e membro que a perdeu (a2) não são copiados; só quem tem (a3)');
insert into public.team_member_tools (member_id, ferramenta, nivel) values (pg_temp.i('c2'), 'quadro', 'ver');
delete from public.producer_tasks where recur_days is not null and id <> pg_temp.i('f1');

-- Checklist que move ----------------------------------------------------------------------------------------------------------------------------
select pg_temp.como('postgres');
insert into public.producer_tasks (id, producer_id, event_id, title, ck_move) values
  (pg_temp.i('a0'), pg_temp.i('01'), pg_temp.i('e1'), 'K1', true), (pg_temp.i('a1'), pg_temp.i('01'), pg_temp.i('e1'), 'K2 sem ck_move', false),
  (pg_temp.i('a6'), pg_temp.i('01'), pg_temp.i('e1'), 'K3 dependência', true), (pg_temp.i('a7'), pg_temp.i('01'), pg_temp.i('e1'), 'K4 lista vazia', true),
  (pg_temp.i('a8'), pg_temp.i('01'), pg_temp.i('e1'), 'K5 em Feito', true), (pg_temp.i('a9'), pg_temp.i('01'), pg_temp.i('e1'), 'K6 arquivado', true);
insert into public.task_checklists (id, task_id, title, position) values
  (pg_temp.i('1d'), pg_temp.i('a0'), 'A', 1), (pg_temp.i('1e'), pg_temp.i('a0'), 'B', 2), (pg_temp.i('2a'), pg_temp.i('a1'), 'A', 1),
  (pg_temp.i('2b'), pg_temp.i('a6'), 'A', 1), (pg_temp.i('2c'), pg_temp.i('a7'), 'A', 1), (pg_temp.i('2d'), pg_temp.i('a7'), 'Vazia', 2),
  (pg_temp.i('2e'), pg_temp.i('a8'), 'A', 1), (pg_temp.i('2f'), pg_temp.i('a9'), 'A', 1);
insert into public.task_checklist_items (id, checklist_id, text, done, position) values
  (pg_temp.i('3a'), pg_temp.i('1d'), 'i1', false, 1), (pg_temp.i('3b'), pg_temp.i('1d'), 'i2', false, 2), (pg_temp.i('3c'), pg_temp.i('1e'), 'i3', false, 1),
  (pg_temp.i('3d'), pg_temp.i('2a'), 'sem move', false, 1), (pg_temp.i('3e'), pg_temp.i('2b'), 'dep', false, 1),
  (pg_temp.i('3f'), pg_temp.i('2c'), 'vazia', false, 1), (pg_temp.i('4a'), pg_temp.i('2e'), 'feito', false, 1), (pg_temp.i('4b'), pg_temp.i('2f'), 'arq', false, 1);
insert into public.task_watchers (task_id, user_id) values (pg_temp.i('a0'), pg_temp.i('a2'));
insert into public.task_dependencies (task_id, depends_on) values (pg_temp.i('a6'), pg_temp.i('d3'));
update public.producer_tasks set column_id = pg_temp.col(pg_temp.bE(), 'Feito') where id = pg_temp.i('a8');
update public.producer_tasks set archived_at = now() where id = pg_temp.i('a9');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$update public.task_checklist_items set done = true where id = pg_temp.i('3a')$$, 'marca o primeiro item');
select lives_ok($$update public.task_checklist_items set done = true where id = pg_temp.i('3b')$$, 'marca o segundo item (a lista B ainda tem item aberto)');
select is((select column_id from public.producer_tasks where id = pg_temp.i('a0')), pg_temp.col(pg_temp.bE(), 'A fazer'), 'falta item em outra lista: o cartão não se move');
select lives_ok($$update public.task_checklist_items set done = true where id = pg_temp.i('3c')$$, 'marca o último item de todas as listas');
select is((select column_id from public.producer_tasks where id = pg_temp.i('a0')), pg_temp.col(pg_temp.bE(), 'Em revisão'), 'tudo feito: o cartão foi para "Em revisão"');
select is((select count(*) from public.task_checklist_items where checklist_id in (pg_temp.i('1d'), pg_temp.i('1e')) and done), 3::bigint, 'os itens continuam marcados');
select pg_temp.como('postgres');
select is((select count(*) from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'tipo' = 'movido' and metadata ->> 'task_id' = pg_temp.i('a0')::text), 1::bigint,
  'o observador recebeu o aviso "movido" (gatilho da 2B)');
select is((select count(*) from public.task_activity where kind = 'movido' and task_id = pg_temp.i('a0')), 1::bigint, 'histórico: 1 movimento');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$update public.task_checklist_items set done = false where id = pg_temp.i('3a')$$, 'desmarca');
select lives_ok($$update public.task_checklist_items set done = true where id = pg_temp.i('3a')$$, 'marca de novo (já está na revisão)');
select pg_temp.como('postgres');
select is((select count(*) from public.task_activity where kind = 'movido' and task_id = pg_temp.i('a0')), 1::bigint, 'cartão já na coluna de revisão: nada se move de novo');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$update public.task_checklist_items set done = true where id = pg_temp.i('3d')$$, 'marca item de cartão sem ck_move');
select is((select column_id from public.producer_tasks where id = pg_temp.i('a1')), pg_temp.col(pg_temp.bE(), 'A fazer'), 'sem ck_move o cartão não se move');
select lives_ok($$update public.task_checklist_items set done = true where id = pg_temp.i('4a')$$, 'marca item de cartão em "Feito"');
select is((select column_id from public.producer_tasks where id = pg_temp.i('a8')), pg_temp.col(pg_temp.bE(), 'Feito'), 'cartão em coluna done fica onde está');
select lives_ok($$update public.task_checklist_items set done = true where id = pg_temp.i('4b')$$, 'marca item de cartão arquivado');
select is((select column_id from public.producer_tasks where id = pg_temp.i('a9')), pg_temp.col(pg_temp.bE(), 'A fazer'), 'cartão arquivado não se move');
select lives_ok($$update public.task_checklist_items set done = true where id = pg_temp.i('3f')$$, 'marca o único item (a outra lista está vazia)');
select is((select column_id from public.producer_tasks where id = pg_temp.i('a7')), pg_temp.col(pg_temp.bE(), 'Em revisão'), 'lista vazia não bloqueia o movimento');
-- dependência aberta: mover é recusado, mas o item fica marcado e o motivo vai ao histórico
select lives_ok($$update public.task_checklist_items set done = true where id = pg_temp.i('3e')$$, 'marca o item de cartão com dependência aberta (a marcação não falha)');
select is((select done from public.task_checklist_items where id = pg_temp.i('3e')), true, 'o item continua marcado');
select is((select column_id from public.producer_tasks where id = pg_temp.i('a6')), pg_temp.col(pg_temp.bE(), 'A fazer'), 'o cartão não saiu da coluna');
select pg_temp.como('postgres');
select is((select data ->> 'motivo' from public.task_activity where kind = 'checklist_recusado' and task_id = pg_temp.i('a6')),
  'Este cartão depende de outro que ainda não foi concluído.', 'histórico: motivo da recusa');
-- quadro sem coluna de revisão
update public.task_boards set review_column_id = null where id = pg_temp.bE();
update public.task_checklist_items set done = false where id = pg_temp.i('3a');
update public.producer_tasks set column_id = pg_temp.col(pg_temp.bE(), 'A fazer') where id = pg_temp.i('a0');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$update public.task_checklist_items set done = true where id = pg_temp.i('3a')$$, 'marca com o quadro sem coluna de revisão');
select is((select column_id from public.producer_tasks where id = pg_temp.i('a0')), pg_temp.col(pg_temp.bE(), 'A fazer'), 'sem review_column_id o cartão não se move');
select pg_temp.como('postgres');
-- backfill (o mesmo UPDATE do SQL) e coluna apagada
update public.task_boards b set review_column_id = (select c.id from public.task_columns c
    where c.board_id = b.id and c.name = 'Em revisão' order by c.position, c.id limit 1) where b.review_column_id is null;
select is((select review_column_id from public.task_boards where id = pg_temp.bE()), pg_temp.col(pg_temp.bE(), 'Em revisão'), 'o preenchimento dos quadros existentes acha "Em revisão"');
-- ck_move e review_column_id: quem altera
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$update public.producer_tasks set ck_move = true where id = pg_temp.i('a1')$$, 'editor liga ck_move');
with u as (update public.task_boards set review_column_id = null where id = pg_temp.bE() returning 1) select is((select count(*) from u), 0::bigint, 'editor não altera review_column_id (0 linhas)');
select pg_temp.como('authenticated', pg_temp.i('a2'));
with u as (update public.task_boards set review_column_id = null where id = pg_temp.bE() returning 1) select is((select count(*) from u), 0::bigint, '''ver'' não altera review_column_id (0 linhas)');
with u as (update public.producer_tasks set ck_move = false where id = pg_temp.i('a1') returning 1) select is((select count(*) from u), 0::bigint, '''ver'' não altera ck_move (0 linhas)');
select pg_temp.como('authenticated', pg_temp.i('a4'));
with u as (update public.task_boards set review_column_id = null where id = pg_temp.bE() returning 1) select is((select count(*) from u), 0::bigint, 'bloqueado não altera review_column_id (0 linhas)');
select pg_temp.como('authenticated', pg_temp.i('02'));
with u as (update public.task_boards set review_column_id = null where id = pg_temp.bE() returning 1) select is((select count(*) from u), 0::bigint, 'outro produtor não altera review_column_id (0 linhas)');
select pg_temp.como('authenticated', pg_temp.i('01'));
select lives_ok($$update public.task_boards set review_column_id = pg_temp.col(pg_temp.bE(), 'Em andamento') where id = pg_temp.bE()$$, 'o dono escolhe outra coluna de revisão');
select is((select review_column_id from public.task_boards where id = pg_temp.bE()), pg_temp.col(pg_temp.bE(), 'Em andamento'), 'review_column_id gravado');
select throws_ok($$update public.task_boards set review_column_id = pg_temp.col(pg_temp.bP(), 'Feito') where id = pg_temp.bE()$$, '23514', 'Coluna de revisão de outro quadro.', 'coluna de outro quadro é recusada');
select lives_ok($$update public.task_boards set review_column_id = null where id = pg_temp.bE()$$, 'o dono limpa a coluna de revisão');
select lives_ok($$insert into public.task_columns (board_id, name, kind, position) values (pg_temp.bE(), 'Temporária', 'doing', 9000)$$, 'dono cria coluna');
select lives_ok($$update public.task_boards set review_column_id = pg_temp.col(pg_temp.bE(), 'Temporária') where id = pg_temp.bE()$$, 'e a usa como revisão');
select lives_ok($$delete from public.task_columns where name = 'Temporária' and board_id = pg_temp.bE()$$, 'apagar a coluna de revisão (sem cartões)');
select is((select review_column_id from public.task_boards where id = pg_temp.bE()), null::uuid, 'apagar a coluna leva review_column_id a nulo');
select lives_ok($$insert into public.task_columns (board_id, name, kind, position) values (pg_temp.bE(), 'Em revisão', 'doing', 9500)$$, 'uma nova coluna chamada "Em revisão"');
select is((select review_column_id from public.task_boards where id = pg_temp.bE()), (select id from public.task_columns where board_id = pg_temp.bE() and position = 9500),
  'e o quadro sem coluna de revisão passa a usá-la (gatilho de task_columns)');
select pg_temp.como('postgres');
-- o gatilho não sobrescreve escolha existente
select lives_ok($$insert into public.task_columns (board_id, name, kind, position) values (pg_temp.bE(), 'Em revisão', 'doing', 9600)$$, 'mais uma coluna "Em revisão"');
select is((select review_column_id from public.task_boards where id = pg_temp.bE()), (select id from public.task_columns where board_id = pg_temp.bE() and position = 9500),
  'quem já tem coluna de revisão não é sobrescrito');
-- apagar evento com o novo vínculo circular (quadro -> coluna): o quadro do evento some em cascata
delete from public.task_dependencies where task_id in (select id from public.producer_tasks where board_id = (select id from public.task_boards where event_id = pg_temp.i('e2')));
delete from public.events where id = pg_temp.i('e2');
select is((select count(*) from public.task_boards where event_id = pg_temp.i('e2')), 0::bigint, 'apagar o evento ainda leva o quadro e as colunas em cascata (FK circular review_column_id)');

-- Papéis sugeridos ----------------------------------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is((select array_agg(x ->> 'id' order by x ->> 'id') from jsonb_array_elements(public.quadro_papeis_sugerir(pg_temp.bE())) x),
  array[pg_temp.i('01')::text, pg_temp.i('a2')::text, pg_temp.i('a3')::text], 'sugere o dono e os membros aceitos com a ferramenta (sem bloqueado, sem membro de outra ferramenta, sem outro produtor)');
select is((select x ->> 'nome' from jsonb_array_elements(public.quadro_papeis_sugerir(pg_temp.bE())) x where x ->> 'id' = pg_temp.i('a3')::text), 'Edita', 'traz o nome de exibição');
select is((select array_agg(distinct k) from jsonb_array_elements(public.quadro_papeis_sugerir(pg_temp.bE())) x, jsonb_object_keys(x) k), array['id', 'nome'], 'só id e nome');
select ok(public.quadro_papeis_sugerir(pg_temp.bE())::text !~ '@' and public.quadro_papeis_sugerir(pg_temp.bE())::text !~* 'mail', 'e-mail nunca aparece');
select pg_temp.como('postgres');
update public.profiles set full_name = null where id = pg_temp.i('a2');
select pg_temp.como('authenticated', pg_temp.i('01'));
select is((select x ->> 'nome' from jsonb_array_elements(public.quadro_papeis_sugerir(pg_temp.bE())) x where x ->> 'id' = pg_temp.i('a2')::text), 'Sem nome',
  'sem nome cadastrado: "Sem nome" (nunca o e-mail)');
select pg_temp.como('authenticated', pg_temp.i('a2'));
select throws_ok($$select public.quadro_papeis_sugerir(pg_temp.bE())$$, '42501', 'Sem permissão para este quadro.', '''ver'' não pede a lista de sugestões');
select pg_temp.como('authenticated', pg_temp.i('a4'));
select throws_ok($$select public.quadro_papeis_sugerir(pg_temp.bE())$$, '42501', null, 'bloqueado não pede a lista');
select pg_temp.como('authenticated', pg_temp.i('02'));
select throws_ok($$select public.quadro_papeis_sugerir(pg_temp.bE())$$, '42501', null, 'outro produtor não pede a lista');

-- 2FA: com fator verificado, só aal2 passa -----------------------------------------------------------------------------------------------------------
select pg_temp.como('postgres');
update public.producer_tasks set recur_days = 7 where id = pg_temp.i('d1');
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
  values (pg_temp.i('aa'), pg_temp.i('a3'), 'totp', 'totp', 'verified', now(), now());
select pg_temp.como('authenticated', pg_temp.i('a3'), 'aal1');
select throws_ok($$select public.quadro_rodar_botao(pg_temp.i('b5'), pg_temp.i('d1'))$$, '42501', null, 'com 2FA ativo e sessão aal1, rodar botão é recusado');
select throws_ok($$select public.quadro_aplicar_modelo(pg_temp.bE(), 'festa')$$, '42501', null, 'com 2FA ativo e sessão aal1, aplicar modelo é recusado');
select throws_ok($$select public.quadro_gerar_recorrente(pg_temp.i('d1'))$$, '42501', null, 'com 2FA ativo e sessão aal1, gerar recorrência é recusado');
select throws_ok($$select public.quadro_papeis_sugerir(pg_temp.bE())$$, '42501', null, 'com 2FA ativo e sessão aal1, sugerir papéis é recusado');
select is((select count(*) from public.task_buttons), 0::bigint, 'com 2FA ativo e sessão aal1, a RLS não devolve linha de task_buttons');
select is((select count(*) from public.task_roles), 0::bigint, 'com 2FA ativo e sessão aal1, a RLS não devolve linha de task_roles');
select is((select count(*) from public.task_templates), 0::bigint, 'com 2FA ativo e sessão aal1, a RLS não devolve linha de task_templates');
select pg_temp.como('authenticated', pg_temp.i('a3'), 'aal2');
select lives_ok($$select public.quadro_rodar_botao(pg_temp.i('b5'), pg_temp.i('d1'))$$, 'com sessão aal2 passa');
select lives_ok($$select public.quadro_papeis_sugerir(pg_temp.bE())$$, 'sugerir papéis com aal2 passa');
select pg_temp.como('postgres');
delete from auth.mfa_factors where id = pg_temp.i('aa');

-- Desfazer (ensaio do cabeçalho do SQL, na ordem; o cron não existe aqui) ----------------------------------------------------------------------------------
select pg_temp.como('postgres');
create temp table _dono as select (select tableowner = current_user or (select rolsuper from pg_roles where rolname = current_user)
  from pg_tables where schemaname = 'public' and tablename = 'task_buttons') as ok;
do $d$ begin
  if (select ok from _dono) then
drop trigger if exists producer_tasks_quadro_rec on public.producer_tasks;
drop trigger if exists producer_tasks_quadro_limite on public.producer_tasks;
drop index if exists public.producer_tasks_recur_idx;
drop trigger if exists task_checklist_items_ckmove on public.task_checklist_items;
drop trigger if exists task_columns_review on public.task_columns;
drop trigger if exists task_boards_review on public.task_boards;
delete from public.task_activity where kind in ('botao', 'modelo', 'recorrente', 'checklist_recusado');
alter table public.task_activity drop constraint if exists task_activity_kind_check;
alter table public.task_activity add constraint task_activity_kind_check
  check (kind in ('criado', 'movido', 'arquivado', 'desarquivado', 'comentario', 'comentario_apagado', 'anexo'));
drop table if exists public.task_buttons, public.task_roles, public.task_templates;
alter table public.task_boards drop column if exists review_column_id;
alter table public.producer_tasks drop column if exists ck_move;
drop function if exists public.quadro_rodar_botao(uuid, uuid), public.quadro_aplicar_modelo(uuid, text, int[]),
  public.quadro_gerar_recorrente(uuid), public.quadro_gerar_recorrente_interno(uuid), public.quadro_gerar_recorrentes_vencidas(),
  public.quadro_papeis_sugerir(uuid), public.quadro_steps_ok(jsonb), public.quadro_tem_ferramenta(uuid, uuid),
  public.task_roles_tg(), public.task_buttons_tg(), public.producer_tasks_rec_tg(), public.task_checklist_items_ckmove_tg(),
  public.task_columns_review_tg(), public.task_boards_review_tg();
  end if;
end $d$;
select skip('Desfazer: só o dono das tabelas (ou superusuário) ensaia o Desfazer; aqui current_user não é', 9) where not (select ok from _dono);
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
           and (p.proname in ('quadro_rodar_botao', 'quadro_aplicar_modelo', 'quadro_gerar_recorrente', 'quadro_gerar_recorrente_interno',
                              'quadro_gerar_recorrentes_vencidas', 'quadro_papeis_sugerir', 'quadro_steps_ok', 'quadro_tem_ferramenta')
                or p.proname in ('task_roles_tg', 'task_buttons_tg', 'producer_tasks_rec_tg', 'task_checklist_items_ckmove_tg',
                                 'task_columns_review_tg', 'task_boards_review_tg'))), 0::bigint, 'Desfazer: funções da 2C removidas')
  where (select ok from _dono);
select is(to_regclass('public.task_buttons') is null and to_regclass('public.task_roles') is null and to_regclass('public.task_templates') is null, true,
  'Desfazer: tabelas novas removidas') where (select ok from _dono);
select is((select count(*) from information_schema.columns where table_schema = 'public'
           and ((table_name = 'task_boards' and column_name = 'review_column_id') or (table_name = 'producer_tasks' and column_name = 'ck_move'))), 0::bigint,
  'Desfazer: colunas novas removidas') where (select ok from _dono);
select is((select count(*) from pg_trigger where not tgisinternal and tgname in ('producer_tasks_quadro_rec', 'producer_tasks_quadro_limite', 'task_checklist_items_ckmove',
           'task_columns_review', 'task_boards_review')), 0::bigint, 'Desfazer: gatilhos removidos') where (select ok from _dono);
select is(to_regclass('public.producer_tasks_recur_idx') is null, true, 'Desfazer: índice do cron removido') where (select ok from _dono);
select policies_are('public', 'task_boards', array['gf_mfa_aal2', 'task_boards_recibos', 'task_boards_ver'], 'Desfazer: task_boards como na 2B')
  where (select ok from _dono);
select is(has_column_privilege('authenticated', 'public.task_boards', 'show_receipts', 'update'), true, 'Desfazer: o que era da 2B continua (show_receipts)')
  where (select ok from _dono);
select is((select pg_get_constraintdef(oid) like '%anexo''::text])%' from pg_constraint where conname = 'task_activity_kind_check'), true,
  'Desfazer: regra de kind do histórico volta à da 2A') where (select ok from _dono);
select is(to_regprocedure('public.quadro_notificar(uuid, uuid, text, text, uuid)') is not null, true, 'Desfazer: funções da 2B intactas')
  where (select ok from _dono);

select * from finish();
rollback;
