-- pgTAP da fatia F do Quadro (docs/sql/20261108_quadro_f2f_varios_quadros.sql): vários quadros, porta única de permissão, membros por quadro e modelos de quadro.
-- Só no banco local: aplicar 20261017_team_members_rls, 20261103, 20261105, 20261106, 20261107 e 20261108 e rodar `supabase test db`.
-- Tudo em begin ... rollback: nada fica gravado. Nunca contra produção. Sem pg_cron local, os crons são chamados direto (funções internas).
-- Papéis do teste: p1 dono; p2 outro produtor; mv membro 'ver' (ferramenta quadro); me membro 'editar' (ferramenta); ev e ee membros SEM a ferramenta,
-- escolhidos num quadro 'escolhidas' com 'ver' e 'editar'; mp membro sem ferramenta e sem lista; mb bloqueado; mna não aceito; x conta solta; anon.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(1792);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  -- 'postgres' = o papel da sessão (postgres ou supabase_admin, dono das tabelas): o teste vale para os dois
  if p_role = 'postgres' then execute 'reset role'; else perform set_config('role', p_role, true); end if;
end $f$;
create function pg_temp.i(p text) returns uuid language sql immutable as $f$
  select ('ff000000-0000-4000-8000-' || lpad(p, 12, '0'))::uuid $f$;
create function pg_temp.hoje() returns date language sql stable as $f$ select (now() at time zone 'America/Sao_Paulo')::date $f$;
-- tenta(sql): 'ok' se mexeu em linha, '0 linhas' se a regra filtrou, ou o SQLSTATE do erro (a subtransação desfaz o que fez)
create function pg_temp.tenta(p_sql text) returns text language plpgsql as $f$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return case when n > 0 then 'ok' else '0 linhas' end;
exception when others then return sqlstate;
end $f$;
create temp table _b (k text primary key, id uuid);
create function pg_temp.b(p text) returns uuid language sql stable as $f$ select id from _b where k = p $f$;
create function pg_temp.col(p_b uuid, p_n text) returns uuid language sql stable as $f$
  select id from public.task_columns where board_id = p_b and name = p_n $f$;
grant all on _b to anon, authenticated;
grant execute on function pg_temp.como(text, uuid, text), pg_temp.i(text), pg_temp.hoje(), pg_temp.tenta(text), pg_temp.b(text),
  pg_temp.col(uuid, text) to anon, authenticated;
do $g$ declare r record; begin
  for r in select p.oid::regprocedure as f from pg_proc p join pg_depend d on d.objid = p.oid and d.deptype = 'e'
           join pg_extension e on e.oid = d.refobjid where e.extname = 'pgtap' loop
    begin execute 'grant execute on function ' || r.f || ' to anon, authenticated';
    exception when others then null; end;
  end loop;
end $g$;

-- Dados (como dono das tabelas) ------------------------------------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  (pg_temp.i('01'), 'p1@teste-f2f.local', now(), '{"role":"producer","full_name":"Paula"}'),
  (pg_temp.i('02'), 'p2@teste-f2f.local', now(), '{"role":"producer","full_name":"Pedro"}'),
  (pg_temp.i('a2'), 'mv@teste-f2f.local', now(), '{"full_name":"So ve"}'),
  (pg_temp.i('a3'), 'me@teste-f2f.local', now(), '{"full_name":"Edita"}'),
  (pg_temp.i('a4'), 'mb@teste-f2f.local', now(), '{"full_name":"Bloqueado"}'),
  (pg_temp.i('a5'), 'mp@teste-f2f.local', now(), '{"full_name":"Sem quadro"}'),
  (pg_temp.i('a6'), 'mna@teste-f2f.local', now(), '{"full_name":"Nao aceito"}'),
  (pg_temp.i('a7'), 'ev@teste-f2f.local', now(), '{"full_name":"Escolhido ve"}'),
  (pg_temp.i('a8'), 'ee@teste-f2f.local', now(), '{"full_name":"Escolhido edita"}'),
  (pg_temp.i('b1'), 'x@teste-f2f.local', now(), '{"full_name":"Solta"}');
insert into public.events (id, producer_id, title, slug, status, approval_status, date) values
  (pg_temp.i('e1'), pg_temp.i('01'), 'Do P1', 'f2f-e1', 'draft', 'pending', pg_temp.hoje() + 30),
  (pg_temp.i('e2'), pg_temp.i('01'), 'Sem data', 'f2f-e2', 'draft', 'pending', null),
  (pg_temp.i('e9'), pg_temp.i('02'), 'Do P2', 'f2f-e9', 'draft', 'pending', pg_temp.hoje() + 30);
insert into public.team_members (id, producer_id, user_id, role, accepted_at, blocked_at) values
  (pg_temp.i('c2'), pg_temp.i('01'), pg_temp.i('a2'), 'editor', now(), null),
  (pg_temp.i('c3'), pg_temp.i('01'), pg_temp.i('a3'), 'editor', now(), null),
  (pg_temp.i('c4'), pg_temp.i('01'), pg_temp.i('a4'), 'editor', now(), null),
  (pg_temp.i('c5'), pg_temp.i('01'), pg_temp.i('a5'), 'editor', now(), null),
  (pg_temp.i('c6'), pg_temp.i('01'), pg_temp.i('a6'), 'editor', now(), null),
  (pg_temp.i('c7'), pg_temp.i('01'), pg_temp.i('a7'), 'editor', now(), null),
  (pg_temp.i('c8'), pg_temp.i('01'), pg_temp.i('a8'), 'editor', now(), null);
insert into public.team_member_tools (member_id, ferramenta, nivel) values
  (pg_temp.i('c2'), 'quadro', 'ver'), (pg_temp.i('c3'), 'quadro', 'editar'), (pg_temp.i('c4'), 'quadro', 'editar'), (pg_temp.i('c6'), 'quadro', 'editar');
insert into _b select 'be', public.quadro_criar_interno(pg_temp.i('01'), pg_temp.i('e1'));
insert into _b select 'bp', public.quadro_criar_interno(pg_temp.i('01'), null);
insert into _b select 'b9', public.quadro_criar_interno(pg_temp.i('02'), pg_temp.i('e9'));
-- quadros criados pela função (o dono é p1); mb e mna ainda estão ativos aqui, para entrar na lista e nos cartões; saem logo depois
select pg_temp.como('authenticated', pg_temp.i('01'));
insert into _b select 'eq', public.quadro_criar('Equipe geral', 'equipe', null, null, 'equipe', '[]');
insert into _b select 'pes', public.quadro_criar('So meu', 'pessoal', null, null, null, null);
insert into _b select 'esc', public.quadro_criar('Escolhidos', 'equipe', null, null, 'escolhidas', jsonb_build_array(
  jsonb_build_object('user_id', pg_temp.i('a7'), 'nivel', 'ver'), jsonb_build_object('user_id', pg_temp.i('a8'), 'nivel', 'editar'),
  jsonb_build_object('user_id', pg_temp.i('a4'), 'nivel', 'editar'), jsonb_build_object('user_id', pg_temp.i('a6'), 'nivel', 'editar')));
select pg_temp.como('postgres');

-- Recursos de cada quadro da matriz (um de cada tipo) e cartões de recorrência -------------------------------------------------------
create temp table _rec (k text primary key, card uuid, col uuid, chk uuid, item uuid, com uuid, path text, btn uuid, lab uuid, rec uuid);
grant all on _rec to anon, authenticated;
do $d$
declare k text; b uuid; r _rec; v_ev uuid; v_assin uuid; u uuid;
begin
  foreach k in array array['be', 'eq', 'pes', 'esc'] loop
    b := pg_temp.b(k);
    v_ev := case when k = 'be' then pg_temp.i('e1') end;
    r.k := k;
    insert into public.producer_tasks (producer_id, event_id, board_id, title, due_date)
      values (pg_temp.i('01'), v_ev, b, 'card-' || k, (pg_temp.hoje() + 1)::timestamp at time zone 'America/Sao_Paulo') returning id into r.card;
    select c.id into r.col from public.task_columns c where c.board_id = b order by c.position limit 1;
    insert into public.task_checklists (task_id, title) values (r.card, 'lista') returning id into r.chk;
    insert into public.task_checklist_items (checklist_id, text) values (r.chk, 'item') returning id into r.item;
    insert into public.task_comments (task_id, user_id, body) values (r.card, pg_temp.i('01'), 'comentario do dono') returning id into r.com;
    insert into public.task_comment_receipts (comment_id, user_id) values (r.com, pg_temp.i('a3'));
    insert into public.task_card_views (task_id, user_id) values (r.card, pg_temp.i('a3'));
    r.path := pg_temp.i('01') || '/' || r.card || '/' || gen_random_uuid() || '-a.png';
    insert into public.task_attachments (task_id, storage_path, name, mime, size_bytes, created_by)
      values (r.card, r.path, 'a.png', 'image/png', 10, pg_temp.i('01'));
    insert into storage.objects (bucket_id, name, owner_id) values ('task-attachments', r.path, pg_temp.i('01'));
    insert into public.task_buttons (board_id, name, scope, steps) values (b, 'botao', 'card', '[{"t":"prazo","v":2}]') returning id into r.btn;
    insert into public.task_roles (board_id, papel, user_id) values (b, 'revisao', pg_temp.i('01'));
    insert into public.task_labels (board_id, name, color) values (b, 'etq', '#112233') returning id into r.lab;
    insert into public.task_links (task_id, kind) values (r.card, 'evento');
    -- cartão que se repete, com toda a gente como membro do cartão (a cópia só leva quem tem acesso ao quadro)
    v_assin := case when k = 'esc' then pg_temp.i('a7') else pg_temp.i('a5') end;
    insert into public.producer_tasks (producer_id, event_id, board_id, title, assigned_to) values (pg_temp.i('01'), v_ev, b, 'rec-' || k, v_assin)
      returning id into r.rec;
    update public.producer_tasks set recur_days = 7 where id = r.rec;
    update public.producer_tasks set recur_next = pg_temp.hoje() where id = r.rec;
    foreach u in array array[pg_temp.i('01'), pg_temp.i('a2'), pg_temp.i('a3'), pg_temp.i('a4'), pg_temp.i('a5'), pg_temp.i('a6'), pg_temp.i('a7'), pg_temp.i('a8')] loop
      insert into public.task_card_members (task_id, user_id) values (r.card, u);
      insert into public.task_card_members (task_id, user_id) values (r.rec, u);
    end loop;
    insert into _rec values (r.k, r.card, r.col, r.chk, r.item, r.com, r.path, r.btn, r.lab, r.rec);
  end loop;
end $d$;
-- agora mb sai (bloqueado) e mna deixa de estar aceito: continuam em listas e cartões, mas não têm mais acesso
update public.team_members set blocked_at = now() where id = pg_temp.i('c4');
update public.team_members set accepted_at = null where id = pg_temp.i('c6');
-- limpa os avisos que a montagem gerou (atribuições)
delete from public.notifications where metadata ->> 'kind' = 'quadro';

-- Estrutura ------------------------------------------------------------------------------------------------------------------------------
select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'task\_%' and not c.relrowsecurity), 0::bigint, 'toda tabela task_* tem RLS ligada');
select policies_are('public', 'task_boards', array['gf_mfa_aal2', 'task_boards_recibos', 'task_boards_ver'], 'task_boards: ver (porta) e o update do dono da 2B');
select policies_are('public', 'task_board_members', array['gf_mfa_aal2', 'task_board_members_ver'], 'task_board_members: só ver e 2FA (a escrita é pelas funções)');
select policies_are('public', 'task_board_templates', array['gf_mfa_aal2', 'task_board_templates_ver'], 'task_board_templates: só ver e 2FA');
select policies_are('public', 'producer_tasks', array['gf_mfa_aal2', 'tasks_apagar', 'tasks_criar', 'tasks_editar', 'tasks_ver'], 'producer_tasks: mesmas regras, agora pela porta');
select policies_are('public', 'task_columns', array['gf_mfa_aal2', 'task_columns_apagar', 'task_columns_criar', 'task_columns_editar', 'task_columns_ver'], 'task_columns: mesmas regras, agora pela porta');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename in ('task_board_members', 'task_board_templates')
           and policyname = 'gf_mfa_aal2' and permissive = 'RESTRICTIVE' and cmd = 'ALL'), 2::bigint, 'gf_mfa_aal2 restritiva nas 2 tabelas novas');
select is((select count(*) from information_schema.role_table_grants where grantee in ('anon', 'public') and table_schema = 'public'
           and table_name like 'task\_%'), 0::bigint, 'anon sem privilégio em tabela task_*');
select is((select count(*) from information_schema.columns where table_schema = 'public'
           and (table_name like 'task\_%' or table_name = 'producer_tasks') and column_name ~* '(^|_)(ip|email|e_mail)(_|$)'), 0::bigint,
  'nenhuma coluna de IP nem de e-mail nas tabelas do quadro (LGPD)');
select is(bool_and(has_function_privilege('authenticated', f, 'execute') and not has_function_privilege('anon', f, 'execute')), true,
  'funções públicas: authenticated executa, anon não')
  from unnest(array['public.quadro_acesso(uuid, uuid, text)', 'public.quadro_criar(text, text, uuid, text, text, jsonb)',
    'public.quadro_salvar_como_modelo(uuid, text, boolean)', 'public.quadro_membros_definir(uuid, text, jsonb)', 'public.quadro_arquivar(uuid, boolean)',
    'public.quadro_equipe_lista()', 'public.task_anexo_pode(text, text)', 'public.quadro_texto_ok(text, int, int)']) f;
select is(bool_or(has_function_privilege('authenticated', f, 'execute') or has_function_privilege('anon', f, 'execute') or has_function_privilege('service_role', f, 'execute')), false,
  'funções internas e de gatilho: nem authenticated, nem anon, nem service_role executam')
  from unnest(array['public.quadro_acesso_direto(uuid, uuid, text)', 'public.quadro_limpar_texto(text, int)', 'public.quadro_nome_padrao(uuid)',
    'public.quadro_membros_validar(uuid, jsonb)', 'public.task_board_members_tg()', 'public.task_boards_limite_tg()', 'public.task_boards_guarda_tg()',
    'public.task_boards_visib_tg()', 'public.task_board_templates_limite_tg()', 'public.quadro_modelo_coluna_ok(jsonb)',
    'public.quadro_modelo_carta_ok(jsonb, int)', 'public.quadro_modelo_ok(jsonb, jsonb)', 'public.team_members_quadro_sai_tg()',
    'public.producer_tasks_quadro_tg()', 'public.events_quadro_antes_apagar_tg()']) f;
select is(bool_and(p.prosecdef and p.proconfig @> array['search_path=""']), true, 'funções novas SECURITY DEFINER com search_path vazio')
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('quadro_acesso', 'quadro_acesso_direto', 'quadro_criar', 'quadro_salvar_como_modelo',
    'quadro_membros_definir', 'quadro_arquivar', 'quadro_equipe_lista', 'quadro_membros_validar', 'task_anexo_pode', 'quadro_nome_padrao');
select is((select indexdef like '%WHERE is_default%' from pg_indexes where schemaname = 'public' and indexname = 'task_boards_unico'), true, 'task_boards_unico é parcial: só vale para o quadro padrão');
select is(has_any_column_privilege('authenticated', 'public.task_board_members', 'insert,update') or has_table_privilege('authenticated', 'public.task_board_members', 'delete')
          or has_any_column_privilege('authenticated', 'public.task_board_templates', 'insert,update') or has_table_privilege('authenticated', 'public.task_board_templates', 'delete')
          or has_table_privilege('authenticated', 'public.task_boards', 'insert') or has_table_privilege('authenticated', 'public.task_boards', 'delete'),
  false, 'authenticated não grava direto em membros, modelos nem cria/apaga quadro');
select is((select string_agg(column_name, ',' order by column_name) from information_schema.role_column_grants
           where grantee = 'authenticated' and table_name = 'task_boards' and privilege_type = 'UPDATE'),
  'archived_at,color,description,name,review_column_id,show_receipts,visibility', 'o dono altera só estas colunas de task_boards');

-- Quadro padrão e backfill ---------------------------------------------------------------------------------------------------------
select is((select is_default and kind = 'evento' and visibility = 'equipe' and name = 'Quadro do evento Do P1' from public.task_boards where id = pg_temp.b('be')), true,
  'quadro do evento da fatia 1: padrão, tipo evento, equipe, nome do evento');
select is((select is_default and kind = 'equipe' and visibility = 'equipe' and name = 'Quadro da equipe' from public.task_boards where id = pg_temp.b('bp')), true,
  'quadro da produtora da fatia 1: padrão, tipo equipe, equipe, "Quadro da equipe"');
select is(public.quadro_criar_interno(pg_temp.i('01'), pg_temp.i('e1')), pg_temp.b('be'), 'quadro_criar_interno devolve o padrão existente (ON CONFLICT casa com o índice parcial)');
select throws_ok($$insert into public.task_boards (producer_id, event_id, name, kind, is_default) values (pg_temp.i('01'), pg_temp.i('e1'), 'Dup', 'evento', true)$$,
  '23505', null, 'dois quadros padrão do mesmo produtor+evento: recusado');
select is(public.quadro_nome_padrao(pg_temp.i('e1')), 'Quadro do evento Do P1', 'nome padrão do evento');
insert into public.events (id, producer_id, title, slug, status, approval_status, date) values
  (pg_temp.i('e3'), pg_temp.i('01'), E'Festa muito longa de aniversário <b>da</b> empresa‮\u0007 de verdade', 'f2f-e3', 'draft', 'pending', pg_temp.hoje() + 5);
select is(public.quadro_nome_padrao(pg_temp.i('e3')), 'Quadro do evento Festa muito longa de an', 'nome padrão cortado em 40, sem < >, controle nem bidi');
select is(char_length(public.quadro_nome_padrao(pg_temp.i('e3'))) <= 40 and public.quadro_texto_ok(public.quadro_nome_padrao(pg_temp.i('e3')), 1, 40), true, 'nome padrão passa na regra do nome');
select is(public.quadro_nome_padrao(null), 'Quadro da equipe', 'nome padrão da produtora');
-- simulação do backfill: quadro "antigo" (sem autor, não padrão) vira padrão e ganha o nome; quadro com autor ou já renomeado não é tocado
insert into public.task_boards (id, producer_id, event_id, name, kind, visibility) values (pg_temp.i('ba'), pg_temp.i('01'), pg_temp.i('e3'), 'Quadro', 'evento', 'equipe');
update public.task_boards b set is_default = true, kind = case when b.event_id is null then 'equipe' else 'evento' end,
    visibility = 'equipe', name = public.quadro_nome_padrao(b.event_id) where not b.is_default and b.created_by is null;
select is((select is_default and name = 'Quadro do evento Festa muito longa de an' from public.task_boards where id = pg_temp.i('ba')), true, 'backfill: quadro antigo vira padrão com nome do evento');
select is((select count(*) from public.task_boards where created_by is not null and is_default), 0::bigint, 'backfill não tocou em quadro criado por quadro_criar');
delete from public.task_boards where id = pg_temp.i('ba');

-- Textos --------------------------------------------------------------------------------------------------------------------------------
select is(array[public.quadro_texto_ok('Ok', 1, 40), public.quadro_texto_ok('', 1, 40), public.quadro_texto_ok(null, 1, 40), public.quadro_texto_ok('a<b', 1, 40),
  public.quadro_texto_ok('a>b', 1, 40), public.quadro_texto_ok(repeat('x', 41), 1, 40), public.quadro_texto_ok(repeat('x', 40), 1, 40), public.quadro_texto_ok(E'a\nb', 1, 40),
  public.quadro_texto_ok(E'a‮b', 1, 40), public.quadro_texto_ok(E'a⁦b', 1, 40), public.quadro_texto_ok('', 0, 40), public.quadro_texto_ok('ação ñ ü', 1, 40)],
  array[true, false, false, false, false, false, true, false, false, false, true, true], 'quadro_texto_ok: limites, < >, controle e bidi');
select is(public.quadro_limpar_texto(E' <b>Oi‮\u0007 </b> ', 40), 'bOi /b', 'quadro_limpar_texto tira o que a regra recusa');

-- Modelos: validação (quadro_modelo_ok) -------------------------------------------------------------------------------------------------
select is(array[
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', '[]'),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"}]', '[]'),
  public.quadro_modelo_ok('[{"name":"A","kind":"doing"},{"name":"B","kind":"done"}]', '[]'),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"doing"}]', '[]'),
  public.quadro_modelo_ok((select jsonb_agg(jsonb_build_object('name', 'C' || g, 'kind', case when g = 1 then 'todo' when g = 12 then 'done' else 'doing' end)) from generate_series(1, 12) g), '[]'),
  public.quadro_modelo_ok((select jsonb_agg(jsonb_build_object('name', 'C' || g, 'kind', case when g = 1 then 'todo' when g = 13 then 'done' else 'doing' end)) from generate_series(1, 13) g), '[]'),
  public.quadro_modelo_ok('[{"name":"A<","kind":"todo"},{"name":"B","kind":"done"}]', '[]'),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo","x":1},{"name":"B","kind":"done"}]', '[]'),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"feito"}]', '[]'),
  public.quadro_modelo_ok('{"name":"A"}', '[]'),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', '{}')],
  array[true, false, false, false, true, false, false, false, false, false, false], 'quadro_modelo_ok: colunas (2 a 12, todo e done, só name e kind)');
select is(array[
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', '[{"titulo":"T","coluna":0,"papel":"portaria","dias":-365,"vinculos":["ingresso","evento"]}]'),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', '[{"titulo":"T","coluna":2}]'),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', '[{"titulo":"T","coluna":-1}]'),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', '[{"titulo":"T","coluna":0.5}]'),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', '[{"titulo":"T","coluna":"0"}]'),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', '[{"titulo":"","coluna":0}]'),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', '[{"titulo":"<b>T</b>","coluna":0}]'),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', jsonb_build_array(jsonb_build_object('titulo', repeat('x', 121), 'coluna', 0))),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', '[{"titulo":"T","coluna":0,"dias":366}]'),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', '[{"titulo":"T","coluna":0,"dias":1.5}]'),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', '[{"titulo":"T","coluna":0,"dias":"3"}]'),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', '[{"titulo":"T","coluna":0,"papel":"chefe"}]'),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', '[{"titulo":"T","coluna":0,"vinculos":["pagamento"]}]'),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', '[{"titulo":"T","coluna":0,"vinculos":"evento"}]'),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', '[{"titulo":"T","coluna":0,"extra":1}]'),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', (select jsonb_agg(jsonb_build_object('titulo', 'T' || g, 'coluna', 0)) from generate_series(1, 60) g)),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', (select jsonb_agg(jsonb_build_object('titulo', 'T' || g, 'coluna', 0)) from generate_series(1, 61) g)),
  public.quadro_modelo_ok('[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', '["texto"]')],
  array[true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, true, false, false],
  'quadro_modelo_ok: cartões (coluna válida, título, papel, dias -365..365, vínculos da lista, até 60, sem HTML)');

-- Modelos do sistema (sementes) ----------------------------------------------------------------------------------------------------------
select is((select string_agg(key, ',' order by key) from public.task_board_templates where owner_id is null),
  'dia_a_dia,divulgacao,evento_completo,financeiro_equipe,fornecedores,lancamento_vendas,pos_evento,reuniao_equipe', '8 modelos do sistema');
select is((select count(*) from public.task_board_templates where owner_id is null and public.quadro_modelo_ok(columns, cards)), 8::bigint, 'todos passam na validação');
select is((select string_agg(c ->> 'name', ',' order by o) from public.task_board_templates t, jsonb_array_elements(t.columns) with ordinality x(c, o) where t.key = 'evento_completo'),
  'A fazer,Em andamento,Em revisão,Feito', 'evento_completo: colunas');
select is((select string_agg(c ->> 'name', ',' order by o) from public.task_board_templates t, jsonb_array_elements(t.columns) with ordinality x(c, o) where t.key = 'pos_evento'),
  'Relatório,Certificados,Agradecimentos,Pesquisa,Feito', 'pos_evento: colunas');
select is((select string_agg(key || ':' || jsonb_array_length(cards), ',' order by key) from public.task_board_templates where owner_id is null),
  'dia_a_dia:3,divulgacao:4,evento_completo:9,financeiro_equipe:3,fornecedores:4,lancamento_vendas:5,pos_evento:4,reuniao_equipe:3', 'quantidade de cartões iniciais de cada modelo');
select is((select string_agg((c ->> 'titulo') || '|' || (c ->> 'dias') || '|' || coalesce(c ->> 'papel', '-'), ';' order by o)
             from public.task_board_templates t, jsonb_array_elements(t.cards) with ordinality x(c, o) where t.key = 'evento_completo'),
  'Confirmar local e contrato|60|-;Pedir alvará e vistoria|45|-;Fechar line-up e cachês|40|-;Abrir venda de ingressos|35|-;Contratar som e iluminação|30|-;'
  || 'Plano de segurança e acessos|20|-;Credenciar equipe e fornecedores|7|-;Passagem de som e checagem final|1|-;Conferir caixa e fechamento|-2|financeiro',
  'evento_completo: os 9 cartões do protótipo (título, prazo em dias e papel; só Financeiro tem papel no banco)');
select is((select string_agg(key || '=' || name || '|' || description, ';' order by key) from public.task_board_templates where owner_id is null),
  'dia_a_dia=Dia a dia do produtor|Hoje, esta semana e o que espera resposta.;divulgacao=Divulgação|Ideias, produção e calendário de posts.;'
  || 'evento_completo=Evento completo|Do alvará ao fechamento do caixa.;financeiro_equipe=Financeiro da equipe|Só acompanhamento: o sistema nunca paga.;'
  || 'fornecedores=Fornecedores e contratos|Da cotação ao contrato assinado.;lancamento_vendas=Lançamento de vendas|Pré-venda, abertura de lotes e encerramento.;'
  || 'pos_evento=Pós-evento|Relatório, certificados e agradecimentos.;reuniao_equipe=Reunião de equipe|Pauta, decisões e ações com responsável.',
  'nome e descrição dos 8 modelos = os do protótipo');
select is((select string_agg(key || ':' || (select string_agg((k ->> 'titulo') || '/' || coalesce(k ->> 'dias', '-'), ',' order by o2) from jsonb_array_elements(cards) with ordinality y(k, o2)), ';' order by key)
             from public.task_board_templates where owner_id is null and key <> 'evento_completo'),
  'dia_a_dia:Responder fornecedores/-,Revisar agenda da semana/-,Cobrar retorno pendente/-;'
  || 'divulgacao:Teaser de anúncio/40,Arte do cartaz/38,Série de bastidores/20,Lembrete de última semana/7;'
  || 'financeiro_equipe:Acompanhar nota do fornecedor de som/-,Acompanhar repasse da bilheteria/-,Conferir conciliação do mês/-;'
  || 'fornecedores:Cotar buffet e bebidas/50,Cotar segurança/45,Assinar contrato de som/30,Acompanhar pagamento do palco/14;'
  || 'lancamento_vendas:Definir lotes e preços/45,Montar lista de pré-venda/38,Testar compra de ponta a ponta/36,Abrir lote 1/35,Encerrar lote 1/21;'
  || 'pos_evento:Relatório de público/-3,Emitir certificados/-5,Agradecer parceiros/-2,Enviar pesquisa de satisfação/-4;'
  || 'reuniao_equipe:Resultados da semana/-,Pontos de atenção/-,Próximos passos/-',
  'títulos e prazos dos outros 7 modelos = os do protótipo');
select is((select count(*) from public.task_board_templates t, jsonb_array_elements(t.cards) c
           where (select e ->> 'kind' from jsonb_array_elements(t.columns) with ordinality y(e, p) where p = (c ->> 'coluna')::int + 1) <> 'todo'), 0::bigint,
  'nenhum cartão inicial nasce em coluna de andamento ou concluída');
select is((select count(*) from public.task_board_templates t, jsonb_array_elements(t.cards) c where t.key = 'financeiro_equipe' and c ->> 'titulo' ~* '(pagar automaticamente|transfer|pix)'), 0::bigint,
  'financeiro_equipe: só acompanhamento, nenhum cartão manda pagar');

-- Escrita direta é recusada ------------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', pg_temp.i('01'));
select throws_ok($$insert into public.task_boards (producer_id, name) values (pg_temp.i('01'), 'direto')$$, '42501', null, 'dono não cria quadro direto (só quadro_criar)');
select throws_ok($$delete from public.task_boards where id = pg_temp.b('eq')$$, '42501', null, 'dono não apaga quadro direto');
select throws_ok($$insert into public.task_board_members (board_id, user_id, nivel) values (pg_temp.b('esc'), pg_temp.i('a2'), 'ver')$$, '42501', null, 'dono não grava membro direto');
select throws_ok($$update public.task_board_members set nivel = 'ver'$$, '42501', null, 'dono não altera membro direto');
select throws_ok($$delete from public.task_board_members$$, '42501', null, 'dono não apaga membro direto');
select throws_ok($$insert into public.task_board_templates (key, name, kind_sugerido, columns, owner_id) values ('meu_x', 'X', 'equipe', '[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', pg_temp.i('01'))$$,
  '42501', null, 'dono não grava modelo direto');
select throws_ok($$update public.task_board_templates set name = 'x'$$, '42501', null, 'dono não altera modelo direto');
select throws_ok($$delete from public.task_board_templates$$, '42501', null, 'dono não apaga modelo direto');
select throws_ok($$update public.task_boards set is_default = false where id = pg_temp.b('be')$$, '42501', null, 'dono não altera is_default');
select throws_ok($$update public.task_boards set kind = 'pessoal' where id = pg_temp.b('eq')$$, '42501', null, 'dono não altera o tipo');
select throws_ok($$update public.task_boards set producer_id = pg_temp.i('02') where id = pg_temp.b('eq')$$, '42501', null, 'dono não passa o quadro para outro produtor');

-- quadro_criar: um quadro de cada modelo do sistema ---------------------------------------------------------------------------------------
create temp table _m (key text, board uuid);
grant all on _m to anon, authenticated;
select pg_temp.como('authenticated', pg_temp.i('01'));
insert into _m select t.key, public.quadro_criar('M ' || t.key, t.kind_sugerido, case when t.kind_sugerido = 'evento' then pg_temp.i('e1') end, t.key, 'equipe', null)
  from public.task_board_templates t where t.owner_id is null order by t.key;
select pg_temp.como('postgres');
select is((select count(*) from _m), 8::bigint, 'um quadro criado de cada um dos 8 modelos');
select is((select count(*) from _m m join public.task_board_templates t on t.key = m.key
           where (select jsonb_agg(jsonb_build_object('name', c.name, 'kind', c.kind) order by c.position) from public.task_columns c where c.board_id = m.board) = t.columns),
  8::bigint, 'colunas criadas na ordem e com o tipo do modelo');
select is((select count(*) from public.task_columns c join _m m on m.board = c.board_id
           where c.position <> (select count(*) from public.task_columns d where d.board_id = c.board_id and d.position <= c.position) * 1000), 0::bigint,
  'posição das colunas de 1000 em 1000');
select is((select count(*) from _m m join public.task_board_templates t on t.key = m.key
           where (select array_agg(p.title order by p.title) from public.producer_tasks p where p.board_id = m.board)
               = (select array_agg(c ->> 'titulo' order by c ->> 'titulo') from jsonb_array_elements(t.cards) c)), 8::bigint, 'cartões iniciais = os do modelo');
select is((select count(*) from _m m join public.task_board_templates t on t.key = m.key cross join jsonb_array_elements(t.cards) c
           join public.producer_tasks p on p.board_id = m.board and p.title = c ->> 'titulo'
           join public.task_columns col on col.id = p.column_id where col.position <> ((c ->> 'coluna')::int + 1) * 1000), 0::bigint,
  'cada cartão inicial na coluna indicada pelo modelo');
select is((select count(*) from public.producer_tasks p join _m m on m.board = p.board_id where p.status <> 'todo'), 0::bigint, 'cartões iniciais nascem "a fazer"');
select is((select ((p.due_date at time zone 'America/Sao_Paulo')::date) from public.producer_tasks p where p.board_id = (select board from _m where key = 'evento_completo') and p.title = 'Passagem de som e checagem final'),
  pg_temp.hoje() + 29, 'prazo = data do evento (hoje+30) menos os dias do modelo (1)');
select is((select ((p.due_date at time zone 'America/Sao_Paulo')::date) from public.producer_tasks p where p.board_id = (select board from _m where key = 'evento_completo') and p.title = 'Confirmar local e contrato'),
  pg_temp.hoje(), 'prazo que já passou vira hoje');
select is((select ((p.due_date at time zone 'America/Sao_Paulo')::date) from public.producer_tasks p where p.board_id = (select board from _m where key = 'pos_evento') and p.title = 'Relatório de público'),
  pg_temp.hoje() + 33, 'dias negativos = depois do evento');
select is((select count(*) from public.producer_tasks p join _m m on m.board = p.board_id join public.task_boards b on b.id = m.board
           where b.kind <> 'evento' and p.due_date is not null), 0::bigint, 'quadro que não é de evento não tem prazo');
select is((select count(*) from public.producer_tasks p join _m m on m.board = p.board_id join public.task_boards b on b.id = m.board
           where b.kind = 'evento' and p.due_date is null), 0::bigint, 'quadro de evento com data tem prazo em todos os cartões do modelo');
select is((select count(*) from public.task_links l join public.producer_tasks p on p.id = l.task_id where p.board_id = (select board from _m where key = 'evento_completo')),
  (select count(*) from public.task_board_templates t, jsonb_array_elements(t.cards) c where t.key = 'evento_completo' and c ? 'vinculos'), 'vínculos do modelo viram atalhos (os modelos do protótipo não trazem vínculos: 0)');
select is((select count(*) from public.task_roles r join _m m on m.board = r.board_id), 0::bigint, 'papéis ficam sem pessoa');
select is((select count(*) from public.task_card_members x join public.producer_tasks p on p.id = x.task_id join _m m on m.board = p.board_id), 0::bigint, 'nenhum cartão inicial tem membro');
select is((select review_column_id from public.task_boards where id = (select board from _m where key = 'evento_completo')),
  pg_temp.col((select board from _m where key = 'evento_completo'), 'Em revisão'), 'coluna "Em revisão" do modelo vira a coluna de revisão do quadro');
select is((select review_column_id from public.task_boards where id = (select board from _m where key = 'dia_a_dia')), null, 'modelo sem "Em revisão": sem coluna de revisão');
select is((select count(*) from public.task_boards b join _m m on m.board = b.id
           where b.template_key = m.key and not b.is_default and b.created_by = pg_temp.i('01') and b.producer_id = pg_temp.i('01') and b.name = 'M ' || m.key and b.position is not null), 8::bigint,
  'quadro criado: modelo, não padrão, autor e dono');
select is((select kind || '/' || visibility from public.task_boards where id = (select board from _m where key = 'dia_a_dia')), 'pessoal/pessoal', 'modelo pessoal: quadro pessoal e visibilidade pessoal');
select is((select kind || '/' || visibility from public.task_boards where id = (select board from _m where key = 'reuniao_equipe')), 'equipe/equipe', 'modelo de equipe: equipe/equipe');
select is((select count(*) from public.task_activity a join _m m on m.board = a.board_id where a.kind = 'modelo' and a.data ->> 'origem' = 'quadro_criar' and a.data ->> 'modelo' = m.key), 8::bigint,
  'criação registrada no histórico (task_log)');
select is((select count(*) from public.task_activity a join public.producer_tasks p on p.id = a.task_id join _m m on m.board = p.board_id where a.kind = 'criado'),
  (select sum(jsonb_array_length(cards))::bigint from public.task_board_templates where owner_id is null), 'cada cartão inicial também entra no histórico como criado');

-- quadro_criar: do zero, evento sem data, recusas -----------------------------------------------------------------------------------------
select pg_temp.como('authenticated', pg_temp.i('01'));
insert into _b select 'zero', public.quadro_criar('  Do zero  ', 'equipe', null, null, null, null);
insert into _b select 'semdata', public.quadro_criar('Evento sem data', 'evento', pg_temp.i('e2'), 'evento_completo', 'equipe', null);
insert into _b select 'ev2', public.quadro_criar('Outro do mesmo evento', 'evento', pg_temp.i('e1'), null, 'equipe', null);
select pg_temp.como('postgres');
select is((select name || '|' || visibility from public.task_boards where id = pg_temp.b('zero')), 'Do zero|equipe', 'nome sem espaços nas pontas; visibilidade padrão equipe');
select is((select string_agg(name || ':' || kind, ',' order by position) from public.task_columns where board_id = pg_temp.b('zero')), 'A fazer:todo,Em andamento:doing,Feito:done', 'do zero: A fazer, Em andamento, Feito');
select is((select count(*) from public.producer_tasks where board_id = pg_temp.b('zero')), 0::bigint, 'do zero: sem cartões');
select is((select template_key is null from public.task_boards where id = pg_temp.b('zero')), true, 'do zero: sem template_key');
select is((select count(*) from public.producer_tasks where board_id = pg_temp.b('semdata') and (due_date is not null or start_date is not null)), 0::bigint,
  'evento sem data: prazo ignorado e start_date NÃO usado');
select is((select count(*) from public.producer_tasks where board_id = pg_temp.b('semdata')), 9::bigint, 'evento sem data: os 9 cartões do modelo ainda são criados');
select is((select count(*) from public.task_boards where event_id = pg_temp.i('e1') and not is_default), 6::bigint, 'seis quadros extras no mesmo evento: 5 de modelo e 1 do zero (o índice único é só do padrão)');
select is((select count(*) from public.task_boards where event_id = pg_temp.i('e1') and is_default), 1::bigint, 'e continua um único quadro padrão por evento');
select pg_temp.como('authenticated', pg_temp.i('01'));
select throws_ok($$select public.quadro_criar('X', 'evento', pg_temp.i('e9'), null, 'equipe', null)$$, '22023', 'Escolha um evento seu para o quadro.', 'evento de outro produtor é recusado');
select throws_ok($$select public.quadro_criar('X', 'evento', pg_temp.i('ee'), null, 'equipe', null)$$, '22023', 'Escolha um evento seu para o quadro.', 'evento inexistente: mesma resposta');
select throws_ok($$select public.quadro_criar('X', 'evento', null, null, 'equipe', null)$$, '22023', 'Escolha um evento seu para o quadro.', 'quadro de evento sem evento é recusado');
select throws_ok($$select public.quadro_criar('X', 'equipe', pg_temp.i('e1'), null, 'equipe', null)$$, '22023', 'Só quadro de evento leva um evento.', 'quadro de equipe com evento é recusado');
select throws_ok($$select public.quadro_criar('', 'equipe', null, null, 'equipe', null)$$, '22023', 'O nome do quadro deve ter de 1 a 40 caracteres, sem < ou >.', 'nome vazio');
select throws_ok($$select public.quadro_criar('   ', 'equipe', null, null, 'equipe', null)$$, '22023', null, 'nome só de espaços');
select throws_ok($$select public.quadro_criar(null, 'equipe', null, null, 'equipe', null)$$, '22023', null, 'nome nulo');
select throws_ok($$select public.quadro_criar('a<b', 'equipe', null, null, 'equipe', null)$$, '22023', null, 'nome com <');
select throws_ok($$select public.quadro_criar(repeat('x', 41), 'equipe', null, null, 'equipe', null)$$, '22023', null, 'nome com 41 caracteres');
select throws_ok($$select public.quadro_criar(E'a\u0007b', 'equipe', null, null, 'equipe', null)$$, '22023', null, 'nome com caractere de controle');
select throws_ok($$select public.quadro_criar(E'a‮b', 'equipe', null, null, 'equipe', null)$$, '22023', null, 'nome com formatação bidirecional');
select throws_ok($$select public.quadro_criar('X', 'grupo', null, null, 'equipe', null)$$, '22023', 'Tipo de quadro inválido.', 'tipo inválido');
select throws_ok($$select public.quadro_criar('X', 'equipe', null, null, 'todos', null)$$, '22023', 'Visibilidade inválida.', 'visibilidade inválida');
select throws_ok($$select public.quadro_criar('X', 'equipe', null, 'nao_existe', 'equipe', null)$$, '22023', 'Modelo de quadro não encontrado.', 'modelo inexistente');
select lives_ok($$select public.quadro_criar('lixo', 'equipe', null, null, 'equipe', null)$$, 'controle: nome simples passa');
select lives_ok($$select public.quadro_criar('P', 'pessoal', null, null, 'equipe', jsonb_build_array(jsonb_build_object('user_id', pg_temp.i('a2'), 'nivel', 'ver')))$$, 'quadro pessoal criado');
select pg_temp.como('postgres');
select is((select visibility from public.task_boards where name = 'P' and producer_id = pg_temp.i('01')), 'pessoal', 'quadro pessoal força visibilidade pessoal, mesmo pedindo equipe');
select is((select count(*) from public.task_board_members x join public.task_boards b on b.id = x.board_id where b.name = 'P'), 0::bigint, 'quadro pessoal: lista de pessoas ignorada');
select pg_temp.como('authenticated', pg_temp.i('01'));
select lives_ok($$select public.quadro_criar('Eq com lista', 'equipe', null, null, 'equipe', '[{"user_id":"ff000000-0000-4000-8000-0000000000a2","nivel":"ver"}]')$$, 'visibilidade equipe: lista ignorada');
select pg_temp.como('postgres');
select is((select count(*) from public.task_board_members x join public.task_boards b on b.id = x.board_id where b.name = 'Eq com lista'), 0::bigint, 'visibilidade equipe: nenhuma linha em task_board_members');
select pg_temp.como('authenticated', pg_temp.i('01'));
-- listas de pessoas inválidas (visibilidade escolhidas)
select throws_ok($$select public.quadro_criar('X', 'equipe', null, null, 'escolhidas', '{"user_id":"x"}')$$, '22023', 'Lista de pessoas inválida.', 'lista que não é array');
select throws_ok($$select public.quadro_criar('X', 'equipe', null, null, 'escolhidas', '[{"user_id":"ff000000-0000-4000-8000-0000000000a2"}]')$$, '22023', 'Cada pessoa precisa de user_id e nível (ver ou editar).', 'pessoa sem nível');
select throws_ok($$select public.quadro_criar('X', 'equipe', null, null, 'escolhidas', '[{"user_id":"ff000000-0000-4000-8000-0000000000a2","nivel":"dono"}]')$$, '22023', null, 'nível fora da lista');
select throws_ok($$select public.quadro_criar('X', 'equipe', null, null, 'escolhidas', '[{"user_id":"nao-uuid","nivel":"ver"}]')$$, '22023', null, 'user_id que não é uuid');
select throws_ok($$select public.quadro_criar('X', 'equipe', null, null, 'escolhidas', '[{"user_id":"ff000000-0000-4000-8000-0000000000a2","nivel":"ver","x":1}]')$$, '22023', null, 'chave extra na pessoa');
select throws_ok($$select public.quadro_criar('X', 'equipe', null, null, 'escolhidas', '[{"user_id":"ff000000-0000-4000-8000-0000000000a2","nivel":"ver"},{"user_id":"ff000000-0000-4000-8000-0000000000a2","nivel":"editar"}]')$$,
  '22023', 'Pessoa repetida na lista.', 'pessoa repetida');
select throws_ok($$select public.quadro_criar('X', 'equipe', null, null, 'escolhidas', '[{"user_id":"ff000000-0000-4000-8000-000000000002","nivel":"ver"}]')$$,
  '22023', 'Só pessoas ativas da sua equipe podem entrar no quadro.', 'pessoa de outro produtor');
select throws_ok($$select public.quadro_criar('X', 'equipe', null, null, 'escolhidas', '[{"user_id":"ff000000-0000-4000-8000-0000000000a4","nivel":"ver"}]')$$,
  '22023', 'Só pessoas ativas da sua equipe podem entrar no quadro.', 'membro bloqueado');
select throws_ok($$select public.quadro_criar('X', 'equipe', null, null, 'escolhidas', '[{"user_id":"ff000000-0000-4000-8000-0000000000a6","nivel":"ver"}]')$$,
  '22023', 'Só pessoas ativas da sua equipe podem entrar no quadro.', 'membro não aceito');
select throws_ok($$select public.quadro_criar('X', 'equipe', null, null, 'escolhidas', '[{"user_id":"ff000000-0000-4000-8000-0000000000ee","nivel":"ver"}]')$$,
  '22023', 'Só pessoas ativas da sua equipe podem entrar no quadro.', 'uuid que não existe');
select throws_ok($$select public.quadro_criar('X', 'equipe', null, null, 'escolhidas', (select jsonb_agg(jsonb_build_object('user_id', gen_random_uuid(), 'nivel', 'ver')) from generate_series(1, 51)))$$,
  '22023', 'Limite de 50 pessoas por quadro.', 'mais de 50 pessoas');
select is((select count(*) from public.task_boards where name = 'X'), 0::bigint, 'nenhuma recusa deixou quadro pela metade');
select lives_ok($$select public.quadro_criar('Com dono na lista', 'equipe', null, null, 'escolhidas', '[{"user_id":"ff000000-0000-4000-8000-000000000001","nivel":"ver"},{"user_id":"ff000000-0000-4000-8000-0000000000a2","nivel":"editar"}]')$$,
  'o dono na lista é aceito');
select pg_temp.como('postgres');
select is((select string_agg(x.user_id::text || x.nivel, ',') from public.task_board_members x join public.task_boards b on b.id = x.board_id where b.name = 'Com dono na lista'),
  pg_temp.i('a2')::text || 'editar', 'o dono na lista é ignorado (já tem tudo); só a outra pessoa vira linha');
select is((select string_agg(x.user_id::text || x.nivel || (x.added_by = pg_temp.i('01'))::text, ',' order by x.user_id) from public.task_board_members x where x.board_id = pg_temp.b('esc')),
  pg_temp.i('a7')::text || 'vertrue,' || pg_temp.i('a8')::text || 'editartrue',
  'quadro escolhidas: 2 pessoas ativas, com nível e quem adicionou (mb e mna, que saíram da equipe, perderam a linha: gatilho team_members_quadro_sai)');
delete from public.task_boards where name in ('Com dono na lista', 'Eq com lista', 'P', 'lixo');

-- quadro_criar: modelo de outro produtor, 2FA e anon -------------------------------------------------------------------------------------
insert into public.task_board_templates (key, name, kind_sugerido, columns, cards, owner_id)
  values ('meu_p2', 'Do P2', 'equipe', '[{"name":"A","kind":"todo"},{"name":"B","kind":"done"}]', '[]', pg_temp.i('02'));
select pg_temp.como('authenticated', pg_temp.i('01'));
select throws_ok($$select public.quadro_criar('X', 'equipe', null, 'meu_p2', 'equipe', null)$$, '22023', 'Modelo de quadro não encontrado.', 'modelo de outro produtor não é visto nem usado');
select is((select count(*) from public.task_board_templates), 8::bigint, 'p1 enxerga só os 8 do sistema (o de p2 não)');
select pg_temp.como('authenticated', pg_temp.i('02'));
select is((select count(*) from public.task_board_templates), 9::bigint, 'p2 enxerga os 8 do sistema e o próprio');
select pg_temp.como('anon');
select throws_ok($$select public.quadro_criar('X', 'equipe', null, null, 'equipe', null)$$, '42501', null, 'anon não cria quadro');
select throws_ok($$select count(*) from public.task_board_templates$$, '42501', null, 'anon não lê modelos');
select throws_ok($$select count(*) from public.task_board_members$$, '42501', null, 'anon não lê membros');
select throws_ok($$select public.quadro_acesso(null, null, 'ver')$$, '42501', null, 'anon não chama a porta');
select pg_temp.como('postgres');

-- Salvar como modelo ------------------------------------------------------------------------------------------------------------------
insert into public.producer_tasks (producer_id, board_id, column_id, title) values
  (pg_temp.i('01'), pg_temp.b('eq'), pg_temp.col(pg_temp.b('eq'), 'Feito'), 'ja-feito'),
  (pg_temp.i('01'), pg_temp.b('eq'), null, E'Com <b>tag</b>‮');
insert into public.producer_tasks (producer_id, board_id, title, archived_at) values (pg_temp.i('01'), pg_temp.b('eq'), 'arquivado', now());
insert into _b select 'x70', public.quadro_criar_interno(pg_temp.i('01'), pg_temp.i('e3'));
insert into public.producer_tasks (producer_id, board_id, title) select pg_temp.i('01'), pg_temp.b('x70'), 'c' || g from generate_series(1, 70) g;
insert into public.task_boards (id, producer_id, name, kind, visibility, created_by) values (pg_temp.i('b1'), pg_temp.i('01'), 'Uma coluna', 'equipe', 'equipe', pg_temp.i('01'));
insert into public.task_columns (board_id, name, kind, position) values (pg_temp.i('b1'), 'Só', 'todo', 1000);
select pg_temp.como('authenticated', pg_temp.i('01'));
create temp table _k (k text, v text);
grant all on _k to anon, authenticated;
insert into _k select 'sem', public.quadro_salvar_como_modelo(pg_temp.b('eq'), '  Meu modelo  ');
insert into _k select 'com', public.quadro_salvar_como_modelo(pg_temp.b('eq'), 'Com cartões', true);
insert into _k select 'x70', public.quadro_salvar_como_modelo(pg_temp.b('x70'), 'Setenta', true);
select pg_temp.como('postgres');
select is((select v ~ '^meu_[0-9a-f]{32}$' from _k where k = 'sem'), true, 'chave gerada: meu_ + 32 hex');
select is((select name || '|' || kind_sugerido || '|' || owner_id::text || '|' || jsonb_array_length(cards) from public.task_board_templates where key = (select v from _k where k = 'sem')),
  'Meu modelo|equipe|' || pg_temp.i('01')::text || '|0', 'modelo salvo: nome sem espaços, tipo do quadro, dono, sem cartões por padrão');
select is((select columns from public.task_board_templates where key = (select v from _k where k = 'sem')),
  '[{"name":"A fazer","kind":"todo"},{"name":"Em andamento","kind":"doing"},{"name":"Feito","kind":"done"}]'::jsonb, 'colunas copiadas na ordem');
select is((select string_agg(c ->> 'titulo', '|' order by (c ->> 'titulo') collate "C") from public.task_board_templates t, jsonb_array_elements(t.cards) c where t.key = (select v from _k where k = 'com')),
  'Com btag/b|card-eq|rec-eq', 'só cartões abertos (sem feito nem arquivado), com o título limpo de < > e bidi');
select is((select count(*) from public.task_board_templates t, jsonb_array_elements(t.cards) c where t.key = (select v from _k where k = 'com') and (c - array['titulo', 'coluna']) <> '{}'::jsonb),
  0::bigint, 'o cartão do modelo leva só título e coluna: sem membros, datas, papéis nem vínculos');
select is((select jsonb_array_length(cards)::bigint from public.task_board_templates where key = (select v from _k where k = 'x70')), 60::bigint, 'no máximo 60 cartões');
select pg_temp.como('authenticated', pg_temp.i('01'));
select throws_ok($$select public.quadro_salvar_como_modelo(pg_temp.i('b1'), 'Um')$$, '22023', 'Este quadro não vira modelo: precisa de 2 a 12 colunas, com ao menos uma de "a fazer" e uma de "feito".', 'quadro de uma coluna não vira modelo');
select throws_ok($$select public.quadro_salvar_como_modelo(pg_temp.b('eq'), 'a<b')$$, '22023', 'O nome do modelo deve ter de 1 a 40 caracteres, sem < ou >.', 'nome de modelo inválido');
select throws_ok($$select public.quadro_salvar_como_modelo(pg_temp.b('eq'), '')$$, '22023', null, 'nome de modelo vazio');
select throws_ok($$select public.quadro_salvar_como_modelo(pg_temp.b('b9'), 'Alheio')$$, '42501', 'Sem permissão para este quadro.', 'quadro de outro produtor');
select throws_ok($$select public.quadro_salvar_como_modelo(pg_temp.i('ee'), 'Nada')$$, '42501', 'Sem permissão para este quadro.', 'quadro inexistente: mesma resposta');
select is((select count(*) from public.task_board_templates where owner_id is not null), 3::bigint, 'p1 enxerga os 3 modelos que salvou');
select lives_ok($$select public.quadro_criar('Do meu modelo', 'equipe', null, (select v from _k where k = 'com'), 'equipe', null)$$, 'o modelo salvo é usável por quem o salvou');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select throws_ok($$select public.quadro_salvar_como_modelo(pg_temp.b('eq'), 'Do editor')$$, '42501', 'Sem permissão para este quadro.', 'membro editor não salva o quadro como modelo (só o dono)');
select throws_ok($$select public.quadro_salvar_como_modelo(pg_temp.b('pes'), 'Do pessoal')$$, '42501', null, 'membro não salva quadro pessoal como modelo');
select is((select count(*) from public.task_board_templates where owner_id is not null), 0::bigint, 'membro não enxerga o modelo do dono');
select pg_temp.como('authenticated', pg_temp.i('02'));
select throws_ok($$select public.quadro_salvar_como_modelo(pg_temp.b('eq'), 'Do outro')$$, '42501', null, 'outro produtor não salva quadro alheio como modelo');
select is((select count(*) from public.task_board_templates where owner_id is not null), 1::bigint, 'p2 só enxerga o próprio');
select pg_temp.como('anon');
select throws_ok($$select public.quadro_salvar_como_modelo(pg_temp.b('eq'), 'Anon')$$, '42501', null, 'anon não salva modelo');
select pg_temp.como('postgres');
delete from public.producer_tasks where board_id in (select id from public.task_boards where name = 'Do meu modelo') or board_id = pg_temp.b('x70');
delete from public.task_boards where name = 'Do meu modelo';
delete from public.task_boards where id in (pg_temp.b('x70'), pg_temp.i('b1'));
delete from public.producer_tasks where board_id = pg_temp.b('eq') and (title in ('ja-feito', 'arquivado') or title like 'Com %tag%');

-- Cron de prazos: só avisa quem tem acesso AO QUADRO do cartão ---------------------------------------------------------------------------
-- Todo mundo (inclusive mb, mna, mp, ev, ee, mv, me) é membro do cartão de cada quadro; o prazo é amanhã.
select pg_temp.como('postgres');
select lives_ok($$select public.quadro_avisar_prazos()$$, 'cron de prazos roda');
create function pg_temp.quem(p_task uuid, p_tipo text) returns text language sql stable as $f$
  select coalesce(string_agg(right(user_id::text, 2), ',' order by user_id), '-') from public.notifications
   where metadata ->> 'kind' = 'quadro' and metadata ->> 'task_id' = p_task::text and metadata ->> 'tipo' = p_tipo $f$;
grant execute on function pg_temp.quem(uuid, text) to anon, authenticated;
select is(pg_temp.quem((select card from _rec where k = 'be'), 'prazo'), '01,a2,a3', 'prazo, quadro do evento (equipe): dono, mv e me; ev, ee, mp, mb e mna não');
select is(pg_temp.quem((select card from _rec where k = 'eq'), 'prazo'), '01,a2,a3', 'prazo, quadro de equipe: dono, mv e me');
select is(pg_temp.quem((select card from _rec where k = 'pes'), 'prazo'), '01', 'prazo, quadro pessoal: só o dono');
select is(pg_temp.quem((select card from _rec where k = 'esc'), 'prazo'), '01,a7,a8', 'prazo, quadro de pessoas escolhidas: dono, ev e ee (não exige a ferramenta; mv e me ficam de fora)');

-- Cron de recorrência: a cópia só leva quem tem acesso ----------------------------------------------------------------------------------
select is(public.quadro_gerar_recorrentes_vencidas(), 4, 'cron de recorrência gerou as 4 cópias');
create function pg_temp.copia(p_k text) returns uuid language sql stable as $f$
  select p.id from public.producer_tasks p where p.title = 'rec-' || p_k and p.id <> (select rec from _rec where k = p_k) and p.board_id = pg_temp.b(p_k) $f$;
create function pg_temp.membros(p_task uuid) returns text language sql stable as $f$
  select coalesce(string_agg(right(user_id::text, 2), ',' order by user_id), '-') from public.task_card_members where task_id = p_task $f$;
grant execute on function pg_temp.copia(text), pg_temp.membros(uuid) to anon, authenticated;
select is(pg_temp.membros(pg_temp.copia('be')), '01,a2,a3', 'cópia recorrente (evento): membros só com acesso ao quadro');
select is(pg_temp.membros(pg_temp.copia('eq')), '01,a2,a3', 'cópia recorrente (equipe): idem');
select is(pg_temp.membros(pg_temp.copia('pes')), '01', 'cópia recorrente (pessoal): só o dono, nenhum membro vaza');
select is(pg_temp.membros(pg_temp.copia('esc')), '01,a7,a8', 'cópia recorrente (escolhidas): dono, ev e ee');
select is((select assigned_to from public.producer_tasks where id = pg_temp.copia('be')), null, 'responsável sem acesso ao quadro não vai para a cópia (equipe)');
select is((select assigned_to from public.producer_tasks where id = pg_temp.copia('pes')), null, 'responsável sem acesso não vai para a cópia (pessoal)');
select is((select assigned_to from public.producer_tasks where id = pg_temp.copia('esc')), pg_temp.i('a7'), 'responsável com acesso ao quadro (escolhidas) vai para a cópia');
select is((select count(*) from public.producer_tasks p where p.board_id = pg_temp.b('pes') and p.title = 'rec-pes'), 2::bigint, 'a cópia fica no MESMO quadro (nada sai do quadro pessoal)');
select is((select recur_next from public.producer_tasks where id = (select rec from _rec where k = 'be')), pg_temp.hoje() + 7, 'o original avança a data');
-- quadro arquivado não gera cópia, mas o original avança (não trava as 10 vagas do produtor)
select pg_temp.como('authenticated', pg_temp.i('01'));
insert into _b select 'arq2', public.quadro_criar('Arquivado', 'equipe', null, null, 'equipe', null);
select pg_temp.como('postgres');
insert into public.producer_tasks (id, producer_id, board_id, title) values (pg_temp.i('d2'), pg_temp.i('01'), pg_temp.b('arq2'), 'rec-arq2');
update public.producer_tasks set recur_days = 7 where id = pg_temp.i('d2');
update public.producer_tasks set recur_next = pg_temp.hoje() where id = pg_temp.i('d2');
update public.task_boards set archived_at = now() where id = pg_temp.b('arq2');
select is(public.quadro_gerar_recorrentes_vencidas(), 0, 'cron: nada a copiar (os 4 originais já avançaram; o do quadro arquivado não gera cópia)');
select is((select count(*) from public.producer_tasks where title = 'rec-arq2'), 1::bigint, 'quadro arquivado não gera cópia');
select is((select recur_next from public.producer_tasks where id = pg_temp.i('d2')), pg_temp.hoje() + 7, 'quadro arquivado: o original só avança a data');

-- Avisos de comentário, menção e atribuição -------------------------------------------------------------------------------------------
delete from public.notifications where metadata ->> 'kind' = 'quadro';
select pg_temp.como('authenticated', pg_temp.i('a3'));
select lives_ok($$insert into public.task_comments (task_id, body, mentions) select card, 'oi', array[pg_temp.i('a2'), pg_temp.i('a7')] from _rec where k = 'be'$$, 'me comenta e menciona mv e ev');
select pg_temp.como('postgres');
select is(pg_temp.quem((select card from _rec where k = 'be'), 'mencao'), 'a2', 'menção: mv (com acesso) recebe; ev (membro sem acesso ao quadro) não');
select is(pg_temp.quem((select card from _rec where k = 'be'), 'mensagem'), '01', 'mensagem: dos membros do cartão, só o dono tem acesso ao quadro (mp, ev, ee, mb e mna não)');
select pg_temp.como('authenticated', pg_temp.i('a8'));
select lives_ok($$insert into public.task_comments (task_id, body, mentions) select card, 'oi', array[pg_temp.i('a7')] from _rec where k = 'esc'$$, 'ee comenta e menciona ev no quadro escolhidas');
select pg_temp.como('postgres');
select is(pg_temp.quem((select card from _rec where k = 'esc'), 'mencao'), 'a7', 'menção no quadro escolhidas: ev recebe');
select is(pg_temp.quem((select card from _rec where k = 'esc'), 'mensagem'), '01', 'mensagem no quadro escolhidas: só o dono (mv, me e mp têm a ferramenta ou são membros, mas não têm acesso)');
delete from public.notifications where metadata ->> 'kind' = 'quadro';
select pg_temp.como('authenticated', pg_temp.i('a8'));
with x as (insert into public.producer_tasks (producer_id, board_id, title) values (pg_temp.i('01'), pg_temp.b('esc'), 'novo-esc') returning id) insert into _b select 'd3', id from x;
insert into public.task_card_members (task_id, user_id) values (pg_temp.b('d3'), pg_temp.i('a7'));
insert into public.task_card_members (task_id, user_id) values (pg_temp.b('d3'), pg_temp.i('a5'));
select pg_temp.como('postgres');
select is(pg_temp.quem(pg_temp.b('d3'), 'atribuicao'), 'a7', 'atribuição: ev recebe; mp (membro sem acesso ao quadro) não');

-- Segurança extra: trocar a visibilidade corta o acesso na hora ---------------------------------------------------------------------------
select pg_temp.como('authenticated', pg_temp.i('a2'));
select is((select count(*) from public.producer_tasks where board_id = pg_temp.b('eq')) > 0, true, 'antes: mv lê os cartões do quadro de equipe');
select pg_temp.como('authenticated', pg_temp.i('01'));
select lives_ok($$select public.quadro_membros_definir(pg_temp.b('eq'), 'pessoal', null)$$, 'dono passa o quadro de equipe para pessoal');
select pg_temp.como('authenticated', pg_temp.i('a2'));
select is((select count(*) from public.task_boards where id = pg_temp.b('eq')), 0::bigint, 'pessoal: mv não vê mais o quadro');
select is((select count(*) from public.producer_tasks where board_id = pg_temp.b('eq')), 0::bigint, 'pessoal: nem os cartões');
select is((select count(*) from public.task_columns where board_id = pg_temp.b('eq')), 0::bigint, 'pessoal: nem as colunas');
select is((select count(*) from public.task_comments c where c.task_id = (select card from _rec where k = 'eq')), 0::bigint, 'pessoal: nem os comentários');
select is((select count(*) from public.task_comment_receipts where comment_id = (select com from _rec where k = 'eq')), 0::bigint, 'pessoal: nem os recibos');
select is((select count(*) from public.task_card_views where task_id = (select card from _rec where k = 'eq')), 0::bigint, 'pessoal: nem o "visto por"');
select is((select count(*) from public.task_attachments where task_id = (select card from _rec where k = 'eq')), 0::bigint, 'pessoal: nem os anexos');
select is((select count(*) from storage.objects where name = (select path from _rec where k = 'eq')), 0::bigint, 'pessoal: nem o arquivo no Storage');
select is((select count(*) from public.task_buttons where board_id = pg_temp.b('eq')), 0::bigint, 'pessoal: nem os botões');
select is((select count(*) from public.task_roles where board_id = pg_temp.b('eq')), 0::bigint, 'pessoal: nem os papéis');
select is((select count(*) from public.task_activity where board_id = pg_temp.b('eq')), 0::bigint, 'pessoal: nem o histórico');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select throws_ok($$select public.quadro_rodar_botao((select btn from _rec where k = 'eq'), (select card from _rec where k = 'eq'))$$, '42501', null, 'pessoal: editor não roda botão');
select throws_ok($$select public.quadro_gerar_recorrente((select rec from _rec where k = 'eq'))$$, '42501', null, 'pessoal: editor não gera recorrência');
select throws_ok($$select public.quadro_aplicar_modelo(pg_temp.b('eq'), 'festa')$$, '42501', null, 'pessoal: editor não aplica modelo de cartão');
select throws_ok($$select public.quadro_papeis_sugerir(pg_temp.b('eq'))$$, '42501', null, 'pessoal: editor não lista papéis');
select is(public.quadro_marcar_lido((select card from _rec where k = 'eq')), 0, 'pessoal: marcar como lido não grava nada');
select is(public.quadro_marcar_entregue(array[(select card from _rec where k = 'eq')]), 0, 'pessoal: marcar como entregue não grava nada');
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('task-attachments', pg_temp.i('01')::text || '/' || (select card from _rec where k = 'eq')::text || '/' || gen_random_uuid()::text || '-b.png', pg_temp.i('a3'))$$,
  '42501', null, 'pessoal: editor não envia arquivo');
select pg_temp.como('postgres');
delete from public.notifications where metadata ->> 'kind' = 'quadro';
update public.producer_tasks set due_date = pg_temp.hoje()::timestamp at time zone 'America/Sao_Paulo' where id = (select card from _rec where k = 'eq');
select public.quadro_avisar_prazos();
select is(pg_temp.quem((select card from _rec where k = 'eq'), 'prazo'), '01', 'pessoal: o cron de prazos avisa só o dono');

-- MATRIZ DE ACESSO: papéis x tipos de visibilidade x leitura/escrita ---------------------------------------------------------------------
-- Quadros: be (padrão do evento, equipe), eq (equipe), pes (pessoal), esc (pessoas escolhidas: ev 'ver', ee 'editar'; mb e mna já saíram da equipe).
-- Antes: o quadro eq volta a ser de equipe; comentários e avisos do teste anterior saem, para a matriz partir do zero.
select pg_temp.como('authenticated', pg_temp.i('01'));
select lives_ok($$select public.quadro_membros_definir(pg_temp.b('eq'), 'equipe', null)$$, 'o quadro eq volta a ser de equipe');
select pg_temp.como('postgres');
delete from public.task_comments where body in ('oi', 'x');
delete from public.notifications where metadata ->> 'kind' = 'quadro';

create temp table _acl (ator text, k text, ver boolean, ed boolean);
create temp table _atores (ator text primary key, id uuid);
create temp table _sondas (fase int, ord int, nome text primary key);
grant select on _acl, _atores, _sondas to anon, authenticated;
insert into _atores values ('dono', pg_temp.i('01')), ('mv', pg_temp.i('a2')), ('me', pg_temp.i('a3')), ('ev', pg_temp.i('a7')), ('ee', pg_temp.i('a8')),
  ('mp', pg_temp.i('a5')), ('mb', pg_temp.i('a4')), ('mna', pg_temp.i('a6')), ('p2', pg_temp.i('02')), ('x', pg_temp.i('b1'));
-- a tabela de verdade (escrita à mão, independente do código): ator, quadro, vê, edita
insert into _acl values
  ('dono','be',true,true), ('dono','eq',true,true), ('dono','pes',true,true), ('dono','esc',true,true),
  ('mv','be',true,false), ('mv','eq',true,false), ('mv','pes',false,false), ('mv','esc',false,false),
  ('me','be',true,true), ('me','eq',true,true), ('me','pes',false,false), ('me','esc',false,false),
  ('ev','be',false,false), ('ev','eq',false,false), ('ev','pes',false,false), ('ev','esc',true,false),
  ('ee','be',false,false), ('ee','eq',false,false), ('ee','pes',false,false), ('ee','esc',true,true),
  ('mp','be',false,false), ('mp','eq',false,false), ('mp','pes',false,false), ('mp','esc',false,false),
  ('mb','be',false,false), ('mb','eq',false,false), ('mb','pes',false,false), ('mb','esc',false,false),
  ('mna','be',false,false), ('mna','eq',false,false), ('mna','pes',false,false), ('mna','esc',false,false),
  ('p2','be',false,false), ('p2','eq',false,false), ('p2','pes',false,false), ('p2','esc',false,false),
  ('x','be',false,false), ('x','eq',false,false), ('x','pes',false,false), ('x','esc',false,false),
  ('anon','be',false,false), ('anon','eq',false,false), ('anon','pes',false,false), ('anon','esc',false,false);
insert into _sondas values
  (1,1,'quadros'), (1,2,'colunas'), (1,3,'cartoes'), (1,4,'checklists'), (1,5,'itens'), (1,6,'comentarios'), (1,7,'anexos'), (1,8,'objetos'),
  (1,9,'recibos'), (1,10,'visto'), (1,11,'botoes'), (1,12,'papeis'), (1,13,'membros_quadro'), (1,14,'historico'), (1,15,'etiquetas'),
  (1,16,'membros_cartao'), (1,17,'atalhos'),
  (2,1,'pode_ver'), (2,2,'pode_editar'), (2,3,'board_ver'), (2,4,'acesso_ver'), (2,5,'acesso_editar'), (2,6,'marcar_lido'), (2,7,'rodar_botao'), (2,8,'papeis_sugerir'),
  (3,1,'w_atualizar_cartao'), (3,2,'w_criar_cartao'), (3,3,'w_atualizar_coluna'), (3,4,'w_criar_checklist'), (3,5,'w_comentar'), (3,6,'w_criar_botao'),
  (3,7,'w_atualizar_papel'), (3,8,'w_enviar_arquivo'), (3,9,'w_renomear_quadro');

-- sonda(sonda, quadro): leitura = "viu alguma linha?" (true/false); função = resultado; escrita = ok | 0 linhas | SQLSTATE do erro
create function pg_temp.sonda_i(p_sonda text, p_k text) returns text language plpgsql as $f$
declare r record; v_b uuid := pg_temp.b(p_k); v text; n bigint;
begin
  select * into r from _rec where _rec.k = p_k;
  if p_sonda in ('quadros','colunas','cartoes','checklists','itens','comentarios','anexos','objetos','recibos','visto','botoes','papeis','membros_quadro','historico','etiquetas','membros_cartao','atalhos') then
    execute case p_sonda
      when 'quadros' then 'select count(*) from public.task_boards where id = $1'
      when 'colunas' then 'select count(*) from public.task_columns where board_id = $1'
      when 'cartoes' then 'select count(*) from public.producer_tasks where board_id = $1'
      when 'checklists' then 'select count(*) from public.task_checklists where task_id = $2'
      when 'itens' then 'select count(*) from public.task_checklist_items where checklist_id = $3'
      when 'comentarios' then 'select count(*) from public.task_comments where task_id = $2'
      when 'anexos' then 'select count(*) from public.task_attachments where task_id = $2'
      when 'objetos' then 'select count(*) from storage.objects where name = $4'
      when 'recibos' then 'select count(*) from public.task_comment_receipts where comment_id = $5'
      when 'visto' then 'select count(*) from public.task_card_views where task_id = $2'
      when 'botoes' then 'select count(*) from public.task_buttons where board_id = $1'
      when 'papeis' then 'select count(*) from public.task_roles where board_id = $1'
      when 'membros_quadro' then 'select count(*) from public.task_board_members where board_id = $1'
      when 'historico' then 'select count(*) from public.task_activity where board_id = $1'
      when 'etiquetas' then 'select count(*) from public.task_labels where board_id = $1'
      when 'membros_cartao' then 'select count(*) from public.task_card_members where task_id = $2'
      else 'select count(*) from public.task_links where task_id = $2' end
      into n using v_b, r.card, r.chk, r.path, r.com;
    return (n > 0)::text;
  elsif p_sonda in ('pode_ver','pode_editar','board_ver','acesso_ver','acesso_editar','marcar_lido') then
    execute case p_sonda
      when 'pode_ver' then 'select public.task_pode($1, ''ver'')::text'
      when 'pode_editar' then 'select public.task_pode($1, ''editar'')::text'
      when 'board_ver' then 'select public.board_pode($2, ''ver'')::text'
      when 'acesso_ver' then 'select public.quadro_acesso($2, (select auth.uid()), ''ver'')::text'
      when 'acesso_editar' then 'select public.quadro_acesso($2, (select auth.uid()), ''editar'')::text'
      else 'select (public.quadro_marcar_lido($1) > 0)::text' end
      into v using r.card, v_b;
    return v;
  end if;
  return pg_temp.tenta(case p_sonda
    when 'rodar_botao' then format('select public.quadro_rodar_botao(%L, %L)', r.btn, r.card)
    when 'papeis_sugerir' then format('select public.quadro_papeis_sugerir(%L)', v_b)
    when 'w_atualizar_cartao' then format('update public.producer_tasks set title = title where id = %L', r.card)
    when 'w_criar_cartao' then format('insert into public.producer_tasks (producer_id, board_id, title) values (%L, %L, ''novo'')', pg_temp.i('01'), v_b)
    when 'w_atualizar_coluna' then format('update public.task_columns set name = name where id = %L', r.col)
    when 'w_criar_checklist' then format('insert into public.task_checklists (task_id, title) values (%L, ''lista nova'')', r.card)
    when 'w_comentar' then format('insert into public.task_comments (task_id, body) values (%L, ''mais um'')', r.card)
    when 'w_criar_botao' then format('insert into public.task_buttons (board_id, name, scope, steps) values (%L, ''outro'', ''card'', ''[{"t":"prazo","v":3}]'')', v_b)
    when 'w_atualizar_papel' then format('update public.task_roles set user_id = user_id where board_id = %L', v_b)
    when 'w_enviar_arquivo' then format('insert into storage.objects (bucket_id, name) values (''task-attachments'', %L)',
         pg_temp.i('01')::text || '/' || r.card::text || '/' || gen_random_uuid()::text || '-n.png')
    else format('update public.task_boards set name = name where id = %L', v_b) end);
end $f$;
create function pg_temp.sonda(p_sonda text, p_k text) returns text language plpgsql as $f$
begin return pg_temp.sonda_i(p_sonda, p_k); exception when others then return sqlstate; end $f$;
create function pg_temp.esp(p_sonda text, p_ver boolean, p_ed boolean, p_k text, p_ator text) returns text language sql immutable as $f$
  select case
    when p_ator = 'anon' and p_sonda = 'objetos' then 'false' -- anon tem SELECT em storage.objects, mas a regra do bucket não devolve linha
    when p_ator = 'anon' then '42501'
    when p_sonda = 'membros_quadro' then (p_ver and p_k = 'esc')::text
    when p_sonda in ('quadros','colunas','cartoes','checklists','itens','comentarios','anexos','objetos','recibos','visto','botoes','papeis','historico','etiquetas','membros_cartao','atalhos','pode_ver','board_ver','acesso_ver') then p_ver::text
    when p_sonda in ('pode_editar', 'acesso_editar') then p_ed::text
    when p_sonda = 'marcar_lido' then (p_ver and p_ator <> 'dono')::text
    when p_sonda in ('rodar_botao', 'papeis_sugerir') then case when p_ed then 'ok' else '42501' end
    when p_sonda in ('w_criar_cartao','w_criar_checklist','w_comentar','w_criar_botao','w_enviar_arquivo') then case when p_ed then 'ok' else '42501' end
    when p_sonda = 'w_renomear_quadro' then case when p_ator = 'dono' then 'ok' else '0 linhas' end
    else case when p_ed then 'ok' else '0 linhas' end end $f$;
grant execute on function pg_temp.sonda_i(text, text), pg_temp.sonda(text, text), pg_temp.esp(text, boolean, boolean, text, text) to anon, authenticated;

select pg_temp.como('authenticated', pg_temp.i('01'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'dono' and s.fase = 1 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('a2'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'mv' and s.fase = 1 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'me' and s.fase = 1 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('a7'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'ev' and s.fase = 1 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('a8'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'ee' and s.fase = 1 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('a5'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'mp' and s.fase = 1 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('a4'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'mb' and s.fase = 1 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('a6'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'mna' and s.fase = 1 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('02'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'p2' and s.fase = 1 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('b1'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'x' and s.fase = 1 order by c.k, s.ord;
select pg_temp.como('anon');
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'anon' and s.fase = 1 and c.k = 'eq' order by c.k, s.ord;
select pg_temp.como('postgres');
select pg_temp.como('authenticated', pg_temp.i('01'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'dono' and s.fase = 2 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('a2'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'mv' and s.fase = 2 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'me' and s.fase = 2 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('a7'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'ev' and s.fase = 2 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('a8'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'ee' and s.fase = 2 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('a5'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'mp' and s.fase = 2 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('a4'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'mb' and s.fase = 2 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('a6'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'mna' and s.fase = 2 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('02'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'p2' and s.fase = 2 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('b1'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'x' and s.fase = 2 order by c.k, s.ord;
select pg_temp.como('anon');
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'anon' and s.fase = 2 and c.k = 'eq' order by c.k, s.ord;
select pg_temp.como('postgres');
select pg_temp.como('authenticated', pg_temp.i('01'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'dono' and s.fase = 3 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('a2'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'mv' and s.fase = 3 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'me' and s.fase = 3 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('a7'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'ev' and s.fase = 3 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('a8'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'ee' and s.fase = 3 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('a5'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'mp' and s.fase = 3 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('a4'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'mb' and s.fase = 3 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('a6'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'mna' and s.fase = 3 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('02'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'p2' and s.fase = 3 order by c.k, s.ord;
select pg_temp.como('authenticated', pg_temp.i('b1'));
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'x' and s.fase = 3 order by c.k, s.ord;
select pg_temp.como('anon');
select is(pg_temp.sonda(s.nome, c.k), pg_temp.esp(s.nome, c.ver, c.ed, c.k, c.ator), c.ator || ' / ' || c.k || ' / ' || s.nome)
  from _acl c cross join _sondas s where c.ator = 'anon' and s.fase = 3 and c.k = 'eq' order by c.k, s.ord;
select pg_temp.como('postgres');

-- Dono altera nome, descrição, cor e visibilidade por update de coluna -------------------------------------------------------------------
select pg_temp.como('authenticated', pg_temp.i('01'));
select lives_ok($$update public.task_boards set name = 'Equipe renomeada', description = 'Tudo da equipe', color = 'azul' where id = pg_temp.b('eq')$$, 'dono renomeia e põe cor e descrição');
select is(pg_temp.tenta($$update public.task_boards set name = 'a<b' where id = pg_temp.b('eq')$$), '23514', 'nome com < é recusado pelo banco');
select is(pg_temp.tenta($$update public.task_boards set name = repeat('x', 41) where id = pg_temp.b('eq')$$), '23514', 'nome com 41 caracteres é recusado');
select is(pg_temp.tenta($$update public.task_boards set name = '' where id = pg_temp.b('eq')$$), '23514', 'nome vazio é recusado');
select is(pg_temp.tenta($$update public.task_boards set name = E'a\u0007b' where id = pg_temp.b('eq')$$), '23514', 'nome com controle é recusado');
select is(pg_temp.tenta($$update public.task_boards set name = E'a‮b' where id = pg_temp.b('eq')$$), '23514', 'nome com bidi é recusado');
select is(pg_temp.tenta($$update public.task_boards set description = repeat('x', 201) where id = pg_temp.b('eq')$$), '23514', 'descrição com 201 caracteres é recusada');
select is(pg_temp.tenta($$update public.task_boards set description = '<script>' where id = pg_temp.b('eq')$$), '23514', 'descrição com < > é recusada');
select is(pg_temp.tenta($$update public.task_boards set color = 'rosa' where id = pg_temp.b('eq')$$), '23514', 'cor fora da lista é recusada');
select is(pg_temp.tenta($$update public.task_boards set description = null, color = null where id = pg_temp.b('eq')$$), 'ok', 'descrição e cor podem ser limpas');
select is(pg_temp.tenta($$update public.task_boards set visibility = 'pessoal' where id = pg_temp.b('be')$$), '23514', 'o quadro padrão não muda de visibilidade');
select is(pg_temp.tenta($$update public.task_boards set archived_at = now() where id = pg_temp.b('be')$$), '23514', 'o quadro padrão não se arquiva por update');
select is(pg_temp.tenta($$update public.task_boards set visibility = 'equipe' where id = pg_temp.b('pes')$$), '23514', 'quadro pessoal não vira de equipe por update');
select is(pg_temp.tenta($$update public.task_boards set archived_at = '2099-01-01' where id = pg_temp.b('eq')$$), 'ok', 'arquivar por update');
select pg_temp.como('postgres');
select is((select archived_at <= now() + interval '1 minute' from public.task_boards where id = pg_temp.b('eq')), true, 'a hora de arquivar é do banco (o cliente não escolhe)');
update public.task_boards set archived_at = null where id = pg_temp.b('eq');
select is((select name from public.task_boards where id = pg_temp.b('eq')), 'Equipe renomeada', 'nome gravado');

-- quadro_arquivar --------------------------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', pg_temp.i('01'));
select throws_ok($$select public.quadro_arquivar(pg_temp.b('be'), true)$$, '22023', 'O quadro padrão não pode ser arquivado.', 'quadro padrão (evento) não se arquiva');
select throws_ok($$select public.quadro_arquivar(pg_temp.b('bp'), true)$$, '22023', 'O quadro padrão não pode ser arquivado.', 'quadro padrão da produtora não se arquiva');
select throws_ok($$select public.quadro_arquivar(pg_temp.b('eq'), null)$$, '22023', null, 'arquivar sem dizer sim ou não');
select lives_ok($$select public.quadro_arquivar(pg_temp.b('eq'), true)$$, 'dono arquiva um quadro comum');
select is((select archived_at is not null from public.task_boards where id = pg_temp.b('eq')), true, 'quadro arquivado');
select pg_temp.como('authenticated', pg_temp.i('a2'));
select is((select count(*) from public.task_boards where id = pg_temp.b('eq')), 1::bigint, 'arquivado: o membro ainda lê o quadro');
select is((select count(*) from public.producer_tasks where board_id = pg_temp.b('eq')) > 0, true, 'arquivado: e os cartões');
select throws_ok($$select public.quadro_arquivar(pg_temp.b('eq'), false)$$, '42501', 'Sem permissão para este quadro.', 'membro não desarquiva (só o dono)');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select throws_ok($$select public.quadro_arquivar(pg_temp.b('eq'), true)$$, '42501', null, 'membro editor não arquiva (só o dono)');
select pg_temp.como('authenticated', pg_temp.i('02'));
select throws_ok($$select public.quadro_arquivar(pg_temp.b('eq'), true)$$, '42501', null, 'outro produtor não arquiva');
select throws_ok($$select public.quadro_arquivar(pg_temp.i('ee'), true)$$, '42501', 'Sem permissão para este quadro.', 'quadro inexistente: mesma resposta');
select pg_temp.como('anon');
select throws_ok($$select public.quadro_arquivar(pg_temp.b('eq'), true)$$, '42501', null, 'anon não arquiva');
select pg_temp.como('authenticated', pg_temp.i('01'));
select lives_ok($$select public.quadro_arquivar(pg_temp.b('eq'), false)$$, 'dono desarquiva');
select is((select archived_at is null from public.task_boards where id = pg_temp.b('eq')), true, 'desarquivado');

-- quadro_membros_definir: troca de lista e de visibilidade -----------------------------------------------------------------------------------
insert into _b select 'dm', public.quadro_criar('Definir', 'equipe', null, null, 'escolhidas', jsonb_build_array(
  jsonb_build_object('user_id', pg_temp.i('a7'), 'nivel', 'ver'), jsonb_build_object('user_id', pg_temp.i('a8'), 'nivel', 'editar'),
  jsonb_build_object('user_id', pg_temp.i('a2'), 'nivel', 'ver')));
with x as (insert into public.producer_tasks (producer_id, board_id, title) values (pg_temp.i('01'), pg_temp.b('dm'), 'cartao-dm') returning id) insert into _b select 'dmc', id from x;
select pg_temp.como('postgres');
create temp table _snap as select user_id, created_at from public.task_board_members where board_id = pg_temp.b('dm');
grant select on _snap to authenticated;
select pg_temp.como('authenticated', pg_temp.i('a8'));
select throws_ok($$select public.quadro_membros_definir(pg_temp.b('dm'), 'equipe', null)$$, '42501', 'Sem permissão para este quadro.', 'editor do quadro não troca a lista nem a visibilidade (só o dono)');
select pg_temp.como('authenticated', pg_temp.i('a2'));
select throws_ok($$select public.quadro_membros_definir(pg_temp.b('dm'), 'equipe', null)$$, '42501', null, 'membro que vê não muda a visibilidade');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select throws_ok($$select public.quadro_membros_definir(pg_temp.b('dm'), 'equipe', null)$$, '42501', null, 'membro com a ferramenta editar também não');
select pg_temp.como('authenticated', pg_temp.i('02'));
select throws_ok($$select public.quadro_membros_definir(pg_temp.b('dm'), 'equipe', null)$$, '42501', null, 'outro produtor não');
select throws_ok($$select public.quadro_membros_definir(pg_temp.i('ee'), 'equipe', null)$$, '42501', 'Sem permissão para este quadro.', 'quadro inexistente: mesma resposta');
select pg_temp.como('anon');
select throws_ok($$select public.quadro_membros_definir(pg_temp.b('dm'), 'equipe', null)$$, '42501', null, 'anon não');
select pg_temp.como('authenticated', pg_temp.i('01'));
select throws_ok($$select public.quadro_membros_definir(pg_temp.b('be'), 'escolhidas', '[]')$$, '22023', 'O quadro padrão é da equipe toda e não muda.', 'quadro padrão não muda');
select throws_ok($$select public.quadro_membros_definir(pg_temp.b('pes'), 'equipe', null)$$, '22023', 'Quadro pessoal só pode ser pessoal.', 'quadro pessoal não abre para a equipe');
select throws_ok($$select public.quadro_membros_definir(pg_temp.b('dm'), 'todos', null)$$, '22023', 'Visibilidade inválida.', 'visibilidade inválida');
select throws_ok($$select public.quadro_membros_definir(pg_temp.b('dm'), null, null)$$, '22023', 'Visibilidade inválida.', 'visibilidade nula');
select throws_ok($$select public.quadro_membros_definir(pg_temp.b('dm'), 'escolhidas', '[{"user_id":"ff000000-0000-4000-8000-0000000000a4","nivel":"ver"}]')$$,
  '22023', 'Só pessoas ativas da sua equipe podem entrar no quadro.', 'bloqueado não entra na lista');
select pg_temp.como('postgres');
select is((select count(*) from public.task_board_members where board_id = pg_temp.b('dm')), 3::bigint, 'recusa não mexe na lista');
select pg_temp.como('authenticated', pg_temp.i('01'));
select lives_ok($$select public.quadro_membros_definir(pg_temp.b('dm'), 'escolhidas', jsonb_build_array(
  jsonb_build_object('user_id', pg_temp.i('a7'), 'nivel', 'editar'), jsonb_build_object('user_id', pg_temp.i('a8'), 'nivel', 'editar'),
  jsonb_build_object('user_id', pg_temp.i('a3'), 'nivel', 'ver')))$$, 'dono troca a lista: ev passa a editar, mv sai, me entra');
select pg_temp.como('postgres');
select is((select string_agg(right(user_id::text, 2) || nivel, ',' order by user_id) from public.task_board_members where board_id = pg_temp.b('dm')),
  'a3ver,a7editar,a8editar', 'lista nova: me ver, ev editar, ee editar; mv saiu');
select is((select count(*) from public.task_board_members m join _snap s on s.user_id = m.user_id and s.created_at = m.created_at where m.board_id = pg_temp.b('dm')), 2::bigint,
  'a diferença não recria quem ficou (ee e ev mantêm a data de entrada)');
select is((select added_by from public.task_board_members where board_id = pg_temp.b('dm') and user_id = pg_temp.i('a3')), pg_temp.i('01'), 'quem entrou registra quem adicionou');
select pg_temp.como('authenticated', pg_temp.i('a2'));
select is((select count(*) from public.task_boards where id = pg_temp.b('dm')), 0::bigint, 'mv saiu da lista: perde o quadro na hora');
select is((select count(*) from public.producer_tasks where board_id = pg_temp.b('dm')), 0::bigint, 'e os cartões');
select pg_temp.como('authenticated', pg_temp.i('a7'));
select is(pg_temp.tenta(format('update public.producer_tasks set title = title where id = %L', pg_temp.b('dmc'))), 'ok', 'ev virou editor: já edita o cartão');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is((select count(*) from public.producer_tasks where board_id = pg_temp.b('dm')), 1::bigint, 'me (tem a ferramenta, mas está na lista só com ver) vê o quadro');
select is(pg_temp.tenta(format('update public.producer_tasks set title = title where id = %L', pg_temp.b('dmc'))), '0 linhas', 'e não edita');
select pg_temp.como('authenticated', pg_temp.i('01'));
select lives_ok($$select public.quadro_membros_definir(pg_temp.b('dm'), 'escolhidas', jsonb_build_array(jsonb_build_object('user_id', pg_temp.i('a7'), 'nivel', 'editar')))$$, 'dono tira ee e me');
select pg_temp.como('authenticated', pg_temp.i('a8'));
select is((select count(*) from public.producer_tasks where board_id = pg_temp.b('dm')), 0::bigint, 'ee removido: perde o cartão na hora');
select is(pg_temp.tenta(format('insert into public.task_comments (task_id, body) values (%L, ''x'')', pg_temp.b('dmc'))), '42501', 'ee removido: não comenta');
select pg_temp.como('authenticated', pg_temp.i('01'));
select lives_ok($$insert into public.task_comments (task_id, body, mentions) values (pg_temp.b('dmc'), 'olha', array[pg_temp.i('a8'), pg_temp.i('a7')])$$, 'dono comenta mencionando ee (removido) e ev');
select pg_temp.como('postgres');
select is(pg_temp.quem(pg_temp.b('dmc'), 'mencao'), 'a7', 'aviso de menção: ev recebe; ee, que perdeu o acesso, não');
select pg_temp.como('authenticated', pg_temp.i('01'));
select lives_ok($$select public.quadro_membros_definir(pg_temp.b('dm'), 'equipe', jsonb_build_array(jsonb_build_object('user_id', pg_temp.i('a7'), 'nivel', 'editar')))$$, 'dono abre o quadro para a equipe (lista ignorada)');
select pg_temp.como('postgres');
select is((select count(*) from public.task_board_members where board_id = pg_temp.b('dm')), 0::bigint, 'saiu de "escolhidas": a lista é apagada');
select pg_temp.como('authenticated', pg_temp.i('a2'));
select is((select count(*) from public.producer_tasks where board_id = pg_temp.b('dm')), 1::bigint, 'equipe: mv (ferramenta quadro) vê');
select pg_temp.como('authenticated', pg_temp.i('a7'));
select is((select count(*) from public.producer_tasks where board_id = pg_temp.b('dm')), 0::bigint, 'equipe: ev (sem a ferramenta) deixa de ver');
select pg_temp.como('authenticated', pg_temp.i('01'));
select lives_ok($$select public.quadro_membros_definir(pg_temp.b('dm'), 'pessoal', null)$$, 'dono fecha o quadro (pessoal)');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is((select count(*) from public.task_boards where id = pg_temp.b('dm')), 0::bigint, 'pessoal: nem quem edita a ferramenta vê');
select pg_temp.como('authenticated', pg_temp.i('01'));
select lives_ok($$select public.quadro_membros_definir(pg_temp.b('dm'), 'escolhidas', '[]')$$, 'de volta a "escolhidas" com lista vazia');
select pg_temp.como('postgres');
select is((select count(*) from public.task_board_members where board_id = pg_temp.b('dm')), 0::bigint, 'a lista antiga não ressuscita');
-- update direto que sai de "escolhidas" também apaga a lista
insert into public.task_board_members (board_id, user_id, nivel, added_by) values (pg_temp.b('dm'), pg_temp.i('a2'), 'ver', pg_temp.i('01'));
update public.task_boards set visibility = 'equipe' where id = pg_temp.b('dm');
select is((select count(*) from public.task_board_members where board_id = pg_temp.b('dm')), 0::bigint, 'update direto de visibilidade também apaga a lista');
select throws_ok($$insert into public.task_board_members (board_id, user_id, nivel) values (pg_temp.b('dm'), pg_temp.i('a4'), 'ver')$$, '23514', 'Só o dono ou alguém ativo da equipe pode entrar no quadro.', 'gatilho: bloqueado não entra nem por SQL');
select throws_ok($$insert into public.task_board_members (board_id, user_id, nivel) values (pg_temp.b('dm'), pg_temp.i('02'), 'ver')$$, '23514', null, 'gatilho: outro produtor não entra nem por SQL');
select throws_ok($$insert into public.task_board_members (board_id, user_id, nivel) values (pg_temp.b('dm'), pg_temp.i('a2'), 'dono')$$, '23514', null, 'nível fora da lista');

-- quadro_equipe_lista --------------------------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', pg_temp.i('01'));
select is((select jsonb_array_length(public.quadro_equipe_lista())), 5, 'dono vê as 5 pessoas ativas (mb e mna fora)');
select is((select string_agg(right(e ->> 'id', 2), ',' order by e ->> 'id') from jsonb_array_elements(public.quadro_equipe_lista()) e), 'a2,a3,a5,a7,a8', 'quem é: mv, me, mp, ev, ee');
select is((select string_agg(distinct k, ',' order by k) from jsonb_array_elements(public.quadro_equipe_lista()) e, jsonb_object_keys(e) k), 'id,nome', 'só id e nome');
select is(position('@' in public.quadro_equipe_lista()::text), 0, 'nenhum e-mail na lista');
select is((select e ->> 'nome' from jsonb_array_elements(public.quadro_equipe_lista()) e where e ->> 'id' = pg_temp.i('a7')::text), 'Escolhido ve', 'nome da pessoa');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(public.quadro_equipe_lista(), '[]'::jsonb, 'membro (mesmo editor) não vê a equipe do dono: lista vazia');
select pg_temp.como('authenticated', pg_temp.i('02'));
select is(public.quadro_equipe_lista(), '[]'::jsonb, 'outro produtor vê só a própria equipe (vazia)');
select pg_temp.como('anon');
select throws_ok($$select public.quadro_equipe_lista()$$, '42501', null, 'anon não pede a lista');
select pg_temp.como('postgres');

-- Apagar evento com vários quadros ----------------------------------------------------------------------------------------------------------
-- Padrão (2 cartões) + 2 extras de equipe (modelos) + 1 extra PESSOAL + 1 extra "escolhidas" (a7 'ver'). Só os cartões do padrão vão para o quadro
-- padrão da produtora; os extras se desligam do evento (event_id nulo, 'evento' vira 'equipe', visibilidade e membros mantidos).
insert into public.events (id, producer_id, title, slug, status, approval_status, date) values
  (pg_temp.i('e4'), pg_temp.i('01'), 'Vai embora', 'f2f-e4', 'draft', 'pending', pg_temp.hoje() + 20);
insert into _b select 'ex', public.quadro_criar_interno(pg_temp.i('01'), pg_temp.i('e4'));
insert into public.producer_tasks (producer_id, event_id, board_id, title) values (pg_temp.i('01'), pg_temp.i('e4'), pg_temp.b('ex'), 'padrao-1'), (pg_temp.i('01'), pg_temp.i('e4'), pg_temp.b('ex'), 'padrao-2');
insert into public.task_links (task_id, kind) select id, 'evento' from public.producer_tasks where title = 'padrao-1' and board_id = pg_temp.b('ex');
select pg_temp.como('authenticated', pg_temp.i('01'));
insert into _b select 'ex2', public.quadro_criar('Extra A', 'evento', pg_temp.i('e4'), 'evento_completo', 'equipe', null);
insert into _b select 'ex3', public.quadro_criar('Extra B', 'evento', pg_temp.i('e4'), 'pos_evento', 'equipe', null);
insert into _b select 'ex4', public.quadro_criar('Extra pessoal', 'evento', pg_temp.i('e4'), null, 'pessoal', null);
insert into _b select 'ex5', public.quadro_criar('Extra escolhidas', 'evento', pg_temp.i('e4'), null, 'escolhidas', '[{"user_id":"ff000000-0000-4000-8000-0000000000a7","nivel":"ver"}]');
select pg_temp.como('postgres');
insert into public.producer_tasks (producer_id, event_id, board_id, title) values
  (pg_temp.i('01'), pg_temp.i('e4'), pg_temp.b('ex4'), 'segredo-pessoal'), (pg_temp.i('01'), pg_temp.i('e4'), pg_temp.b('ex5'), 'segredo-escolhidas');
update public.producer_tasks set archived_at = now() where title = 'padrao-2';
create temp table _ex as select p.id as task, p.board_id as board from public.producer_tasks p where p.board_id in (pg_temp.b('ex'), pg_temp.b('ex2'), pg_temp.b('ex3'), pg_temp.b('ex4'), pg_temp.b('ex5'));
select is((select count(*) from _ex), 17::bigint, '2 + 9 + 4 + 1 + 1 cartões nos 5 quadros do evento');
select is((select count(*) from public.task_activity a where a.task_id in (select task from _ex)) > 0, true, 'os cartões têm histórico');
create temp table _ex_cols as select c.id, c.board_id from public.task_columns c where c.board_id in (pg_temp.b('ex'), pg_temp.b('ex2'), pg_temp.b('ex3'), pg_temp.b('ex4'), pg_temp.b('ex5'));
select is((select count(*) from _ex_cols where board_id <> pg_temp.b('ex')) > 0, true, 'os extras têm colunas');
select lives_ok($$delete from public.events where id = pg_temp.i('e4')$$, 'apagar o evento com 5 quadros');
select is((select count(*) from public.producer_tasks where id in (select task from _ex)), 17::bigint, 'nenhum cartão se perdeu');
-- quadro padrão do evento: cartões vão para o padrão da produtora e ele some
select is((select count(*) from public.producer_tasks where id in (select task from _ex where board = pg_temp.b('ex')) and board_id = pg_temp.b('bp') and event_id is null), 2::bigint,
  'os 2 cartões do padrão do evento voltaram ao quadro padrão da produtora (sem evento)');
select is((select count(*) from public.producer_tasks p join public.task_columns c on c.id = p.column_id where p.id in (select task from _ex where board = pg_temp.b('ex')) and c.board_id = pg_temp.b('bp')), 2::bigint, 'cada um numa coluna do quadro padrão');
select is((select count(*) from public.producer_tasks p join public.task_columns c on c.id = p.column_id where p.id in (select task from _ex)
           and p.status is distinct from case c.kind when 'doing' then 'in_progress' else c.kind end), 0::bigint, 'status coerente com a coluna');
select is((select count(*) from public.task_boards where id = pg_temp.b('ex')), 0::bigint, 'o quadro padrão do evento sumiu');
select is((select count(*) from public.task_columns where board_id = pg_temp.b('ex')), 0::bigint, 'e as colunas dele, em cascata');
select is((select count(*) from public.task_activity a where a.task_id in (select task from _ex where board = pg_temp.b('ex')) and a.board_id <> pg_temp.b('bp')), 0::bigint, 'o histórico dos cartões do padrão acompanhou para o quadro da produtora');
select is((select count(*) from public.task_links l where l.task_id in (select task from _ex)) > 0, true, 'atalhos dos cartões do padrão continuam');
-- quadros extras: sobrevivem, sem evento
select is((select string_agg(name || ':' || kind || ':' || visibility || ':' || (event_id is null)::text, ',' order by name) from public.task_boards where id in (pg_temp.b('ex2'), pg_temp.b('ex3'), pg_temp.b('ex4'), pg_temp.b('ex5'))),
  'Extra A:equipe:equipe:true,Extra B:equipe:equipe:true,Extra escolhidas:equipe:escolhidas:true,Extra pessoal:equipe:pessoal:true',
  'os 4 extras seguem existindo, sem evento: "evento" virou "equipe" e a visibilidade (pessoal, escolhidas) foi mantida');
select is((select count(*) from public.task_columns where board_id in (pg_temp.b('ex2'), pg_temp.b('ex3'), pg_temp.b('ex4'), pg_temp.b('ex5'))),
  (select count(*) from _ex_cols where board_id <> pg_temp.b('ex')), 'as colunas dos extras ficaram');
select is((select count(*) from public.producer_tasks where id in (select task from _ex where board <> pg_temp.b('ex')) and board_id in (pg_temp.b('ex2'), pg_temp.b('ex3'), pg_temp.b('ex4'), pg_temp.b('ex5')) and event_id is null), 15::bigint,
  'os 15 cartões dos extras ficaram nos seus quadros, sem evento');
select is((select count(*) from public.task_activity a where a.task_id in (select task from _ex where board <> pg_temp.b('ex')) and a.board_id is distinct from (select board from _ex x where x.task = a.task_id)), 0::bigint,
  'o histórico dos cartões dos extras ficou no quadro deles');
select is((select string_agg(user_id::text || nivel, ',') from public.task_board_members where board_id = pg_temp.b('ex5')), pg_temp.i('a7')::text || 'ver', 'a lista de pessoas do quadro "escolhidas" ficou');
-- quem só tem a ferramenta quadro NÃO passa a ver o que era pessoal ou de pessoas escolhidas
select pg_temp.como('authenticated', pg_temp.i('a2')); -- mv: ferramenta 'ver'
select is((select count(*) from public.producer_tasks where title in ('segredo-pessoal', 'segredo-escolhidas')), 0::bigint, 'mv (só a ferramenta) vê 0 cartões dos quadros pessoal e escolhidas do evento apagado');
select is((select count(*) from public.task_boards where id in (pg_temp.b('ex4'), pg_temp.b('ex5'))), 0::bigint, 'mv não vê os quadros');
select is((select count(*) from public.producer_tasks where board_id = pg_temp.b('bp') and title like 'segredo%'), 0::bigint, 'mv: nada de segredo no quadro padrão da produtora');
select pg_temp.como('authenticated', pg_temp.i('a3')); -- me: ferramenta 'editar'
select is((select count(*) from public.producer_tasks where title in ('segredo-pessoal', 'segredo-escolhidas')), 0::bigint, 'me (ferramenta editar) também vê 0');
select is((select count(*) from public.task_boards where id in (pg_temp.b('ex4'), pg_temp.b('ex5'))), 0::bigint, 'me não vê os quadros');
select pg_temp.como('authenticated', pg_temp.i('a7')); -- ev: escolhido 'ver' no ex5, sem a ferramenta
select is((select string_agg(title, ',') from public.producer_tasks where title like 'segredo%'), 'segredo-escolhidas', 'ev (escolhido) vê só o quadro dele');
select pg_temp.como('authenticated', pg_temp.i('01'));
select is((select count(*) from public.producer_tasks where title like 'segredo%'), 2::bigint, 'o dono vê os dois');
select pg_temp.como('postgres');
select is((select count(*) from public.task_boards where producer_id = pg_temp.i('01') and event_id is null and is_default), 1::bigint, 'um único quadro padrão da produtora');
-- o que o apagar-evento devolve: nenhum extra voltou ao padrão
select is((select count(*) from public.producer_tasks where board_id = pg_temp.b('bp') and title in ('segredo-pessoal', 'segredo-escolhidas')), 0::bigint, 'nenhum cartão sensível caiu no padrão da produtora');

-- Saída da equipe apaga a lista do quadro: removido, bloqueado ou desaceitado, e readmitido, NÃO volta a ver nada ---------------------------------------------
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  (pg_temp.i('d1'), 'd1@teste-f2f.local', now(), '{"full_name":"Removido"}'),
  (pg_temp.i('d2'), 'd2@teste-f2f.local', now(), '{"full_name":"Bloqueado depois"}'),
  (pg_temp.i('d3'), 'd3@teste-f2f.local', now(), '{"full_name":"Desaceito"}');
insert into public.team_members (id, producer_id, user_id, role, accepted_at) values
  (pg_temp.i('cd1'), pg_temp.i('01'), pg_temp.i('d1'), 'editor', now()), (pg_temp.i('cd2'), pg_temp.i('01'), pg_temp.i('d2'), 'editor', now()),
  (pg_temp.i('cd3'), pg_temp.i('01'), pg_temp.i('d3'), 'editor', now()), (pg_temp.i('cd4'), pg_temp.i('02'), pg_temp.i('d1'), 'editor', now());
select pg_temp.como('authenticated', pg_temp.i('01'));
insert into _b select 'sai', public.quadro_criar('Saidas', 'equipe', null, null, 'escolhidas', jsonb_build_array(
  jsonb_build_object('user_id', pg_temp.i('d1'), 'nivel', 'editar'), jsonb_build_object('user_id', pg_temp.i('d2'), 'nivel', 'editar'),
  jsonb_build_object('user_id', pg_temp.i('d3'), 'nivel', 'ver')));
select pg_temp.como('authenticated', pg_temp.i('02'));
insert into _b select 'sai9', public.quadro_criar('Saidas do P2', 'equipe', null, null, 'escolhidas', jsonb_build_array(jsonb_build_object('user_id', pg_temp.i('d1'), 'nivel', 'ver')));
select pg_temp.como('postgres');
insert into public.producer_tasks (producer_id, board_id, title) values (pg_temp.i('01'), pg_temp.b('sai'), 'cartao-sai');
select is((select count(*) from public.task_board_members where board_id = pg_temp.b('sai')), 3::bigint, 'antes: 3 pessoas na lista');
select is((select public.quadro_acesso_direto(pg_temp.b('sai'), pg_temp.i('d1'), 'editar')), true, 'antes: d1 edita');
-- removido
delete from public.team_members where id = pg_temp.i('cd1');
select is((select count(*) from public.task_board_members where board_id = pg_temp.b('sai') and user_id = pg_temp.i('d1')), 0::bigint, 'removido da equipe: linha da lista apagada');
select is((select count(*) from public.task_board_members where board_id = pg_temp.b('sai9') and user_id = pg_temp.i('d1')), 1::bigint, 'a linha dele no quadro de OUTRO produtor ficou');
insert into public.team_members (id, producer_id, user_id, role, accepted_at) values (pg_temp.i('cd1'), pg_temp.i('01'), pg_temp.i('d1'), 'editor', now());
select is((select public.quadro_acesso_direto(pg_temp.b('sai'), pg_temp.i('d1'), 'ver')), false, 'readmitido: NÃO volta a ver o quadro');
select pg_temp.como('authenticated', pg_temp.i('d1'));
select is((select count(*) from public.producer_tasks where title = 'cartao-sai'), 0::bigint, 'readmitido: não lê o cartão (RLS)');
select pg_temp.como('postgres');
-- bloqueado
update public.team_members set blocked_at = now() where id = pg_temp.i('cd2');
select is((select count(*) from public.task_board_members where board_id = pg_temp.b('sai') and user_id = pg_temp.i('d2')), 0::bigint, 'bloqueado: linha da lista apagada');
update public.team_members set blocked_at = null where id = pg_temp.i('cd2');
select is((select public.quadro_acesso_direto(pg_temp.b('sai'), pg_temp.i('d2'), 'ver')), false, 'desbloqueado: NÃO volta a ver o quadro');
-- desaceitado
update public.team_members set accepted_at = null where id = pg_temp.i('cd3');
select is((select count(*) from public.task_board_members where board_id = pg_temp.b('sai') and user_id = pg_temp.i('d3')), 0::bigint, 'desaceitado: linha da lista apagada');
update public.team_members set accepted_at = now() where id = pg_temp.i('cd3');
select is((select public.quadro_acesso_direto(pg_temp.b('sai'), pg_temp.i('d3'), 'ver')), false, 'aceito de novo: NÃO volta a ver o quadro');
-- quem continua ativo e muda só o papel não perde a linha
insert into public.task_board_members (board_id, user_id, nivel) values (pg_temp.b('sai'), pg_temp.i('d2'), 'ver');
update public.team_members set role = 'viewer' where id = pg_temp.i('cd2');
select is((select count(*) from public.task_board_members where board_id = pg_temp.b('sai') and user_id = pg_temp.i('d2')), 1::bigint, 'ativo que só muda de papel não perde a linha');
select is(has_function_privilege('authenticated', 'public.team_members_quadro_sai_tg()', 'execute'), false, 'a função do gatilho de saída não é executável por authenticated');

-- Primeiro cartão sem quadro padrão: a regra (RLS) enxerga o quadro que o gatilho cria na mesma instrução ----------------------------------------------------
insert into public.events (id, producer_id, title, slug, status, approval_status, date) values
  (pg_temp.i('e5'), pg_temp.i('01'), 'Sem quadro ainda', 'f2f-e5', 'draft', 'pending', pg_temp.hoje() + 10),
  (pg_temp.i('e6'), pg_temp.i('01'), 'Tambem sem quadro', 'f2f-e6', 'draft', 'pending', pg_temp.hoje() + 10),
  (pg_temp.i('e7'), pg_temp.i('01'), 'Mais um sem quadro', 'f2f-e7', 'draft', 'pending', pg_temp.hoje() + 10);
select is((select count(*) from public.task_boards where event_id in (pg_temp.i('e5'), pg_temp.i('e6'), pg_temp.i('e7'))), 0::bigint, 'os 3 eventos novos não têm quadro padrão');
select pg_temp.como('authenticated', pg_temp.i('a3')); -- me: ferramenta editar
select is(pg_temp.tenta($$insert into public.producer_tasks (producer_id, event_id, title) values (pg_temp.i('01'), pg_temp.i('e5'), 'primeiro')$$), 'ok',
  'quem edita a ferramenta cria o primeiro cartão do evento (o gatilho cria o quadro padrão)');
select is(pg_temp.tenta($$insert into public.producer_tasks (producer_id, title) values (pg_temp.i('01'), 'primeiro da produtora')$$), 'ok', 'e o cartão sem evento (quadro da produtora)');
select pg_temp.como('authenticated', pg_temp.i('a2')); -- mv: só ver
select is(pg_temp.tenta($$insert into public.producer_tasks (producer_id, event_id, title) values (pg_temp.i('01'), pg_temp.i('e6'), 'nao')$$), '42501', 'quem só VÊ a ferramenta não cria o primeiro cartão');
select pg_temp.como('authenticated', pg_temp.i('a5')); -- mp: sem a ferramenta
select is(pg_temp.tenta($$insert into public.producer_tasks (producer_id, event_id, title) values (pg_temp.i('01'), pg_temp.i('e6'), 'nao')$$), '42501', 'quem NÃO tem a ferramenta não cria o primeiro cartão');
select pg_temp.como('authenticated', pg_temp.i('a7')); -- ev: escolhido num quadro, sem a ferramenta
select is(pg_temp.tenta($$insert into public.producer_tasks (producer_id, event_id, title) values (pg_temp.i('01'), pg_temp.i('e7'), 'nao')$$), '42501', 'escolhido de um quadro, sem a ferramenta: não cria o primeiro cartão do evento');
select pg_temp.como('authenticated', pg_temp.i('b1')); -- conta solta
select is(pg_temp.tenta($$insert into public.producer_tasks (producer_id, event_id, title) values (pg_temp.i('01'), pg_temp.i('e7'), 'nao')$$), '42501', 'conta solta também não');
select pg_temp.como('postgres');
select is((select count(*) from public.task_boards where event_id in (pg_temp.i('e6'), pg_temp.i('e7'))), 0::bigint, 'as recusas não deixaram quadro padrão para trás (tudo desfeito)');
select is((select count(*) from public.task_boards where event_id = pg_temp.i('e5') and is_default), 1::bigint, 'o cartão aceito criou o quadro padrão do evento');
-- não abre brecha para quadro restrito: quem tem a ferramenta não grava em quadro pessoal, escolhidas, nem de outro produtor, nem inexistente
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(pg_temp.tenta('insert into public.producer_tasks (producer_id, board_id, title) values (pg_temp.i(''01''), pg_temp.b(''pes''), ''x'')'), '42501', 'quadro pessoal: recusado');
select is(pg_temp.tenta('insert into public.producer_tasks (producer_id, board_id, title) values (pg_temp.i(''01''), pg_temp.b(''esc''), ''x'')'), '42501', 'quadro escolhidas (me não está na lista): recusado');
select is(pg_temp.tenta('insert into public.producer_tasks (producer_id, board_id, title) values (pg_temp.i(''01''), pg_temp.b(''b9''), ''x'')'), '42501', 'quadro de outro produtor: recusado');
select throws_ok($$insert into public.producer_tasks (producer_id, board_id, title) values (pg_temp.i('01'), pg_temp.b('pes'), 'x')$$, '42501', 'new row violates row-level security policy for table "producer_tasks"',
  'quadro existente sem permissão: mensagem da regra');
select throws_ok($$insert into public.producer_tasks (producer_id, board_id, title) values (pg_temp.i('01'), pg_temp.b('b9'), 'x')$$, '42501', 'new row violates row-level security policy for table "producer_tasks"',
  'quadro de outro produtor: a MESMA mensagem');
select throws_ok($$insert into public.producer_tasks (producer_id, board_id, title) values (pg_temp.i('01'), gen_random_uuid(), 'x')$$, '42501', 'new row violates row-level security policy for table "producer_tasks"',
  'quadro inexistente: a MESMA mensagem (não revela que quadro existe)');
-- coluna aleatória: a mensagem não depende de o quadro existir (nem de ser alheio ou pessoal)
select pg_temp.como('authenticated', pg_temp.i('02')); -- P2 grava como se fosse do produtor P1
create temp table _msg (k text, m text);
grant all on _msg to authenticated;
do $m$ declare r record; begin
  for r in select * from (values ('pessoal de P1', pg_temp.b('pes')), ('equipe de P1', pg_temp.b('eq')), ('padrão de P1', pg_temp.b('bp')), ('inexistente', gen_random_uuid())) v(k, b) loop
    begin
      insert into public.producer_tasks (producer_id, board_id, column_id, title) values (pg_temp.i('01'), r.b, gen_random_uuid(), 'x');
      insert into _msg values (r.k, 'passou');
    exception when others then insert into _msg values (r.k, sqlstate || ':' || sqlerrm);
    end;
  end loop;
end $m$;
select pg_temp.como('postgres');
select is((select count(distinct m) from _msg), 1::bigint, 'coluna aleatória: mensagem idêntica em quadro pessoal, de equipe, padrão e inexistente');
select is((select min(m) from _msg), '42501:new row violates row-level security policy for table "producer_tasks"', 'e é a mensagem da regra (RLS)');
select is((select count(*) from _msg), 4::bigint, 'os 4 casos foram exercitados');

-- Porta: 2FA, token sem identidade, texto invisível --------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', null);
select is((select public.quadro_acesso(pg_temp.b('eq'), pg_temp.i('01'), 'ver')), false, 'token logado sem identidade (sem sub): a porta responde falso, mesmo perguntando pelo dono');
select pg_temp.como('postgres');
select is((select public.quadro_texto_ok(x, 1, 40)), false, 'nome só de caracteres invisíveis recusado: ' || n) from (values
  (E'\u2060', 'U+2060'), (E'\u3164', 'U+3164'), (E'\u00AD', 'U+00AD'), (E'\u2028', 'U+2028'), (E'\u2029', 'U+2029'),
  (E'\u115F', 'U+115F'), (E'\u1160', 'U+1160'), (E'\u180E', 'U+180E'), (E'\u200B', 'U+200B'), (E'\u200D', 'U+200D'), (E'\u200E', 'U+200E'), (E'\u200F', 'U+200F'), (E'\u061C', 'U+061C'), (E'\uFEFF', 'U+FEFF'),
  (E'a\u200Bb', 'no meio'), ('   ', 'só espaços'), (E' \u200B ', 'espaço e invisível')) v(x, n);
select is(public.quadro_texto_ok('Reunião', 1, 40), true, 'texto normal continua valendo');
select is(public.quadro_texto_ok('  ab ', 3, 40), false, 'mínimo vale depois de tirar os espaços das pontas (char_length(btrim) >= mínimo)');
select is(public.quadro_limpar_texto(E'Fe\u200Bsta\uFEFF', 40), 'Festa', 'quadro_limpar_texto tira os invisíveis');
insert into public.events (id, producer_id, title, slug, status, approval_status, date) values
  (pg_temp.i('ef'), pg_temp.i('01'), E'Show\u200B\u200F\uFEFF\u061C', 'f2f-ef', 'draft', 'pending', pg_temp.hoje() + 10);
select lives_ok($$select public.quadro_criar_interno(pg_temp.i('01'), pg_temp.i('ef'))$$, 'evento com invisíveis no título: o quadro padrão ainda nasce (o nome é limpo)');
select is((select name from public.task_boards where event_id = pg_temp.i('ef') and is_default), 'Quadro do evento Show', 'nome do quadro padrão sem os invisíveis');
select pg_temp.como('authenticated', pg_temp.i('01'));
select throws_ok($$select public.quadro_criar(E'\u200B\u200B', 'equipe', null, null, 'equipe', null)$$, '22023', null, 'quadro_criar recusa nome só de invisíveis');
select pg_temp.como('postgres');

-- Pessoas em cartões e menções: quem edita só um quadro "escolhidas" (sem a ferramenta) consegue atribuir e mencionar ----------------------------------
select pg_temp.como('authenticated', pg_temp.i('a8'));
select is(pg_temp.tenta(format('insert into public.producer_tasks (producer_id, board_id, title, assigned_to) values (%L, %L, ''resp'', %L)', pg_temp.i('01'), pg_temp.b('esc'), pg_temp.i('a7'))), 'ok',
  'ee (editor sem a ferramenta) atribui o cartão a alguém da equipe');
select throws_ok(format('insert into public.producer_tasks (producer_id, board_id, title, assigned_to) values (%L, %L, ''resp'', %L)', pg_temp.i('01'), pg_temp.b('esc'), pg_temp.i('b1')),
  '42501', 'O responsável não é da equipe deste produtor.', 'e não atribui a quem não é da equipe');
select is(pg_temp.tenta(format('insert into public.task_card_members (task_id, user_id) values (%L, %L)', (select card from _rec where k = 'esc'), pg_temp.i('b1'))), '23514', 'nem põe no cartão quem não é da equipe');
select is(pg_temp.tenta(format('insert into public.task_comments (task_id, body, mentions) values (%L, ''oi'', array[%L::uuid])', (select card from _rec where k = 'esc'), pg_temp.i('b1'))), '23514', 'nem menciona');
select is(pg_temp.tenta(format('insert into public.task_comments (task_id, body, mentions) values (%L, ''oi'', array[%L::uuid])', (select card from _rec where k = 'esc'), pg_temp.i('a5'))), 'ok', 'mas menciona alguém da equipe (mp)');
select pg_temp.como('authenticated', pg_temp.i('a7'));
select throws_ok(format('insert into public.producer_tasks (producer_id, board_id, title, assigned_to) values (%L, %L, ''resp'', %L)', pg_temp.i('01'), pg_temp.b('esc'), pg_temp.i('b1')),
  '42501', 'new row violates row-level security policy for table "producer_tasks"', 'ev (só vê) tentando atribuir a estranho: a regra recusa, sem a mensagem que revelaria quem é da equipe');
select is(pg_temp.tenta(format('insert into public.task_comments (task_id, body, mentions) values (%L, ''oi'', array[%L::uuid])', (select card from _rec where k = 'esc'), pg_temp.i('b1'))), '42501',
  'ev (só vê) mencionando estranho: 42501');
select is(pg_temp.tenta(format('insert into public.task_card_members (task_id, user_id) values (%L, %L)', (select card from _rec where k = 'esc'), pg_temp.i('b1'))), '42501', 'ev (só vê) pondo estranho no cartão: 42501');
select pg_temp.como('authenticated', pg_temp.i('a2'));
select is(pg_temp.tenta(format('insert into public.task_card_members (task_id, user_id) values (%L, %L)', (select card from _rec where k = 'esc'), pg_temp.i('a5'))), '42501', 'mv sem acesso ao quadro escolhidas: 42501');
select pg_temp.como('authenticated', pg_temp.i('a3'));
select is(pg_temp.tenta(format('insert into public.producer_tasks (producer_id, event_id, title) values (%L, %L, ''antigo'')', pg_temp.i('01'), pg_temp.i('e1'))), 'ok',
  'modo antigo (sem quadro): me grava só com o evento');
select pg_temp.como('postgres');
select is((select board_id from public.producer_tasks where title = 'antigo' and producer_id = pg_temp.i('01')), pg_temp.b('be'),
  'o cartão sem quadro vai para o quadro PADRÃO do evento, mesmo havendo outros quadros no evento');
-- anexos: o produtor do caminho só aparece para quem pode ver o cartão
select pg_temp.como('authenticated', pg_temp.i('a7'));
select is(public.task_anexo_produtor((select path from _rec where k = 'eq')), null, 'task_anexo_produtor: ev não vê o produtor de um cartão de equipe');
select is(public.task_anexo_produtor((select path from _rec where k = 'esc')), pg_temp.i('01'), 'task_anexo_produtor: ev vê o do cartão do quadro escolhidas');
select is(public.task_anexo_pode((select path from _rec where k = 'esc'), 'ver'), true, 'task_anexo_pode: ver no quadro escolhidas');
select is(public.task_anexo_pode((select path from _rec where k = 'esc'), 'editar'), false, 'task_anexo_pode: editar no quadro escolhidas, ev não');
select is(public.task_anexo_pode('lixo', 'ver'), false, 'task_anexo_pode: caminho fora do formato');
select pg_temp.como('postgres');

-- Tetos de um produtor com equipe grande (p2) ---------------------------------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  select ('ee000000-0000-4000-8000-' || lpad(to_hex(g), 12, '0'))::uuid, 'm' || g || '@teste-f2f.local', now(), jsonb_build_object('full_name', 'Membro ' || g) from generate_series(1, 52) g;
insert into public.team_members (producer_id, user_id, role, accepted_at)
  select pg_temp.i('02'), ('ee000000-0000-4000-8000-' || lpad(to_hex(g), 12, '0'))::uuid, 'editor', now() from generate_series(1, 52) g;
create function pg_temp.lista(p_n int) returns jsonb language sql stable as $f$
  select jsonb_agg(jsonb_build_object('user_id', user_id, 'nivel', 'ver')) from (select user_id from public.team_members where producer_id = pg_temp.i('02') order by user_id limit p_n) x $f$;
create function pg_temp.encher_quadros() returns int language plpgsql as $f$
declare n int; i int := 0;
begin
  loop
    select count(*) into n from public.task_boards where producer_id = pg_temp.i('02') and not is_default;
    exit when n >= 30;
    i := i + 1;
    perform public.quadro_criar('Teto ' || i, 'equipe', null, null, 'equipe', null);
  end loop;
  return n;
end $f$;
create function pg_temp.encher_modelos() returns int language plpgsql as $f$
declare n int; i int := 0;
begin
  loop
    select count(*) into n from public.task_board_templates where owner_id = pg_temp.i('02');
    exit when n >= 20;
    i := i + 1;
    perform public.quadro_salvar_como_modelo(pg_temp.b('b9'), 'Modelo ' || i);
  end loop;
  return n;
end $f$;
grant execute on function pg_temp.lista(int), pg_temp.encher_quadros(), pg_temp.encher_modelos() to anon, authenticated;
select pg_temp.como('authenticated', pg_temp.i('02'));
insert into _b select 'c50', public.quadro_criar('Cinquenta', 'equipe', null, null, 'escolhidas', pg_temp.lista(50));
select throws_ok($$select public.quadro_membros_definir(pg_temp.b('c50'), 'escolhidas', pg_temp.lista(51))$$, '22023', 'Limite de 50 pessoas por quadro.', 'definir com 51 pessoas é recusado');
select pg_temp.como('postgres');
select is((select count(*) from public.task_board_members where board_id = pg_temp.b('c50')), 50::bigint, 'o quadro com 50 pessoas ficou com 50');
select throws_ok($$insert into public.task_board_members (board_id, user_id, nivel) select pg_temp.b('c50'), user_id, 'ver' from public.team_members where producer_id = pg_temp.i('02')
  and user_id not in (select user_id from public.task_board_members where board_id = pg_temp.b('c50')) limit 1$$, '23514', 'Limite de 50 pessoas por quadro.', 'gatilho: a 51ª pessoa é recusada mesmo por SQL');
select pg_temp.como('authenticated', pg_temp.i('02'));
select is(pg_temp.encher_quadros(), 30, 'p2 cria quadros até o teto de 30');
select throws_ok($$select public.quadro_criar('Trinta e um', 'equipe', null, null, 'equipe', null)$$, '23514', 'Limite de 30 quadros por produtor (os arquivados contam).', 'o 31º quadro é recusado');
select lives_ok($$select public.quadro_arquivar((select id from public.task_boards where name = 'Teto 1'), true)$$, 'arquiva um quadro');
select throws_ok($$select public.quadro_criar('Trinta e um', 'equipe', null, null, 'equipe', null)$$, '23514', null, 'arquivado continua contando: ainda recusa');
select pg_temp.como('postgres');
select is((select count(*) from public.task_boards where producer_id = pg_temp.i('01') and not is_default) > 15, true, 'p1 tem muitos quadros, abaixo do teto dele (o teto é por produtor)');
select lives_ok($$select public.quadro_criar_interno(pg_temp.i('02'), null)$$, 'o quadro padrão (do sistema) não conta no teto e continua sendo criado');
insert into public.events (id, producer_id, title, slug, status, approval_status, date) values (pg_temp.i('e8'), pg_temp.i('02'), 'Mais um do P2', 'f2f-e8', 'draft', 'pending', pg_temp.hoje() + 9);
select lives_ok($$select public.quadro_criar_interno(pg_temp.i('02'), pg_temp.i('e8'))$$, 'nem o padrão de um evento novo');
select pg_temp.como('authenticated', pg_temp.i('02'));
select is(pg_temp.encher_modelos(), 20, 'p2 salva modelos até o teto de 20 (já tinha 1 inserido)');
select throws_ok($$select public.quadro_salvar_como_modelo(pg_temp.b('b9'), 'Vinte e um')$$, '23514', 'Limite de 20 modelos de quadro por produtor.', 'o 21º modelo é recusado');
select pg_temp.como('authenticated', pg_temp.i('01'));
select lives_ok($$select public.quadro_salvar_como_modelo(pg_temp.b('dm'), 'p1 segue livre')$$, 'o teto de p2 não atrapalha p1');
select pg_temp.como('postgres');

-- 2FA: com fator verificado, só aal2 passa -----------------------------------------------------------------------------------------------------------------
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
  values (pg_temp.i('aa'), pg_temp.i('01'), 'totp', 'totp', 'verified', now(), now());
select pg_temp.como('authenticated', pg_temp.i('01'), 'aal1');
select throws_ok($$select public.quadro_criar('Sem 2FA', 'equipe', null, null, 'equipe', null)$$, '42501', null, 'com 2FA ativo e sessão aal1, criar quadro é recusado');
select throws_ok($$select public.quadro_salvar_como_modelo(pg_temp.b('dm'), 'Sem 2FA')$$, '42501', null, 'com 2FA ativo e sessão aal1, salvar modelo é recusado');
select throws_ok($$select public.quadro_membros_definir(pg_temp.b('dm'), 'equipe', null)$$, '42501', null, 'com 2FA ativo e sessão aal1, definir membros é recusado');
select throws_ok($$select public.quadro_arquivar(pg_temp.b('dm'), true)$$, '42501', null, 'com 2FA ativo e sessão aal1, arquivar é recusado');
select throws_ok($$select public.quadro_equipe_lista()$$, '42501', null, 'com 2FA ativo e sessão aal1, a lista da equipe é recusada');
select is((select count(*) from public.task_board_members), 0::bigint, 'com 2FA ativo e sessão aal1, a RLS não devolve linha de task_board_members');
select is((select count(*) from public.task_board_templates), 0::bigint, 'com 2FA ativo e sessão aal1, a RLS não devolve linha de task_board_templates');
select is((select count(*) from public.task_boards), 0::bigint, 'com 2FA ativo e sessão aal1, a RLS não devolve linha de task_boards');
select is((select public.quadro_acesso(pg_temp.b('eq'), pg_temp.i('01'), 'ver')), false, 'com 2FA ativo e sessão aal1, a porta (quadro_acesso) responde falso até para o dono');
select pg_temp.como('authenticated', pg_temp.i('01'), 'aal2');
select is((select public.quadro_acesso(pg_temp.b('eq'), pg_temp.i('01'), 'ver')), true, 'com sessão aal2 a porta responde verdadeiro');
select lives_ok($$select public.quadro_equipe_lista()$$, 'com sessão aal2 passa');
select lives_ok($$select public.quadro_criar('Com 2FA', 'equipe', null, null, 'equipe', null)$$, 'criar quadro com aal2 passa');
select pg_temp.como('postgres');
delete from auth.mfa_factors where id = pg_temp.i('aa');

-- Desfazer (ensaio do cabeçalho do SQL, na ordem: gatilhos, regras, tabelas, dados e colunas, e só no fim as funções) -------------------------------------
-- As funções antigas abaixo são os blocos "create or replace function" dos arquivos 20261103, 20261105, 20261106 e 20261107, sem mudança.
select pg_temp.como('postgres');
create temp table _dono as select (select tableowner = current_user or (select rolsuper from pg_roles where rolname = current_user)
  from pg_tables where schemaname = 'public' and tablename = 'task_board_members') as ok;
grant select on _dono to anon, authenticated;
create temp table _antes as select (select count(*) from public.producer_tasks) as tarefas, (select count(*) from public.task_boards where is_default) as padroes;
do $d$ begin
  if (select ok from _dono) then
drop trigger if exists team_members_quadro_sai on public.team_members;
drop trigger if exists team_members_quadro_sai_upd on public.team_members;
drop trigger if exists task_board_members_quadro on public.task_board_members;
drop trigger if exists task_board_templates_limite on public.task_board_templates;
drop trigger if exists task_boards_limite on public.task_boards;
drop trigger if exists task_boards_guarda on public.task_boards;
drop trigger if exists task_boards_visib on public.task_boards;
drop policy if exists tasks_ver on public.producer_tasks;
drop policy if exists tasks_criar on public.producer_tasks;
drop policy if exists tasks_editar on public.producer_tasks;
create policy tasks_ver on public.producer_tasks as permissive for select to authenticated
  using (public.equipe_pode(producer_id, 'quadro', 'ver'));
create policy tasks_criar on public.producer_tasks as permissive for insert to authenticated
  with check (public.equipe_pode(producer_id, 'quadro', 'editar'));
create policy tasks_editar on public.producer_tasks as permissive for update to authenticated
  using (public.equipe_pode(producer_id, 'quadro', 'editar')) with check (public.equipe_pode(producer_id, 'quadro', 'editar'));
drop policy if exists task_boards_ver on public.task_boards;
create policy task_boards_ver on public.task_boards as permissive for select to authenticated
  using (public.equipe_pode(producer_id, 'quadro', 'ver'));
drop policy if exists task_columns_ver on public.task_columns;
drop policy if exists task_columns_criar on public.task_columns;
drop policy if exists task_columns_editar on public.task_columns;
create policy task_columns_ver on public.task_columns as permissive for select to authenticated
  using (exists (select 1 from public.task_boards b where b.id = board_id and public.equipe_pode(b.producer_id, 'quadro', 'ver')));
create policy task_columns_criar on public.task_columns as permissive for insert to authenticated
  with check (exists (select 1 from public.task_boards b where b.id = board_id and public.equipe_pode(b.producer_id, 'quadro', 'editar')));
create policy task_columns_editar on public.task_columns as permissive for update to authenticated
  using (exists (select 1 from public.task_boards b where b.id = board_id and public.equipe_pode(b.producer_id, 'quadro', 'editar')))
  with check (exists (select 1 from public.task_boards b where b.id = board_id and public.equipe_pode(b.producer_id, 'quadro', 'editar')));
drop policy if exists task_anexos_select on storage.objects;
create policy task_anexos_select on storage.objects as permissive for select to authenticated
  using (bucket_id = 'task-attachments' and public.equipe_pode(public.task_anexo_produtor(name), 'quadro', 'ver'));
drop policy if exists task_anexos_insert on storage.objects;
create policy task_anexos_insert on storage.objects as permissive for insert to authenticated
  with check (bucket_id = 'task-attachments' and public.equipe_pode(public.task_anexo_produtor(name), 'quadro', 'editar'));
drop policy if exists task_anexos_delete on storage.objects;
create policy task_anexos_delete on storage.objects as permissive for delete to authenticated
  using (bucket_id = 'task-attachments' and public.equipe_pode(public.task_anexo_produtor(name), 'quadro', 'editar'));
drop table if exists public.task_board_members, public.task_board_templates;
perform public.quadro_criar_interno(x.producer_id, x.event_id) from (select distinct producer_id, event_id from public.task_boards where not is_default) x;
update public.producer_tasks t set board_id = d.id, column_id = null
  from public.task_boards b join public.task_boards d on d.producer_id = b.producer_id and d.event_id is not distinct from b.event_id and d.is_default
  where t.board_id = b.id and not b.is_default;
delete from public.task_boards where not is_default;
alter table public.task_boards drop constraint if exists task_boards_nome_ck, drop constraint if exists task_boards_descricao_ck,
  drop constraint if exists task_boards_kind_evento_ck, drop constraint if exists task_boards_pessoal_ck, drop constraint if exists task_boards_template_ck;
drop index if exists public.task_boards_unico;
drop index if exists public.task_boards_produtor_idx;
create unique index task_boards_unico on public.task_boards (producer_id, (coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid)));
alter table public.task_boards drop column if exists kind, drop column if exists visibility, drop column if exists description, drop column if exists color,
  drop column if exists archived_at, drop column if exists template_key, drop column if exists position, drop column if exists created_by,
  drop column if exists is_default;
create or replace function public.quadro_criar_interno(p_produtor uuid, p_evento uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_evento is not null and not exists (select 1 from public.events e where e.id = p_evento and e.producer_id = p_produtor) then
    raise exception 'Esse evento não é deste produtor.' using errcode = '42501';
  end if;
  insert into public.task_boards (producer_id, event_id) values (p_produtor, p_evento)
    on conflict (producer_id, (coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid))) do nothing
    returning id into v_id;
  if v_id is null then
    select b.id into v_id from public.task_boards b
      where b.producer_id = p_produtor and b.event_id is not distinct from p_evento;
  else
    insert into public.task_columns (board_id, name, kind, position) values
      (v_id, 'A fazer', 'todo', 1000), (v_id, 'Em andamento', 'doing', 2000),
      (v_id, 'Em revisão', 'doing', 3000), (v_id, 'Feito', 'done', 4000);
  end if;
  return v_id;
end $$;

create or replace function public.producer_tasks_quadro_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_board public.task_boards;
  v_col public.task_columns;
  v_kind text;
begin
  if new.board_id is null then
    new.board_id := public.quadro_criar_interno(new.producer_id, new.event_id);
    new.column_id := null;
  end if;
  select * into v_board from public.task_boards b where b.id = new.board_id;
  if not found or v_board.producer_id <> new.producer_id then
    raise exception 'Quadro de outro produtor.' using errcode = '42501';
  end if;
  new.event_id := v_board.event_id;

  -- Responsável tem de ser o dono ou membro ativo, mas só quando é escolhido agora: uma tarefa antiga cujo responsável
  -- saiu da equipe continua editável (status, título...) sem trocar o responsável.
  if new.assigned_to is not null and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to)
     and not public.equipe_pode(new.producer_id, null, null, new.assigned_to) then
    raise exception 'O responsável não é da equipe deste produtor.' using errcode = '42501';
  end if;

  if new.column_id is not null then
    select * into v_col from public.task_columns c where c.id = new.column_id;
    if not found or v_col.board_id <> new.board_id then
      raise exception 'Coluna de outro quadro.' using errcode = '42501';
    end if;
  end if;

  if new.column_id is null
     or (tg_op = 'UPDATE' and new.column_id is not distinct from old.column_id and new.status is distinct from old.status) then
    -- sem coluna (INSERT sem coluna, ou tarefa que mudou de quadro) ou só o status mudou (tela antiga):
    -- primeira coluna do tipo do status
    v_kind := case new.status when 'in_progress' then 'doing' when 'done' then 'done' else 'todo' end;
    select c.id into new.column_id from public.task_columns c
      where c.board_id = new.board_id and c.kind = v_kind order by c.position limit 1;
    if new.column_id is null then raise exception 'O quadro não tem coluna do tipo %.', v_kind; end if;
  elsif tg_op = 'INSERT' or new.column_id is distinct from old.column_id then
    new.status := case v_col.kind when 'doing' then 'in_progress' else v_col.kind end;
  end if;

  if new.position is null or (tg_op = 'UPDATE' and new.column_id is distinct from old.column_id
                              and new.position is not distinct from old.position) then
    select coalesce(max(t.position), 0) + 1000 into new.position from public.producer_tasks t where t.column_id = new.column_id;
  end if;

  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_by := (select auth.uid()); end if;
  return new;
end $$;

create or replace function public.events_quadro_antes_apagar_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.producer_tasks set event_id = null, board_id = null, column_id = null where event_id = old.id;
  return old;
end $$;

create or replace function public.board_pode(p_board uuid, p_nivel text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.task_boards b where b.id = p_board and public.equipe_pode(b.producer_id, 'quadro', p_nivel))
$$;

create or replace function public.task_pode(p_task uuid, p_nivel text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.producer_tasks t where t.id = p_task and public.equipe_pode(t.producer_id, 'quadro', p_nivel))
$$;

create or replace function public.checklist_pode(p_checklist uuid, p_nivel text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin -- plpgsql: a tabela task_checklists só é criada abaixo
  return exists (select 1 from public.task_checklists c join public.producer_tasks t on t.id = c.task_id
                 where c.id = p_checklist and public.equipe_pode(t.producer_id, 'quadro', p_nivel));
end $$;

create or replace function public.comment_pode(p_comment uuid, p_nivel text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin -- plpgsql: a tabela task_comments só é criada abaixo
  return exists (select 1 from public.task_comments c join public.producer_tasks t on t.id = c.task_id
                 where c.id = p_comment and public.equipe_pode(t.producer_id, 'quadro', p_nivel));
end $$;

create or replace function public.task_card_members_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.task_pode(new.task_id, 'editar') then return new; end if; -- RLS recusa
  if not public.equipe_pode((select t.producer_id from public.producer_tasks t where t.id = new.task_id), null, null, new.user_id) then
    raise exception 'Esse usuário não é da equipe deste produtor.' using errcode = '23514';
  end if;
  return new;
end $$;

create or replace function public.task_comments_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_t public.producer_tasks; v_m uuid;
begin
  select * into v_t from public.producer_tasks t where t.id = new.task_id;
  -- só revalida menções quando elas mudaram (o autor pode editar o texto de comentário antigo)
  if tg_op = 'INSERT' or new.mentions is distinct from old.mentions then
    if cardinality(new.mentions) > 20 then
      raise exception 'Máximo de 20 menções por comentário.' using errcode = '23514';
    end if;
    new.mentions := array(select distinct m from unnest(new.mentions) m);
    foreach v_m in array new.mentions loop
      if not public.equipe_pode(v_t.producer_id, null, null, v_m) then
        raise exception 'Menção a quem não é da equipe deste produtor.' using errcode = '23514';
      end if;
    end loop;
  end if;
  if tg_op = 'INSERT' then
    perform public.task_log(v_t.board_id, new.task_id, 'comentario', jsonb_build_object('comment_id', new.id));
  end if;
  return new;
end $$;

create or replace function public.task_anexo_produtor(p_name text)
returns uuid language sql stable security definer set search_path = '' as $$
  select t.producer_id from public.producer_tasks t
  where p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{36}-[A-Za-z0-9_-][A-Za-z0-9_.-]{0,82}\.(png|jpe?g|webp|pdf)$'
    and p_name not like '%..%'
    and t.id::text = split_part(p_name, '/', 2) and t.producer_id::text = split_part(p_name, '/', 1)
    -- só revela o produtor a quem tem acesso (sem login = rotina do banco: valida só o formato)
    and ((select auth.uid()) is null or public.equipe_pode(t.producer_id, 'quadro', 'ver'))
$$;

create or replace function public.quadro_notificar(p_user uuid, p_task uuid, p_tipo text, p_texto text, p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_t public.producer_tasks;
  v_pref public.task_notification_prefs;
  v_texto text;
  i int;
begin
  if p_tipo is null or p_tipo <> all (array['atribuicao', 'mencao', 'mensagem', 'prazo', 'movido', 'automacao']) then
    raise exception 'Tipo de aviso do quadro inválido.' using errcode = '22023';
  end if;
  if p_user is null or p_task is null or p_user is not distinct from p_actor then return; end if; -- ninguém, ou o próprio autor
  select * into v_t from public.producer_tasks t where t.id = p_task;
  if not found then return; end if;
  -- só quem TEM a ferramenta quadro (dono, ou membro aceito, não bloqueado, com 'ver' ou 'editar'). Consulta direta e não
  -- equipe_pode(..., p_user): a guarda dela só responde por OUTRA pessoa a quem edita, e no cron auth.uid() é nulo.
  if v_t.producer_id <> p_user and not exists (
       select 1 from public.team_members m join public.team_member_tools f on f.member_id = m.id
       where m.producer_id = v_t.producer_id and m.user_id = p_user and m.accepted_at is not null and m.blocked_at is null
         and f.ferramenta = 'quadro') then
    return;
  end if;
  -- preferências: sem linha = tudo ligado
  select * into v_pref from public.task_notification_prefs f where f.user_id = p_user;
  if found and (not v_pref.general or coalesce((v_pref.types -> p_tipo ->> 'app')::boolean, true) = false) then return; end if;
  -- anti-spam (passou, ignora em silêncio). ponytail: contagens sem trava, gravações simultâneas podem passar dos tetos por poucas unidades.
  -- (a) mesma combinação tipo + cartão + destinatário só de novo depois de 10 minutos (atribui e desatribui em laço não reenche).
  --     'prazo' fica de fora: já tem a sua própria chave em task_prazo_avisos.
  if p_tipo <> 'prazo' and exists (select 1 from public.notifications n
      where n.user_id = p_user and n.metadata ->> 'kind' = 'quadro' and n.metadata ->> 'tipo' = p_tipo
        and n.metadata ->> 'task_id' = p_task::text and n.created_at > now() - interval '10 minutes') then
    return;
  end if;
  -- (b) 200 avisos do quadro por destinatário por hora
  if (select count(*) from public.notifications n
      where n.user_id = p_user and n.metadata ->> 'kind' = 'quadro' and n.created_at > now() - interval '1 hour') >= 200 then
    return;
  end if;
  -- (c) 100 EVENTOS por hora por quem DISPARA, contados por (tipo, cartão) distintos: um comentário que avisa 100 pessoas conta 1.
  --     Um membro não esgota a cota alheia nem a própria. Sem autor (cron, serviço) fica de fora.
  if p_actor is not null and (select count(distinct (n.metadata ->> 'tipo', n.metadata ->> 'task_id')) from public.notifications n
      where n.metadata ->> 'kind' = 'quadro' and n.metadata ->> 'actor' = p_actor::text and n.created_at > now() - interval '1 hour') >= 100
     -- o par (tipo, cartão) que já conta na hora não é bloqueado: os outros destinatários do MESMO comentário ainda recebem
     and not exists (select 1 from public.notifications n2
      where n2.metadata ->> 'kind' = 'quadro' and n2.metadata ->> 'actor' = p_actor::text and n2.metadata ->> 'tipo' = p_tipo
        and n2.metadata ->> 'task_id' = p_task::text and n2.created_at > now() - interval '1 hour') then
    return;
  end if;
  -- texto puro: tira HTML, links em markdown (fica o rótulo), esquemas javascript: e data:, espaços repetidos, e corta em 200
  v_texto := regexp_replace(coalesce(p_texto, ''), '<[^>]*>', '', 'g');
  v_texto := regexp_replace(v_texto, '\[([^\]]*)\]\([^)]*\)', '\1', 'g');
  for i in 1..3 loop -- 3 passadas: "javajavascript:script:" não reconstrói o esquema
    v_texto := regexp_replace(v_texto, '(javascript|data)\s*:', '', 'gi');
  end loop;
  v_texto := left(btrim(regexp_replace(regexp_replace(v_texto, '[<>]', '', 'g'), '\s+', ' ', 'g')), 200);
  insert into public.notifications (user_id, title, body, type, metadata)
  values (p_user,
          case p_tipo when 'atribuicao' then 'Nova atribuição' when 'mencao' then 'Você foi mencionado'
                      when 'mensagem' then 'Nova mensagem' when 'prazo' then 'Prazo chegando'
                      when 'movido' then 'Cartão movido' else 'Automação' end,
          v_texto,
          case when p_tipo = 'prazo' then 'reminder' else 'info' end,
          jsonb_build_object('kind', 'quadro', 'tipo', p_tipo, 'task_id', p_task, 'board_id', v_t.board_id, 'actor', p_actor,
                             'url', '/producer/tasks?cartao=' || p_task));
end $$;

create or replace function public.task_roles_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.board_pode(new.board_id, 'editar') then return new; end if; -- RLS recusa
  if not public.quadro_tem_ferramenta((select b.producer_id from public.task_boards b where b.id = new.board_id), new.user_id) then
    raise exception 'Essa pessoa não tem acesso ao quadro deste produtor.' using errcode = '23514';
  end if;
  return new;
end $$;

create or replace function public.quadro_rodar_botao(p_button uuid, p_task uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_b public.task_buttons;
  v_ids uuid[];
  v_total int;
  v_id uuid;
  v_s jsonb;
  v_n int := 0;
  v_ign int := 0;
  v_motivos text[] := '{}';
  v_ok int;
  v_cm text[];
  v_user uuid;
  v_alvo uuid;
  v_prod uuid;
  v_rows int;
  v_rotulo text;
begin
  if v_uid is null or not (select public.gf_mfa_ok()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  select * into v_b from public.task_buttons b where b.id = p_button;
  if not found or not public.board_pode(v_b.board_id, 'editar') then
    raise exception 'Sem permissão para este botão.' using errcode = '42501'; -- botão inexistente e botão alheio dão a mesma resposta
  end if;
  -- o mesmo botão não roda duas vezes ao mesmo tempo (a segunda espera a primeira terminar)
  perform pg_advisory_xact_lock(hashtext('botao:' || p_button::text));
  select b.producer_id into v_prod from public.task_boards b where b.id = v_b.board_id;
  if v_b.scope = 'card' then
    if p_task is null or not exists (select 1 from public.producer_tasks t where t.id = p_task and t.board_id = v_b.board_id) then
      raise exception 'O cartão não é deste quadro.' using errcode = '22023';
    end if;
    v_ids := array[p_task];
    v_total := 1;
  else
    select count(*) into v_total from public.producer_tasks t
      where t.board_id = v_b.board_id and t.column_id = v_b.column_id and t.archived_at is null;
    v_ids := array(select t.id from public.producer_tasks t
      where t.board_id = v_b.board_id and t.column_id = v_b.column_id and t.archived_at is null
      order by t.position, t.id limit 200);
    if v_total > 200 then
      v_motivos := array['Limite de 200 cartões por execução: rode de novo para os demais.'];
    end if;
  end if;

  foreach v_id in array v_ids loop
    v_ok := 0;
    v_cm := '{}';
    begin -- subtransação: erro em um passo desfaz só este cartão
      if exists (select 1 from public.producer_tasks t where t.id = v_id and t.archived_at is not null) then
        v_cm := array['Cartão arquivado.'];
      else
        for v_s in select e from jsonb_array_elements(v_b.steps) e loop
          v_rows := null;
          v_rotulo := case v_s ->> 'v' when 'portaria' then 'Portaria' when 'divulgacao' then 'Divulgação' when 'fornecedores' then 'Fornecedores'
                        when 'financeiro' then 'Financeiro' when 'juridico' then 'Jurídico' when 'revisao' then 'Revisão' end;
          case v_s ->> 't'
            when 'mover' then
              select c.id into v_alvo from public.task_columns c where c.id = (v_s ->> 'v')::uuid and c.board_id = v_b.board_id;
              if v_alvo is null then
                v_cm := v_cm || 'A coluna de destino do passo mover não existe mais.'::text;
              else
                update public.producer_tasks set column_id = v_alvo where id = v_id and column_id is distinct from v_alvo; -- gatilhos da fatia 1 e 2A: dependência aberta recusa
                get diagnostics v_rows = row_count;
              end if;
            when 'atribuir', 'avisar' then
              select r.user_id into v_user from public.task_roles r where r.board_id = v_b.board_id and r.papel = v_s ->> 'v';
              if v_user is null then
                v_cm := v_cm || ('Papel “' || v_rotulo || '” sem pessoa definida.');
              elsif not public.quadro_tem_ferramenta(v_prod, v_user) then
                v_cm := v_cm || ('Papel “' || v_rotulo || '”: a pessoa saiu da equipe.');
              elsif v_s ->> 't' = 'atribuir' then
                insert into public.task_card_members (task_id, user_id) values (v_id, v_user) on conflict do nothing;
                get diagnostics v_rows = row_count;
              else
                perform public.quadro_notificar(v_user, v_id, 'automacao', 'Botão “' || v_b.name || '” precisa da sua atenção.', v_uid);
                v_rows := 1; -- o aviso pode ser descartado pelos freios da 2B; conta como feito
              end if;
            when 'etiqueta' then
              if not exists (select 1 from public.task_labels l where l.id = (v_s ->> 'v')::uuid and l.board_id = v_b.board_id) then
                v_cm := v_cm || 'A etiqueta do passo não existe mais.'::text;
              else
                insert into public.task_card_labels (task_id, label_id) values (v_id, (v_s ->> 'v')::uuid) on conflict do nothing;
                get diagnostics v_rows = row_count;
              end if;
            when 'prazo' then
              update public.producer_tasks set due_date = (v_hoje + (v_s ->> 'v')::int)::timestamp at time zone 'America/Sao_Paulo'
                where id = v_id and due_date is distinct from (v_hoje + (v_s ->> 'v')::int)::timestamp at time zone 'America/Sao_Paulo';
              get diagnostics v_rows = row_count;
            when 'arquivar' then
              update public.producer_tasks set archived_at = now() where id = v_id and archived_at is null;
              get diagnostics v_rows = row_count;
            else
              null; -- impossível: o CHECK da tabela só aceita os 6 passos
          end case;
          if v_rows = 0 then
            v_cm := v_cm || 'Sem mudança.'::text;
          elsif v_rows > 0 then
            v_ok := v_ok + 1;
          end if;
        end loop;
      end if;
    exception when others then
      v_ok := 0;
      -- nossas mensagens em português (P0001 e os 23514 dos gatilhos, que não citam constraint) voltam como estão; o resto
      -- (unicidade, check nativo...) vira texto genérico e o erro real vai ao histórico, para o dono investigar
      if sqlstate = 'P0001' or (sqlstate = '23514' and sqlerrm not like '%violates%') then
        v_cm := array[sqlerrm];
      else
        v_cm := array['Um passo falhou neste cartão.'];
        perform public.task_log(v_b.board_id, v_id, 'botao', jsonb_build_object('botao', v_b.name, 'erro', sqlerrm, 'sqlstate', sqlstate));
      end if;
    end;
    if v_ok > 0 then v_n := v_n + 1; else v_ign := v_ign + 1; end if;
    v_motivos := v_motivos || v_cm;
  end loop;

  v_ign := v_ign + (v_total - cardinality(v_ids)); -- cartões além do teto
  v_motivos := array(select m from (select distinct m from unnest(v_motivos) m) d order by m limit 20);
  perform public.task_log(v_b.board_id, case when v_b.scope = 'card' then p_task end, 'botao',
    jsonb_build_object('botao', v_b.name, 'afetados', v_n, 'ignorados', v_ign));
  return jsonb_build_object('afetados', v_n, 'ignorados', v_ign, 'motivos', to_jsonb(v_motivos));
end $$;

create or replace function public.quadro_aplicar_modelo(p_board uuid, p_kind text, p_itens int[] default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_board public.task_boards;
  v_tpl public.task_templates;
  v_data date;
  v_col uuid;
  v_it jsonb;
  v_i int;
  v_task uuid;
  v_user uuid;
  v_cl uuid;
  v_k text;
  v_prazo date;
  v_criados int := 0;
  v_exist int := 0;
begin
  if v_uid is null or not (select public.gf_mfa_ok()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_board is null or not public.board_pode(p_board, 'editar') then
    raise exception 'Sem permissão para este quadro.' using errcode = '42501';
  end if;
  select * into v_board from public.task_boards b where b.id = p_board;
  if v_board.event_id is null then
    raise exception 'Escolha um evento: o modelo usa a data dele.' using errcode = '22023';
  end if;
  select * into v_tpl from public.task_templates t where t.key = p_kind;
  if not found then
    raise exception 'Modelo desconhecido.' using errcode = '22023';
  end if;
  if p_itens is not null and cardinality(p_itens) > 60 then
    raise exception 'No máximo 60 cartões por vez.' using errcode = '22023';
  end if;
  select e.date into v_data from public.events e where e.id = v_board.event_id;
  if v_data is null then
    raise exception 'Defina a data do evento antes de aplicar o modelo.' using errcode = '22023';
  end if;
  select c.id into v_col from public.task_columns c where c.board_id = p_board order by c.position, c.id limit 1;
  if v_col is null then
    raise exception 'O quadro não tem coluna.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('quadro:' || p_board::text)); -- duas chamadas juntas não duplicam

  for v_it, v_i in select e.value, (e.ordinality - 1)::int from jsonb_array_elements(v_tpl.items) with ordinality e loop
    continue when p_itens is not null and not coalesce(v_i = any (p_itens), false);
    if exists (select 1 from public.producer_tasks t where t.board_id = p_board and t.archived_at is null and t.title = v_it ->> 'titulo') then
      v_exist := v_exist + 1;
      continue;
    end if;
    v_prazo := greatest(v_data - (v_it ->> 'dias')::int, v_hoje);
    insert into public.producer_tasks (producer_id, event_id, board_id, column_id, title, description, due_date)
      values (v_board.producer_id, v_board.event_id, p_board, v_col, v_it ->> 'titulo',
              'Criado pelo modelo “' || v_tpl.name || '”.', v_prazo::timestamp at time zone 'America/Sao_Paulo')
      returning id into v_task;
    select r.user_id into v_user from public.task_roles r where r.board_id = p_board and r.papel = v_it ->> 'papel';
    if v_user is not null and public.quadro_tem_ferramenta(v_board.producer_id, v_user) then
      insert into public.task_card_members (task_id, user_id) values (v_task, v_user);
    end if;
    for v_k in select jsonb_array_elements_text(coalesce(v_it -> 'vinculos', '[]'::jsonb)) loop
      insert into public.task_links (task_id, kind) values (v_task, v_k);
    end loop;
    if jsonb_typeof(v_it -> 'checklist') = 'array' and jsonb_array_length(v_it -> 'checklist') > 0 then
      insert into public.task_checklists (task_id, title, position) values (v_task, 'Checklist', 1000) returning id into v_cl;
      insert into public.task_checklist_items (checklist_id, text, position)
        select v_cl, x.value, x.ordinality * 1000 from jsonb_array_elements_text(v_it -> 'checklist') with ordinality x;
    end if;
    v_criados := v_criados + 1;
  end loop;

  perform public.task_log(p_board, null, 'modelo', jsonb_build_object('modelo', v_tpl.key, 'criados', v_criados, 'existentes', v_exist));
  return jsonb_build_object('criados', v_criados, 'existentes', v_exist);
end $$;

create or replace function public.quadro_gerar_recorrente_interno(p_task uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_t public.producer_tasks;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_col uuid;
  v_new uuid;
  v_cl record;
  v_cl_new uuid;
begin
  select * into v_t from public.producer_tasks t where t.id = p_task for update; -- cron e clique juntos não duplicam o avanço
  if not found or v_t.recur_days is null or v_t.archived_at is not null then return null; end if;
  select c.id into v_col from public.task_columns c where c.board_id = v_t.board_id order by c.position, c.id limit 1;
  insert into public.producer_tasks (producer_id, event_id, board_id, column_id, title, description, priority, cover, location, fields,
                                     assigned_to, due_date)
    values (v_t.producer_id, v_t.event_id, v_t.board_id, v_col, v_t.title, v_t.description, v_t.priority, v_t.cover, v_t.location, v_t.fields,
            case when public.quadro_tem_ferramenta(v_t.producer_id, v_t.assigned_to) then v_t.assigned_to end,
            (v_hoje + v_t.recur_days)::timestamp at time zone 'America/Sao_Paulo')
    returning id into v_new;
  insert into public.task_card_members (task_id, user_id)
    select v_new, m.user_id from public.task_card_members m
    where m.task_id = p_task and public.quadro_tem_ferramenta(v_t.producer_id, m.user_id);
  insert into public.task_card_labels (task_id, label_id) select v_new, l.label_id from public.task_card_labels l where l.task_id = p_task;
  insert into public.task_links (task_id, kind, ref) select v_new, k.kind, k.ref from public.task_links k where k.task_id = p_task;
  for v_cl in select c.id, c.title, c.position from public.task_checklists c where c.task_id = p_task order by c.position, c.id loop
    insert into public.task_checklists (task_id, title, position) values (v_new, v_cl.title, v_cl.position) returning id into v_cl_new;
    insert into public.task_checklist_items (checklist_id, text, position, done)
      select v_cl_new, i.text, i.position, false from public.task_checklist_items i where i.checklist_id = v_cl.id;
  end loop;
  update public.producer_tasks set recur_next = v_hoje + v_t.recur_days where id = p_task;
  perform public.task_log(v_t.board_id, v_new, 'recorrente', jsonb_build_object('origem', p_task));
  return v_new;
end $$;

create or replace function public.quadro_papeis_sugerir(p_board uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_prod uuid;
begin
  if v_uid is null or not (select public.gf_mfa_ok()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_board is null or not public.board_pode(p_board, 'editar') then
    raise exception 'Sem permissão para este quadro.' using errcode = '42501';
  end if;
  select b.producer_id into v_prod from public.task_boards b where b.id = p_board;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome) order by x.nome, x.id)
    from (select p.id, coalesce(nullif(btrim(p.full_name), ''), 'Sem nome') as nome from public.profiles p where p.id = v_prod
          union
          select p.id, coalesce(nullif(btrim(p.full_name), ''), 'Sem nome')
          from public.team_members m join public.team_member_tools f on f.member_id = m.id and f.ferramenta = 'quadro'
               join public.profiles p on p.id = m.user_id
          where m.producer_id = v_prod and m.accepted_at is not null and m.blocked_at is null) x), '[]'::jsonb);
end $$;
drop function if exists public.quadro_criar(text, text, uuid, text, text, jsonb), public.quadro_salvar_como_modelo(uuid, text, boolean),
  public.quadro_membros_definir(uuid, text, jsonb), public.quadro_arquivar(uuid, boolean), public.quadro_equipe_lista(),
  public.quadro_membros_validar(uuid, jsonb), public.task_anexo_pode(text, text), public.quadro_acesso(uuid, uuid, text),
  public.quadro_acesso_direto(uuid, uuid, text), public.quadro_equipe_ativa(uuid, uuid), public.quadro_nome_padrao(uuid),
  public.quadro_texto_ok(text, int, int), public.quadro_limpar_texto(text, int), public.quadro_modelo_ok(jsonb, jsonb),
  public.quadro_modelo_carta_ok(jsonb, int), public.quadro_modelo_coluna_ok(jsonb), public.task_board_members_tg(),
  public.task_boards_limite_tg(), public.task_boards_guarda_tg(), public.task_boards_visib_tg(), public.task_board_templates_limite_tg(),
  public.team_members_quadro_sai_tg();
  end if;
end $d$;
select skip('Desfazer: só o dono das tabelas (ou superusuário) ensaia o Desfazer; aqui current_user não é', 14) where not (select ok from _dono);
select is(to_regclass('public.task_board_members') is null and to_regclass('public.task_board_templates') is null, true, 'Desfazer: tabelas novas removidas') where (select ok from _dono);
select is((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'task_boards'
           and column_name in ('kind', 'visibility', 'description', 'color', 'archived_at', 'template_key', 'position', 'created_by', 'is_default')), 0::bigint,
  'Desfazer: colunas novas de task_boards removidas') where (select ok from _dono);
select is((select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('quadro_criar', 'quadro_salvar_como_modelo', 'quadro_membros_definir',
  'quadro_arquivar', 'quadro_equipe_lista', 'quadro_membros_validar', 'task_anexo_pode', 'quadro_acesso', 'quadro_acesso_direto', 'quadro_equipe_ativa', 'quadro_nome_padrao',
  'quadro_texto_ok', 'quadro_limpar_texto', 'quadro_modelo_ok', 'quadro_modelo_carta_ok', 'quadro_modelo_coluna_ok', 'task_board_members_tg', 'task_boards_limite_tg',
  'task_boards_guarda_tg', 'task_boards_visib_tg', 'task_board_templates_limite_tg', 'team_members_quadro_sai_tg')), 0::bigint, 'Desfazer: funções novas removidas') where (select ok from _dono);
select is((select count(*) from pg_trigger where not tgisinternal and tgname in ('task_board_members_quadro', 'task_board_templates_limite', 'task_boards_limite', 'task_boards_guarda', 'task_boards_visib',
  'team_members_quadro_sai', 'team_members_quadro_sai_upd')),
  0::bigint, 'Desfazer: gatilhos novos removidos') where (select ok from _dono);
select is((select indexdef from pg_indexes where schemaname = 'public' and indexname = 'task_boards_unico') not like '%WHERE%', true, 'Desfazer: índice único volta a valer para todo quadro') where (select ok from _dono);
select policies_are('public', 'task_boards', array['gf_mfa_aal2', 'task_boards_recibos', 'task_boards_ver'], 'Desfazer: task_boards com as regras da 2B') where (select ok from _dono);
select is((select bool_and(prosrc like '%equipe_pode%') from pg_proc where pronamespace = 'public'::regnamespace and proname in ('board_pode', 'task_pode', 'checklist_pode', 'comment_pode')), true,
  'Desfazer: board_pode, task_pode, checklist_pode e comment_pode voltam a chamar equipe_pode') where (select ok from _dono);
select is((select pg_get_expr(polqual, polrelid) like '%equipe_pode%' from pg_policy where polname = 'tasks_ver' and polrelid = 'public.producer_tasks'::regclass), true, 'Desfazer: tasks_ver volta à regra da fatia 1') where (select ok from _dono);
select is((select pg_get_expr(polqual, polrelid) like '%equipe_pode%task_anexo_produtor%' from pg_policy where polname = 'task_anexos_select'), true, 'Desfazer: regra do bucket volta à da 2A') where (select ok from _dono);
select is((select prosrc not like '%is_default%' from pg_proc where proname = 'quadro_criar_interno' and pronamespace = 'public'::regnamespace), true, 'Desfazer: quadro_criar_interno volta à da fatia 1') where (select ok from _dono);
select is((select count(*) from public.producer_tasks), (select tarefas from _antes), 'Desfazer: nenhum cartão se perdeu (os dos quadros extras foram para o quadro padrão)') where (select ok from _dono);
select is((select count(*) from public.producer_tasks where board_id is null or column_id is null), 0::bigint, 'Desfazer: todo cartão segue com quadro e coluna') where (select ok from _dono);
select pg_temp.como('authenticated', pg_temp.i('a2'));
select is((select count(*) from public.producer_tasks where board_id = pg_temp.b('be')) > 0, true, 'Desfazer: mv (ferramenta quadro, ver) volta a ler pelo produtor') where (select ok from _dono);
select pg_temp.como('postgres');
select is(to_regprocedure('public.quadro_tem_ferramenta(uuid, uuid)') is not null and to_regprocedure('public.quadro_gerar_recorrentes_vencidas()') is not null, true, 'Desfazer: o resto da 2C fica') where (select ok from _dono);


select * from finish();
rollback;
