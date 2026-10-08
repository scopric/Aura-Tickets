-- pgTAP de docs/sql/20261030c_equipe_convite_email.sql (2FA em team_convidar + reserva do e-mail do convite).
-- Banco com o baseline + docs/sql até este arquivo; `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(40);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal2') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', case when p_role = 'postgres' then 'none' else p_role end, true);
end $f$;
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated, service_role;
grant execute on all functions in schema extensions to anon, authenticated;

-- 01 produtor com fator, 02 produtor SEM fator, 03 a 07 e 09 participantes, 08 outro produtor com fator
insert into auth.users (id, email, raw_user_meta_data)
select ('f4000000-0000-4000-8000-0000000000' || n)::uuid, 'u' || n || '@teste-convite-email.local', '{}'
from unnest(array['01', '02', '03', '04', '05', '06', '07', '08', '09']) n;
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at) values
  ('f4000000-0000-4000-9000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'teste', 'totp', 'verified', now(), now()),
  ('f4000000-0000-4000-9000-000000000008', 'f4000000-0000-4000-8000-000000000008', 'teste', 'totp', 'verified', now(), now());
update public.profiles set role = 'producer' where id in ('f4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000002', 'f4000000-0000-4000-8000-000000000008');

-- permissões
select ok(not has_function_privilege('anon', 'public.team_convite_email_reservar()', 'execute'), 'anon não executa reservar');
select ok(has_function_privilege('authenticated', 'public.team_convite_email_reservar()', 'execute'), 'authenticated executa reservar');
select ok(not has_function_privilege('authenticated', 'public.team_convite_email_resultado(uuid, uuid, timestamptz, boolean)', 'execute')
       and not has_function_privilege('anon', 'public.team_convite_email_resultado(uuid, uuid, timestamptz, boolean)', 'execute'), 'resultado: nem authenticated nem anon');
select ok(has_function_privilege('service_role', 'public.team_convite_email_resultado(uuid, uuid, timestamptz, boolean)', 'execute'), 'resultado: service_role executa');
select ok(not has_table_privilege('authenticated', 'public.team_convite_email', 'select') and not has_table_privilege('anon', 'public.team_convite_email', 'select')
       and not has_table_privilege('authenticated', 'public.team_convite_email', 'insert'), 'controle: sem acesso pela API');
select ok((select relrowsecurity from pg_class where oid = 'public.team_convite_email'::regclass), 'controle: RLS ligada');

-- 2FA e papel em team_convidar e em reservar
select pg_temp.como('authenticated', 'f4000000-0000-4000-8000-000000000002');
select throws_ok($$select public.team_convidar('u03@teste-convite-email.local', 'editor')$$, '42501',
  'Ative a verificação em duas etapas no seu perfil e entre com o código para convidar a equipe.', 'produtor sem fator recusado (mesmo em aal2)');
select throws_ok($$select * from public.team_convite_email_reservar()$$, '42501', null, 'produtor sem fator não reserva');
select pg_temp.como('authenticated', 'f4000000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($$select public.team_convidar('u03@teste-convite-email.local', 'editor')$$, '42501',
  'Ative a verificação em duas etapas no seu perfil e entre com o código para convidar a equipe.', 'fator em aal1 recusado');
select throws_ok($$select * from public.team_convite_email_reservar()$$, '42501', null, 'fator em aal1 não reserva');
select pg_temp.como('authenticated', 'f4000000-0000-4000-8000-000000000003');
select throws_ok($$select public.team_convidar('u04@teste-convite-email.local', 'editor')$$, '42501', 'Só a conta do produtor convida para a equipe.', 'não produtor recusado em team_convidar');
select throws_ok($$select * from public.team_convite_email_reservar()$$, '42501', 'Só a conta do produtor envia o convite da equipe.', 'não produtor recusado em reservar');
select pg_temp.como('anon');
select throws_ok($$select * from public.team_convite_email_reservar()$$, '42501', null, 'anon não reserva');
select throws_ok($$select public.team_convite_email_resultado('f4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000003', now(), false)$$, '42501', null, 'anon não registra resultado');
select pg_temp.como('authenticated', 'f4000000-0000-4000-8000-000000000001');
select throws_ok($$select public.team_convite_email_resultado('f4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000003', now(), false)$$, '42501', null, 'authenticated não registra resultado');

-- convites
select is(public.team_convidar('u03@teste-convite-email.local', 'editor'), '{"ok": true}'::jsonb, 'fator verificado em aal2 convida (03)');
select is(public.team_convidar('u04@teste-convite-email.local', 'viewer'), '{"ok": true}'::jsonb, 'convida 04');
select is(public.team_convidar('u05@teste-convite-email.local', 'admin'), '{"ok": true}'::jsonb, 'convida 05');
select is(public.team_convidar('u06@teste-convite-email.local', 'editor'), '{"ok": true}'::jsonb, 'convida 06');
select is(public.team_convidar('u07@teste-convite-email.local', 'editor'), '{"ok": true}'::jsonb, 'convida 07');
select pg_temp.como('authenticated', 'f4000000-0000-4000-8000-000000000008');
select is(public.team_convidar('u03@teste-convite-email.local', 'editor'), '{"ok": true}'::jsonb, 'outro produtor (08) convida 03 para a equipe dele');

-- 04 já aceitou, 05 foi convidada há 11 minutos, 06 está bloqueada: nenhuma entra na reserva
select pg_temp.como('postgres');
update public.team_members set accepted_at = now() where user_id = 'f4000000-0000-4000-8000-000000000004';
update public.team_members set invited_at = now() - interval '11 minutes' where user_id = 'f4000000-0000-4000-8000-000000000005';
update public.team_members set blocked_at = now() where user_id = 'f4000000-0000-4000-8000-000000000006';

select pg_temp.como('authenticated', 'f4000000-0000-4000-8000-000000000001');
select is((select array_agg(email || '/' || role || '/' || produtor order by email) from public.team_convite_email_reservar()),
  array['u03@teste-convite-email.local/editor/Um produtor da Evokaa', 'u07@teste-convite-email.local/editor/Um produtor da Evokaa'],
  'reserva só pendentes, recentes e do dono (sem 04 aceita, 05 antiga, 06 bloqueada, nem a equipe do 08); nome em branco: fallback');
select pg_temp.como('postgres');
select is((select count(*)::int from public.team_convite_email where producer_id = 'f4000000-0000-4000-8000-000000000001' and enviado), 2, 'a reserva já conta como enviada');
select pg_temp.como('authenticated', 'f4000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.team_convite_email_reservar()), 0, 'segunda reserva: vazia');
select pg_temp.como('authenticated', 'f4000000-0000-4000-8000-000000000008');
select is((select array_agg(email) from public.team_convite_email_reservar()), array['u03@teste-convite-email.local'], 'outro produtor reserva só o par dele');

-- janela de 7 dias: depois dela o par recomeça (falhas zeradas) e o nome do produtor sai aparado
select pg_temp.como('postgres');
update public.team_convite_email set reservado_em = now() - interval '8 days', falhas = 2 where producer_id = 'f4000000-0000-4000-8000-000000000001';
update public.profiles set full_name = '  Ana <b>Prod</b>  ' where id = 'f4000000-0000-4000-8000-000000000001';
select pg_temp.como('authenticated', 'f4000000-0000-4000-8000-000000000001');
select is((select row(email, role, produtor)::text from public.team_convite_email_reservar() where email like 'u03%'),
  '(u03@teste-convite-email.local,editor,"Ana <b>Prod</b>")', 'depois de 7 dias reserva de novo, com e-mail, cargo e nome do produtor');
select pg_temp.como('postgres');
select is((select falhas from public.team_convite_email where user_id = 'f4000000-0000-4000-8000-000000000003' and producer_id = 'f4000000-0000-4000-8000-000000000001'), 0, 'janela nova zera as falhas');
select set_config('t.r1', (select reservado_em::text from public.team_convite_email where user_id = 'f4000000-0000-4000-8000-000000000003' and producer_id = 'f4000000-0000-4000-8000-000000000001'), true);

-- falha libera até 3 dentro da janela; falha atrasada de reserva antiga não desfaz a nova
select pg_temp.como('service_role');
select public.team_convite_email_resultado('f4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000003', current_setting('t.r1')::timestamptz, false);
select pg_temp.como('authenticated', 'f4000000-0000-4000-8000-000000000001');
select is((select array_agg(email) from public.team_convite_email_reservar()), array['u03@teste-convite-email.local'], '1ª falha libera o par (07, enviado, não volta)');
select pg_temp.como('postgres');
select set_config('t.r2', (select reservado_em::text from public.team_convite_email where user_id = 'f4000000-0000-4000-8000-000000000003' and producer_id = 'f4000000-0000-4000-8000-000000000001'), true);
select pg_temp.como('service_role');
select public.team_convite_email_resultado('f4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000003', current_setting('t.r1')::timestamptz, false);
select pg_temp.como('postgres');
select is((select enviado::text || '/' || falhas from public.team_convite_email where user_id = 'f4000000-0000-4000-8000-000000000003' and producer_id = 'f4000000-0000-4000-8000-000000000001'),
  'true/1', 'falha atrasada da reserva antiga não desfaz o envio da nova');
select pg_temp.como('service_role');
select public.team_convite_email_resultado('f4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000003', current_setting('t.r2')::timestamptz, false);
select public.team_convite_email_resultado('f4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000003', current_setting('t.r2')::timestamptz, false);
select pg_temp.como('authenticated', 'f4000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.team_convite_email_reservar() where email like 'u03%'), 1, '2ª falha libera: reserva de novo');
select pg_temp.como('postgres');
select set_config('t.r3', (select reservado_em::text from public.team_convite_email where user_id = 'f4000000-0000-4000-8000-000000000003' and producer_id = 'f4000000-0000-4000-8000-000000000001'), true);
select pg_temp.como('service_role');
select public.team_convite_email_resultado('f4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000003', current_setting('t.r3')::timestamptz, false);
select pg_temp.como('authenticated', 'f4000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.team_convite_email_reservar() where email like 'u03%'), 0, '3ª falha: não reserva mais dentro da janela');
select pg_temp.como('postgres');
select is((select falhas from public.team_convite_email where user_id = 'f4000000-0000-4000-8000-000000000003' and producer_id = 'f4000000-0000-4000-8000-000000000001'), 3, 'três falhas contadas');

-- p_ok = true não mexe; resultado de reserva certa e dono errado também não
select pg_temp.como('service_role');
select public.team_convite_email_resultado('f4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000007', (select now()), true);
select pg_temp.como('postgres');
select is((select enviado from public.team_convite_email where user_id = 'f4000000-0000-4000-8000-000000000007' and producer_id = 'f4000000-0000-4000-8000-000000000001'), true, 'p_ok = true não desfaz nada');

-- remover o membro e convidar de novo: o controle sobrevive e não manda outro e-mail
update public.team_convite_email set reservado_em = clock_timestamp(), enviado = true, falhas = 0 where user_id = 'f4000000-0000-4000-8000-000000000003' and producer_id = 'f4000000-0000-4000-8000-000000000001';
delete from public.team_members where user_id = 'f4000000-0000-4000-8000-000000000003' and producer_id = 'f4000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.team_convite_email where user_id = 'f4000000-0000-4000-8000-000000000003' and producer_id = 'f4000000-0000-4000-8000-000000000001'), 1, 'remover o membro não apaga o controle do par');
select pg_temp.como('authenticated', 'f4000000-0000-4000-8000-000000000001');
select is(public.team_convidar('u03@teste-convite-email.local', 'editor'), '{"ok": true}'::jsonb, 'convida 03 de novo depois de remover');
select is((select count(*)::int from public.team_convite_email_reservar()), 0, 'convite novo do mesmo par dentro de 7 dias: sem outro e-mail');

-- limite por convidado: 3 reservas de produtores diferentes em 24 h (09); controle com mais de 30 dias é apagado
select pg_temp.como('postgres');
insert into public.team_convite_email (producer_id, user_id, reservado_em) values
  ('f4000000-0000-4000-8000-0000000000a1', 'f4000000-0000-4000-8000-000000000009', now() - interval '1 hour'),
  ('f4000000-0000-4000-8000-0000000000a2', 'f4000000-0000-4000-8000-000000000009', now() - interval '2 hours'),
  ('f4000000-0000-4000-8000-0000000000a3', 'f4000000-0000-4000-8000-000000000009', now() - interval '3 hours'),
  ('f4000000-0000-4000-8000-0000000000a4', 'f4000000-0000-4000-8000-000000000006', now() - interval '31 days'),
  ('f4000000-0000-4000-8000-0000000000a5', 'f4000000-0000-4000-8000-000000000006', now() - interval '29 days');
select pg_temp.como('authenticated', 'f4000000-0000-4000-8000-000000000001');
select is(public.team_convidar('u09@teste-convite-email.local', 'viewer'), '{"ok": true}'::jsonb, 'convida 09');
select is((select count(*)::int from public.team_convite_email_reservar() where email like 'u09%'), 0, '09 já recebeu de 3 produtores em 24 h: não reserva');
select pg_temp.como('postgres');
update public.team_convite_email set reservado_em = now() - interval '25 hours' where producer_id = 'f4000000-0000-4000-8000-0000000000a3';
select pg_temp.como('authenticated', 'f4000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.team_convite_email_reservar() where email like 'u09%'), 1, 'só 2 nas últimas 24 h: reserva');
select pg_temp.como('postgres');
select is((select array_agg(producer_id::text order by producer_id) from public.team_convite_email where user_id = 'f4000000-0000-4000-8000-000000000006'),
  array['f4000000-0000-4000-8000-0000000000a5'], 'controle de 31 dias apagado; o de 29 dias fica');

select * from finish();
rollback;
