-- pgTAP de docs/sql/20261031e_certificado_validar.sql. Só no banco local descartável: aplicar o SQL e rodar `supabase test db`. Tudo em begin ... rollback. Nunca contra produção.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(14);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('fe000000-0000-4000-8000-000000000001', 'org@teste-cert.local', now(), '{}'::jsonb),
  ('fe000000-0000-4000-8000-000000000002', 'part@teste-cert.local', now(), '{}'::jsonb);
insert into public.events (id, producer_id, title, slug, status, approval_status, start_date) values
  ('fe000000-0000-4000-8000-0000000000e1', 'fe000000-0000-4000-8000-000000000001', 'Workshop de Teste', 'cert-e1', 'published', 'approved', '2026-12-12 20:00:00+00');
insert into public.certificates (id, event_id, template) values
  ('fe000000-0000-4000-8000-0000000000c1', 'fe000000-0000-4000-8000-0000000000e1', '{"horas": "8"}'::jsonb);
insert into public.issued_certificates (certificate_id, user_id, code) values
  ('fe000000-0000-4000-8000-0000000000c1', 'fe000000-0000-4000-8000-000000000002', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa');

insert into public.orders (id, user_id, event_id, total, status) values
  ('fe000000-0000-4000-8000-0000000000f1', 'fe000000-0000-4000-8000-000000000002', 'fe000000-0000-4000-8000-0000000000e1', 0, 'paid');
insert into public.ticket_types (id, event_id, name, price, quantity_total) values
  ('fe000000-0000-4000-8000-0000000000b1', 'fe000000-0000-4000-8000-0000000000e1', 'Geral', 0, 10);
insert into public.tickets (id, order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, status) values
  ('fe000000-0000-4000-8000-0000000000a1', 'fe000000-0000-4000-8000-0000000000f1', 'fe000000-0000-4000-8000-0000000000b1', 'fe000000-0000-4000-8000-0000000000e1',
   'fe000000-0000-4000-8000-000000000002', 'Maria Participante', 'part@teste-cert.local', 'active');

-- anon chama a função (é o uso real: página pública sem login)
set local role anon;

select is(public.certificado_validar('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa') ->> 'valido', 'true', 'código válido: valido = true');
select is(public.certificado_validar('AAAAAAAA-1111-4111-8111-AAAAAAAAAAAA') ->> 'valido', 'true', 'maiúsculas também valem');
select is(public.certificado_validar('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa') ->> 'evento', 'Workshop de Teste', 'devolve o evento');
select is(public.certificado_validar('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa') ->> 'horas', '8', 'devolve a carga horária numérica');
select is(public.certificado_validar('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb') ->> 'valido', 'false', 'código inexistente: valido = false');
select is(public.certificado_validar('isto nao e um codigo') ->> 'valido', 'false', 'código malformado: valido = false');
select is(public.certificado_validar(null) ->> 'valido', 'false', 'nulo: valido = false');

-- nada de dado pessoal ou interno na resposta
select is((select array_agg(k order by k) from jsonb_object_keys(public.certificado_validar('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa')) k),
  array['data_evento', 'emitido_em', 'evento', 'horas', 'nome', 'organizador', 'valido'], 'só estas chaves saem');

select is(public.certificado_validar('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa') ->> 'nome', 'Maria Participante', 'nome = buyer_name do ingresso');

-- as mudanças abaixo são feitas como dono (reset role) e a chamada volta ao anon
reset role;
update public.certificates set template = '{"horas": "abc"}'::jsonb where id = 'fe000000-0000-4000-8000-0000000000c1';
set local role anon;
select is(public.certificado_validar('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa') ->> 'horas', null, 'horas não numérica sai nula');

reset role;
update public.certificates set template = '{"horas": "8"}'::jsonb where id = 'fe000000-0000-4000-8000-0000000000c1';
update public.events set status = 'draft' where id = 'fe000000-0000-4000-8000-0000000000e1';
set local role anon;
select is(public.certificado_validar('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa') ->> 'valido', 'true', 'evento draft mas aprovado ainda valida');

reset role;
update public.tickets set status = 'refunded' where id = 'fe000000-0000-4000-8000-0000000000a1';
set local role anon;
select is(public.certificado_validar('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa') ->> 'valido', 'false', 'ingresso estornado: valido = false');

reset role;
update public.tickets set status = 'active' where id = 'fe000000-0000-4000-8000-0000000000a1';
update public.events set approval_status = 'pending' where id = 'fe000000-0000-4000-8000-0000000000e1';
set local role anon;
select is(public.certificado_validar('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa') ->> 'valido', 'false', 'evento não aprovado: valido = false');

-- anon NÃO lê a tabela direto: sem policy para anon, a RLS devolve 0 linhas (o baseline concede SELECT)
select is((select count(*) from public.issued_certificates), 0::bigint, 'anon não vê nenhuma linha de issued_certificates');

select * from finish();
rollback;
