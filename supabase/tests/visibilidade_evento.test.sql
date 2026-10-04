-- pgTAP do PR3e-1 (docs/sql/20261017_f1_pr3e_visibilidade.sql). Só no banco local: `supabase start`, aplicar o SQL do PR3e-1
-- e rodar `supabase test db`. Tudo em begin ... rollback: nada fica gravado. Nunca contra produção.
-- Cobre o que existe neste PR: Pública e Só com link. Senha e Convidados (evento_liberado, evento_convidados) ganham
-- testes nos PR3e-2/3. pg_temp.como() troca o papel e as claims do JWT, igual a supabase/tests/favoritos.test.sql.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(46);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', p_role, true);
end $f$;
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- Dados (como postgres): p produtor dono; a participante ---------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('fb000000-0000-4000-8000-00000000000a', 'a@teste-vis.local', now(), '{"full_name":"Ana"}'),
  ('fb000000-0000-4000-8000-000000000009', 'p@teste-vis.local', now(), '{"role":"producer","full_name":"Paula"}');
-- e1 pública; e2 só com link; e3 com senha; e4 só convidados; e5 só com link mas rascunho; e6 pública mas em análise
insert into public.events (id, producer_id, title, slug, status, approval_status, visibility, mostrar_contagem) values
  ('fb000000-0000-4000-8000-0000000000e1', 'fb000000-0000-4000-8000-000000000009', 'Pública', 'vis-e1', 'published', 'approved', 'public', true),
  ('fb000000-0000-4000-8000-0000000000e2', 'fb000000-0000-4000-8000-000000000009', 'Link', 'vis-e2', 'published', 'approved', 'unlisted', true),
  ('fb000000-0000-4000-8000-0000000000e3', 'fb000000-0000-4000-8000-000000000009', 'Senha', 'vis-e3', 'published', 'approved', 'password', true),
  ('fb000000-0000-4000-8000-0000000000e4', 'fb000000-0000-4000-8000-000000000009', 'Convidados', 'vis-e4', 'published', 'approved', 'private', true),
  ('fb000000-0000-4000-8000-0000000000e5', 'fb000000-0000-4000-8000-000000000009', 'Rascunho', 'vis-e5', 'draft', 'approved', 'unlisted', true),
  ('fb000000-0000-4000-8000-0000000000e6', 'fb000000-0000-4000-8000-000000000009', 'Em análise', 'vis-e6', 'published', 'pending', 'public', true);
-- um ingresso ativo por evento (e1 tem também um inativo); ids terminam em e1..e5 (tipo) e 51 (inativo de e1)
insert into public.ticket_types (id, event_id, name, is_active, sort_order) values
  ('fb000000-0000-4000-8000-0000000000b1', 'fb000000-0000-4000-8000-0000000000e1', 'Pista', true, 1),
  ('fb000000-0000-4000-8000-0000000000b2', 'fb000000-0000-4000-8000-0000000000e2', 'Pista', true, 1),
  ('fb000000-0000-4000-8000-0000000000b3', 'fb000000-0000-4000-8000-0000000000e3', 'Pista', true, 1),
  ('fb000000-0000-4000-8000-0000000000b4', 'fb000000-0000-4000-8000-0000000000e4', 'Pista', true, 1),
  ('fb000000-0000-4000-8000-0000000000b5', 'fb000000-0000-4000-8000-0000000000e5', 'Pista', true, 1),
  ('fb000000-0000-4000-8000-0000000000b9', 'fb000000-0000-4000-8000-0000000000e1', 'Inativo', false, 2);
-- pedidos de a criados pelo postgres, para testar order_items nos eventos que a RLS de orders não deixaria criar
insert into public.orders (id, user_id, event_id) values
  ('fb000000-0000-4000-8000-0000000000a3', 'fb000000-0000-4000-8000-00000000000a', 'fb000000-0000-4000-8000-0000000000e3');

-- Estrutura -------------------------------------------------------------------------------------------------------
select has_function('public', 'evento_acesso', array['uuid'], 'evento_acesso existe');
select has_function('public', 'evento_publico', array['text'], 'evento_publico existe');
select has_function('public', 'pode_comprar', array['uuid', 'uuid'], 'pode_comprar existe');
select ok((select bool_and(prosecdef and proconfig = array['search_path=""'])
  from pg_proc where oid in ('public.evento_acesso(uuid)'::regprocedure, 'public.evento_publico(text)'::regprocedure,
  'public.pode_comprar(uuid, uuid)'::regprocedure)), 'as 3 funções são security definer com search_path vazio');
select ok(has_function_privilege('anon', 'public.evento_acesso(uuid)', 'execute')
  and has_function_privilege('anon', 'public.evento_publico(text)', 'execute')
  and has_function_privilege('authenticated', 'public.evento_publico(text)', 'execute'),
  'anon executa evento_acesso e evento_publico; authenticated executa evento_publico');
select ok(not has_function_privilege('anon', 'public.pode_comprar(uuid, uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.pode_comprar(uuid, uuid)', 'execute'),
  'pode_comprar: authenticated sim, anon não');

-- evento_acesso (como postgres: sem login) -------------------------------------------------------------------------
select is(public.evento_acesso('fb000000-0000-4000-8000-0000000000e1'), 'aberto', 'pública: aberto');
select is(public.evento_acesso('fb000000-0000-4000-8000-0000000000e2'), 'link', 'só com link: link');
select is(public.evento_acesso('fb000000-0000-4000-8000-0000000000e3'), 'senha', 'com senha: senha (sem tabelas ainda)');
select is(public.evento_acesso('fb000000-0000-4000-8000-0000000000e4'), 'convidados', 'privada: convidados (sem tabelas ainda)');
select is(public.evento_acesso('fb000000-0000-4000-8000-0000000000e5'), null, 'rascunho: null');
select is(public.evento_acesso('fb000000-0000-4000-8000-0000000000e6'), null, 'em análise: null');
select is(public.evento_acesso('fb000000-0000-4000-8000-0000000000ff'), null, 'evento que não existe: null');

-- Anônimo ---------------------------------------------------------------------------------------------------------
select pg_temp.como('anon');
select results_eq($$select id from public.events where slug like 'vis-e%'$$, array['fb000000-0000-4000-8000-0000000000e1']::uuid[],
  'anon lê só o evento público em events (nada de link, senha, convidados, rascunho, análise)');
select is((select count(*) from public.events where visibility = 'unlisted'), 0::bigint, 'anon: ?visibility=eq.unlisted devolve vazio');
select results_eq($$select event_id from public.ticket_types where event_id::text like 'fb000000%' order by event_id$$,
  array['fb000000-0000-4000-8000-0000000000e1']::uuid[], 'anon lê só o ingresso ativo do evento público');
select is(public.evento_acesso('fb000000-0000-4000-8000-0000000000e2'), 'link', 'anon chama evento_acesso');
select is(public.evento_publico('vis-e1') ->> 'acesso', 'aberto', 'evento_publico: slug de evento público');
select is(public.evento_publico('fb000000-0000-4000-8000-0000000000e1') #>> '{evento,slug}', 'vis-e1', 'evento_publico: por uuid');
select is(public.evento_publico('FB000000-0000-4000-8000-0000000000E1') #>> '{evento,slug}', 'vis-e1', 'evento_publico: uuid em maiúsculas');
select is(jsonb_array_length(public.evento_publico('vis-e1') -> 'ingressos'), 1, 'evento_publico: só o ingresso ativo');
select is(public.evento_publico('vis-e1') #>> '{evento,visibility}', 'public', 'evento_publico: traz as colunas do evento (visibility)');
select is(public.evento_publico('vis-e2') ->> 'acesso', 'link', 'evento_publico: só com link abre pelo slug');
select is(public.evento_publico('fb000000-0000-4000-8000-0000000000e2') #>> '{evento,slug}', 'vis-e2', 'evento_publico: só com link abre pelo uuid');
select is(jsonb_array_length(public.evento_publico('vis-e2') -> 'ingressos'), 1, 'evento_publico: só com link traz os ingressos');
select ok(public.evento_publico('vis-e3') ? 'cartao' and not (public.evento_publico('vis-e3') ? 'evento')
  and not (public.evento_publico('vis-e3') ? 'ingressos'), 'evento_publico: com senha devolve só o cartão');
select is(public.evento_publico('vis-e4'), null, 'evento_publico: privado devolve null');
select is(public.evento_publico('vis-e5'), null, 'evento_publico: rascunho devolve null');
select is(public.evento_publico('vis-e6'), null, 'evento_publico: em análise devolve null');
select is(public.evento_publico('nao-existe'), null, 'evento_publico: slug inexistente devolve null');
select lives_ok($$select public.evento_publico('não é uuid ''; --')$$, 'evento_publico: texto que não é uuid não dá erro');
select is(public.evento_contagem_publica('fb000000-0000-4000-8000-0000000000e2'), 0, 'contagem: só com link conta');
select is(public.evento_contagem_publica('fb000000-0000-4000-8000-0000000000e4'), null, 'contagem: privado não conta');
select throws_ok($$insert into public.orders (user_id, event_id) values
  ('fb000000-0000-4000-8000-00000000000a', 'fb000000-0000-4000-8000-0000000000e1')$$, '42501', null, 'anon não cria pedido');

-- Participante a --------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'fb000000-0000-4000-8000-00000000000a');
select results_eq($$select id from public.events where slug like 'vis-e%'$$, array['fb000000-0000-4000-8000-0000000000e1']::uuid[],
  'a lê só o evento público em events');
select lives_ok($$insert into public.orders (user_id, event_id) values
  ('fb000000-0000-4000-8000-00000000000a', 'fb000000-0000-4000-8000-0000000000e1')$$, 'a cria pedido em evento público');
select lives_ok($$insert into public.orders (user_id, event_id) values
  ('fb000000-0000-4000-8000-00000000000a', 'fb000000-0000-4000-8000-0000000000e2')$$, 'a cria pedido em evento só com link');
select throws_ok($$insert into public.orders (user_id, event_id) values
  ('fb000000-0000-4000-8000-00000000000a', 'fb000000-0000-4000-8000-0000000000e3')$$, '42501', null, 'a não cria pedido em evento com senha');
select throws_ok($$insert into public.orders (user_id, event_id) values
  ('fb000000-0000-4000-8000-00000000000a', 'fb000000-0000-4000-8000-0000000000e4')$$, '42501', null, 'a não cria pedido em evento de convidados');
select lives_ok($$insert into public.order_items (order_id, ticket_type_id, unit_price)
  select o.id, 'fb000000-0000-4000-8000-0000000000b2', 0 from public.orders o where o.event_id = 'fb000000-0000-4000-8000-0000000000e2'$$,
  'a põe item no pedido do evento só com link');
select throws_ok($$insert into public.order_items (order_id, ticket_type_id, unit_price) values
  ('fb000000-0000-4000-8000-0000000000a3', 'fb000000-0000-4000-8000-0000000000b3', 0)$$, '42501', null,
  'a não põe item no pedido do evento com senha');
select lives_ok($$insert into public.favoritos (user_id, event_id) values
  ('fb000000-0000-4000-8000-00000000000a', 'fb000000-0000-4000-8000-0000000000e1')$$, 'a favorita evento público');
select throws_ok($$insert into public.favoritos (user_id, event_id) values
  ('fb000000-0000-4000-8000-00000000000a', 'fb000000-0000-4000-8000-0000000000e2')$$, '42501', null, 'a não favorita evento só com link');

-- Dono ------------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'fb000000-0000-4000-8000-000000000009');
select is((select count(*) from public.events where slug like 'vis-e%'), 6::bigint, 'o dono lê os 6 eventos dele');
select is(public.evento_acesso('fb000000-0000-4000-8000-0000000000e4'), 'aberto', 'o dono tem acesso aberto ao evento de convidados');
select is(public.evento_publico('vis-e5') ->> 'acesso', 'aberto', 'o dono abre o próprio rascunho pela página');

select * from finish();
rollback;
