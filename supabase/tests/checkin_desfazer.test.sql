-- pgTAP de docs/sql/20261103a_checkin_desfazer.sql. Banco com o baseline + docs/sql até este arquivo; `supabase test db`.
-- NÃO rodar em produção.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(28);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal2') returns void
language plpgsql as $f$
declare e text;
begin
  perform set_config('role', 'none', true);
  e := (select email from auth.users where id = p);
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'email', e, 'aal', case when p is not null then p_aal end,
    'amr', case when p is not null and p_aal = 'aal2' then json_build_array(json_build_object('method', 'totp',
      'timestamp', extract(epoch from now())::bigint)) end))::text end, true);
  perform set_config('role', case when p_role = 'postgres' then 'none' else p_role end, true);
end $f$;
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;
create function pg_temp.st(t uuid) returns text language sql as $f$ select status from public.tickets where id = t $f$;
grant execute on function pg_temp.st(uuid) to authenticated;

-- 01 produtor, 02 editor aceito, 03 viewer aceito, 04 editor pendente, 05 outro produtor, 06 super_admin,
-- 07 admin só com view_users (sem manage_tickets), 08 comprador
insert into auth.users (id, email, raw_user_meta_data) values
  ('e3000000-0000-4000-8000-000000000001', 'p@teste-desfazer.local', '{"role":"producer"}'),
  ('e3000000-0000-4000-8000-000000000002', 'e@teste-desfazer.local', '{}'),
  ('e3000000-0000-4000-8000-000000000003', 'v@teste-desfazer.local', '{}'),
  ('e3000000-0000-4000-8000-000000000004', 'n@teste-desfazer.local', '{}'),
  ('e3000000-0000-4000-8000-000000000005', 'q@teste-desfazer.local', '{"role":"producer"}'),
  ('e3000000-0000-4000-8000-000000000006', 's@teste-desfazer.local', '{}'),
  ('e3000000-0000-4000-8000-000000000007', 'a@teste-desfazer.local', '{}'),
  ('e3000000-0000-4000-8000-000000000008', 'c@teste-desfazer.local', '{}');
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
select ('e3000000-0000-4000-9000-0000000000' || n)::uuid, ('e3000000-0000-4000-8000-0000000000' || n)::uuid, 'teste', 'totp', 'verified', now(), now()
from unnest(array['01', '02', '03', '04', '05', '06', '07']) n;
update public.profiles set role = 'producer' where id in ('e3000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000005');
update public.profiles set role = 'admin', admin_permissions = array['super_admin']::text[] where id = 'e3000000-0000-4000-8000-000000000006';
update public.profiles set role = 'admin', admin_permissions = array['view_users']::text[] where id = 'e3000000-0000-4000-8000-000000000007';
insert into public.team_members (producer_id, user_id, role, accepted_at, blocked_at) values
  ('e3000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000002', 'editor', now(), null),
  ('e3000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000003', 'viewer', now(), null),
  ('e3000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000004', 'editor', null, null);

insert into public.events (id, producer_id, title, slug, status, approval_status, visibility) values
  ('e3000000-0000-4000-b000-000000000001', 'e3000000-0000-4000-8000-000000000001', 'Festa A', 'desfazer-1', 'published', 'approved', 'public'),
  ('e3000000-0000-4000-b000-000000000002', 'e3000000-0000-4000-8000-000000000005', 'Festa B', 'desfazer-2', 'published', 'approved', 'public');
-- evento C: do produtor 01, já encerrado
insert into public.events (id, producer_id, title, slug, status, approval_status, visibility, start_date, end_date) values
  ('e3000000-0000-4000-b000-000000000007', 'e3000000-0000-4000-8000-000000000001', 'Festa C', 'desfazer-3', 'published', 'approved', 'public', now() - interval '3 days', now() - interval '2 days');
insert into public.ticket_types (id, event_id, name, is_active) values
  ('e3000000-0000-4000-b000-000000000003', 'e3000000-0000-4000-b000-000000000001', 'Pista', true),
  ('e3000000-0000-4000-b000-000000000004', 'e3000000-0000-4000-b000-000000000002', 'Pista', true);
insert into public.orders (id, user_id, event_id, total, status) values
  ('e3000000-0000-4000-b000-000000000005', 'e3000000-0000-4000-8000-000000000008', 'e3000000-0000-4000-b000-000000000001', 100, 'paid'),
  ('e3000000-0000-4000-b000-000000000006', 'e3000000-0000-4000-8000-000000000008', 'e3000000-0000-4000-b000-000000000002', 100, 'paid');
-- t10..t17 usados no evento A (dono, editor, viewer, pendente, admin, admin sem permissão, dono em aal1, teto); t20 ativo; t30 usado no evento B; t40 no evento C (encerrado)
insert into public.tickets (id, order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, status, checked_in_at)
select ('e3000000-0000-4000-c000-0000000000' || n)::uuid,
  case when n = '30' then 'e3000000-0000-4000-b000-000000000006' else 'e3000000-0000-4000-b000-000000000005' end::uuid,
  case when n = '30' then 'e3000000-0000-4000-b000-000000000004' else 'e3000000-0000-4000-b000-000000000003' end::uuid,
  case n when '30' then 'e3000000-0000-4000-b000-000000000002' when '40' then 'e3000000-0000-4000-b000-000000000007' else 'e3000000-0000-4000-b000-000000000001' end::uuid,
  'e3000000-0000-4000-8000-000000000008', 'Comprador ' || n, 'c@teste-desfazer.local',
  case when n = '20' then 'active' else 'used' end, case when n = '20' then null else now() - interval '1 hour' end
from unnest(array['10', '11', '12', '13', '14', '15', '16', '17', '20', '30', '40']) n;
insert into public.check_ins (event_id, ticket_id, user_id)
values ('e3000000-0000-4000-b000-000000000001', 'e3000000-0000-4000-c000-000000000010', 'e3000000-0000-4000-8000-000000000008');

select ok(not has_function_privilege('anon', 'public.checkin_desfazer(uuid,text)', 'execute'), 'anon não executa');
select ok(has_function_privilege('authenticated', 'public.checkin_desfazer(uuid,text)', 'execute'), 'authenticated executa');
select ok((select relrowsecurity from pg_class where oid = 'public.check_in_desfeitos'::regclass), 'RLS ligada no histórico');
select is((select count(*)::int from pg_policies where tablename = 'check_in_desfeitos' and cmd <> 'SELECT' and permissive = 'PERMISSIVE'), 0, 'histórico sem política de escrita');
select is((select count(*)::int from pg_policies where tablename = 'check_in_desfeitos' and policyname = 'gf_mfa_aal2' and permissive = 'RESTRICTIVE'), 1, 'regra restritiva do 2FA');

-- dono
select pg_temp.como('authenticated', 'e3000000-0000-4000-8000-000000000001');
select throws_ok($$select public.checkin_desfazer('e3000000-0000-4000-c000-000000000010', 'ab')$$, '22023', null, 'motivo curto demais');
select throws_ok($$select public.checkin_desfazer('e3000000-0000-4000-c000-000000000010', '   ')$$, '22023', null, 'motivo só com espaços');
select throws_ok($$select public.checkin_desfazer('e3000000-0000-4000-c000-000000000010', repeat('x', 201))$$, '22023', null, 'motivo acima de 200');
select lives_ok($$select public.checkin_desfazer('e3000000-0000-4000-c000-000000000010', 'Leitura por engano')$$, 'dono desfaz');
select is(pg_temp.st('e3000000-0000-4000-c000-000000000010'::uuid), 'active', 'ingresso voltou a active');
select is((select checked_in_at from public.tickets where id = 'e3000000-0000-4000-c000-000000000010'), null, 'checked_in_at zerado');
select is((select count(*)::int from public.check_in_desfeitos where ticket_id = 'e3000000-0000-4000-c000-000000000010' and motivo = 'Leitura por engano'
  and desfeito_por = 'e3000000-0000-4000-8000-000000000001' and checked_in_at is not null), 1, 'histórico gravado com a entrada original');
select is((select count(*)::int from public.check_ins where ticket_id = 'e3000000-0000-4000-c000-000000000010'), 0, 'linha de check_ins apagada (o admin não conta como entrou)');
select throws_ok($$select public.checkin_desfazer('e3000000-0000-4000-c000-000000000010', 'de novo')$$, 'P0001', null, 'segundo desfazer falha');
select throws_ok($$select public.checkin_desfazer('e3000000-0000-4000-c000-000000000020', 'não estava usado')$$, 'P0001', null, 'ingresso ativo falha');
select throws_ok($$select public.checkin_desfazer('e3000000-0000-4000-c000-000000000030', 'outro produtor')$$, 'P0001', null, 'ingresso de outro produtor falha');
select throws_ok($$select public.checkin_desfazer('e3000000-0000-4000-c000-0000000000ff', 'inexistente')$$, 'P0001', null, 'ingresso inexistente falha');
select throws_ok($$select public.checkin_desfazer('e3000000-0000-4000-c000-000000000040', 'evento encerrado')$$, 'P0001', null, 'evento encerrado falha');
select is((select count(*)::int from public.check_in_desfeitos), 1, 'o dono lê o histórico do próprio evento');

-- teto de 2 desfazimentos por ingresso
select lives_ok($$select public.checkin_desfazer('e3000000-0000-4000-c000-000000000017', 'primeiro')$$, 'teto: 1º desfazer');
select pg_temp.como('postgres');
update public.tickets set status = 'used', checked_in_at = now() where id = 'e3000000-0000-4000-c000-000000000017';
select pg_temp.como('authenticated', 'e3000000-0000-4000-8000-000000000001');
select lives_ok($$select public.checkin_desfazer('e3000000-0000-4000-c000-000000000017', 'segundo')$$, 'teto: 2º desfazer');
select pg_temp.como('postgres');
update public.tickets set status = 'used', checked_in_at = now() where id = 'e3000000-0000-4000-c000-000000000017';
select pg_temp.como('authenticated', 'e3000000-0000-4000-8000-000000000001');
select throws_ok($$select public.checkin_desfazer('e3000000-0000-4000-c000-000000000017', 'terceiro')$$, 'P0001', null, 'teto: 3º desfazer falha');

-- equipe e admin
select pg_temp.como('authenticated', 'e3000000-0000-4000-8000-000000000002');
select lives_ok($$select public.checkin_desfazer('e3000000-0000-4000-c000-000000000011', 'Editor desfaz')$$, 'editor aceito desfaz');
select pg_temp.como('authenticated', 'e3000000-0000-4000-8000-000000000003');
select throws_ok($$select public.checkin_desfazer('e3000000-0000-4000-c000-000000000012', 'Viewer não pode')$$, 'P0001', null, 'viewer não desfaz');
select pg_temp.como('authenticated', 'e3000000-0000-4000-8000-000000000004');
select throws_ok($$select public.checkin_desfazer('e3000000-0000-4000-c000-000000000013', 'Pendente não pode')$$, 'P0001', null, 'editor pendente não desfaz');
select pg_temp.como('authenticated', 'e3000000-0000-4000-8000-000000000007');
select throws_ok($$select public.checkin_desfazer('e3000000-0000-4000-c000-000000000015', 'Sem permissão')$$, 'P0001', null, 'admin sem manage_tickets não desfaz');
select pg_temp.como('authenticated', 'e3000000-0000-4000-8000-000000000006');
select lives_ok($$select public.checkin_desfazer('e3000000-0000-4000-c000-000000000014', 'Admin da plataforma')$$, 'super_admin desfaz');
select pg_temp.como('authenticated', 'e3000000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($$select public.checkin_desfazer('e3000000-0000-4000-c000-000000000016', 'Dono sem o código do 2FA')$$, 'P0001', null, 'dono com fator em aal1 não desfaz');

select * from finish();
rollback;
