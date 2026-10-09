-- pgTAP do cartão completo do Quadro (docs/sql/20261105_quadro_f2a_cartao.sql). Só no banco local: aplicar 20261010, 20261017,
-- 20261103 e 20261105 e rodar `supabase test db`. Tudo em begin ... rollback: nada fica gravado. Nunca contra produção.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(142);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', p_role, true);
end $f$;
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated;
-- o pgTAP precisa ser executável pelos papéis de teste; só as funções do próprio pgtap (a linha antiga "on all functions in
-- schema extensions" falhava com pg_stat_statements_reset, que não é nosso). Tolerante: se não for dono, segue sem erro.
do $g$ declare r record; begin
  for r in select p.oid::regprocedure as f from pg_proc p join pg_depend d on d.objid = p.oid and d.deptype = 'e'
           join pg_extension e on e.oid = d.refobjid where e.extname = 'pgtap' loop
    begin execute 'grant execute on function ' || r.f || ' to anon, authenticated';
    exception when others then null; end;
  end loop;
end $g$;

-- Dados (como postgres): p1 dono; p2 outro produtor; mv membro 'ver'; me membro 'editar'; mb membro bloqueado; x conta solta
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('fd000000-0000-4000-8000-000000000001', 'p1@teste-f2a.local', now(), '{"role":"producer","full_name":"Paula"}'),
  ('fd000000-0000-4000-8000-000000000002', 'p2@teste-f2a.local', now(), '{"role":"producer","full_name":"Pedro"}'),
  ('fd000000-0000-4000-8000-0000000000a2', 'mv@teste-f2a.local', now(), '{"full_name":"So ve"}'),
  ('fd000000-0000-4000-8000-0000000000a3', 'me@teste-f2a.local', now(), '{"full_name":"Edita"}'),
  ('fd000000-0000-4000-8000-0000000000a4', 'mb@teste-f2a.local', now(), '{"full_name":"Bloqueado"}'),
  ('fd000000-0000-4000-8000-0000000000b1', 'x@teste-f2a.local', now(), '{"full_name":"Solta"}');
insert into public.team_members (id, producer_id, user_id, role, accepted_at, blocked_at) values
  ('fd000000-0000-4000-8000-0000000000c2', 'fd000000-0000-4000-8000-000000000001', 'fd000000-0000-4000-8000-0000000000a2', 'editor', now(), null),
  ('fd000000-0000-4000-8000-0000000000c3', 'fd000000-0000-4000-8000-000000000001', 'fd000000-0000-4000-8000-0000000000a3', 'editor', now(), null),
  ('fd000000-0000-4000-8000-0000000000c4', 'fd000000-0000-4000-8000-000000000001', 'fd000000-0000-4000-8000-0000000000a4', 'editor', now(), now());
insert into public.team_member_tools (member_id, ferramenta, nivel) values
  ('fd000000-0000-4000-8000-0000000000c2', 'quadro', 'ver'),
  ('fd000000-0000-4000-8000-0000000000c3', 'quadro', 'editar'),
  ('fd000000-0000-4000-8000-0000000000c4', 'quadro', 'editar');
-- cartões: A, B, C do P1 (mesmo quadro); Z do P2
insert into public.producer_tasks (id, producer_id, title) values
  ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-000000000001', 'A'),
  ('fd000000-0000-4000-8000-0000000000d2', 'fd000000-0000-4000-8000-000000000001', 'B'),
  ('fd000000-0000-4000-8000-0000000000d3', 'fd000000-0000-4000-8000-000000000001', 'C'),
  ('fd000000-0000-4000-8000-0000000000d9', 'fd000000-0000-4000-8000-000000000002', 'Z');
-- etiqueta do quadro de P2 (para o teste de "outro quadro") e uma etiqueta do quadro de P1
insert into public.task_labels (id, board_id, name, color) values
  ('fd000000-0000-4000-8000-0000000000e9', (select board_id from public.producer_tasks where title = 'Z'), 'Do P2', '#112233'),
  ('fd000000-0000-4000-8000-0000000000e1', (select board_id from public.producer_tasks where title = 'A'), 'Urgente', '#ff0000');
insert into public.task_comments (id, task_id, user_id, body) values
  ('fd000000-0000-4000-8000-0000000000f1', 'fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-0000000000a3', 'do editor');
insert into public.task_checklists (id, task_id, title) values
  ('fd000000-0000-4000-8000-0000000000f2', 'fd000000-0000-4000-8000-0000000000d1', 'Lista');
insert into public.task_checklist_items (id, checklist_id, text) values
  ('fd000000-0000-4000-8000-0000000000f3', 'fd000000-0000-4000-8000-0000000000f2', 'Item 1');

-- Estrutura -----------------------------------------------------------------------------------------------------------------
select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'task\_%' and not c.relrowsecurity), 0::bigint,
  'toda tabela task_* tem RLS ligada');
select is((select count(*) from pg_policies where schemaname = 'public' and policyname = 'gf_mfa_aal2' and permissive = 'RESTRICTIVE'
           and tablename like 'task\_%'), 15::bigint, 'gf_mfa_aal2 RESTRICTIVE nas 15 tabelas task_*');
select is((select count(*) from information_schema.role_table_grants where grantee in ('anon', 'public') and table_schema = 'public'
           and table_name like 'task\_%'), 0::bigint, 'anon sem privilégio em tabela task_*');
select is((select count(*) from information_schema.columns where table_schema = 'public'
           and (table_name like 'task\_%' or table_name = 'producer_tasks') and column_name ~* '(^|_)ip(_|$)'), 0::bigint,
  'nenhuma coluna de IP nas tabelas do quadro (LGPD)');
select is(has_function_privilege('anon', 'public.task_pode(uuid, text)', 'execute'), false, 'anon não executa task_pode');
select is(has_function_privilege('authenticated', 'public.task_log(uuid, uuid, text, jsonb)', 'execute'), false,
  'authenticated não executa task_log');
select is(has_table_privilege('authenticated', 'public.task_activity', 'insert'), false, 'authenticated sem INSERT em task_activity');
select is((select public from storage.buckets where id = 'task-attachments'), false, 'bucket task-attachments é privado');
select is((select file_size_limit from storage.buckets where id = 'task-attachments'), 10485760::bigint, 'bucket limita 10 MB');
select policies_are('public', 'task_activity', array['gf_mfa_aal2', 'task_activity_ver'], 'task_activity: só ver e 2FA');
select policies_are('public', 'task_comment_receipts',
  array['gf_mfa_aal2', 'task_comment_receipts_criar', 'task_comment_receipts_editar', 'task_comment_receipts_ver'], 'recibos: ver, criar, editar e 2FA');

-- Anon ------------------------------------------------------------------------------------------------------------------------
select pg_temp.como('anon');
select throws_ok('select count(*) from public.task_labels', '42501', null, 'anon não lê etiquetas');
select throws_ok('select count(*) from public.task_comments', '42501', null, 'anon não lê comentários');
select throws_ok($$select public.task_pode('fd000000-0000-4000-8000-0000000000d1', 'ver')$$, '42501', null, 'anon não chama task_pode');

-- P2 (outro produtor) ---------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000002');
select is((select count(*) from public.task_labels), 1::bigint, 'P2 vê só a etiqueta do próprio quadro');
select is((select count(*) from public.task_comments), 0::bigint, 'P2 não vê comentário de P1');
select is((select count(*) from public.task_checklist_items), 0::bigint, 'P2 não vê item de checklist de P1');
select throws_ok($$insert into public.task_links (task_id, kind) values ('fd000000-0000-4000-8000-0000000000d1', 'cupom')$$,
  '42501', null, 'P2 não cria atalho em cartão de P1');
select throws_ok($$insert into public.task_labels (board_id, name, color) values
  ((select board_id from public.producer_tasks where id = 'fd000000-0000-4000-8000-0000000000d1'), 'x', '#000000')$$,
  '42501', null, 'P2 não cria etiqueta no quadro de P1');

-- Membro bloqueado ------------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-0000000000a4');
select is((select count(*) from public.task_labels), 0::bigint, 'bloqueado não lê etiquetas');
select is((select count(*) from public.task_activity), 0::bigint, 'bloqueado não lê histórico');

-- Membro 'ver' ----------------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-0000000000a2');
select is((select count(*) from public.task_labels), 1::bigint, '''ver'' lê as etiquetas do quadro de P1');
select is((select count(*) from public.task_comments), 1::bigint, '''ver'' lê comentários');
select is((select count(*) from public.task_checklist_items), 1::bigint, '''ver'' lê itens de checklist');
select throws_ok($$insert into public.task_labels (board_id, name, color) values
  ((select board_id from public.producer_tasks where id = 'fd000000-0000-4000-8000-0000000000d1'), 'x', '#000000')$$,
  '42501', null, '''ver'' não cria etiqueta');
with u as (update public.task_checklist_items set done = true returning 1)
  select is((select count(*) from u), 0::bigint, '''ver'' não marca item (0 linhas)');
select throws_ok($$insert into public.task_comments (task_id, body) values ('fd000000-0000-4000-8000-0000000000d1', 'oi')$$,
  '42501', null, '''ver'' não comenta');
select lives_ok($$insert into public.task_watchers (task_id, user_id) values
  ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-0000000000a2')$$, '''ver'' observa o cartão');
select throws_ok($$insert into public.task_watchers (task_id, user_id) values
  ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-0000000000a3')$$, '42501', null, 'não coloca outra pessoa como observadora');
-- recibo e "visto por": só o próprio
select lives_ok($$insert into public.task_comment_receipts (comment_id, user_id, read_at, device) values
  ('fd000000-0000-4000-8000-0000000000f1', 'fd000000-0000-4000-8000-0000000000a2', now(), 'celular')$$, 'destinatário grava o próprio recibo');
select ok((select read_at >= delivered_at and read_at > '2000-01-01' from public.task_comment_receipts
           where comment_id = 'fd000000-0000-4000-8000-0000000000f1' and user_id = 'fd000000-0000-4000-8000-0000000000a2'),
  'read_at carimbado pelo banco, nunca menor que delivered_at');
select throws_ok($$insert into public.task_comment_receipts (comment_id, user_id) values
  ('fd000000-0000-4000-8000-0000000000f1', 'fd000000-0000-4000-8000-0000000000a3')$$, '42501', null, 'recibo em nome de outra pessoa é recusado');
select throws_ok($$insert into public.task_comment_receipts (comment_id, user_id, device) values
  ('fd000000-0000-4000-8000-0000000000f1', 'fd000000-0000-4000-8000-0000000000a2', 'geladeira')$$, '23514', null, 'device fora da lista é recusado');
select throws_ok($$insert into public.task_card_views (task_id, user_id, last_seen_at) values
  ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-0000000000a2', '2000-01-01')$$, '42501', null, 'cliente não escolhe last_seen_at');
select lives_ok($$insert into public.task_card_views (task_id, user_id, device) values
  ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-0000000000a2', 'computador')$$, '''ver'' grava o próprio ''visto por''');
select throws_ok($$insert into public.task_card_views (task_id, user_id) values
  ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-0000000000a3')$$, '42501', null, '''visto por'' em nome de outro é recusado');
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id) values
  ('task-attachments', 'fd000000-0000-4000-8000-000000000001/fd000000-0000-4000-8000-0000000000d1/fd000000-0000-4000-8000-0000000000aa-a.png', 'fd000000-0000-4000-8000-0000000000a2')$$,
  '42501', null, '''ver'' não envia arquivo ao bucket');

-- Membro 'editar' -------------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-0000000000a3');
select lives_ok($$insert into public.task_labels (board_id, name, color) values
  ((select board_id from public.producer_tasks where id = 'fd000000-0000-4000-8000-0000000000d1'), 'Nova', '#00ff00')$$, '''editar'' cria etiqueta');
select throws_ok($$insert into public.task_labels (board_id, name, color) values
  ((select board_id from public.producer_tasks where id = 'fd000000-0000-4000-8000-0000000000d1'), 'x', 'verde')$$,
  '23514', null, 'cor fora de #rrggbb é recusada');
select lives_ok($$insert into public.task_card_labels (task_id, label_id) values
  ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-0000000000e1')$$, 'etiqueta do mesmo quadro entra no cartão');
select throws_ok($$insert into public.task_card_labels (task_id, label_id) values
  ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-0000000000e9')$$, '23514', 'Etiqueta de outro quadro.',
  'etiqueta de outro quadro é recusada');
select lives_ok($$insert into public.task_card_members (task_id, user_id) values
  ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-0000000000a2')$$, 'membro da equipe entra no cartão');
select throws_ok($$insert into public.task_card_members (task_id, user_id) values
  ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-0000000000b1')$$, '23514', 'Esse usuário não é da equipe deste produtor.',
  'quem não é da equipe não entra no cartão');
select lives_ok($$update public.task_checklist_items set done = true where id = 'fd000000-0000-4000-8000-0000000000f3'$$, '''editar'' marca item');
select is((select done_by from public.task_checklist_items where id = 'fd000000-0000-4000-8000-0000000000f3'),
  'fd000000-0000-4000-8000-0000000000a3'::uuid, 'done_by gravado pelo gatilho');
select ok((select done_at is not null from public.task_checklist_items where id = 'fd000000-0000-4000-8000-0000000000f3'), 'done_at gravado');
select throws_ok($$insert into public.task_checklist_items (checklist_id, text) values
  ('fd000000-0000-4000-8000-0000000000f2', '')$$, '23514', null, 'item vazio é recusado');
-- anexos
select throws_ok($$insert into public.task_attachments (task_id, storage_path, name, mime, size_bytes, created_by) values
  ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-000000000001/fd000000-0000-4000-8000-0000000000d1/fd000000-0000-4000-8000-0000000000aa-a.png', 'a.exe', 'application/x-msdownload', 100,
   'fd000000-0000-4000-8000-0000000000a3')$$, '23514', null, 'mime fora da lista é recusado');
select throws_ok($$insert into public.task_attachments (task_id, storage_path, name, mime, size_bytes, created_by) values
  ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-000000000001/fd000000-0000-4000-8000-0000000000d1/fd000000-0000-4000-8000-0000000000aa-a.pdf', 'a.pdf', 'application/pdf', 10485761,
   'fd000000-0000-4000-8000-0000000000a3')$$, '23514', null, 'acima de 10 MB é recusado');
select throws_ok($$insert into public.task_attachments (task_id, storage_path, name, mime, size_bytes, created_by) values
  ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-000000000002/fd000000-0000-4000-8000-0000000000d1/fd000000-0000-4000-8000-0000000000aa-a.pdf', 'a.pdf', 'application/pdf', 100,
   'fd000000-0000-4000-8000-0000000000a3')$$, '23514', 'Caminho de anexo inválido.', 'caminho de outro produtor é recusado');
select throws_ok($$insert into public.task_attachments (task_id, storage_path, name, mime, size_bytes, created_by) values
  ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-000000000001/fd000000-0000-4000-8000-0000000000d1/fd000000-0000-4000-8000-0000000000aa-b.pdf', 'b.pdf', 'application/pdf', 100,
   'fd000000-0000-4000-8000-000000000001')$$, '42501', null, 'created_by de outra pessoa é recusado');
select lives_ok($$insert into public.task_attachments (task_id, storage_path, name, mime, size_bytes, created_by) values
  ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-000000000001/fd000000-0000-4000-8000-0000000000d1/fd000000-0000-4000-8000-0000000000aa-a.png', 'a.png', 'image/png', 100,
   'fd000000-0000-4000-8000-0000000000a3')$$, 'anexo válido entra');
select lives_ok($$insert into storage.objects (bucket_id, name, owner_id) values
  ('task-attachments', 'fd000000-0000-4000-8000-000000000001/fd000000-0000-4000-8000-0000000000d1/fd000000-0000-4000-8000-0000000000aa-a.png', 'fd000000-0000-4000-8000-0000000000a3')$$,
  '''editar'' envia arquivo ao bucket');
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id) values
  ('task-attachments', 'fd000000-0000-4000-8000-000000000002/fd000000-0000-4000-8000-0000000000d9/fd000000-0000-4000-8000-0000000000aa-a.png', 'fd000000-0000-4000-8000-0000000000a3')$$,
  '42501', null, 'arquivo na pasta de outro produtor é recusado');
-- caminho: nome '.png', outro cartão do mesmo produtor, 2º segmento inexistente (upload órfão)
select throws_ok($$insert into public.task_attachments (task_id, storage_path, name, mime, size_bytes, created_by) values
  ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-000000000001/fd000000-0000-4000-8000-0000000000d1/fd000000-0000-4000-8000-0000000000aa-.png', '.png', 'image/png', 100, 'fd000000-0000-4000-8000-0000000000a3')$$, '23514',
  'Caminho de anexo inválido.', 'nome de arquivo .png é recusado');
select throws_ok($$insert into public.task_attachments (task_id, storage_path, name, mime, size_bytes, created_by) values
  ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-000000000001/fd000000-0000-4000-8000-0000000000d2/fd000000-0000-4000-8000-0000000000aa-a.png', 'a.png', 'image/png', 100, 'fd000000-0000-4000-8000-0000000000a3')$$,
  '23514', 'Caminho de anexo inválido.', 'caminho de outro cartão (mesmo produtor) é recusado');
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id) values
  ('task-attachments', 'fd000000-0000-4000-8000-000000000001/fd000000-0000-4000-8000-0000000000ff/fd000000-0000-4000-8000-0000000000aa-a.png', 'fd000000-0000-4000-8000-0000000000a3')$$,
  '42501', null, 'upload órfão (2º segmento sem cartão) é recusado');
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id) values
  ('task-attachments', 'fd000000-0000-4000-8000-000000000001/fd000000-0000-4000-8000-0000000000d1/fd000000-0000-4000-8000-0000000000aa-.png', 'fd000000-0000-4000-8000-0000000000a3')$$,
  '42501', null, 'nome .png no bucket é recusado');
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id) values
  ('task-attachments', 'fd000000-0000-4000-8000-000000000001/fd000000-0000-4000-8000-0000000000d1/fd000000-0000-4000-8000-0000000000aa-a.PNG', 'fd000000-0000-4000-8000-0000000000a3')$$,
  '42501', null, 'extensão em maiúscula no bucket é recusada (o front envia minúscula)');
-- comentários
select lives_ok($$insert into public.task_comments (task_id, body, mentions) values
  ('fd000000-0000-4000-8000-0000000000d1', 'oi @ver', array['fd000000-0000-4000-8000-0000000000a2']::uuid[])$$, '''editar'' comenta e menciona membro');
select throws_ok($$insert into public.task_comments (task_id, body, mentions) values
  ('fd000000-0000-4000-8000-0000000000d1', 'oi', array['fd000000-0000-4000-8000-0000000000b1']::uuid[])$$, '23514',
  'Menção a quem não é da equipe deste produtor.',
  'menção a quem não é da equipe é recusada');
select throws_ok($$insert into public.task_comments (task_id, body, user_id) values
  ('fd000000-0000-4000-8000-0000000000d1', 'em nome de outro', 'fd000000-0000-4000-8000-000000000001')$$, '42501', null,
  'comentário em nome de outra pessoa é recusado');
select throws_ok($$insert into public.task_comments (task_id, body) values ('fd000000-0000-4000-8000-0000000000d1', repeat('x', 4001))$$,
  '23514', null, 'comentário acima de 4000 caracteres é recusado');
select lives_ok($$update public.task_comments set body = 'editado' where id = 'fd000000-0000-4000-8000-0000000000f1'$$, 'autor edita o próprio');
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000001');
with u as (update public.task_comments set body = 'do dono' where id = 'fd000000-0000-4000-8000-0000000000f1' returning 1)
  select is((select count(*) from u), 0::bigint, 'nem o dono edita comentário alheio (0 linhas)');
select is((select count(*) from public.task_comment_receipts), 1::bigint, 'dono lê os recibos');
select is((select count(*) from public.task_card_views), 1::bigint, 'dono lê o ''visto por''');
with u as (update public.task_comment_receipts set read_at = null returning 1)
  select is((select count(*) from u), 0::bigint, 'dono não altera recibo alheio (0 linhas)');
with d as (delete from public.task_comments where id = 'fd000000-0000-4000-8000-0000000000f1' returning 1)
  select is((select count(*) from d), 1::bigint, 'o dono do produtor apaga comentário alheio (moderação)');
-- atalhos
select throws_ok($$insert into public.task_links (task_id, kind, ref) values ('fd000000-0000-4000-8000-0000000000d1', 'cupom', 'a b/c')$$,
  '23514', null, 'ref de atalho fora de [A-Za-z0-9_-] é recusada');
select throws_ok($$insert into public.task_links (task_id, kind) values ('fd000000-0000-4000-8000-0000000000d1', 'bitcoin')$$,
  '23514', null, 'atalho de tipo fora da lista é recusado');
select lives_ok($$insert into public.task_links (task_id, kind, ref) values ('fd000000-0000-4000-8000-0000000000d1', 'cupom', 'ABC')$$,
  'atalho válido');

-- Colunas novas de producer_tasks -----------------------------------------------------------------------------------------------
select lives_ok($$update public.producer_tasks set cover = '#abcdef', location = '{"txt":"Salão","lat":-23.5,"lng":-46.6}',
  start_date = current_date, fields = '{"a":1}', recur_days = 7, recur_next = current_date + 7
  where id = 'fd000000-0000-4000-8000-0000000000d3'$$, 'colunas novas aceitam valores válidos');
select lives_ok($$update public.producer_tasks set location = '{"txt":"só texto"}' where id = 'fd000000-0000-4000-8000-0000000000d3'$$, 'location só com txt');
select lives_ok($$update public.producer_tasks set location = '{"lat":10,"lng":20}' where id = 'fd000000-0000-4000-8000-0000000000d3'$$, 'location só com lat e lng');
select lives_ok($$update public.producer_tasks set location = '{"lat":10}' where id = 'fd000000-0000-4000-8000-0000000000d3'$$, 'location só com lat');
select throws_ok($$update public.producer_tasks set fields = '{"Chave Ruim":1}' where id = 'fd000000-0000-4000-8000-0000000000d3'$$, '23514', null, 'fields com chave fora de [a-z0-9_]');
select throws_ok($$update public.producer_tasks set cover = 'red' where id = 'fd000000-0000-4000-8000-0000000000d3'$$, '23514', null, 'cover inválida');
select throws_ok($$update public.producer_tasks set location = '{"lat":91}' where id = 'fd000000-0000-4000-8000-0000000000d3'$$, '23514', null, 'lat fora de -90..90');
select throws_ok($$update public.producer_tasks set location = '{"lng":181}' where id = 'fd000000-0000-4000-8000-0000000000d3'$$, '23514', null, 'lng fora de -180..180');
select throws_ok($$update public.producer_tasks set location = '{"cep":"1"}' where id = 'fd000000-0000-4000-8000-0000000000d3'$$, '23514', null, 'location com chave não permitida');
select throws_ok($$update public.producer_tasks set location = '{"lat":"1"}' where id = 'fd000000-0000-4000-8000-0000000000d3'$$, '23514', null, 'lat que não é número');
select throws_ok($$update public.producer_tasks set fields = '[1]' where id = 'fd000000-0000-4000-8000-0000000000d3'$$, '23514', null, 'fields que não é objeto');
select throws_ok($$update public.producer_tasks set fields = jsonb_build_object('k', (select string_agg(md5(i::text), '') from generate_series(1, 400) i))
  where id = 'fd000000-0000-4000-8000-0000000000d3'$$, '23514', null, 'fields acima de 8 KB');
select throws_ok($$update public.producer_tasks set recur_days = 5 where id = 'fd000000-0000-4000-8000-0000000000d3'$$, '23514', null, 'recur_days fora de 1/7/14/30');

-- Dependências ----------------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-0000000000a3');
select lives_ok($$insert into public.task_dependencies (task_id, depends_on) values
  ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-0000000000d2')$$, 'A depende de B');
select lives_ok($$insert into public.task_dependencies (task_id, depends_on) values
  ('fd000000-0000-4000-8000-0000000000d2', 'fd000000-0000-4000-8000-0000000000d3')$$, 'B depende de C');
select throws_ok($$insert into public.task_dependencies (task_id, depends_on) values
  ('fd000000-0000-4000-8000-0000000000d3', 'fd000000-0000-4000-8000-0000000000d1')$$, '23514', 'Essa dependência cria um ciclo.', 'ciclo A->B->C->A recusado');
select throws_ok($$insert into public.task_dependencies (task_id, depends_on) values
  ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-0000000000d1')$$, '23514', null, 'dependência de si mesmo recusada');
select throws_ok($$insert into public.task_dependencies (task_id, depends_on) values
  ('fd000000-0000-4000-8000-0000000000d3', 'fd000000-0000-4000-8000-0000000000d9')$$, '23514', 'Dependência entre quadros diferentes.',
  'dependência de cartão de outro quadro recusada');
-- mover: A depende de B (em A fazer); só a primeira coluna é permitida
select throws_ok($$update public.producer_tasks set column_id = (select c.id from public.task_columns c where c.board_id = producer_tasks.board_id and c.name = 'Em andamento')
  where id = 'fd000000-0000-4000-8000-0000000000d1'$$, '23514', 'Este cartão depende de outro que ainda não foi concluído.',
  'mover A para fora da primeira coluna: bloqueado');
select throws_ok($$update public.producer_tasks set status = 'done' where id = 'fd000000-0000-4000-8000-0000000000d1'$$, '23514',
  'Este cartão depende de outro que ainda não foi concluído.', 'tela antiga (só status) também é bloqueada');
select lives_ok($$update public.producer_tasks set position = 1 where id = 'fd000000-0000-4000-8000-0000000000d1'$$, 'reordenar na primeira coluna segue livre');
-- concluir C (sem dependência) libera B; concluir B libera A
select lives_ok($$update public.producer_tasks set status = 'done' where id = 'fd000000-0000-4000-8000-0000000000d3'$$, 'C (sem dependência) vai para Feito');
select lives_ok($$update public.producer_tasks set column_id = (select c.id from public.task_columns c where c.board_id = producer_tasks.board_id and c.name = 'Em andamento')
  where id = 'fd000000-0000-4000-8000-0000000000d2'$$, 'B liberado porque C está concluída');
select throws_ok($$update public.producer_tasks set status = 'in_progress' where id = 'fd000000-0000-4000-8000-0000000000d1'$$, '23514',
  'Este cartão depende de outro que ainda não foi concluído.', 'A segue bloqueado enquanto B não estiver concluída');
select lives_ok($$update public.producer_tasks set status = 'done' where id = 'fd000000-0000-4000-8000-0000000000d2'$$, 'B concluída');
select lives_ok($$update public.producer_tasks set status = 'in_progress' where id = 'fd000000-0000-4000-8000-0000000000d1'$$, 'A liberado porque B está concluída');

-- Histórico -------------------------------------------------------------------------------------------------------------------
select ok((select count(*) from public.task_activity where kind = 'criado') = 3, '''editar'' lê o histórico: cartões criados');
select ok(exists (select 1 from public.task_activity where kind = 'movido' and task_id = 'fd000000-0000-4000-8000-0000000000d1'),
  'movimento de A registrado no histórico');
select ok(exists (select 1 from public.task_activity where kind = 'comentario'), 'comentário registrado no histórico');
select ok(exists (select 1 from public.task_activity where kind = 'anexo'), 'anexo registrado no histórico');
select throws_ok($$insert into public.task_activity (board_id, kind) values
  ((select board_id from public.producer_tasks where id = 'fd000000-0000-4000-8000-0000000000d1'), 'criado')$$, '42501', null,
  'ninguém grava histórico direto');
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000002');
select is((select count(*) from public.task_activity), 1::bigint, 'P2 vê só o histórico do próprio quadro');
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-0000000000a2');
select ok((select count(*) from public.task_activity) >= 4, '''ver'' lê o histórico de P1');
select is((select count(*) from storage.objects where bucket_id = 'task-attachments'), 1::bigint, '''ver'' lê o arquivo do bucket');
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000002');
select is((select count(*) from storage.objects where bucket_id = 'task-attachments'), 0::bigint, 'P2 não lê arquivo de P1');

-- Casos extras: limites, cartão já fora da primeira coluna, pai arquivado, apagar evento, menções -----------------------------
select pg_temp.como('postgres');
insert into public.task_links (task_id, kind) select 'fd000000-0000-4000-8000-0000000000d3', 'cupom' from generate_series(1, 30);
insert into public.producer_tasks (id, producer_id, title, status) values
  ('fd000000-0000-4000-8000-0000000000d5', 'fd000000-0000-4000-8000-000000000001', 'F', 'in_progress'),
  ('fd000000-0000-4000-8000-0000000000d6', 'fd000000-0000-4000-8000-000000000001', 'G', 'todo');
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-0000000000a3');
select throws_ok($$insert into public.task_links (task_id, kind) values ('fd000000-0000-4000-8000-0000000000d3', 'cupom')$$,
  '23514', 'Limite de 30 atalhos por cartão.', 'teto de 30 atalhos por cartão');
select throws_ok($$insert into public.task_comments (task_id, body, mentions) values ('fd000000-0000-4000-8000-0000000000d1', 'x',
  (select array_agg(gen_random_uuid()) from generate_series(1, 21)))$$, '23514', 'Máximo de 20 menções por comentário.', 'mais de 20 menções é recusado');
select lives_ok($$update public.task_comments set body = 'texto novo' where id = (select id from public.task_comments where body = 'oi @ver')$$,
  'editar o texto não revalida menções');
select lives_ok($$insert into public.task_dependencies (task_id, depends_on) values
  ('fd000000-0000-4000-8000-0000000000d5', 'fd000000-0000-4000-8000-0000000000d6')$$, 'dependência criada com o cartão já fora da primeira coluna');
select throws_ok($$update public.producer_tasks set column_id = (select c.id from public.task_columns c where c.board_id = producer_tasks.board_id and c.name = 'Em revisão')
  where id = 'fd000000-0000-4000-8000-0000000000d5'$$, '23514', 'Este cartão depende de outro que ainda não foi concluído.',
  'F (já em andamento) não avança para outra coluna doing enquanto G está aberta');
select lives_ok($$update public.producer_tasks set status = 'todo' where id = 'fd000000-0000-4000-8000-0000000000d5'$$, 'destino do tipo todo é sempre livre');
select lives_ok($$update public.producer_tasks set archived_at = now() where id = 'fd000000-0000-4000-8000-0000000000d6'$$, 'G arquivada');
select lives_ok($$update public.producer_tasks set status = 'in_progress' where id = 'fd000000-0000-4000-8000-0000000000d5'$$,
  'dependência de cartão arquivado não bloqueia');
-- apagar evento com dependência aberta
select pg_temp.como('postgres');
insert into public.events (id, producer_id, title, slug, status, approval_status) values
  ('fd000000-0000-4000-8000-0000000000e5', 'fd000000-0000-4000-8000-000000000001', 'Evento', 'f2a-e5', 'draft', 'pending');
insert into public.producer_tasks (id, producer_id, event_id, title, status) values
  ('fd000000-0000-4000-8000-0000000000d7', 'fd000000-0000-4000-8000-000000000001', 'fd000000-0000-4000-8000-0000000000e5', 'E1', 'in_progress'),
  ('fd000000-0000-4000-8000-0000000000d8', 'fd000000-0000-4000-8000-000000000001', 'fd000000-0000-4000-8000-0000000000e5', 'E2', 'todo');
insert into public.task_dependencies (task_id, depends_on) values
  ('fd000000-0000-4000-8000-0000000000d7', 'fd000000-0000-4000-8000-0000000000d8');
insert into public.task_comments (task_id, user_id, body) values
  ('fd000000-0000-4000-8000-0000000000d7', 'fd000000-0000-4000-8000-0000000000a3', 'no evento');
select is((select count(*) from public.task_activity where task_id = 'fd000000-0000-4000-8000-0000000000d7' and kind in ('criado', 'comentario')),
  2::bigint, 'cartão do evento tem criado e comentario no histórico');
select lives_ok($$delete from public.events where id = 'fd000000-0000-4000-8000-0000000000e5'$$, 'apagar evento com dependência aberta funciona');
select is((select count(*) from public.task_activity a join public.task_boards b on b.id = a.board_id
           where a.task_id = 'fd000000-0000-4000-8000-0000000000d7' and a.kind in ('criado', 'comentario') and b.event_id is null),
  2::bigint, 'apagar o evento: o histórico do cartão sobrevivente passa para o quadro da produtora');
select is((select count(*) from public.producer_tasks where id in ('fd000000-0000-4000-8000-0000000000d7', 'fd000000-0000-4000-8000-0000000000d8')
           and event_id is null), 2::bigint, 'as tarefas do evento voltaram ao quadro da produtora');
-- histórico: nada é descartado por tempo; só 'movido' é podado (500 por cartão)
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-0000000000a3');
select lives_ok($$insert into public.task_comments (task_id, body) values ('fd000000-0000-4000-8000-0000000000d2', 'c1')$$, 'primeiro comentário em B');
select lives_ok($$insert into public.task_comments (task_id, body) values ('fd000000-0000-4000-8000-0000000000d2', 'c2')$$, 'segundo comentário em B');
select is((select count(*) from public.task_activity where task_id = 'fd000000-0000-4000-8000-0000000000d2' and kind = 'comentario'), 2::bigint,
  'dois comentários seguidos: 2 linhas no histórico');
select lives_ok($$update public.producer_tasks set archived_at = null where id = 'fd000000-0000-4000-8000-0000000000d6'$$, 'G desarquivada');
select ok(exists (select 1 from public.task_activity where task_id = 'fd000000-0000-4000-8000-0000000000d6' and kind = 'desarquivado'),
  'desarquivar fica no histórico');
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000001');
select lives_ok($$delete from public.task_comments where task_id = 'fd000000-0000-4000-8000-0000000000d2' and body = 'c1'$$, 'dono apaga o comentário c1');
select is((select actor from public.task_activity where task_id = 'fd000000-0000-4000-8000-0000000000d2' and kind = 'comentario_apagado'),
  'fd000000-0000-4000-8000-000000000001'::uuid, 'comentario_apagado registra o ator (quem apagou)');
select pg_temp.como('postgres');
select public.task_log((select board_id from public.producer_tasks where id = 'fd000000-0000-4000-8000-0000000000d8'), 'fd000000-0000-4000-8000-0000000000d8', 'movido');
create temp table _mv as select count(*) as n from public.task_activity where task_id = 'fd000000-0000-4000-8000-0000000000d8' and kind = 'movido';
select public.task_log((select board_id from public.producer_tasks where id = 'fd000000-0000-4000-8000-0000000000d8'), 'fd000000-0000-4000-8000-0000000000d8', 'movido');
select public.task_log((select board_id from public.producer_tasks where id = 'fd000000-0000-4000-8000-0000000000d8'), 'fd000000-0000-4000-8000-0000000000d8', 'movido');
select is((select count(*) from public.task_activity where task_id = 'fd000000-0000-4000-8000-0000000000d8' and kind = 'movido'), (select n + 2 from _mv),
  'dois movimentos seguidos: 2 linhas a mais');
insert into public.task_activity (board_id, task_id, kind, created_at)
  select (select board_id from public.producer_tasks where id = 'fd000000-0000-4000-8000-0000000000d3'),
         'fd000000-0000-4000-8000-0000000000d3', 'movido', now() - interval '1 hour' - (i || ' seconds')::interval from generate_series(1, 600) i;
select public.task_log((select board_id from public.producer_tasks where id = 'fd000000-0000-4000-8000-0000000000d3'),
  'fd000000-0000-4000-8000-0000000000d3', 'movido');
select is((select count(*) from public.task_activity where task_id = 'fd000000-0000-4000-8000-0000000000d3' and kind = 'movido' and actor is null), 500::bigint,
  'movido é podado em 500 por autor e cartão');
select is((select count(*) from public.task_activity where task_id = 'fd000000-0000-4000-8000-0000000000d3' and kind = 'criado'), 1::bigint,
  '''criado'' sobrevive a 600 movimentos');
-- poda só dos movimentos do próprio autor: o membro move 506 vezes; os 3 do dono continuam
select pg_temp.como('postgres');
insert into public.task_activity (board_id, task_id, actor, kind)
  select (select board_id from public.producer_tasks where id = 'fd000000-0000-4000-8000-0000000000d6'), 'fd000000-0000-4000-8000-0000000000d6',
         'fd000000-0000-4000-8000-000000000001', 'movido' from generate_series(1, 3);
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-0000000000a3');
do $m$ begin
  for i in 1..506 loop
    update public.producer_tasks set status = case when i % 2 = 0 then 'todo' else 'in_progress' end where id = 'fd000000-0000-4000-8000-0000000000d6';
  end loop;
end $m$;
select pg_temp.como('postgres');
select is((select count(*) from public.task_activity where task_id = 'fd000000-0000-4000-8000-0000000000d6' and kind = 'movido'
           and actor = 'fd000000-0000-4000-8000-0000000000a3'), 500::bigint, 'a poda limita o membro a 500 movimentos dele');
select is((select count(*) from public.task_activity where task_id = 'fd000000-0000-4000-8000-0000000000d6' and kind = 'movido'
           and actor = 'fd000000-0000-4000-8000-000000000001'), 3::bigint, 'a poda do membro não apaga os movimentos do dono');
-- conta sem vínculo (x): a MESMA mensagem 42501 venha o cartão/etiqueta/caminho existir, não existir ou ser de outro quadro
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-0000000000b1');
select throws_ok($$insert into public.task_dependencies (task_id, depends_on) values ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-0000000000d3')$$,
  '42501', 'new row violates row-level security policy for table "task_dependencies"', 'sem vínculo: dependência com cartão existente');
select throws_ok($$insert into public.task_dependencies (task_id, depends_on) values ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-0000000000ff')$$,
  '42501', 'new row violates row-level security policy for table "task_dependencies"', 'sem vínculo: dependência com cartão inexistente');
select throws_ok($$insert into public.task_dependencies (task_id, depends_on) values ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-0000000000d9')$$,
  '42501', 'new row violates row-level security policy for table "task_dependencies"', 'sem vínculo: dependência com cartão de outro quadro');
select throws_ok($$insert into public.task_card_labels (task_id, label_id) values ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-0000000000e1')$$,
  '42501', 'new row violates row-level security policy for table "task_card_labels"', 'sem vínculo: etiqueta existente do quadro');
select throws_ok($$insert into public.task_card_labels (task_id, label_id) values ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-0000000000ff')$$,
  '42501', 'new row violates row-level security policy for table "task_card_labels"', 'sem vínculo: etiqueta inexistente');
select throws_ok($$insert into public.task_card_labels (task_id, label_id) values ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-0000000000e9')$$,
  '42501', 'new row violates row-level security policy for table "task_card_labels"', 'sem vínculo: etiqueta de outro quadro');
select throws_ok($$insert into public.task_attachments (task_id, storage_path, name, mime, size_bytes, created_by) values
  ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-000000000001/fd000000-0000-4000-8000-0000000000d1/fd000000-0000-4000-8000-0000000000aa-a.png', 'a.png', 'image/png', 1, 'fd000000-0000-4000-8000-0000000000b1')$$,
  '42501', 'new row violates row-level security policy for table "task_attachments"', 'sem vínculo: anexo com caminho válido');
select throws_ok($$insert into public.task_attachments (task_id, storage_path, name, mime, size_bytes, created_by) values
  ('fd000000-0000-4000-8000-0000000000d1', 'fd000000-0000-4000-8000-000000000001/fd000000-0000-4000-8000-0000000000ff/fd000000-0000-4000-8000-0000000000aa-a.png', 'a.png', 'image/png', 1, 'fd000000-0000-4000-8000-0000000000b1')$$,
  '42501', 'new row violates row-level security policy for table "task_attachments"', 'sem vínculo: anexo com cartão inexistente no caminho');
select throws_ok($$insert into public.task_attachments (task_id, storage_path, name, mime, size_bytes, created_by) values
  ('fd000000-0000-4000-8000-0000000000d1', 'lixo', 'a.png', 'image/png', 1, 'fd000000-0000-4000-8000-0000000000b1')$$,
  '42501', 'new row violates row-level security policy for table "task_attachments"', 'sem vínculo: anexo com caminho inválido');
select is(public.task_anexo_produtor('fd000000-0000-4000-8000-000000000001/fd000000-0000-4000-8000-0000000000d1/fd000000-0000-4000-8000-0000000000aa-a.png'),
  null::uuid, 'task_anexo_produtor não revela o produtor a quem não tem acesso');
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000001');
-- apagar o cartão leva comentários e histórico junto, sem erro do gatilho de comentário apagado
select pg_temp.como('authenticated', 'fd000000-0000-4000-8000-000000000001');
select lives_ok($$delete from public.producer_tasks where id = 'fd000000-0000-4000-8000-0000000000d2'$$, 'apagar cartão com comentários funciona');

select * from finish();
rollback;
