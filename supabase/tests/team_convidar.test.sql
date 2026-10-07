-- pgTAP de docs/sql/20261029_equipe_convidar.sql. Banco com o baseline + docs/sql até este arquivo; `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(46);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal2') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', case when p_role = 'postgres' then 'none' else p_role end, true);
end $f$;
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- 01 produtor (com fator), 02 participante, 03 colaborador da Evokaa (admin), 04 participante,
-- 05 outro produtor, 06..10 participantes, 11 produtor para o limite de tentativas
insert into auth.users (id, email, raw_user_meta_data)
select ('f3000000-0000-4000-8000-0000000000' || n)::uuid, 'u' || n || '@teste-convidar.local', '{}'
from unnest(array['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11']) n;
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values ('f3000000-0000-4000-9000-000000000001', 'f3000000-0000-4000-8000-000000000001', 'teste', 'totp', 'verified', now(), now());
update public.profiles set role = 'producer' where id in ('f3000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000005', 'f3000000-0000-4000-8000-000000000011');
update public.profiles set role = 'admin', admin_permissions = array['manage_users']::text[] where id = 'f3000000-0000-4000-8000-000000000003';

select ok(not has_function_privilege('anon', 'public.team_convidar(text, text)', 'execute'), 'anon não executa');
select is(pg_get_function_result('public.team_convidar(text, text)'::regprocedure), 'jsonb', 'devolve jsonb (sem uuid)');
select ok(not has_table_privilege('authenticated', 'public.team_convite_tentativas', 'select')
       and not has_table_privilege('authenticated', 'public.team_convite_tentativas', 'insert')
       and not has_table_privilege('anon', 'public.team_convite_tentativas', 'select'), 'tentativas: sem acesso pela API');
select is((select count(*)::int from pg_policies where tablename = 'team_members' and policyname = 'team_members_dono_insert'), 0, 'regra de insert direto removida');
select ok(not has_table_privilege('authenticated', 'public.team_members', 'insert'), 'authenticated sem insert em team_members');

select pg_temp.como('authenticated', 'f3000000-0000-4000-8000-000000000001');
select is(public.team_convidar('  U02@Teste-Convidar.local ', 'editor'), '{"ok": true}'::jsonb, 'produtor convida participante (maiúscula e espaço)');
select throws_ok($$insert into public.team_members (producer_id, user_id, role) values ('f3000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000003', 'admin')$$,
  '42501', null, 'insert direto falha');
select pg_temp.como('postgres');
select is((select row(producer_id, role, accepted_at is null, blocked_at is null)::text from public.team_members where user_id = 'f3000000-0000-4000-8000-000000000002'),
  '(f3000000-0000-4000-8000-000000000001,editor,t,t)', 'vínculo do próprio produtor, pendente e não bloqueado');

select pg_temp.como('authenticated', 'f3000000-0000-4000-8000-000000000001');
select is(public.team_convidar('u02@teste-convidar.local', 'viewer'), '{"ok": false, "motivo": "duplicado"}'::jsonb, 'duplicado');
select is(public.team_convidar('u01@teste-convidar.local', 'editor'), '{"ok": false, "motivo": "generico"}'::jsonb, 'a si mesmo: genérico');
select is(public.team_convidar('u03@teste-convidar.local', 'editor'), '{"ok": false, "motivo": "generico"}'::jsonb, 'admin: genérico');
select is(public.team_convidar('ninguem@teste-convidar.local', 'editor'), '{"ok": false, "motivo": "generico"}'::jsonb, 'inexistente: genérico');
select throws_ok($$select public.team_convidar('u04@teste-convidar.local', 'dono')$$, '22023', null, 'cargo fora da lista');
select is(public.team_convidar('u04@teste-convidar.local', 'viewer'), '{"ok": true}'::jsonb, 'cargo viewer');
select is(public.team_convidar('u05@teste-convidar.local', 'admin'), '{"ok": true}'::jsonb, 'cargo admin (outro produtor pode ser membro)');

select pg_temp.como('postgres');
update public.team_members set blocked_at = now() where user_id = 'f3000000-0000-4000-8000-000000000004';
select pg_temp.como('authenticated', 'f3000000-0000-4000-8000-000000000001');
select is(public.team_convidar('u04@teste-convidar.local', 'editor'), '{"ok": false, "motivo": "bloqueado"}'::jsonb, 'bloqueado');

-- limite de 5 não bloqueados (02, 05 + 06, 07, 08)
select is(public.team_convidar('u06@teste-convidar.local', 'editor') || public.team_convidar('u07@teste-convidar.local', 'editor')
  || public.team_convidar('u08@teste-convidar.local', 'editor'), '{"ok": true}'::jsonb, 'até 5 vínculos');
select is(public.team_convidar('u09@teste-convidar.local', 'editor'), '{"ok": false, "motivo": "limite_equipe"}'::jsonb, 'limite de 5');
select pg_temp.como('postgres');
select is((select count(*)::int from public.team_convite_tentativas where producer_id = 'f3000000-0000-4000-8000-000000000001'), 12,
  'toda chamada que passa das guardas conta (sucesso e falha: 12)');

-- quem não pode (erro, não conta tentativa)
select pg_temp.como('authenticated', 'f3000000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($$select public.team_convidar('u10@teste-convidar.local', 'editor')$$, '42501', null, 'produtor com fator em aal1 recusado');
select pg_temp.como('authenticated', 'f3000000-0000-4000-8000-000000000002');
select throws_ok($$select public.team_convidar('u10@teste-convidar.local', 'editor')$$, '42501', null, 'participante recusado');
select pg_temp.como('authenticated', 'f3000000-0000-4000-8000-000000000003', 'aal2');
select throws_ok($$select public.team_convidar('u10@teste-convidar.local', 'editor')$$, '42501', null, 'admin da plataforma recusado');

-- outro produtor convida o mesmo e-mail: o vínculo é dele
select pg_temp.como('authenticated', 'f3000000-0000-4000-8000-000000000005');
select is(public.team_convidar('u02@teste-convidar.local', 'editor'), '{"ok": true}'::jsonb, 'outro produtor convida para a equipe dele');
select pg_temp.como('postgres');
select is((select count(*)::int from public.team_members where user_id = 'f3000000-0000-4000-8000-000000000002'), 2, 'dois vínculos, um por produtor');
select is((select count(*)::int from public.team_members where producer_id = 'f3000000-0000-4000-8000-000000000005'), 1, 'producer_id é sempre o de quem chama');

-- e-mail repetido em profiles: vale a conta mais antiga
update public.profiles set email = 'dup@teste-convidar.local', created_at = now() - interval '1 day' where id = 'f3000000-0000-4000-8000-000000000010';
update public.profiles set email = 'DUP@teste-convidar.local', created_at = now() where id = 'f3000000-0000-4000-8000-000000000009';
select pg_temp.como('authenticated', 'f3000000-0000-4000-8000-000000000005');
select is(public.team_convidar('dup@teste-convidar.local', 'viewer'), '{"ok": true}'::jsonb, 'convite com e-mail repetido');
select pg_temp.como('postgres');
select is((select user_id from public.team_members where producer_id = 'f3000000-0000-4000-8000-000000000005' and role = 'viewer'),
  'f3000000-0000-4000-8000-000000000010'::uuid, 'e-mail repetido: a conta mais antiga');

-- limite de tentativas: 20 na última hora (sucesso e falha contam); a 21ª é recusada; linha de mais de 1 dia some
insert into public.team_convite_tentativas (producer_id, em) values ('f3000000-0000-4000-8000-000000000011', now() - interval '2 days');
insert into public.team_convite_tentativas (producer_id, em) select 'f3000000-0000-4000-8000-000000000011', now() - interval '2 hours' from generate_series(1, 30);
select pg_temp.como('authenticated', 'f3000000-0000-4000-8000-000000000011');
select is(public.team_convidar('u06@teste-convidar.local', 'editor'), '{"ok": true}'::jsonb, '1ª (as de 2 horas atrás não contam)');
select is((select count(*)::int from generate_series(1, 18) g where public.team_convidar('ninguem' || g || '@teste-convidar.local', 'editor') = '{"ok": false, "motivo": "generico"}'::jsonb), 18, '2ª a 19ª (falhas)');
select is(public.team_convidar('u06@teste-convidar.local', 'editor'), '{"ok": false, "motivo": "duplicado"}'::jsonb, '20ª ainda responde');
select is(public.team_convidar('u07@teste-convidar.local', 'editor'), '{"ok": false, "motivo": "limite"}'::jsonb, '21ª recusada por limite');
select is(public.team_convidar('u07@teste-convidar.local', 'editor'), '{"ok": false, "motivo": "limite"}'::jsonb, 'continua recusada');
select pg_temp.como('postgres');
select is((select count(*)::int from public.team_convite_tentativas where producer_id = 'f3000000-0000-4000-8000-000000000011' and em < now() - interval '1 day'), 0, 'tentativa de mais de 1 dia apagada');
select is((select count(*)::int from public.team_members where producer_id = 'f3000000-0000-4000-8000-000000000011'), 1, 'só o 1º convite gravou vínculo');
select pg_temp.como('authenticated', 'f3000000-0000-4000-8000-000000000001');
select is(public.team_convidar('u11@teste-convidar.local', 'editor'), '{"ok": false, "motivo": "limite_equipe"}'::jsonb, 'o limite de tentativas é por produtor');
-- equipe cheia: a resposta é a mesma exista ou não o e-mail (sem oráculo)
select is(public.team_convidar('ninguem-cheia@teste-convidar.local', 'editor'), '{"ok": false, "motivo": "limite_equipe"}'::jsonb, 'equipe cheia: inexistente dá limite_equipe');
select is(public.team_convidar('u03@teste-convidar.local', 'editor'), '{"ok": false, "motivo": "limite_equipe"}'::jsonb, 'equipe cheia: admin dá limite_equipe');
select is(public.team_convidar('u09@teste-convidar.local', 'editor'), '{"ok": false, "motivo": "limite_equipe"}'::jsonb, 'equipe cheia: conta existente dá limite_equipe');

-- team_lista
select ok(not has_function_privilege('anon', 'public.team_lista()', 'execute'), 'anon não executa team_lista');
select is(pg_get_function_result('public.team_lista()'::regprocedure),
  'TABLE(id uuid, user_id uuid, role text, invited_at timestamp with time zone, accepted_at timestamp with time zone, blocked_at timestamp with time zone, full_name text, email text)',
  'team_lista devolve exatamente as 8 colunas');
select pg_temp.como('postgres');
update public.profiles set full_name = 'Ana Teste' where id = 'f3000000-0000-4000-8000-000000000002';
select pg_temp.como('authenticated', 'f3000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.team_lista()), 6, 'produtor vê a própria equipe (02, 04, 05, 06, 07, 08)');
select is((select full_name || '/' || email from public.team_lista() where user_id = 'f3000000-0000-4000-8000-000000000002'), 'Ana Teste/u02@teste-convidar.local', 'nome e e-mail do membro');
select is((select full_name from public.team_lista() where user_id = 'f3000000-0000-4000-8000-000000000006'), 'Convidado', 'sem nome: Convidado');
select pg_temp.como('authenticated', 'f3000000-0000-4000-8000-000000000005');
select is((select array_agg(user_id::text order by user_id) from public.team_lista()),
  array['f3000000-0000-4000-8000-000000000002', 'f3000000-0000-4000-8000-000000000010'], 'outro produtor vê só a equipe dele');
select pg_temp.como('authenticated', 'f3000000-0000-4000-8000-000000000002');
select throws_ok($$select * from public.team_lista()$$, '42501', null, 'participante recusado na lista');
select pg_temp.como('authenticated', 'f3000000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($$select * from public.team_lista()$$, '42501', null, 'produtor com fator em aal1 recusado na lista');

select * from finish();
rollback;
