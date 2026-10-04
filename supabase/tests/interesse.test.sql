-- pgTAP da P4 (docs/sql/20261016_interesse.sql). Só em banco descartável: baseline + 20261008_favoritos + 20261013_notificacoes
-- + o SQL da P4, e rodar `supabase test db` (ou psql -f). Tudo em begin ... rollback: nada fica gravado. Nunca contra produção.
-- pg_temp.como() troca o papel e as claims do JWT como o PostgREST faz (igual a notificacoes.test.sql).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(60);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', p_role, true);
end $f$;
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated;
create function pg_temp.afetadas(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin execute p_sql; get diagnostics n = row_count; return n; end $f$;
grant execute on function pg_temp.afetadas(text) to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- Dados (como postgres): a, b, c participantes; p e q produtores. e1 (de p, no ar, venda começa daqui a 1 dia),
-- e2 (de p, em análise), e3 (de q, no ar).
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('ab000000-0000-4000-8000-00000000000a', 'Ana@teste-p4.local', now(), '{"full_name":"Ana"}'),
  ('ab000000-0000-4000-8000-00000000000b', 'b@teste-p4.local', now(), '{"full_name":"Bia"}'),
  ('ab000000-0000-4000-8000-00000000000c', 'c@teste-p4.local', now(), '{"full_name":"Caio"}'),
  ('ab000000-0000-4000-8000-00000000000d', 'd@teste-p4.local', null, '{"full_name":"Davi"}'),
  ('ab000000-0000-4000-8000-000000000009', 'p@teste-p4.local', now(), '{"role":"producer","full_name":"Paula"}'),
  ('ab000000-0000-4000-8000-000000000008', 'q@teste-p4.local', now(), '{"role":"producer","full_name":"Quico"}');
insert into public.events (id, producer_id, title, slug, status, approval_status, start_date) values
  ('ab000000-0000-4000-8000-0000000000e1', 'ab000000-0000-4000-8000-000000000009', 'Festa P4', 'p4-e1', 'published', 'approved', '2026-12-01 20:00+00'),
  ('ab000000-0000-4000-8000-0000000000e2', 'ab000000-0000-4000-8000-000000000009', 'Em análise', 'p4-e2', 'published', 'pending', '2026-12-02 20:00+00'),
  ('ab000000-0000-4000-8000-0000000000e3', 'ab000000-0000-4000-8000-000000000008', 'Do Quico', 'p4-e3', 'published', 'approved', '2026-12-03 20:00+00');
insert into public.ticket_types (id, event_id, name, price, quantity_total, sale_start) values
  ('ab000000-0000-4000-8000-0000000000f1', 'ab000000-0000-4000-8000-0000000000e1', 'Lote 1', 50, 100, now() + interval '1 day'),
  ('ab000000-0000-4000-8000-0000000000f3', 'ab000000-0000-4000-8000-0000000000e3', 'Lote Q', 50, 100, now() + interval '1 day');
update public.profiles set city = 'Curitiba' where id = 'ab000000-0000-4000-8000-00000000000a';
-- inscrição antiga, sem consentimento (como nasceria antes da P4): c em e1
insert into public.interest_lists (event_id, user_id, consentimento_em) values
  ('ab000000-0000-4000-8000-0000000000e1', 'ab000000-0000-4000-8000-00000000000c', null);

-- Estrutura -------------------------------------------------------------------------------------------------------
select policies_are('public', 'interest_lists',
  array['gf_interesse_select_dono', 'gf_mfa_aal2'],
  'interest_lists: só leitura do dono e 2FA; entrar e sair são funções');
select is((select count(*) from cron.job where jobname in ('interesse_avisar', 'interesse_email')), 2::bigint, 'os dois cron existem');
select is((select count(*) from cron.job where jobname = 'interesse_email'
           and command like '%' || (select decrypted_secret from vault.decrypted_secrets where name = 'interesse_notify_secret') || '%'), 0::bigint,
  'o segredo não está escrito no comando do cron');
select ok(not has_function_privilege('authenticated', 'public.interesse_email_due()', 'execute')
  and not has_function_privilege('authenticated', 'public.interesse_notify_secret()', 'execute')
  and not has_function_privilege('authenticated', 'public.gf_interesse_avisar()', 'execute')
  and not has_function_privilege('anon', 'public.interesse_lista(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.interesse_email_due()', 'execute'),
  'funções de fila só para service_role; lista do produtor só para authenticated');

-- Participante ------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'ab000000-0000-4000-8000-00000000000a');
select throws_ok($$insert into public.interest_lists (event_id, user_id, consentimento_versao) values ('ab000000-0000-4000-8000-0000000000e1', 'ab000000-0000-4000-8000-00000000000a', 'p4-rascunho-1')$$,
  '42501', null, 'A não insere direto na tabela (só pela função)');
select throws_ok($$select public.interesse_entrar('ab000000-0000-4000-8000-0000000000e1', null, null)$$,
  '42501', null, 'A não entra sem a versão do consentimento');
select throws_ok($$select public.interesse_entrar('ab000000-0000-4000-8000-0000000000e1', null, 'v-inventada')$$,
  '23514', null, 'versão do consentimento fora da lista fechada: recusada pelo CHECK');
select throws_ok($$select public.interesse_entrar('ab000000-0000-4000-8000-0000000000e2', null, 'p4-rascunho-1')$$,
  '42501', null, 'A não entra em evento em análise');
select throws_ok($$select public.interesse_entrar('ab000000-0000-4000-8000-0000000000e1', 'ab000000-0000-4000-8000-0000000000f3', 'p4-rascunho-1')$$,
  '42501', null, 'A não usa tipo de ingresso de outro evento');
select lives_ok($$select public.interesse_entrar('ab000000-0000-4000-8000-0000000000e1', null, 'p4-rascunho-1')$$,
  'A entra no e1 com a versão do consentimento');
select lives_ok($$select public.interesse_entrar('ab000000-0000-4000-8000-0000000000e1', null, 'p4-rascunho-1')$$,
  'entrar de novo é inofensivo (sem erro, sem segunda linha)');
select ok((select consentimento_em from public.interest_lists where user_id = 'ab000000-0000-4000-8000-00000000000a') is not null,
  'o banco gravou a data do consentimento');
select is((select count(*) from public.interest_lists), 1::bigint, 'A lê só a própria inscrição (não a de C)');
select throws_ok($$update public.interest_lists set notified = true where user_id = 'ab000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'A não altera a tabela');
select throws_ok($$delete from public.interest_lists where user_id = 'ab000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'A não apaga a própria linha (sair marca, não apaga)');
select is(public.interesse_sair('ab000000-0000-4000-8000-0000000000e1'), true, 'A sai');
select is(public.interesse_sair('ab000000-0000-4000-8000-0000000000e1'), false, 'sair de novo não muda nada');
select ok((select removido_em is not null from public.interest_lists where user_id = 'ab000000-0000-4000-8000-00000000000a'), 'a linha continua, marcada como removida');
select lives_ok($$select public.interesse_entrar('ab000000-0000-4000-8000-0000000000e1', null, 'p4-rascunho-1')$$, 'A reentra');
select is((select count(*) from public.interest_lists), 1::bigint, 'reentrar reativa a mesma linha');
select ok((select removido_em is null from public.interest_lists where user_id = 'ab000000-0000-4000-8000-00000000000a'), 'removido_em zerado');
select pg_temp.como('authenticated', 'ab000000-0000-4000-8000-00000000000b');
select is(public.interesse_sair('ab000000-0000-4000-8000-0000000000e1'), false, 'B sair do e1 (onde não está): nada');
select pg_temp.como('anon');
select throws_ok($$select * from public.interest_lists$$, '42501', null, 'visitante não lê');
select throws_ok($$select public.interesse_entrar('ab000000-0000-4000-8000-0000000000e1', null, 'p4-rascunho-1')$$,
  '42501', null, 'visitante não entra');

-- CRM ---------------------------------------------------------------------------------------------------------------
select pg_temp.como('postgres');
select results_eq($$select email, city, source, event_interest from public.crm_leads where producer_id = 'ab000000-0000-4000-8000-000000000009'$$,
  $$values ('Ana@teste-p4.local'::text, 'Curitiba'::text, 'lista_interesse'::text, 'Festa P4'::text)$$,
  'a inscrição de A virou lead no CRM de P (e a de C, sem consentimento, não)');
insert into public.crm_leads (producer_id, full_name, email) values ('ab000000-0000-4000-8000-000000000008', 'Já era lead', 'B@TESTE-p4.local');
insert into public.interest_lists (event_id, user_id, consentimento_versao) values
  ('ab000000-0000-4000-8000-0000000000e3', 'ab000000-0000-4000-8000-00000000000b', 'p4-rascunho-1'),
  ('ab000000-0000-4000-8000-0000000000e3', 'ab000000-0000-4000-8000-00000000000d', 'p4-rascunho-1');
select is((select count(*) from public.crm_leads where producer_id = 'ab000000-0000-4000-8000-000000000008'), 1::bigint,
  'lead com o mesmo e-mail (outra caixa) não duplica; conta D sem e-mail confirmado não vira lead');
select throws_ok($$insert into public.crm_leads (producer_id, full_name, email) values ('ab000000-0000-4000-8000-000000000008', 'X', 'b@teste-p4.LOCAL')$$,
  '23505', null, 'o índice único barra lead duplicado por e-mail também à mão');

-- Produtor ------------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'ab000000-0000-4000-8000-000000000009');
select is((select count(*) from public.interesse_lista()), 2::bigint, 'P vê as 2 inscrições do próprio evento (A e C)');
select results_eq($$select full_name, email, city, consentiu from public.interesse_lista() where consentiu$$,
  $$values ('Ana'::text, 'Ana@teste-p4.local'::text, 'Curitiba'::text, true)$$, 'nome, e-mail e cidade de quem consentiu');
select results_eq($$select full_name, email, city from public.interesse_lista() where not consentiu$$,
  $$values (null::text, null::text, null::text)$$, 'quem não consentiu aparece sem nome, e-mail nem cidade');
select is((select count(*) from public.interesse_lista('ab000000-0000-4000-8000-0000000000e3')), 0::bigint, 'P não vê a lista do evento de Q');
select is((select count(*) from public.interest_lists), 0::bigint, 'P não lê a tabela direto');
select is(public.interesse_remover((select id from public.interesse_lista() where consentiu)), true, 'P remove a inscrição de A');
select is((select count(*) from public.interesse_lista()), 1::bigint, 'sobra a inscrição antiga de C');
select pg_temp.como('postgres');
select is((select count(*) from public.crm_leads where producer_id = 'ab000000-0000-4000-8000-000000000009'), 1::bigint,
  'remover da lista não apaga o lead do CRM');
select pg_temp.como('authenticated', 'ab000000-0000-4000-8000-000000000008');
select is(public.interesse_remover((select i.id from public.interest_lists i where i.event_id = 'ab000000-0000-4000-8000-0000000000e1' limit 1)), false,
  'Q (sem ver nada) não remove inscrição do evento de P');
select pg_temp.como('postgres');
select is((select count(*) from public.interest_lists where event_id = 'ab000000-0000-4000-8000-0000000000e1'), 1::bigint, 'a inscrição de C continua');
-- 2FA: produtor com fator verificado e token aal1 não lê nada
insert into auth.mfa_factors (user_id, status) values ('ab000000-0000-4000-8000-000000000009', 'verified');
select pg_temp.como('authenticated', 'ab000000-0000-4000-8000-000000000009', 'aal1');
select is((select count(*) from public.interesse_lista()), 0::bigint, 'P com 2FA e token aal1 não lê a lista');
select pg_temp.como('authenticated', 'ab000000-0000-4000-8000-000000000009', 'aal2');
select is((select count(*) from public.interesse_lista()), 1::bigint, 'com aal2 lê');
select pg_temp.como('postgres');
delete from auth.mfa_factors;

-- Cron: aviso -------------------------------------------------------------------------------------------------------
insert into public.interest_lists (id, event_id, user_id, ticket_type_id, consentimento_versao) values
  ('ab000000-0000-4000-8000-0000000000a1', 'ab000000-0000-4000-8000-0000000000e1', 'ab000000-0000-4000-8000-00000000000a', 'ab000000-0000-4000-8000-0000000000f1', 'p4-rascunho-1');
select is(public.gf_interesse_avisar(), 0::int, 'venda ainda não abriu: ninguém é avisado');
update public.ticket_types set sale_start = now() - interval '1 minute' where id = 'ab000000-0000-4000-8000-0000000000f1';
select is(public.gf_interesse_avisar(), 1::int, 'venda abriu: A é avisada (C, sem consentimento, não)');
select results_eq($$select type, metadata ->> 'url' from public.notifications where user_id = 'ab000000-0000-4000-8000-00000000000a'$$,
  $$values ('sale'::text, '/event/ab000000-0000-4000-8000-0000000000e1'::text)$$, 'o aviso do sino leva à página do evento');
select ok((select notified and notified_at is not null from public.interest_lists where id = 'ab000000-0000-4000-8000-0000000000a1'), 'notified marcado');
select is(public.gf_interesse_avisar(), 0::int, 'não avisa duas vezes');

-- Cron: fila do e-mail ------------------------------------------------------------------------------------------------
select results_eq($$select email, nome, evento from public.interesse_email_due()$$,
  $$values ('Ana@teste-p4.local'::text, 'Ana'::text, 'Festa P4'::text)$$, 'a fila traz A, com o e-mail do login');
select is((select count(*) from public.interesse_email_due()), 0::bigint, 'reservada por 2 min: a segunda chamada vem vazia');
select is(public.interesse_email_mark(array['ab000000-0000-4000-8000-0000000000a1']::uuid[], false), 1, 'falha marcada');
select is((select email_falhas from public.interest_lists where id = 'ab000000-0000-4000-8000-0000000000a1'), 1, 'soma 1 falha');
select is(public.interesse_email_mark(array['ab000000-0000-4000-8000-0000000000a1']::uuid[], true), 1, 'sucesso marcado');
select is((select count(*) from public.interesse_email_due()), 0::bigint, 'enviado: sai da fila');

-- Sair e reentrar depois do aviso não gera segundo aviso nem segundo e-mail --------------------------------------------
select pg_temp.como('authenticated', 'ab000000-0000-4000-8000-00000000000a');
select is(public.interesse_sair('ab000000-0000-4000-8000-0000000000e1'), true, 'A sai depois de avisada');
select lives_ok($$select public.interesse_entrar('ab000000-0000-4000-8000-0000000000e1', null, 'p4-rascunho-1')$$, 'A reentra');
select pg_temp.como('postgres');
select ok((select notified and email_enviado_em is not null from public.interest_lists where id = 'ab000000-0000-4000-8000-0000000000a1'),
  'reentrar não zera notified nem email_enviado_em');
select is(public.gf_interesse_avisar(), 0::int, 'sair e reentrar: nenhum segundo aviso');
select is((select count(*) from public.notifications where user_id = 'ab000000-0000-4000-8000-00000000000a'), 1::bigint, 'A tem um aviso só');
select is((select count(*) from public.interesse_email_due()), 0::bigint, 'e nenhum segundo e-mail na fila');

-- Conta sem e-mail confirmado: o sino sai, e-mail e lead não -------------------------------------------------------------
update public.ticket_types set sale_start = now() - interval '1 minute' where id = 'ab000000-0000-4000-8000-0000000000f3';
select is(public.gf_interesse_avisar(), 2::int, 'e3 abriu: B e D avisados no sino');
select is((select count(*) from public.interesse_email_due() where email = 'b@teste-p4.local'), 1::bigint, 'e-mail só para B (confirmada)');
select is((select count(*) from public.interest_lists where user_id = 'ab000000-0000-4000-8000-00000000000d' and notified), 1::bigint, 'D foi marcada como avisada');
select is((select count(*) from public.interesse_email_due() where email = 'd@teste-p4.local'), 0::bigint, 'D (sem e-mail confirmado) não entra na fila de e-mail');

select * from finish();
rollback;
