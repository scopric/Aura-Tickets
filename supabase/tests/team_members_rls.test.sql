-- pgTAP de docs/sql/20261017_team_members_rls.sql. Banco local com o baseline + esse SQL; `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(20);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal2') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', p_role, true);
end $f$;
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

create function pg_temp.n(q text) returns int language plpgsql as $f$
declare r int; begin execute q; get diagnostics r = row_count; return r; end $f$;
grant execute on function pg_temp.n(text) to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('c1000000-0000-4000-8000-000000000001', 'p1@teste.local', '{"role":"producer"}'),
  ('c1000000-0000-4000-8000-000000000002', 'p2@teste.local', '{"role":"producer"}'),
  ('c1000000-0000-4000-8000-000000000003', 'm@teste.local', '{}'),
  ('c1000000-0000-4000-8000-000000000004', 'x@teste.local', '{}');
-- p1 com fator verificado: só então o aal1 é barrado pela regra de 2FA
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values ('c1000000-0000-4000-8000-0000000000f1', 'c1000000-0000-4000-8000-000000000001', 'teste', 'totp', 'verified', now(), now());
insert into public.team_members (id, producer_id, user_id, role) values
  ('c1000000-0000-4000-8000-0000000000a1', 'c1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000003', 'admin'),
  ('c1000000-0000-4000-8000-0000000000a2', 'c1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000003', 'viewer');

select pg_temp.como('authenticated', 'c1000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.team_members), 1, 'dono lê só os seus');
select lives_ok($$insert into public.team_members (producer_id, user_id, role) values ('c1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'editor')$$, 'dono convida');
select throws_ok($$insert into public.team_members (producer_id, user_id, role) values ('c1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'editor')$$, '42501', null, 'não convida em nome de outro produtor');
select throws_ok($$insert into public.team_members (producer_id, user_id, accepted_at) values ('c1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000004', now())$$, '42501', null, 'dono não grava accepted_at no convite');
select throws_ok($$insert into public.team_members (producer_id, user_id) values ('c1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001')$$, '42501', null, 'não se convida');
select throws_ok($$update public.team_members set accepted_at = now() where id = 'c1000000-0000-4000-8000-0000000000a1'$$, '42501', null, 'dono não altera accepted_at');
select throws_ok($$update public.team_members set user_id = 'c1000000-0000-4000-8000-000000000004' where id = 'c1000000-0000-4000-8000-0000000000a1'$$, '42501', null, 'dono não troca user_id');
select throws_ok($$update public.team_members set producer_id = 'c1000000-0000-4000-8000-000000000002' where id = 'c1000000-0000-4000-8000-0000000000a1'$$, '42501', null, 'dono não troca producer_id');
select throws_ok($$insert into public.team_members (producer_id, user_id) values ('c1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002')$$, '23505', null, 'vínculo duplicado recusado');
select is(pg_temp.n($$update public.team_members set blocked_at = now() where id = 'c1000000-0000-4000-8000-0000000000a1'$$), 1, 'dono bloqueia');
select is((select role from public.team_members where id = 'c1000000-0000-4000-8000-0000000000a1'), 'admin', 'bloquear não muda o cargo');
select is(pg_temp.n($$update public.team_members set role = 'viewer' where id = 'c1000000-0000-4000-8000-0000000000a2'$$), 0, 'não altera membro de outro produtor');
select is(pg_temp.n($$delete from public.team_members where id = 'c1000000-0000-4000-8000-0000000000a2'$$), 0, 'não remove membro de outro produtor');
select is(pg_temp.n($$delete from public.team_members where id = 'c1000000-0000-4000-8000-0000000000a1'$$), 1, 'dono remove o seu');

select pg_temp.como('authenticated', 'c1000000-0000-4000-8000-000000000001', 'aal1');
select is((select count(*)::int from public.team_members), 0, 'sem 2FA (aal1) não lê nada (gf_mfa_aal2 segue valendo)');

select pg_temp.como('authenticated', 'c1000000-0000-4000-8000-000000000003');
select is((select count(*)::int from public.team_members), 0, 'membro convidado não lê vínculos');

select throws_ok($$insert into public.team_members (producer_id, user_id) values ('c1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001')$$, '42501', null, 'participante (não produtor) não insere');
select pg_temp.como('anon');
select throws_ok($$select 1 from public.team_members$$, '42501', null, 'anon sem permissão de leitura');
select throws_ok($$insert into public.team_members (producer_id, user_id) values ('c1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000003')$$, '42501', null, 'anon não insere');
select pg_temp.como('postgres');
select is((select count(*)::int from public.team_members), 2, 'linhas existem (a2 de p2 e o convite de p1; a1 foi removida)');
select * from finish();
rollback;
