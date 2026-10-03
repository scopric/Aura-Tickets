-- pgTAP da VF-a (docs/sql/20261008_favoritos.sql). Só no banco local: `supabase start`, aplicar o SQL da VF-a
-- (e antes os de docs/sql que vieram depois do baseline e mexem em events/2FA: 20260930_2fa_no_banco e
-- 20260930_f0a_moderacao_eventos já fazem parte do baseline) e rodar `supabase test db`.
-- Tudo em begin ... rollback: nada fica gravado. Nunca contra produção.
-- Sem os helpers do dbdev (precisam de internet no container): pg_temp.como() troca o papel e as claims do JWT
-- como o PostgREST faz, igual a supabase/tests/produtor_acesso.test.sql.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(39);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', p_role, true);
end $f$;
-- funções novas do postgres nascem sem EXECUTE para PUBLIC (seg6); as do pgTAP também, neste banco
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- Dados (como postgres) -------------------------------------------------------------------------------------------
-- a, b, c participantes; d participante com 2FA; p produtor dono dos eventos
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('fa000000-0000-4000-8000-00000000000a', 'a@teste-fav.local', now(), '{"full_name":"Ana"}'),
  ('fa000000-0000-4000-8000-00000000000b', 'b@teste-fav.local', now(), '{"full_name":"Bia"}'),
  ('fa000000-0000-4000-8000-00000000000c', 'c@teste-fav.local', now(), '{"full_name":"Caio"}'),
  ('fa000000-0000-4000-8000-00000000000d', 'd@teste-fav.local', now(), '{"full_name":"Duda"}'),
  ('fa000000-0000-4000-8000-000000000009', 'p@teste-fav.local', now(), '{"role":"producer","full_name":"Paula"}');
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values ('fa000000-0000-4000-8000-0000000000f1', 'fa000000-0000-4000-8000-00000000000d', 'teste', 'totp', 'verified', now(), now());
-- e1 e e2 publicados e aprovados; e3 rascunho; e4 publicado mas em análise; e5 publicado mas recusado;
-- e6 cancelado e aprovado; e7 rascunho de a (a é dono, mas rascunho não se favorita)
insert into public.events (id, producer_id, title, slug, status, approval_status) values
  ('fa000000-0000-4000-8000-0000000000e1', 'fa000000-0000-4000-8000-000000000009', 'Publicado 1', 'fav-e1', 'published', 'approved'),
  ('fa000000-0000-4000-8000-0000000000e2', 'fa000000-0000-4000-8000-000000000009', 'Publicado 2', 'fav-e2', 'published', 'approved'),
  ('fa000000-0000-4000-8000-0000000000e3', 'fa000000-0000-4000-8000-000000000009', 'Rascunho', 'fav-e3', 'draft', 'approved'),
  ('fa000000-0000-4000-8000-0000000000e4', 'fa000000-0000-4000-8000-000000000009', 'Em análise', 'fav-e4', 'published', 'pending'),
  ('fa000000-0000-4000-8000-0000000000e5', 'fa000000-0000-4000-8000-000000000009', 'Recusado', 'fav-e5', 'published', 'rejected'),
  ('fa000000-0000-4000-8000-0000000000e6', 'fa000000-0000-4000-8000-000000000009', 'Cancelado', 'fav-e6', 'cancelled', 'approved'),
  ('fa000000-0000-4000-8000-0000000000e7', 'fa000000-0000-4000-8000-00000000000a', 'Rascunho da Ana', 'fav-e7', 'draft', 'pending');
-- a tem ingresso do evento cancelado (e6): a regra "Quem tem ingresso lê o evento" deixa ela VER o evento, mas não favoritá-lo
insert into public.orders (id, user_id, event_id) values
  ('fa000000-0000-4000-8000-0000000000a6', 'fa000000-0000-4000-8000-00000000000a', 'fa000000-0000-4000-8000-0000000000e6');
insert into public.ticket_types (id, event_id, name) values
  ('fa000000-0000-4000-8000-0000000000b6', 'fa000000-0000-4000-8000-0000000000e6', 'Pista');
insert into public.tickets (order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, status) values
  ('fa000000-0000-4000-8000-0000000000a6', 'fa000000-0000-4000-8000-0000000000b6', 'fa000000-0000-4000-8000-0000000000e6',
   'fa000000-0000-4000-8000-00000000000a', 'Ana', 'a@teste-fav.local', 'active');

-- Estrutura -------------------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.favoritos'::regclass), 'favoritos: RLS ligada');
select policies_are('public', 'favoritos', array['favoritos_select', 'favoritos_insert', 'favoritos_delete', 'gf_mfa_aal2'],
  'favoritos: só as 4 regras esperadas (sem UPDATE)');
select ok(not has_table_privilege('anon', 'public.favoritos', 'select,insert,update,delete,truncate')
  and not has_any_column_privilege('anon', 'public.favoritos', 'select,insert,update'), 'anon não tem nenhum privilégio');
select ok(not has_table_privilege('authenticated', 'public.favoritos', 'insert,update,truncate')
  and not has_any_column_privilege('authenticated', 'public.favoritos', 'update')
  and has_table_privilege('authenticated', 'public.favoritos', 'select,delete'),
  'authenticated: select e delete; sem update nem truncate; insert só por coluna');
select ok(not has_column_privilege('authenticated', 'public.favoritos', 'criado_em', 'insert')
  and has_column_privilege('authenticated', 'public.favoritos', 'user_id', 'insert')
  and has_column_privilege('authenticated', 'public.favoritos', 'event_id', 'insert'),
  'authenticated não grava criado_em');
select is((select count(*) from pg_constraint where conrelid = 'public.favoritos'::regclass and contype = 'f' and confdeltype = 'c'),
  2::bigint, 'as duas chaves estrangeiras são ON DELETE CASCADE');
select has_index('public', 'favoritos', 'favoritos_event_id_idx', 'event_id', 'índice em event_id para a cascata do evento');
select col_is_pk('public', 'favoritos', array['user_id', 'event_id'], 'chave primária (user_id, event_id)');

-- A favorita ------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'fa000000-0000-4000-8000-00000000000a');
select lives_ok($$insert into favoritos (user_id, event_id) values
  ('fa000000-0000-4000-8000-00000000000a', 'fa000000-0000-4000-8000-0000000000e1')$$, 'A favorita evento publicado e aprovado');
select throws_ok($$insert into favoritos (user_id, event_id) values
  ('fa000000-0000-4000-8000-00000000000a', 'fa000000-0000-4000-8000-0000000000e1')$$, '23505', null, 'favoritar de novo dá 23505');
select lives_ok($$insert into favoritos (user_id, event_id) values
  ('fa000000-0000-4000-8000-00000000000a', 'fa000000-0000-4000-8000-0000000000e2')
  on conflict do nothing$$, 'A favorita o segundo evento');
select lives_ok($$insert into favoritos (user_id, event_id) values
  ('fa000000-0000-4000-8000-00000000000a', 'fa000000-0000-4000-8000-0000000000e1')
  on conflict do nothing$$, 'repetir com ON CONFLICT DO NOTHING (ignoreDuplicates) não dá erro');
select throws_ok($$insert into favoritos (user_id, event_id) values
  ('fa000000-0000-4000-8000-00000000000a', 'fa000000-0000-4000-8000-0000000000e3')$$, '42501', null, 'A não favorita rascunho');
select throws_ok($$insert into favoritos (user_id, event_id) values
  ('fa000000-0000-4000-8000-00000000000a', 'fa000000-0000-4000-8000-0000000000e4')$$, '42501', null, 'A não favorita evento em análise');
select throws_ok($$insert into favoritos (user_id, event_id) values
  ('fa000000-0000-4000-8000-00000000000a', 'fa000000-0000-4000-8000-0000000000e5')$$, '42501', null, 'A não favorita evento recusado');
select is((select count(*) from public.events where id = 'fa000000-0000-4000-8000-0000000000e6'), 1::bigint,
  'A (com ingresso) enxerga o evento cancelado');
select throws_ok($$insert into favoritos (user_id, event_id) values
  ('fa000000-0000-4000-8000-00000000000a', 'fa000000-0000-4000-8000-0000000000e6')$$, '42501', null, 'A não favorita evento cancelado, mesmo vendo-o');
select throws_ok($$insert into favoritos (user_id, event_id) values
  ('fa000000-0000-4000-8000-00000000000a', 'fa000000-0000-4000-8000-0000000000e7')$$, '42501', null, 'A não favorita nem o próprio rascunho');
select throws_ok($$insert into favoritos (user_id, event_id) values
  ('fa000000-0000-4000-8000-00000000000a', 'fa000000-0000-4000-8000-0000000000ff')$$, '42501', null, 'A não favorita evento que não existe');
select throws_ok($$insert into favoritos (user_id, event_id) values
  ('fa000000-0000-4000-8000-00000000000b', 'fa000000-0000-4000-8000-0000000000e1')$$, '42501', null, 'A não favorita em nome de B');
select throws_ok($$insert into favoritos (user_id, event_id, criado_em) values
  ('fa000000-0000-4000-8000-00000000000a', 'fa000000-0000-4000-8000-0000000000e2', '2020-01-01')$$, '42501', null,
  'A não escolhe criado_em');
select results_eq($$select event_id from favoritos order by event_id$$,
  array['fa000000-0000-4000-8000-0000000000e1', 'fa000000-0000-4000-8000-0000000000e2']::uuid[], 'A lê os 2 favoritos dela');

-- B não vê nem mexe nos de A --------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'fa000000-0000-4000-8000-00000000000b');
select lives_ok($$insert into favoritos (user_id, event_id) values
  ('fa000000-0000-4000-8000-00000000000b', 'fa000000-0000-4000-8000-0000000000e1')$$, 'B favorita o mesmo evento que A');
select results_eq($$select user_id from favoritos$$, array['fa000000-0000-4000-8000-00000000000b']::uuid[],
  'B lê só o favorito dele (ids conhecidos)');
select results_eq($$select count(*) from favoritos where user_id = 'fa000000-0000-4000-8000-00000000000a'$$, array[0::bigint],
  'B não lê favorito de A nem filtrando pelo id dela');
select results_eq($$with d as (delete from favoritos where user_id = 'fa000000-0000-4000-8000-00000000000a' returning 1)
  select count(*) from d$$, array[0::bigint], 'B não apaga favorito de A');
select throws_ok($$update favoritos set criado_em = now()$$, '42501', null, 'B não faz UPDATE (sem privilégio)');
select throws_ok($$update favoritos set event_id = 'fa000000-0000-4000-8000-0000000000e2'
  where user_id = 'fa000000-0000-4000-8000-00000000000b'$$, '42501', null, 'B não troca o evento do favorito');

-- Anônimo ---------------------------------------------------------------------------------------------------------
select pg_temp.como('anon');
select throws_ok($$select count(*) from favoritos$$, '42501', null, 'anon não lê favoritos');
select throws_ok($$insert into favoritos (user_id, event_id) values
  ('fa000000-0000-4000-8000-00000000000a', 'fa000000-0000-4000-8000-0000000000e2')$$, '42501', null, 'anon não favorita');

-- Os de A continuam lá; A apaga o próprio --------------------------------------------------------------------------
select pg_temp.como('postgres');
select is((select count(*) from favoritos where user_id = 'fa000000-0000-4000-8000-00000000000a'), 2::bigint,
  'os 2 favoritos de A continuam depois das tentativas de B e do anon');
select pg_temp.como('authenticated', 'fa000000-0000-4000-8000-00000000000a');
select results_eq($$with d as (delete from favoritos where event_id = 'fa000000-0000-4000-8000-0000000000e2' returning 1)
  select count(*) from d$$, array[1::bigint], 'A apaga o próprio favorito');
select results_eq($$select count(*) from favoritos$$, array[1::bigint], 'A fica com 1');

-- 2FA: quem tem fator confirmado só grava com a sessão aal2 (regra gf_mfa_aal2) ------------------------------------
select pg_temp.como('authenticated', 'fa000000-0000-4000-8000-00000000000d', 'aal1');
select throws_ok($$insert into favoritos (user_id, event_id) values
  ('fa000000-0000-4000-8000-00000000000d', 'fa000000-0000-4000-8000-0000000000e1')$$, '42501', null, 'D com 2FA em aal1 não favorita');
select pg_temp.como('authenticated', 'fa000000-0000-4000-8000-00000000000d', 'aal2');
select lives_ok($$insert into favoritos (user_id, event_id) values
  ('fa000000-0000-4000-8000-00000000000d', 'fa000000-0000-4000-8000-0000000000e1')$$, 'D com 2FA em aal2 favorita');

-- Cascatas --------------------------------------------------------------------------------------------------------
select pg_temp.como('postgres');
select lives_ok($$delete from public.events where id = 'fa000000-0000-4000-8000-0000000000e1'$$, 'o evento e1 é apagado');
select is((select count(*) from favoritos where event_id = 'fa000000-0000-4000-8000-0000000000e1'), 0::bigint,
  'apagar o evento apaga os favoritos dele (B e D)');
insert into favoritos (user_id, event_id) values
  ('fa000000-0000-4000-8000-00000000000c', 'fa000000-0000-4000-8000-0000000000e2');
select lives_ok($$delete from auth.users where id = 'fa000000-0000-4000-8000-00000000000c'$$, 'a conta de C é apagada de verdade');
select is((select count(*) from favoritos where user_id = 'fa000000-0000-4000-8000-00000000000c'), 0::bigint,
  'apagar a conta (auth.users) apaga os favoritos dela; o soft delete da delete-account NÃO dispara isto');

select * from finish();
rollback;
