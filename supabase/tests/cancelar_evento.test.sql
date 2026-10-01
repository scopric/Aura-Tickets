-- pgTAP da Decisão 129 (parte 2 de docs/sql/20261006_saldo_e_cancelamento.sql): evento com ingresso vendido
-- não sai do ar pelo produtor (cancelar, voltar a rascunho, encerrar antes da data). Só no banco local: aplicar
-- seg6, seg4, 20261005 e 20261006 e rodar `supabase test db`. Tudo em begin ... rollback.
-- pg_temp.como() troca papel e claims do JWT como o PostgREST.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(22);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', p_role, true);
end $f$;
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated, service_role;
grant execute on all functions in schema extensions to anon, authenticated, service_role;

-- produtor (001), comprador (002), admin com 2FA e manage_events (003)
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('c4000000-0000-4000-8000-000000000001', 'canc-prod@teste.local', now(), '{"role":"producer"}'),
  ('c4000000-0000-4000-8000-000000000002', 'canc-comp@teste.local', now(), '{}'),
  ('c4000000-0000-4000-8000-000000000003', 'canc-adm@teste.local', now(), '{}');
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values ('c4000000-0000-4000-8000-0000000000f3', 'c4000000-0000-4000-8000-000000000003', 'teste', 'totp', 'verified', now(), now());
update public.profiles set role = 'admin', admin_permissions = '{manage_events}' where id = 'c4000000-0000-4000-8000-000000000003';

-- Eventos (todos 'published'; data = start_date, end_date nulo):
--   e1 sem venda | e2 active | e3 used | e4 só cancelled+refunded | e5 active (admin) | e6 active (service_role)
--   e7 só transferred | e8 active, data futura (rascunho) | e9 active, data futura (encerrar)
--   e10 active, data passada (encerrar e depois cancelar) | e11 active (claim forjada) | e12 active (admin aal1)
--   e13 active (moderação do admin: recusa e volta a rascunho)
insert into public.events (id, producer_id, title, slug, status, start_date)
select ('c4000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'c4000000-0000-4000-8000-000000000001',
       'Evento ' || n, 'canc-e' || n, 'published',
       case when n in (8, 9) then now() + interval '30 days' when n = 10 then now() - interval '2 days' else now() end
from generate_series(1, 13) n;
insert into public.orders (id, user_id, event_id)
select ('c4000000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid, 'c4000000-0000-4000-8000-000000000002',
       ('c4000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
from generate_series(2, 13) n;
insert into public.ticket_types (id, event_id, name)
select ('c4000000-0000-4000-8000-0000000002' || lpad(n::text, 2, '0'))::uuid,
       ('c4000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'Pista'
from generate_series(2, 13) n;
insert into public.tickets (order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, status)
select ('c4000000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid,
       ('c4000000-0000-4000-8000-0000000002' || lpad(n::text, 2, '0'))::uuid,
       ('c4000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       'c4000000-0000-4000-8000-000000000002', 'Comprador', 'canc-comp@teste.local', st
from (values (2, 'active'), (3, 'used'), (4, 'cancelled'), (4, 'refunded'), (5, 'active'), (6, 'active'),
             (7, 'transferred'), (8, 'active'), (9, 'active'), (10, 'active'), (11, 'active'), (12, 'active'),
             (13, 'active')) v(n, st);

select ok(exists (select 1 from pg_trigger where tgrelid = 'public.events'::regclass and tgname = 'gf_protect_event_cancel'),
  'gatilho gf_protect_event_cancel existe');
select ok(not has_function_privilege('anon', 'public.gf_protect_event_cancel()', 'execute')
  and not has_function_privilege('authenticated', 'public.gf_protect_event_cancel()', 'execute'),
  'visitante e usuário logado não executam a função do gatilho');

-- Produtor: cancelar
select pg_temp.como('authenticated', 'c4000000-0000-4000-8000-000000000001');
select results_eq($$with u as (update events set status = 'cancelled' where id = 'c4000000-0000-4000-8000-000000000001'
  returning status) select * from u$$, array['cancelled'], 'produtor cancela evento sem venda');
select throws_ok($$update events set status = 'cancelled' where id = 'c4000000-0000-4000-8000-000000000002'$$,
  'EV001', 'Este evento tem ingressos vendidos. Para cancelar, fale com o suporte da Evokaa.',
  'produtor não cancela evento com ingresso active');
select throws_ok($$update events set status = 'cancelled' where id = 'c4000000-0000-4000-8000-000000000003'$$,
  'EV001', null, 'produtor não cancela evento com ingresso used');
select results_eq($$select status from events where id = 'c4000000-0000-4000-8000-000000000003'$$, array['published'],
  'o evento com used continua publicado depois da recusa');
select results_eq($$with u as (update events set status = 'cancelled' where id = 'c4000000-0000-4000-8000-000000000004'
  returning status) select * from u$$, array['cancelled'], 'só ingressos cancelled/refunded: produtor cancela');
select throws_ok($$update events set status = 'cancelled' where id = 'c4000000-0000-4000-8000-000000000007'$$,
  'EV001', null, 'ingresso transferred conta como venda (mesmo critério da F0a)');
select results_eq($$with u as (update events set title = 'Evento 2 renomeado' where id = 'c4000000-0000-4000-8000-000000000002'
  returning title) select * from u$$, array['Evento 2 renomeado'], 'produtor edita o título do evento com venda');

-- Produtor: rascunho e encerrar
select throws_ok($$update events set status = 'draft' where id = 'c4000000-0000-4000-8000-000000000008'$$,
  'EV002', 'Este evento tem ingressos vendidos e não pode sair do ar. Fale com o suporte da Evokaa.',
  'produtor não volta a rascunho evento publicado com venda');
select throws_ok($$update events set status = 'ended' where id = 'c4000000-0000-4000-8000-000000000009'$$,
  'EV002', null, 'produtor não encerra evento com venda antes da data');
select throws_ok($$update events set status = 'ended', start_date = now() - interval '1 day'
  where id = 'c4000000-0000-4000-8000-000000000009'$$, 'EV002', null,
  'mudar a data para o passado e encerrar no mesmo update também é recusado (vale a data antiga)');
select results_eq($$with u as (update events set status = 'ended' where id = 'c4000000-0000-4000-8000-000000000010'
  returning status) select * from u$$, array['ended'], 'produtor encerra evento com venda depois da data');
select throws_ok($$update events set status = 'cancelled' where id = 'c4000000-0000-4000-8000-000000000010'$$,
  'EV001', null, 'de encerrado para cancelado, com venda: recusado');
select results_eq($$with u as (update events set status = 'draft' where id = 'c4000000-0000-4000-8000-000000000001'
  returning status) select * from u$$, array['draft'], 'evento sem venda: de cancelado para rascunho continua livre');

-- Claim role forjada: sessão authenticated com "role": "service_role" no JWT
select set_config('request.jwt.claims',
  '{"role":"service_role","sub":"c4000000-0000-4000-8000-000000000001","aal":"aal1"}', true);
select throws_ok($$update events set status = 'cancelled' where id = 'c4000000-0000-4000-8000-000000000011'$$,
  'EV001', null, 'claim service_role forjada numa sessão authenticated não passa');

-- Admin
select pg_temp.como('authenticated', 'c4000000-0000-4000-8000-000000000003', 'aal1');
select results_eq($$with u as (update events set status = 'cancelled' where id = 'c4000000-0000-4000-8000-000000000012'
  returning 1) select count(*) from u$$, array[0::bigint],
  'admin com fator em aal1: bloqueado (a regra de 2FA esconde a linha antes do gatilho)');
select pg_temp.como('authenticated', 'c4000000-0000-4000-8000-000000000003', 'aal2');
select results_eq($$with u as (update events set status = 'cancelled' where id = 'c4000000-0000-4000-8000-000000000005'
  returning status) select * from u$$, array['cancelled'], 'admin (aal2) cancela evento com venda');
select results_eq($$with u as (update events set approval_status = 'rejected', rejection_reason = 'teste', status = 'draft'
  where id = 'c4000000-0000-4000-8000-000000000013' returning status) select * from u$$, array['draft'],
  'moderação do admin (recusar e voltar a rascunho) não é afetada');
select pg_temp.como('postgres');
select results_eq($$select status from events where id = 'c4000000-0000-4000-8000-000000000012'$$, array['published'],
  'o evento do teste do admin aal1 continua publicado');

-- Chave de serviço
select pg_temp.como('service_role');
select results_eq($$with u as (update events set status = 'cancelled' where id = 'c4000000-0000-4000-8000-000000000006'
  returning status) select * from u$$, array['cancelled'], 'chave de serviço cancela evento com venda');
select results_eq($$with u as (update events set status = 'draft' where id = 'c4000000-0000-4000-8000-000000000008'
  returning status) select * from u$$, array['draft'], 'chave de serviço volta a rascunho evento com venda');

select * from finish();
rollback;
