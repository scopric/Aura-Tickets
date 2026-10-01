-- pgTAP da Decisão 129 (parte 2 de docs/sql/20261006_saldo_e_cancelamento.sql): produtor não cancela evento com
-- ingresso vendido. Só no banco local: aplicar seg6, seg4, 20261005 e 20261006 e rodar `supabase test db`.
-- Tudo em begin ... rollback. pg_temp.como() troca papel e claims do JWT como o PostgREST.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(10);

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

-- e1 sem venda, e2 ingresso active, e3 ingresso used, e4 só cancelled/refunded, e5 active (para o admin),
-- e6 active (para a chave de serviço)
insert into public.events (id, producer_id, title, slug, status)
select ('c4000000-0000-4000-8000-0000000000e' || n)::uuid, 'c4000000-0000-4000-8000-000000000001', 'Evento ' || n,
       'canc-e' || n, 'published'
from generate_series(1, 6) n;
insert into public.orders (id, user_id, event_id)
select ('c4000000-0000-4000-8000-0000000000a' || n)::uuid, 'c4000000-0000-4000-8000-000000000002',
       ('c4000000-0000-4000-8000-0000000000e' || n)::uuid
from generate_series(2, 6) n;
insert into public.ticket_types (id, event_id, name)
select ('c4000000-0000-4000-8000-0000000000b' || n)::uuid, ('c4000000-0000-4000-8000-0000000000e' || n)::uuid, 'Pista'
from generate_series(2, 6) n;
insert into public.tickets (order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, status)
select ('c4000000-0000-4000-8000-0000000000a' || n)::uuid, ('c4000000-0000-4000-8000-0000000000b' || n)::uuid,
       ('c4000000-0000-4000-8000-0000000000e' || n)::uuid, 'c4000000-0000-4000-8000-000000000002', 'Comprador',
       'canc-comp@teste.local', st
from (values (2, 'active'), (3, 'used'), (4, 'cancelled'), (4, 'refunded'), (5, 'active'), (6, 'active')) v(n, st);

select ok(exists (select 1 from pg_trigger where tgrelid = 'public.events'::regclass and tgname = 'gf_protect_event_cancel'),
  'gatilho gf_protect_event_cancel existe');

-- Produtor
select pg_temp.como('authenticated', 'c4000000-0000-4000-8000-000000000001');
select results_eq($$with u as (update events set status = 'cancelled' where id = 'c4000000-0000-4000-8000-0000000000e1'
  returning status) select * from u$$, array['cancelled'], 'produtor cancela evento sem venda');
select throws_ok($$update events set status = 'cancelled' where id = 'c4000000-0000-4000-8000-0000000000e2'$$,
  'EV001', 'Este evento tem ingressos vendidos. Para cancelar, fale com o suporte da Evokaa.',
  'produtor não cancela evento com ingresso active');
select throws_ok($$update events set status = 'cancelled' where id = 'c4000000-0000-4000-8000-0000000000e3'$$,
  'EV001', null, 'produtor não cancela evento com ingresso used');
select results_eq($$with u as (update events set status = 'cancelled' where id = 'c4000000-0000-4000-8000-0000000000e4'
  returning status) select * from u$$, array['cancelled'], 'só ingressos cancelled/refunded: produtor cancela');
select results_eq($$with u as (update events set title = 'Evento 2 renomeado' where id = 'c4000000-0000-4000-8000-0000000000e2'
  returning title) select * from u$$, array['Evento 2 renomeado'], 'produtor edita o título do evento com venda');
select results_eq($$with u as (update events set status = 'ended' where id = 'c4000000-0000-4000-8000-0000000000e2'
  returning status) select * from u$$, array['ended'], 'produtor arquiva (ended) o evento com venda');
select results_eq($$select status from events where id = 'c4000000-0000-4000-8000-0000000000e3'$$, array['published'],
  'o evento com used continua publicado depois da recusa');

-- Admin (fator confirmado + aal2) e chave de serviço
select pg_temp.como('authenticated', 'c4000000-0000-4000-8000-000000000003', 'aal2');
select results_eq($$with u as (update events set status = 'cancelled' where id = 'c4000000-0000-4000-8000-0000000000e5'
  returning status) select * from u$$, array['cancelled'], 'admin cancela evento com venda');
select pg_temp.como('service_role');
select results_eq($$with u as (update events set status = 'cancelled' where id = 'c4000000-0000-4000-8000-0000000000e6'
  returning status) select * from u$$, array['cancelled'], 'chave de serviço cancela evento com venda');

select * from finish();
rollback;
