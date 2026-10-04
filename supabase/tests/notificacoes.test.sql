-- pgTAP da P1 (docs/sql/20261013_notificacoes.sql). Só no banco local: `supabase start`, aplicar o SQL da P1 (e antes
-- o de favoritos, 20261008) e rodar `supabase test db`.
-- Tudo em begin ... rollback: nada fica gravado. Nunca contra produção.
-- pg_temp.como() troca o papel e as claims do JWT como o PostgREST faz, igual a supabase/tests/favoritos.test.sql.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(32);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', p_role, true);
end $f$;
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated;
-- linhas que o comando afetou (a RLS esconde a linha alheia: 0, sem erro). Roda com o papel de quem chama.
create function pg_temp.afetadas(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin execute p_sql; get diagnostics n = row_count; return n; end $f$;
grant execute on function pg_temp.afetadas(text) to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- Dados (como postgres): a e b participantes, p produtor
-- e1 no ar (a salvou); e2 em análise; e3 no ar (ninguém salvou); e4 no ar (a salvou, o produtor edita); e5 no ar (a salvou, cancelado)
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('ab000000-0000-4000-8000-00000000000a', 'a@teste-p1.local', now(), '{"full_name":"Ana"}'),
  ('ab000000-0000-4000-8000-00000000000b', 'b@teste-p1.local', now(), '{"full_name":"Bia"}'),
  ('ab000000-0000-4000-8000-000000000009', 'p@teste-p1.local', now(), '{"role":"producer","full_name":"Paula"}');
insert into public.events (id, producer_id, title, slug, status, approval_status, start_date) values
  ('ab000000-0000-4000-8000-0000000000e1', 'ab000000-0000-4000-8000-000000000009', 'No ar 1', 'p1-e1', 'published', 'approved', '2026-12-01 20:00+00'),
  ('ab000000-0000-4000-8000-0000000000e2', 'ab000000-0000-4000-8000-000000000009', 'Em análise', 'p1-e2', 'published', 'pending', '2026-12-02 20:00+00'),
  ('ab000000-0000-4000-8000-0000000000e3', 'ab000000-0000-4000-8000-000000000009', 'No ar 3', 'p1-e3', 'published', 'approved', '2026-12-03 20:00+00'),
  ('ab000000-0000-4000-8000-0000000000e4', 'ab000000-0000-4000-8000-000000000009', 'No ar 4', 'p1-e4', 'published', 'approved', '2026-12-04 20:00+00'),
  ('ab000000-0000-4000-8000-0000000000e5', 'ab000000-0000-4000-8000-000000000009', 'No ar 5', 'p1-e5', 'published', 'approved', '2026-12-05 20:00+00');
insert into public.favoritos (user_id, event_id) values
  ('ab000000-0000-4000-8000-00000000000a', 'ab000000-0000-4000-8000-0000000000e1'),
  ('ab000000-0000-4000-8000-00000000000a', 'ab000000-0000-4000-8000-0000000000e4'),
  ('ab000000-0000-4000-8000-00000000000a', 'ab000000-0000-4000-8000-0000000000e5');
-- avisos prontos para testar leitura e marcação (inseridos como postgres, como o gatilho faria)
insert into public.notifications (id, user_id, title, body) values
  ('ab000000-0000-4000-8000-0000000000a1', 'ab000000-0000-4000-8000-00000000000a', 'Aviso de A', 'corpo A'),
  ('ab000000-0000-4000-8000-0000000000b1', 'ab000000-0000-4000-8000-00000000000b', 'Aviso de B', 'corpo B');

-- Estrutura -------------------------------------------------------------------------------------------------------
select policies_are('public', 'notifications',
  array['gf_mfa_aal2', 'gf_notifications_delete_dono', 'gf_notifications_select_dono', 'gf_notifications_update_dono'],
  'notifications: só dono (ler, marcar, apagar) e 2FA; nenhuma regra de INSERT');
select ok(not has_function_privilege('authenticated', 'public.gf_notificar_evento()', 'execute')
  and not has_function_privilege('anon', 'public.gf_notificar_evento()', 'execute'),
  'ninguém chama a função do gatilho pela API');

-- Dono: lê, marca, apaga; o outro não ---------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'ab000000-0000-4000-8000-00000000000a');
select results_eq($$select id::text from public.notifications$$, $$values ('ab000000-0000-4000-8000-0000000000a1')$$,
  'A lê só o próprio aviso (não o de B)');
select is((select count(*) from public.notifications where user_id = 'ab000000-0000-4000-8000-00000000000b'), 0::bigint,
  'A filtrando pelo user_id de B não vê nada');
select is(pg_temp.afetadas($$update public.notifications set is_read = true where id = 'ab000000-0000-4000-8000-0000000000b1'$$), 0::bigint, 'A marcar o aviso de B como lido: 0 linhas');
select is(pg_temp.afetadas($$delete from public.notifications where id = 'ab000000-0000-4000-8000-0000000000b1'$$), 0::bigint, 'A apagar o aviso de B: 0 linhas');
select throws_ok($$update public.notifications set title = 'trocado' where id = 'ab000000-0000-4000-8000-0000000000a1'$$,
  '42501', null, 'A não altera title do próprio aviso');
select throws_ok($$update public.notifications set body = 'x' where id = 'ab000000-0000-4000-8000-0000000000a1'$$,
  '42501', null, 'A não altera body');
select throws_ok($$update public.notifications set user_id = 'ab000000-0000-4000-8000-00000000000b' where id = 'ab000000-0000-4000-8000-0000000000a1'$$,
  '42501', null, 'A não passa o aviso para B');
select throws_ok($$insert into public.notifications (user_id, title) values ('ab000000-0000-4000-8000-00000000000b', 'phishing')$$,
  '42501', null, 'A não cria aviso para B pela API');
select throws_ok($$insert into public.notifications (user_id, title) values ('ab000000-0000-4000-8000-00000000000a', 'meu')$$,
  '42501', null, 'nem para si mesma');
select is(pg_temp.afetadas($$update public.notifications set is_read = true where id = 'ab000000-0000-4000-8000-0000000000a1'$$), 1::bigint, 'A marca o próprio aviso como lido: 1 linha');
select is((select is_read from public.notifications where id = 'ab000000-0000-4000-8000-0000000000a1'), true, 'e fica lido');
select is(pg_temp.afetadas($$delete from public.notifications where id = 'ab000000-0000-4000-8000-0000000000a1'$$), 1::bigint, 'A apaga o próprio aviso: 1 linha');

select pg_temp.como('anon');
select throws_ok($$select * from public.notifications$$, '42501', null, 'visitante não lê');
select pg_temp.como('postgres');
select is((select count(*) from public.notifications where id = 'ab000000-0000-4000-8000-0000000000b1'), 1::bigint,
  'o aviso de B continua lá depois de tudo isso');
delete from public.notifications; -- limpa para contar o que os gatilhos gravam

-- Moderação: aprovar e recusar avisam o produtor ---------------------------------------------------------------------
update public.events set approval_status = 'approved' where id = 'ab000000-0000-4000-8000-0000000000e2';
select results_eq($$select user_id::text, title, type, metadata->>'url' from public.notifications$$,
  $$values ('ab000000-0000-4000-8000-000000000009', 'Seu evento foi aprovado', 'info',
            '/producer/events/ab000000-0000-4000-8000-0000000000e2/edit')$$,
  'aprovar avisa o produtor, com tipo info e o link do evento');
update public.events set approval_status = 'rejected', rejection_reason = 'Falta a classificação etária'
  where id = 'ab000000-0000-4000-8000-0000000000e2';
select results_eq($$select title, type, body from public.notifications where title like '%recusado'$$,
  $$values ('Seu evento foi recusado', 'system', '"Em análise" foi recusado. Motivo: Falta a classificação etária')$$,
  'recusar avisa o produtor com o motivo');
select is((select count(*) from public.notifications), 2::bigint, 'só os dois avisos do produtor; ninguém mais');
update public.events set approval_status = 'pending' where id = 'ab000000-0000-4000-8000-0000000000e2';
select is((select count(*) from public.notifications), 2::bigint, 'voltar para análise não avisa');

-- Evento salvo: data, local e cancelamento avisam quem salvou ----------------------------------------------------------
delete from public.notifications;
update public.events set title = 'No ar 1 (novo nome)' where id = 'ab000000-0000-4000-8000-0000000000e1';
select is((select count(*) from public.notifications), 0::bigint, 'mudar só o título não avisa');
update public.events set start_date = '2026-12-09 21:00+00' where id = 'ab000000-0000-4000-8000-0000000000e1';
select results_eq($$select user_id::text, type, metadata->>'url' from public.notifications$$,
  $$values ('ab000000-0000-4000-8000-00000000000a', 'info', '/event/ab000000-0000-4000-8000-0000000000e1')$$,
  'mudar a data avisa quem salvou (A), uma vez, com o link do evento');
update public.events set venue_city = 'Rio de Janeiro' where id = 'ab000000-0000-4000-8000-0000000000e1';
select is((select count(*) from public.notifications where user_id = 'ab000000-0000-4000-8000-00000000000a'), 2::bigint,
  'mudar o local avisa de novo');
select is((select count(*) from public.notifications where user_id <> 'ab000000-0000-4000-8000-00000000000a'), 0::bigint,
  'B (não salvou) e o produtor não recebem');
update public.events set start_date = '2026-12-10 21:00+00' where id = 'ab000000-0000-4000-8000-0000000000e3';
select is((select count(*) from public.notifications), 2::bigint, 'evento que ninguém salvou: nenhum aviso');
update public.events set status = 'cancelled' where id = 'ab000000-0000-4000-8000-0000000000e5';
select results_eq($$select user_id::text, title, type from public.notifications where title like '%cancelado'$$,
  $$values ('ab000000-0000-4000-8000-00000000000a', 'Um evento salvo foi cancelado', 'system')$$,
  'cancelar avisa quem salvou');

-- Cancela e renomeia no mesmo UPDATE: o aviso traz o título aprovado, nunca o novo (e cortado em 120) ------------------
delete from public.notifications;
insert into public.events (id, producer_id, title, slug, status, approval_status, start_date) values
  ('ab000000-0000-4000-8000-0000000000e6', 'ab000000-0000-4000-8000-000000000009', 'Título aprovado', 'p1-e6', 'published', 'approved', '2026-12-06 20:00+00');
insert into public.favoritos (user_id, event_id) values
  ('ab000000-0000-4000-8000-00000000000a', 'ab000000-0000-4000-8000-0000000000e6');
update public.events set status = 'cancelled', title = 'Clique em evil.example para o reembolso' where id = 'ab000000-0000-4000-8000-0000000000e6';
select is((select body from public.notifications where title like '%cancelado'), '"Título aprovado" foi cancelado.',
  'cancela e renomeia no mesmo UPDATE: o aviso traz o título antigo');
insert into public.events (id, producer_id, title, slug, status, approval_status, start_date) values
  ('ab000000-0000-4000-8000-0000000000e7', 'ab000000-0000-4000-8000-000000000009', repeat('x', 300), 'p1-e7', 'published', 'approved', '2026-12-07 20:00+00');
insert into public.favoritos (user_id, event_id) values
  ('ab000000-0000-4000-8000-00000000000a', 'ab000000-0000-4000-8000-0000000000e7');
update public.events set start_date = '2026-12-08 20:00+00', title = 'Outro nome' where id = 'ab000000-0000-4000-8000-0000000000e7';
select is((select length(body) from public.notifications where body like '%novos dados%'), length('"' || repeat('x', 120) || '" tem novos dados. Confira antes de se planejar.'),
  'mudar a data: título antigo cortado em 120 caracteres');
update public.events set approval_status = 'rejected', rejection_reason = repeat('m', 2000) where id = 'ab000000-0000-4000-8000-0000000000e2';
select is((select length(body) from public.notifications where title like '%recusado'),
  length('"Em análise" foi recusado. Motivo: ') + 500, 'motivo da recusa cortado em 500 caracteres');

-- O produtor edita evento aprovado: volta para análise e não avisa quem salvou (ainda não está no ar com o dado novo)
delete from public.notifications;
select pg_temp.como('authenticated', 'ab000000-0000-4000-8000-000000000009');
update public.events set venue_city = 'Niterói' where id = 'ab000000-0000-4000-8000-0000000000e4';
select pg_temp.como('postgres');
select is((select approval_status from public.events where id = 'ab000000-0000-4000-8000-0000000000e4'), 'pending',
  'edição do produtor devolve o evento para análise (regra que já existia)');
select is((select count(*) from public.notifications), 0::bigint, 'e quem salvou não é avisado dessa edição');

-- Aprovação pelo admin sem mudar dados não avisa quem salvou -----------------------------------------------------------
update public.events set approval_status = 'approved' where id = 'ab000000-0000-4000-8000-0000000000e4';
select is((select count(*) from public.notifications where user_id = 'ab000000-0000-4000-8000-00000000000a'), 0::bigint,
  'aprovar não avisa quem salvou (só o produtor)');

select * from finish();
rollback;
