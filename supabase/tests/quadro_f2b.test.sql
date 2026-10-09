-- pgTAP da fatia 2B do Quadro (docs/sql/20261106_quadro_f2b_notificacoes.sql): avisos, preferências, prazos, recibos e "visto por".
-- Só no banco local: aplicar 20261017_team_members_rls, 20261103, 20261105 e 20261106 e rodar `supabase test db`.
-- Tudo em begin ... rollback: nada fica gravado. Nunca contra produção. Sem pg_cron local, os prazos são chamados direto.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(201);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  -- 'postgres' = o papel da sessão (postgres ou supabase_admin, dono das tabelas): o teste vale para os dois
  if p_role = 'postgres' then execute 'reset role'; else perform set_config('role', p_role, true); end if;
end $f$;
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated;
-- atalho para os ids fixos: i('a2') = fe000000-0000-4000-8000-0000000000a2
create function pg_temp.i(p text) returns uuid language sql immutable as $f$
  select ('fe000000-0000-4000-8000-' || lpad(p, 12, '0'))::uuid $f$;
grant execute on function pg_temp.i(text) to anon, authenticated;
do $g$ declare r record; begin
  for r in select p.oid::regprocedure as f from pg_proc p join pg_depend d on d.objid = p.oid and d.deptype = 'e'
           join pg_extension e on e.oid = d.refobjid where e.extname = 'pgtap' loop
    begin execute 'grant execute on function ' || r.f || ' to anon, authenticated';
    exception when others then null; end;
  end loop;
end $g$;

-- Dados (como postgres): p1 dono; p2 outro produtor; mv membro 'ver'; me membro 'editar'; mb membro bloqueado; x conta solta
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  (pg_temp.i('01'), 'p1@teste-f2b.local', now(), '{"role":"producer","full_name":"Paula"}'),
  (pg_temp.i('02'), 'p2@teste-f2b.local', now(), '{"role":"producer","full_name":"Pedro"}'),
  (pg_temp.i('a2'), 'mv@teste-f2b.local', now(), '{"full_name":"So ve"}'),
  (pg_temp.i('a3'), 'me@teste-f2b.local', now(), '{"full_name":"Edita"}'),
  (pg_temp.i('a4'), 'mb@teste-f2b.local', now(), '{"full_name":"Bloqueado"}'),
  (pg_temp.i('b1'), 'x@teste-f2b.local', now(), '{"full_name":"Solta"}'),
  (pg_temp.i('a5'), 'mp@teste-f2b.local', now(), '{"full_name":"Sem quadro"}');
insert into public.team_members (id, producer_id, user_id, role, accepted_at, blocked_at) values
  (pg_temp.i('c2'), pg_temp.i('01'), pg_temp.i('a2'), 'editor', now(), null),
  (pg_temp.i('c3'), pg_temp.i('01'), pg_temp.i('a3'), 'editor', now(), null),
  (pg_temp.i('c4'), pg_temp.i('01'), pg_temp.i('a4'), 'editor', now(), now()),
  (pg_temp.i('c5'), pg_temp.i('01'), pg_temp.i('a5'), 'editor', now(), null); -- membro aceito SEM a ferramenta quadro
insert into public.team_member_tools (member_id, ferramenta, nivel) values
  (pg_temp.i('c2'), 'quadro', 'ver'), (pg_temp.i('c3'), 'quadro', 'editar'), (pg_temp.i('c4'), 'quadro', 'editar');
insert into public.producer_tasks (id, producer_id, title) values
  (pg_temp.i('d1'), pg_temp.i('01'), 'A'), (pg_temp.i('d2'), pg_temp.i('01'), 'B'), (pg_temp.i('d9'), pg_temp.i('02'), 'Z');

-- Estrutura -----------------------------------------------------------------------------------------------------------------
select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'task\_%' and not c.relrowsecurity), 0::bigint,
  'toda tabela task_* tem RLS ligada');
select policies_are('public', 'task_notification_prefs',
  array['gf_mfa_aal2', 'task_notification_prefs_apagar', 'task_notification_prefs_criar', 'task_notification_prefs_editar', 'task_notification_prefs_ver'],
  'prefs: regras por operação e 2FA');
select policies_are('public', 'task_prazo_avisos', array['gf_mfa_aal2'], 'avisos de prazo: nenhuma regra permissiva para clientes');
select policies_are('public', 'task_card_views', array['gf_mfa_aal2', 'task_card_views_ver'], '"visto por": só ver e 2FA');
select policies_are('public', 'task_boards', array['gf_mfa_aal2', 'task_boards_recibos', 'task_boards_ver'], 'task_boards: ver, recibos e 2FA');
select is((select count(*) from information_schema.role_table_grants where grantee in ('anon', 'public') and table_schema = 'public'
           and table_name like 'task\_%'), 0::bigint, 'anon sem privilégio em tabela task_*');
select is((select count(*) from information_schema.columns where table_schema = 'public'
           and (table_name like 'task\_%' or table_name = 'producer_tasks') and column_name ~* '(^|_)ip(_|$)'), 0::bigint,
  'nenhuma coluna de IP nas tabelas do quadro (LGPD)');
select is(has_function_privilege('authenticated', 'public.quadro_notificar(uuid, uuid, text, text, uuid)', 'execute'), false,
  'authenticated não executa quadro_notificar');
select is(has_function_privilege('anon', 'public.quadro_notificar(uuid, uuid, text, text, uuid)', 'execute'), false,
  'anon não executa quadro_notificar');
select is(has_function_privilege('authenticated', 'public.quadro_avisar_prazos()', 'execute'), false, 'authenticated não executa quadro_avisar_prazos');
select is(has_function_privilege('anon', 'public.quadro_avisar_prazos()', 'execute'), false, 'anon não executa quadro_avisar_prazos');
select is(bool_or(has_function_privilege('authenticated', f, 'execute') or has_function_privilege('anon', f, 'execute')), false,
  'funções de gatilho dos avisos sem EXECUTE para authenticated e anon')
  from unnest(array['public.task_card_members_notif_tg()', 'public.task_comments_notif_tg()', 'public.producer_tasks_notif_tg()']) f;
select is(has_function_privilege('authenticated', 'public.quadro_marcar_lido(uuid, text)', 'execute')
          and has_function_privilege('authenticated', 'public.quadro_marcar_entregue(uuid[], text)', 'execute'), true,
  'authenticated executa as funções de leitura');
select is(has_function_privilege('anon', 'public.quadro_marcar_lido(uuid, text)', 'execute')
          or has_function_privilege('anon', 'public.quadro_marcar_entregue(uuid[], text)', 'execute'), false, 'anon não executa as funções de leitura');
select is(has_any_column_privilege('authenticated', 'public.task_comment_receipts', 'insert,update')
          or has_any_column_privilege('authenticated', 'public.task_card_views', 'insert,update'), false,
  'authenticated sem INSERT nem UPDATE (nem por coluna) em recibos e "visto por"');
select is(has_any_column_privilege('authenticated', 'public.task_prazo_avisos', 'select,insert,update'), false, 'authenticated sem acesso a task_prazo_avisos');
select is((select show_receipts from public.task_boards limit 1), true, 'show_receipts nasce ligado');
select throws_ok($$select public.quadro_notificar(null, null, 'xx', 'x', null)$$, '22023', 'Tipo de aviso do quadro inválido.', 'tipo de aviso fora da lista é recusado');

-- Anon ------------------------------------------------------------------------------------------------------------------------
select pg_temp.como('anon');
select throws_ok('select count(*) from public.task_notification_prefs', '42501', null, 'anon não lê preferências');
select throws_ok($$select public.quadro_marcar_lido(pg_temp.i('d1'), 'celular')$$, '42501', null, 'anon não chama quadro_marcar_lido');
select throws_ok($$select public.quadro_marcar_entregue(array[pg_temp.i('d1')], 'celular')$$, '42501', null, 'anon não chama quadro_marcar_entregue');
select throws_ok($$select public.quadro_avisar_prazos()$$, '42501', null, 'anon não chama quadro_avisar_prazos');

-- Preferências e check das chaves ---------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$insert into public.task_notification_prefs (general, sound, types) values
  (true, false, '{"mencao":{"app":true,"email":false},"prazo":{"app":false,"email":false}}')$$, 'a pessoa grava a própria preferência (user_id padrão)');
select throws_ok($$insert into public.task_notification_prefs (user_id) values (pg_temp.i('a2'))$$, '42501', null, 'preferência em nome de outra pessoa é recusada');
select throws_ok($$update public.task_notification_prefs set types = '{"spam":{"app":true,"email":true}}'$$, '23514', null, 'chave fora dos 6 tipos é recusada');
select throws_ok($$update public.task_notification_prefs set types = '{"mencao":{"app":true}}'$$, '23514', null, 'valor sem email é recusado');
select throws_ok($$update public.task_notification_prefs set types = '{"mencao":{"app":"sim","email":true}}'$$, '23514', null, 'app que não é booleano é recusado');
select throws_ok($$update public.task_notification_prefs set types = '{"mencao":{"app":true,"email":true,"x":1}}'$$, '23514', null, 'chave extra no valor é recusada');
select throws_ok($$update public.task_notification_prefs set types = '[1]'$$, '23514', null, 'types que não é objeto é recusado');
select throws_ok($$update public.task_notification_prefs set types = '{"mencao":true}'$$, '23514', null, 'valor que não é objeto é recusado');
select lives_ok($$update public.task_notification_prefs set general = false, sound = true, types = '{}'$$, 'a pessoa altera a própria preferência');
select throws_ok($$update public.task_notification_prefs set user_id = pg_temp.i('a2')$$, '42501', null, 'user_id da preferência não muda');
select is((select count(*) from public.task_notification_prefs), 1::bigint, 'a pessoa lê a própria linha');
select pg_temp.como('authenticated', pg_temp.i('01'));
select is((select count(*) from public.task_notification_prefs), 0::bigint, 'o dono do quadro não lê a preferência de outra pessoa');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$update public.task_notification_prefs set general = true$$, 'preferência volta a ligada');
-- upsert do PostgREST (ON CONFLICT ... SET user_id = excluded.user_id): o grant de UPDATE não cobre user_id, então dá 42501.
-- Por isso o front usa update + insert, nunca upsert.
select throws_ok($$insert into public.task_notification_prefs (user_id, general, sound, types) values (pg_temp.i('a3'), true, true, '{}')
  on conflict (user_id) do update set user_id = excluded.user_id, general = excluded.general, sound = excluded.sound, types = excluded.types$$,
  '42501', null, 'upsert no formato do PostgREST é negado (user_id fora do grant de UPDATE)');
select pg_temp.como('postgres');
insert into public.task_notification_prefs (user_id, general) values (pg_temp.i('a2'), false);
select pg_temp.como('authenticated', pg_temp.i('a3'));
with u as (update public.task_notification_prefs set general = true where user_id = pg_temp.i('a2') returning 1)
  select is((select count(*) from u), 0::bigint, 'não altera a preferência de outra pessoa (0 linhas)');
with d as (delete from public.task_notification_prefs where user_id = pg_temp.i('a2') returning 1)
  select is((select count(*) from d), 0::bigint, 'não apaga a preferência de outra pessoa (0 linhas)');
select pg_temp.como('postgres');
delete from public.task_notification_prefs where user_id = pg_temp.i('a2');
select pg_temp.como('authenticated', pg_temp.i('a3'));

-- show_receipts: só o dono ------------------------------------------------------------------------------------------------------
with u as (update public.task_boards set show_receipts = false returning 1) select is((select count(*) from u), 0::bigint, '''editar'' não altera show_receipts (0 linhas)');
select pg_temp.como('authenticated', pg_temp.i('a2'));
with u as (update public.task_boards set show_receipts = false returning 1) select is((select count(*) from u), 0::bigint, '''ver'' não altera show_receipts (0 linhas)');
select pg_temp.como('authenticated', pg_temp.i('a4'));
with u as (update public.task_boards set show_receipts = false returning 1) select is((select count(*) from u), 0::bigint, 'bloqueado não altera show_receipts (0 linhas)');
select pg_temp.como('authenticated', pg_temp.i('02'));
with u as (update public.task_boards set show_receipts = false where producer_id = pg_temp.i('01') returning 1)
  select is((select count(*) from u), 0::bigint, 'outro produtor não altera show_receipts do quadro alheio (0 linhas)');
select pg_temp.como('authenticated', pg_temp.i('01'));
select throws_ok($$update public.task_boards set name = 'outro nome'$$, '42501', null, 'o dono não altera o nome do quadro pela API');
select lives_ok($$update public.task_boards set show_receipts = false where producer_id = pg_temp.i('01')$$, 'o dono desliga show_receipts');
select is((select show_receipts from public.task_boards where producer_id = pg_temp.i('01')), false, 'show_receipts desligado');
select lives_ok($$update public.task_boards set show_receipts = true where producer_id = pg_temp.i('01')$$, 'o dono religa show_receipts');

-- Atribuição ---------------------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$insert into public.task_card_members (task_id, user_id) values (pg_temp.i('d1'), pg_temp.i('a2'))$$, 'editor atribui membro ao cartão');
select lives_ok($$insert into public.task_card_members (task_id, user_id) values (pg_temp.i('d1'), pg_temp.i('a3'))$$, 'editor se atribui ao cartão');
select lives_ok($$insert into public.task_card_members (task_id, user_id) values (pg_temp.i('d1'), pg_temp.i('01'))$$, 'editor atribui o dono ao cartão');
select pg_temp.como('postgres');
select is((select count(*) from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'tipo' = 'atribuicao'), 1::bigint, 'o membro atribuído recebe 1 aviso de atribuição');
select is((select title from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'tipo' = 'atribuicao'), 'Nova atribuição', 'título do aviso de atribuição');
select is((select type from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'tipo' = 'atribuicao'), 'info', 'tipo info para atribuição');
select is((select body from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'tipo' = 'atribuicao'),
  'Você foi atribuído ao cartão “A”.', 'texto: só o título do cartão');
select is((select metadata ->> 'url' from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'tipo' = 'atribuicao'),
  '/producer/tasks?cartao=' || pg_temp.i('d1'), 'metadata.url aponta para o cartão');
select ok((select metadata ->> 'url' ~ '^/(?![/\\])' from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'tipo' = 'atribuicao'),
  'metadata.url passa na regex do front (começa com uma barra)');
select is((select metadata ->> 'kind' from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'tipo' = 'atribuicao'), 'quadro', 'metadata.kind = quadro');
select is((select (metadata ->> 'board_id')::uuid from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'tipo' = 'atribuicao'),
  (select board_id from public.producer_tasks where id = pg_temp.i('d1')), 'metadata.board_id é o quadro do cartão');
select is((select count(*) from public.notifications where user_id = pg_temp.i('a3')), 0::bigint, 'quem se atribui (o autor) não é avisado');
select is((select count(*) from public.notifications where user_id = pg_temp.i('01') and metadata ->> 'tipo' = 'atribuicao'), 1::bigint, 'o dono atribuído por outra pessoa é avisado');

-- Observadores, menção e mensagem ---------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', pg_temp.i('a2'));
select lives_ok($$insert into public.task_watchers (task_id, user_id) values (pg_temp.i('d1'), pg_temp.i('a2'))$$, '''ver'' observa o cartão');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$insert into public.task_watchers (task_id, user_id) values (pg_temp.i('d1'), pg_temp.i('a3'))$$, 'o editor também observa o cartão');
select lives_ok($$insert into public.task_comments (task_id, body, mentions) values
  (pg_temp.i('d1'), 'oi @so-ve <b>negrito</b>', array[pg_temp.i('a2'), pg_temp.i('a2')])$$, 'editor comenta e menciona (com repetição)');
select pg_temp.como('postgres');
select is((select count(*) from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'tipo' = 'mencao'), 1::bigint, 'menção repetida gera 1 aviso');
select is((select title from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'tipo' = 'mencao'), 'Você foi mencionado', 'título do aviso de menção');
select is((select body from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'tipo' = 'mencao'),
  'Você foi mencionado em um comentário do cartão “A”.', 'texto da menção: só o título do cartão, nunca o corpo do comentário');
select is((select count(*) from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'tipo' = 'mensagem'), 0::bigint, 'quem foi mencionado não recebe também ''mensagem''');
select is((select count(*) from public.notifications where user_id = pg_temp.i('01') and metadata ->> 'tipo' = 'mensagem'), 1::bigint, 'membro do cartão não mencionado recebe ''mensagem''');
select is((select title || '|' || type || '|' || body from public.notifications where user_id = pg_temp.i('01') and metadata ->> 'tipo' = 'mensagem'),
  'Nova mensagem|info|Novo comentário no cartão “A”.', 'título, tipo e texto da mensagem');
select is((select count(*) from public.notifications where user_id = pg_temp.i('a3') and metadata ->> 'tipo' in ('mencao', 'mensagem')), 0::bigint,
  'o autor do comentário não é avisado');
select is((select count(*) from public.notifications where user_id = pg_temp.i('b1')), 0::bigint, 'quem não é do cartão não recebe nada');

-- Texto puro, corte, não-equipe, bloqueado, ator ------------------------------------------------------------------------------------
select public.quadro_notificar(pg_temp.i('01'), pg_temp.i('d1'), 'automacao', '<script>alert(1)</script>Olá <b>mundo</b>   ' || repeat('x', 400), null);
select is((select body from public.notifications where user_id = pg_temp.i('01') and metadata ->> 'tipo' = 'automacao'),
  left('alert(1)Olá mundo ' || repeat('x', 400), 200), 'HTML removido, espaços juntados e texto cortado em 200');
select is((select length(body) from public.notifications where user_id = pg_temp.i('01') and metadata ->> 'tipo' = 'automacao'), 200, 'body com 200 caracteres');
select is((select title from public.notifications where user_id = pg_temp.i('01') and metadata ->> 'tipo' = 'automacao'), 'Automação', 'título da automação');
select public.quadro_notificar(pg_temp.i('b1'), pg_temp.i('d1'), 'mensagem', 'x', null);
select public.quadro_notificar(pg_temp.i('a4'), pg_temp.i('d1'), 'mensagem', 'x', null);
select public.quadro_notificar(pg_temp.i('02'), pg_temp.i('d1'), 'mensagem', 'x', null);
select is((select count(*) from public.notifications where user_id in (pg_temp.i('b1'), pg_temp.i('a4'), pg_temp.i('02'))), 0::bigint,
  'conta solta, membro bloqueado e outro produtor não recebem aviso do cartão');
select public.quadro_notificar(pg_temp.i('a2'), pg_temp.i('d1'), 'mensagem', 'x', pg_temp.i('a2'));
select is((select count(*) from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'tipo' = 'mensagem'), 0::bigint, 'p_actor = p_user: não avisa o autor');
select public.quadro_notificar(pg_temp.i('a2'), pg_temp.i('d1'), 'prazo', 'x', null);
select is((select type from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'tipo' = 'prazo'), 'reminder', 'prazo vira type reminder');

-- Preferências silenciam -------------------------------------------------------------------------------------------------------------
insert into public.task_notification_prefs (user_id, general, types) values (pg_temp.i('a2'), false, '{}');
create temp table _n as select count(*) as n from public.notifications where user_id = pg_temp.i('a2');
select public.quadro_notificar(pg_temp.i('a2'), pg_temp.i('d1'), 'mensagem', 'x', null);
select is((select count(*) from public.notifications where user_id = pg_temp.i('a2')), (select n from _n), 'general desligado silencia tudo');
update public.task_notification_prefs set general = true, types = '{"mencao":{"app":false,"email":true}}' where user_id = pg_temp.i('a2');
select public.quadro_notificar(pg_temp.i('a2'), pg_temp.i('d1'), 'mencao', 'x', null);
select is((select count(*) from public.notifications where user_id = pg_temp.i('a2')), (select n from _n), 'types[tipo].app desligado silencia só aquele tipo');
select public.quadro_notificar(pg_temp.i('a2'), pg_temp.i('d1'), 'mensagem', 'x', null);
select is((select count(*) from public.notifications where user_id = pg_temp.i('a2')), (select n + 1 from _n), 'os outros tipos continuam chegando');
update public.task_notification_prefs set types = '{"mensagem":{"app":true,"email":false}}' where user_id = pg_temp.i('a2');
select public.quadro_notificar(pg_temp.i('a2'), pg_temp.i('d2'), 'mensagem', 'y', null); -- outro cartão: o mesmo cartão cairia no freio de 10 min
select is((select count(*) from public.notifications where user_id = pg_temp.i('a2')), (select n + 2 from _n), 'app ligado explícito entrega');
delete from public.task_notification_prefs where user_id = pg_temp.i('a2');

-- Cartão movido -----------------------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$update public.producer_tasks set column_id = (select c.id from public.task_columns c where c.board_id = producer_tasks.board_id and c.name = 'Em andamento')
  where id = pg_temp.i('d1')$$, 'editor move o cartão');
select pg_temp.como('postgres');
select is((select body from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'tipo' = 'movido'),
  'O cartão “A” foi movido para “Em andamento”.', 'o observador recebe o aviso de movido, com o nome da coluna');
select is((select title from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'tipo' = 'movido'), 'Cartão movido', 'título do movido');
select is((select count(*) from public.notifications where user_id = pg_temp.i('a3') and metadata ->> 'tipo' = 'movido'), 0::bigint, 'quem moveu não é avisado');
select is((select count(*) from public.notifications where user_id = pg_temp.i('01') and metadata ->> 'tipo' = 'movido'), 0::bigint, 'quem não observa não recebe ''movido''');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$update public.producer_tasks set position = 5 where id = pg_temp.i('d1')$$, 'reordenar na mesma coluna');
select pg_temp.como('postgres');
select is((select count(*) from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'tipo' = 'movido'), 1::bigint, 'reordenar sem trocar de coluna não avisa');

-- Falha de aviso não impede a operação principal ----------------------------------------------------------------------------------------
create function pg_temp.quebra() returns trigger language plpgsql as $f$ begin raise exception 'aviso quebrado de propósito'; end $f$;
create trigger zz_quebra before insert on public.notifications for each row execute function pg_temp.quebra();
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$insert into public.task_comments (task_id, body, mentions) values (pg_temp.i('d1'), 'comentário com aviso quebrado', array[pg_temp.i('a2')])$$,
  'comentário é gravado mesmo se o aviso falhar');
select lives_ok($$insert into public.task_card_members (task_id, user_id) values (pg_temp.i('d2'), pg_temp.i('a2'))$$, 'membro é gravado mesmo se o aviso falhar');
select lives_ok($$update public.producer_tasks set column_id = (select c.id from public.task_columns c where c.board_id = producer_tasks.board_id and c.name = 'Feito')
  where id = pg_temp.i('d1')$$, 'cartão é movido mesmo se o aviso falhar');
select pg_temp.como('postgres');
select is((select count(*) from public.task_comments where body = 'comentário com aviso quebrado'), 1::bigint, 'o comentário existe');
select is((select count(*) from public.task_card_members where task_id = pg_temp.i('d2') and user_id = pg_temp.i('a2')), 1::bigint, 'o membro existe');
drop trigger zz_quebra on public.notifications;
update public.producer_tasks set column_id = (select c.id from public.task_columns c where c.board_id = producer_tasks.board_id and c.name = 'A fazer') where id = pg_temp.i('d1');

-- Teto de 200 avisos do quadro por pessoa por hora ----------------------------------------------------------------------------------------
delete from public.notifications where user_id = pg_temp.i('01');
insert into public.producer_tasks (id, producer_id, title) values (pg_temp.i('e0'), pg_temp.i('01'), 'P0');
insert into public.notifications (user_id, title, body, type, metadata)
  select pg_temp.i('01'), 't', 'b', 'info', jsonb_build_object('kind', 'quadro', 'tipo', 'mensagem') from generate_series(1, 199);
select public.quadro_notificar(pg_temp.i('01'), pg_temp.i('d1'), 'mensagem', 'a', null);
select is((select count(*) from public.notifications where user_id = pg_temp.i('01')), 200::bigint, 'o aviso 200 ainda entra');
select public.quadro_notificar(pg_temp.i('01'), pg_temp.i('d2'), 'mensagem', 'b', null);
select is((select count(*) from public.notifications where user_id = pg_temp.i('01')), 200::bigint, 'o 201º é ignorado em silêncio (teto por hora)');
insert into public.notifications (user_id, title, body, type) values (pg_temp.i('01'), 'sino comum', 'não é do quadro', 'info');
select public.quadro_notificar(pg_temp.i('01'), pg_temp.i('e0'), 'mensagem', 'c', null);
select is((select count(*) from public.notifications where user_id = pg_temp.i('01')), 201::bigint, 'aviso comum do sino não conta para o teto, e o do quadro segue bloqueado');
update public.notifications set created_at = now() - interval '2 hours' where user_id = pg_temp.i('01');
select public.quadro_notificar(pg_temp.i('01'), pg_temp.i('e0'), 'mensagem', 'd', null);
select is((select count(*) from public.notifications where user_id = pg_temp.i('01') and body = 'd'), 1::bigint, 'passada a hora, volta a avisar');

-- Destinatário sem a ferramenta quadro não recebe nada (gatilho: quem age é o editor) -------------------------------------------------
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$insert into public.task_card_members (task_id, user_id) values (pg_temp.i('d2'), pg_temp.i('a5'))$$, 'editor atribui ao cartão um membro sem a ferramenta quadro');
select lives_ok($$insert into public.task_comments (task_id, body, mentions) values (pg_temp.i('d2'), 'oi', array[pg_temp.i('a5')])$$, 'e o menciona num comentário');
select pg_temp.como('postgres');
insert into public.task_watchers (task_id, user_id) values (pg_temp.i('d2'), pg_temp.i('a5')); -- observador que perdeu (ou nunca teve) a ferramenta
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$update public.producer_tasks set column_id = (select c.id from public.task_columns c where c.board_id = producer_tasks.board_id and c.name = 'Em andamento')
  where id = pg_temp.i('d2')$$, 'editor move o cartão observado');
select pg_temp.como('postgres');
select is((select count(*) from public.notifications where user_id = pg_temp.i('a5')), 0::bigint,
  'membro sem a ferramenta quadro: atribuído, mencionado, membro e observador, nenhum aviso');
select public.quadro_notificar(pg_temp.i('a5'), pg_temp.i('d2'), 'mensagem', 'x', null);
select is((select count(*) from public.notifications where user_id = pg_temp.i('a5')), 0::bigint, 'também pela chamada sem login (caminho do cron)');
insert into public.team_member_tools (member_id, ferramenta, nivel) values (pg_temp.i('c5'), 'quadro', 'ver');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$update public.producer_tasks set column_id = (select c.id from public.task_columns c where c.board_id = producer_tasks.board_id and c.name = 'Em revisão')
  where id = pg_temp.i('d2')$$, 'editor move de novo, agora o membro tem ''ver''');
select pg_temp.como('postgres');
select is((select count(*) from public.notifications where user_id = pg_temp.i('a5') and metadata ->> 'tipo' = 'movido'), 1::bigint, 'com ''ver'' o observador recebe');
delete from public.team_member_tools where member_id = pg_temp.i('c5');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$update public.producer_tasks set column_id = (select c.id from public.task_columns c where c.board_id = producer_tasks.board_id and c.name = 'Feito')
  where id = pg_temp.i('d2')$$, 'editor move outra vez, o membro perdeu a ferramenta');
select pg_temp.como('postgres');
select is((select count(*) from public.notifications where user_id = pg_temp.i('a5') and metadata ->> 'tipo' = 'movido'), 1::bigint, 'quem perdeu a ferramenta deixa de receber');
update public.producer_tasks set column_id = (select c.id from public.task_columns c where c.board_id = producer_tasks.board_id and c.name = 'A fazer') where id = pg_temp.i('d2');
delete from public.task_watchers where user_id = pg_temp.i('a5');

-- Freios de frequência -----------------------------------------------------------------------------------------------------------------------
-- (a) atribui e desatribui em laço não reenche o sino de um colega e a menção legítima de outra pessoa chega
delete from public.notifications;
select pg_temp.como('authenticated', pg_temp.i('a3'));
do $m$ begin
  for k in 1..250 loop
    insert into public.task_card_members (task_id, user_id) values (pg_temp.i('e0'), pg_temp.i('a2'));
    delete from public.task_card_members where task_id = pg_temp.i('e0') and user_id = pg_temp.i('a2');
  end loop;
end $m$;
select pg_temp.como('postgres');
select is((select count(*) from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'tipo' = 'atribuicao'), 1::bigint,
  '250 atribui/desatribui no mesmo cartão: 1 aviso só (freio de 10 minutos)');
select pg_temp.como('authenticated', pg_temp.i('01'));
select lives_ok($$insert into public.task_comments (task_id, body, mentions) values (pg_temp.i('e0'), 'legítima', array[pg_temp.i('a2')])$$, 'o dono menciona o colega');
select pg_temp.como('postgres');
select is((select count(*) from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'tipo' = 'mencao'), 1::bigint, 'a menção legítima chega');
-- (a2) um comentário que avisa 100 pessoas conta como UM evento do ator: não o bloqueia
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  select ('fe000000-0000-4000-8000-' || lpad((60000 + g)::text, 12, '0'))::uuid, 'w' || g || '@teste-f2b.local', now(), '{"full_name":"W"}' from generate_series(1, 100) g;
insert into public.team_members (producer_id, user_id, role, accepted_at)
  select pg_temp.i('01'), ('fe000000-0000-4000-8000-' || lpad((60000 + g)::text, 12, '0'))::uuid, 'editor', now() from generate_series(1, 100) g;
insert into public.team_member_tools (member_id, ferramenta, nivel)
  select m.id, 'quadro', 'ver' from public.team_members m where m.user_id::text like 'fe000000-0000-4000-8000-00000006%';
insert into public.producer_tasks (id, producer_id, title) values (pg_temp.i('ea'), pg_temp.i('01'), 'W'), (pg_temp.i('eb'), pg_temp.i('01'), 'W2');
insert into public.task_card_members (task_id, user_id) select pg_temp.i('ea'), user_id from public.team_members where user_id::text like 'fe000000-0000-4000-8000-00000006%';
delete from public.notifications;
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$insert into public.task_comments (task_id, body) values (pg_temp.i('ea'), 'para todos')$$, 'comentário num cartão com 100 membros');
select pg_temp.como('postgres');
select is((select count(*) from public.notifications where metadata ->> 'task_id' = pg_temp.i('ea')::text and metadata ->> 'tipo' = 'mensagem'), 100::bigint, '100 destinatários avisados por um comentário');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$insert into public.task_card_members (task_id, user_id) values (pg_temp.i('eb'), pg_temp.i('a2'))$$, 'o mesmo ator atribui em outro cartão');
select pg_temp.como('postgres');
select is((select count(*) from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'task_id' = pg_temp.i('eb')::text), 1::bigint,
  'o ator não ficou bloqueado: o aviso do outro cartão chegou');
delete from public.notifications;
-- (a3) autor com 99 pares na hora: o comentário que cria o 100º par chega a TODOS os destinatários; o par 101 (cartão novo) é bloqueado
insert into public.producer_tasks (id, producer_id, title) values (pg_temp.i('ec'), pg_temp.i('01'), 'C99'), (pg_temp.i('ed'), pg_temp.i('01'), 'C100');
insert into public.task_card_members (task_id, user_id) values (pg_temp.i('ec'), pg_temp.i('a2')), (pg_temp.i('ec'), pg_temp.i('01'));
delete from public.notifications;
insert into public.notifications (user_id, title, body, type, metadata)
  select pg_temp.i('a4'), 't', 'b', 'info', jsonb_build_object('kind', 'quadro', 'tipo', 'atribuicao', 'task_id', gen_random_uuid(), 'actor', pg_temp.i('a3'))
  from generate_series(1, 99);
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$insert into public.task_comments (task_id, body) values (pg_temp.i('ec'), 'cria o 100º par')$$, 'comentário que cria o 100º par do autor');
select pg_temp.como('postgres');
select is((select count(*) from public.notifications where metadata ->> 'task_id' = pg_temp.i('ec')::text and metadata ->> 'tipo' = 'mensagem'), 2::bigint,
  'os 2 destinatários do mesmo comentário recebem (o par já contado não é cortado)');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$insert into public.task_card_members (task_id, user_id) values (pg_temp.i('ed'), pg_temp.i('a2'))$$, 'autor com 100 pares atribui em cartão novo');
select pg_temp.como('postgres');
select is((select count(*) from public.notifications where metadata ->> 'task_id' = pg_temp.i('ed')::text), 0::bigint, 'o 101º par (cartão novo) é bloqueado');
delete from public.notifications;
-- (b) quem dispara não passa de 100 cartões distintos por hora
insert into public.producer_tasks (id, producer_id, title)
  select ('fe000000-0000-4000-8000-' || lpad((10000 + g)::text, 12, '0'))::uuid, pg_temp.i('01'), 'Q' || g from generate_series(1, 110) g;
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$insert into public.task_card_members (task_id, user_id) select id, pg_temp.i('a2') from public.producer_tasks where title like 'Q%'$$,
  '110 atribuições seguidas pelo mesmo editor são gravadas');
select pg_temp.como('postgres');
select is((select count(*) from public.notifications where metadata ->> 'actor' = pg_temp.i('a3')::text), 100::bigint, 'o ator para de gerar aviso no 100º cartão distinto da hora');
select is((select count(*) from public.task_card_members where user_id = pg_temp.i('a2') and task_id in (select id from public.producer_tasks where title like 'Q%')), 110::bigint,
  'as 110 atribuições existem mesmo assim');
select public.quadro_notificar(pg_temp.i('a2'), (select t.id from public.producer_tasks t where t.title like 'Q%' and not exists
  (select 1 from public.notifications n where n.metadata ->> 'task_id' = t.id::text) limit 1), 'mensagem', 'sem ator', null);
select is((select count(*) from public.notifications where user_id = pg_temp.i('a2') and body = 'sem ator'), 1::bigint, 'sem ator (cron) o teto por ator não vale');
delete from public.notifications;

-- Texto malicioso -----------------------------------------------------------------------------------------------------------------------------
insert into public.producer_tasks (id, producer_id, title) values (pg_temp.i('e9'), pg_temp.i('01'),
  '[x](javascript:alert(1)) <img src=x onerror=alert(1)> data:text/html,' || repeat('Z', 100));
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$insert into public.task_card_members (task_id, user_id) values (pg_temp.i('e9'), pg_temp.i('a2'))$$, 'atribuição a cartão de título malicioso');
select pg_temp.como('postgres');
select ok((select body !~* '(javascript|data)\s*:' and body !~ '[<>]' and body !~ '\]\(' and body like '%“x%' from public.notifications
           where user_id = pg_temp.i('a2') and metadata ->> 'task_id' = pg_temp.i('e9')::text), 'título malicioso: sem HTML, sem link markdown, sem javascript: nem data:');
select ok((select length(body) < 100 from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'task_id' = pg_temp.i('e9')::text), 'título cortado em 60 caracteres');
select public.quadro_notificar(pg_temp.i('01'), pg_temp.i('d1'), 'automacao', 'javajavascript:script:x e [rótulo](http://ruim) e DATA :y', null);
select is((select body from public.notifications where user_id = pg_temp.i('01') and metadata ->> 'tipo' = 'automacao' order by created_at desc, id limit 1),
  'x e rótulo e y', 'o esquema não se reconstrói; link markdown vira o rótulo');
delete from public.notifications;

-- Prazos ------------------------------------------------------------------------------------------------------------------------------------
-- cartões: p1 = vence amanhã (membro mv); p2 = venceu há 2 dias (membro mv); p3 = venceu há 30 dias (membro mv); p4 = arquivado; p5 = em Feito;
-- p6 = vence em 5 dias; p7 = vence hoje, só assigned_to (me)
insert into public.producer_tasks (id, producer_id, title, due_date, assigned_to, status, archived_at) values
  (pg_temp.i('e1'), pg_temp.i('01'), 'P1', now() + interval '1 day', null, 'todo', null),
  (pg_temp.i('e2'), pg_temp.i('01'), 'P2', now() - interval '2 days', null, 'todo', null),
  (pg_temp.i('e3'), pg_temp.i('01'), 'P3', now() - interval '30 days', null, 'todo', null),
  (pg_temp.i('e4'), pg_temp.i('01'), 'P4', now() + interval '1 day', null, 'todo', now()),
  (pg_temp.i('e5'), pg_temp.i('01'), 'P5', now() + interval '1 day', null, 'done', null),
  (pg_temp.i('e6'), pg_temp.i('01'), 'P6', now() + interval '5 days', null, 'todo', null),
  (pg_temp.i('e7'), pg_temp.i('01'), 'P7', now(), pg_temp.i('a3'), 'todo', null);
insert into public.task_card_members (task_id, user_id)
  select pg_temp.i(x), pg_temp.i('a2') from unnest(array['e1', 'e2', 'e3', 'e4', 'e5', 'e6']) x;
delete from public.notifications where metadata ->> 'tipo' in ('atribuicao', 'prazo');
select is(public.quadro_avisar_prazos(), 3, 'primeira rodada: 3 avisos (amanhã, vencido recente, hoje por assigned_to)');
select is((select count(*) from public.notifications where metadata ->> 'tipo' = 'prazo'), 3::bigint, '3 avisos de prazo gravados');
select is((select body from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'task_id' = pg_temp.i('e1')::text and metadata ->> 'tipo' = 'prazo'),
  'O prazo do cartão “P1” é hoje ou amanhã.', 'aviso 24h');
select is((select body from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'task_id' = pg_temp.i('e2')::text and metadata ->> 'tipo' = 'prazo'),
  'O prazo do cartão “P2” já passou.', 'aviso de vencido');
select is((select title || '|' || type from public.notifications where user_id = pg_temp.i('a3') and metadata ->> 'tipo' = 'prazo'),
  'Prazo chegando|reminder', 'o responsável (assigned_to) também é avisado, com type reminder');
select is((select count(*) from public.notifications where metadata ->> 'tipo' = 'prazo' and metadata ->> 'task_id' in
  (pg_temp.i('e3')::text, pg_temp.i('e4')::text, pg_temp.i('e5')::text, pg_temp.i('e6')::text)), 0::bigint,
  'sem aviso: vencido há mais de 7 dias, arquivado, em Feito, prazo distante');
select is((select count(*) from public.task_prazo_avisos), 3::bigint, '3 registros em task_prazo_avisos');
select is(public.quadro_avisar_prazos(), 0, 'segunda rodada: nada repetido');
select is((select count(*) from public.notifications where metadata ->> 'tipo' = 'prazo'), 3::bigint, 'ainda 3 avisos de prazo');
update public.producer_tasks set due_date = now() where id = pg_temp.i('e1');
select is(public.quadro_avisar_prazos(), 1, 'prazo que muda de dia avisa de novo');
update public.producer_tasks set due_date = now() - interval '2 days' where id = pg_temp.i('e1');
select is(public.quadro_avisar_prazos(), 1, 'mesmo cartão que vence vira ''vencido'' (outra chave)');
delete from public.producer_tasks where id = pg_temp.i('e1');
select is((select count(*) from public.task_prazo_avisos where task_id = pg_temp.i('e1')), 0::bigint, 'apagar o cartão limpa task_prazo_avisos');
insert into public.task_notification_prefs (user_id, types) values (pg_temp.i('a2'), '{"prazo":{"app":false,"email":false}}');
update public.producer_tasks set due_date = now() + interval '1 day' where id = pg_temp.i('e6');
select is(public.quadro_avisar_prazos(), 1, 'preferência que silencia o prazo: o registro é gravado mesmo assim');
select is((select count(*) from public.notifications where user_id = pg_temp.i('a2') and metadata ->> 'task_id' = pg_temp.i('e6')::text), 0::bigint, 'mas o aviso não chega');
delete from public.task_notification_prefs where user_id = pg_temp.i('a2');
insert into public.producer_tasks (id, producer_id, title, due_date, assigned_to) values (pg_temp.i('e8'), pg_temp.i('01'), 'P8', now(), pg_temp.i('a5'));
select is(public.quadro_avisar_prazos(), 1, 'responsável sem a ferramenta quadro: o registro de prazo é gravado');
select is((select count(*) from public.notifications where user_id = pg_temp.i('a5')), 0::bigint, 'mas assigned_to sem a ferramenta quadro não recebe o aviso de prazo');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select throws_ok('select count(*) from public.task_prazo_avisos', '42501', null, 'authenticated não lê task_prazo_avisos');
select throws_ok($$insert into public.task_prazo_avisos (task_id, user_id, kind, due_date) values (pg_temp.i('d1'), pg_temp.i('a3'), '24h', current_date)$$,
  '42501', null, 'authenticated não grava em task_prazo_avisos');
select throws_ok($$select public.quadro_avisar_prazos()$$, '42501', null, 'authenticated não chama quadro_avisar_prazos');
select throws_ok($$select public.quadro_notificar(pg_temp.i('a3'), pg_temp.i('d1'), 'mensagem', 'x', null)$$, '42501', null, 'authenticated não chama quadro_notificar');

-- Leitura: entregue, lido, "visto por" -----------------------------------------------------------------------------------------------------
-- task_recibos_ligados não é oráculo: cartão alheio e id inexistente dão a mesma resposta
select pg_temp.como('authenticated', pg_temp.i('02'));
select is(public.task_recibos_ligados(pg_temp.i('d1')), false, 'outro produtor consultando cartão alheio: false');
select is(public.task_recibos_ligados(pg_temp.i('ff')), false, 'id inexistente: false (igual ao cartão alheio)');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(public.task_recibos_ligados(pg_temp.i('d1')), true, 'quem tem ''ver'' recebe true com a opção ligada');
select pg_temp.como('postgres');
delete from public.task_comments;
insert into public.task_comments (id, task_id, user_id, body) values
  (pg_temp.i('f1'), pg_temp.i('d1'), pg_temp.i('a3'), 'do editor 1'),
  (pg_temp.i('f2'), pg_temp.i('d1'), pg_temp.i('a3'), 'do editor 2'),
  (pg_temp.i('f3'), pg_temp.i('d1'), pg_temp.i('a2'), 'do só-ver'),
  (pg_temp.i('f4'), pg_temp.i('d2'), pg_temp.i('a3'), 'do editor no B'),
  (pg_temp.i('f9'), pg_temp.i('d9'), pg_temp.i('02'), 'do outro produtor');
select pg_temp.como('authenticated', pg_temp.i('a2'));
select is(public.quadro_marcar_entregue(array[pg_temp.i('d1'), pg_temp.i('d1'), pg_temp.i('d9'), null], 'tablet'), 2,
  '''ver'' marca como entregues os 2 comentários alheios do cartão (repetido e cartão sem acesso ignorados)');
select is((select count(*) from public.task_comment_receipts where user_id = pg_temp.i('a2')), 2::bigint, '2 recibos de entrega');
select is((select count(*) from public.task_comment_receipts where user_id = pg_temp.i('a2') and read_at is null and device = 'tablet'), 2::bigint,
  'entregue: delivered_at gravado, read_at vazio, aparelho tablet');
select is(public.quadro_marcar_entregue(array[pg_temp.i('d1')], 'tablet'), 0, 'repetir a entrega não duplica');
select is(public.quadro_marcar_entregue(null, null), 0, 'lista nula não faz nada');
select is(public.quadro_marcar_entregue(array[pg_temp.i('d2')], 'geladeira'), 1, 'entregue em outro cartão do mesmo quadro');
select is((select device from public.task_comment_receipts where comment_id = pg_temp.i('f4') and user_id = pg_temp.i('a2')), 'outro', 'aparelho fora da lista vira ''outro''');
create temp table _ent as select comment_id, delivered_at from public.task_comment_receipts where user_id = pg_temp.i('a2');
select is(public.quadro_marcar_lido(pg_temp.i('d1'), 'celular'), 2, '''ver'' basta para marcar como lido (2 recibos atualizados)');
select is((select count(*) from public.task_comment_receipts where user_id = pg_temp.i('a2') and comment_id in (pg_temp.i('f1'), pg_temp.i('f2'))
           and read_at is not null and read_at >= delivered_at and device = 'celular'), 2::bigint, 'read_at nunca menor que delivered_at');
select is((select count(*) from public.task_comment_receipts r join _ent e using (comment_id) where r.user_id = pg_temp.i('a2') and r.delivered_at <> e.delivered_at), 0::bigint,
  'delivered_at não muda ao ler');
select is((select count(*) from public.task_comment_receipts where user_id = pg_temp.i('a2') and comment_id = pg_temp.i('f3')), 0::bigint, 'não há recibo do próprio comentário');
select is((select count(*) from public.task_comment_receipts where user_id = pg_temp.i('a2') and comment_id = pg_temp.i('f4') and read_at is null), 1::bigint, 'ler um cartão não marca o outro');
select is((select device from public.task_card_views where task_id = pg_temp.i('d1') and user_id = pg_temp.i('a2')), 'celular', '"visto por" gravado com o aparelho');
create temp table _lido as select comment_id, read_at from public.task_comment_receipts where user_id = pg_temp.i('a2') and read_at is not null;
create temp table _vis as select last_seen_at from public.task_card_views where task_id = pg_temp.i('d1') and user_id = pg_temp.i('a2');
select pg_temp.como('postgres');
select pg_sleep(0.05);
select pg_temp.como('authenticated', pg_temp.i('a2'));
select is(public.quadro_marcar_lido(pg_temp.i('d1'), 'computador'), 0, 'ler de novo não atualiza recibo nenhum');
select is((select count(*) from public.task_comment_receipts r join _lido l using (comment_id) where r.user_id = pg_temp.i('a2') and r.read_at <> l.read_at), 0::bigint,
  'read_at já gravado nunca é sobrescrito');
select is((select count(*) from public.task_comment_receipts where user_id = pg_temp.i('a2') and device = 'computador'), 0::bigint, 'nem o aparelho do recibo já lido muda');
-- (a hora é now() da transação, igual em todo o teste: só dá para conferir que não recuou)
select ok((select v.last_seen_at >= s.last_seen_at and v.device = 'computador' from public.task_card_views v, _vis s
           where v.task_id = pg_temp.i('d1') and v.user_id = pg_temp.i('a2')), '"visto por" renova o aparelho a cada leitura e a hora não recua');
select is((select count(*) from public.task_card_views where user_id = pg_temp.i('a2')), 1::bigint, 'uma linha de "visto por" por cartão e pessoa');
select throws_ok($$insert into public.task_comment_receipts (comment_id, user_id) values (pg_temp.i('f1'), pg_temp.i('a2'))$$, '42501', null, 'INSERT direto em recibos negado');
select throws_ok($$update public.task_comment_receipts set read_at = null$$, '42501', null, 'UPDATE direto em recibos negado');
select throws_ok($$insert into public.task_card_views (task_id, user_id) values (pg_temp.i('d2'), pg_temp.i('a2'))$$, '42501', null, 'INSERT direto em "visto por" negado');
select throws_ok($$update public.task_card_views set device = 'outro'$$, '42501', null, 'UPDATE direto em "visto por" negado');
select throws_ok($$delete from public.task_comment_receipts$$, '42501', null, 'DELETE direto em recibos negado (nunca teve)');
-- o autor nunca ganha recibo do próprio comentário
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(public.quadro_marcar_lido(pg_temp.i('d1'), 'computador'), 1, 'o editor lê o comentário do só-ver (1 recibo)');
select is((select count(*) from public.task_comment_receipts where user_id = pg_temp.i('a3')), 1::bigint, 'só do comentário alheio: nenhum recibo do próprio');
select is((select count(*) from public.task_comment_receipts), 4::bigint, 'o editor lê os recibos do quadro: 3 de mv (2 no A, 1 no B) e 1 dele');
-- teto de 200 cartões
select pg_temp.como('authenticated', pg_temp.i('01'));
select is(public.quadro_marcar_entregue((select array_agg(gen_random_uuid()) from generate_series(1, 200)) || array[pg_temp.i('d1')], 'celular'), 0,
  'só os 200 primeiros cartões da lista valem (o 201º é ignorado)');
select is(public.quadro_marcar_entregue(array[pg_temp.i('d1')], 'celular'), 3, 'o dono do quadro marca a entrega dos 3 comentários alheios');
-- sem acesso = nada
select pg_temp.como('authenticated', pg_temp.i('a4'));
select is(public.quadro_marcar_lido(pg_temp.i('d1'), 'celular') + public.quadro_marcar_entregue(array[pg_temp.i('d1')], 'celular'), 0, 'membro bloqueado: nada gravado');
select pg_temp.como('authenticated', pg_temp.i('02'));
select is(public.quadro_marcar_lido(pg_temp.i('d1'), 'celular') + public.quadro_marcar_entregue(array[pg_temp.i('d1')], 'celular'), 0, 'outro produtor: nada gravado');
select pg_temp.como('authenticated', pg_temp.i('b1'));
select is(public.quadro_marcar_lido(pg_temp.i('d1'), 'celular') + public.quadro_marcar_entregue(array[pg_temp.i('d1')], 'celular'), 0, 'conta solta: nada gravado');
select pg_temp.como('postgres');
select is((select count(*) from public.task_comment_receipts where user_id in (pg_temp.i('a4'), pg_temp.i('02'), pg_temp.i('b1'))), 0::bigint, 'nenhum recibo dos sem acesso');
select is((select count(*) from public.task_card_views where user_id in (pg_temp.i('a4'), pg_temp.i('02'), pg_temp.i('b1'))), 0::bigint, 'nenhum "visto por" dos sem acesso');

-- 2FA: com fator verificado, só aal2 passa -----------------------------------------------------------------------------------------------
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
  values (pg_temp.i('aa'), pg_temp.i('a2'), 'totp', 'totp', 'verified', now(), now());
select pg_temp.como('authenticated', pg_temp.i('a2'), 'aal1');
select throws_ok($$select public.quadro_marcar_lido(pg_temp.i('d1'), 'celular')$$, '42501', null, 'com 2FA ativo e sessão aal1, marcar_lido é recusado');
select throws_ok($$select public.quadro_marcar_entregue(array[pg_temp.i('d1')], 'celular')$$, '42501', null, 'com 2FA ativo e sessão aal1, marcar_entregue é recusado');
select pg_temp.como('authenticated', pg_temp.i('a2'), 'aal2');
select lives_ok($$select public.quadro_marcar_lido(pg_temp.i('d1'), 'celular')$$, 'com sessão aal2 passa');
select pg_temp.como('postgres');
delete from auth.mfa_factors where id = pg_temp.i('aa');

-- CHECK de device (as funções normalizam, então só o dono da tabela chega a ele): valor fora da lista dá 23514
select pg_temp.como('postgres');
select throws_ok($$insert into public.task_comment_receipts (comment_id, user_id, device) values (pg_temp.i('f1'), pg_temp.i('a4'), 'geladeira')$$, '23514', null, 'CHECK de device em recibos recusa valor fora da lista');
select throws_ok($$insert into public.task_card_views (task_id, user_id, device) values (pg_temp.i('d1'), pg_temp.i('a4'), 'geladeira')$$, '23514', null, 'CHECK de device em "visto por" recusa valor fora da lista');

-- show_receipts = false: nada é gravado e nada é visível ----------------------------------------------------------------------------------
create temp table _rec as select
  (select count(*) from public.task_comment_receipts) as r, (select count(*) from public.task_card_views) as v;
update public.task_boards set show_receipts = false where producer_id = pg_temp.i('01');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(public.quadro_marcar_lido(pg_temp.i('d2'), 'celular'), 0, 'show_receipts desligado: marcar_lido não grava');
select is(public.quadro_marcar_entregue(array[pg_temp.i('d1'), pg_temp.i('d2')], 'celular'), 0, 'show_receipts desligado: marcar_entregue não grava');
select pg_temp.como('postgres');
select is((select count(*) from public.task_comment_receipts), (select r from _rec), 'nenhum recibo novo com a opção desligada');
select is((select count(*) from public.task_card_views), (select v from _rec), 'nenhum "visto por" novo com a opção desligada');
select pg_temp.como('authenticated', pg_temp.i('01'));
select is((select count(*) from public.task_comment_receipts), 0::bigint, 'dono do quadro: recibos invisíveis com a opção desligada');
select is((select count(*) from public.task_card_views), 0::bigint, 'dono do quadro: "visto por" invisível com a opção desligada');
select pg_temp.como('authenticated', pg_temp.i('a2'));
select is((select count(*) from public.task_comment_receipts) + (select count(*) from public.task_card_views), 0::bigint, 'membro ''ver'': nada visível com a opção desligada');
select pg_temp.como('postgres');
update public.task_boards set show_receipts = true where producer_id = pg_temp.i('01');
select pg_temp.como('authenticated', pg_temp.i('01'));
select ok((select count(*) from public.task_comment_receipts) > 0 and (select count(*) from public.task_card_views) > 0, 'religada a opção, o que já existia volta a aparecer');
select pg_temp.como('authenticated', pg_temp.i('02'));
select is((select count(*) from public.task_comment_receipts) + (select count(*) from public.task_card_views), 0::bigint, 'outro produtor não vê recibo nem "visto por" de P1');
select pg_temp.como('authenticated', pg_temp.i('a4'));
select is((select count(*) from public.task_comment_receipts) + (select count(*) from public.task_card_views), 0::bigint, 'bloqueado não vê recibo nem "visto por"');

-- Desfazer (ensaio do cabeçalho do SQL, na ordem; o cron não existe aqui) ------------------------------------------------------------------
select pg_temp.como('postgres');
create temp table _dono as select (select tableowner = current_user or (select rolsuper from pg_roles where rolname = current_user)
  from pg_tables where schemaname = 'public' and tablename = 'task_card_members') as ok;
do $d$ begin
  if (select ok from _dono) then
drop trigger if exists task_card_members_notif on public.task_card_members;
drop trigger if exists task_comments_notif on public.task_comments;
drop trigger if exists producer_tasks_quadro_notif on public.producer_tasks;
drop policy if exists task_boards_recibos on public.task_boards;
revoke update (show_receipts) on table public.task_boards from authenticated;
drop policy if exists task_comment_receipts_ver on public.task_comment_receipts;
create policy task_comment_receipts_ver on public.task_comment_receipts as permissive for select to authenticated
  using (public.comment_pode(comment_id, 'ver'));
create policy task_comment_receipts_criar on public.task_comment_receipts as permissive for insert to authenticated
  with check (user_id = (select auth.uid()) and public.comment_pode(comment_id, 'ver'));
create policy task_comment_receipts_editar on public.task_comment_receipts as permissive for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.comment_pode(comment_id, 'ver'));
drop policy if exists task_card_views_ver on public.task_card_views;
create policy task_card_views_ver on public.task_card_views as permissive for select to authenticated
  using (public.task_pode(task_id, 'ver'));
create policy task_card_views_criar on public.task_card_views as permissive for insert to authenticated
  with check (user_id = (select auth.uid()) and public.task_pode(task_id, 'ver'));
create policy task_card_views_editar on public.task_card_views as permissive for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.task_pode(task_id, 'ver'));
grant insert (comment_id, user_id, read_at, device) on table public.task_comment_receipts to authenticated;
grant update (read_at, device) on table public.task_comment_receipts to authenticated;
grant insert (task_id, user_id, device) on table public.task_card_views to authenticated;
grant update (device) on table public.task_card_views to authenticated;
drop table if exists public.task_prazo_avisos, public.task_notification_prefs;
alter table public.task_boards drop column if exists show_receipts;
drop function if exists public.quadro_avisar_prazos(), public.quadro_notificar(uuid, uuid, text, text, uuid),
  public.quadro_marcar_entregue(uuid[], text), public.quadro_marcar_lido(uuid, text), public.task_recibos_ligados(uuid),
  public.quadro_prefs_ok(jsonb), public.task_card_members_notif_tg(), public.task_comments_notif_tg(),
  public.producer_tasks_notif_tg();
  end if;
end $d$;
select skip('Desfazer: só o dono das tabelas (ou superusuário) ensaia o Desfazer; aqui current_user não é', 6) where not (select ok from _dono);
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
           and (p.proname like 'quadro\_notificar' or p.proname like 'quadro\_marcar\_%' or p.proname like '%\_notif\_tg'
                or p.proname in ('quadro_avisar_prazos', 'task_recibos_ligados', 'quadro_prefs_ok'))), 0::bigint, 'Desfazer: funções da 2B removidas')
  where (select ok from _dono);
select is(to_regclass('public.task_notification_prefs') is null and to_regclass('public.task_prazo_avisos') is null, true, 'Desfazer: tabelas novas removidas')
  where (select ok from _dono);
select is((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'task_boards' and column_name = 'show_receipts'), 0::bigint,
  'Desfazer: coluna show_receipts removida')
  where (select ok from _dono);
select policies_are('public', 'task_comment_receipts',
  array['gf_mfa_aal2', 'task_comment_receipts_criar', 'task_comment_receipts_editar', 'task_comment_receipts_ver'], 'Desfazer: regras de recibos como na 2A')
  where (select ok from _dono);
select policies_are('public', 'task_boards', array['gf_mfa_aal2', 'task_boards_ver'], 'Desfazer: task_boards como na fatia 1')
  where (select ok from _dono);
select is(has_column_privilege('authenticated', 'public.task_comment_receipts', 'read_at', 'update'), true, 'Desfazer: permissões de recibos como na 2A')
  where (select ok from _dono);

select * from finish();
rollback;
