-- pgTAP de docs/sql/20261028_equipe_portaria.sql. Banco com o baseline + docs/sql até este arquivo; `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(59);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal2') returns void
language plpgsql as $f$
declare e text;
begin
  perform set_config('role', 'none', true);  -- volta ao dono do teste para ler o e-mail
  e := (select email from auth.users where id = p);
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'email', e, 'aal', case when p is not null then p_aal end,
    'amr', case when p is not null and p_aal = 'aal2' then json_build_array(json_build_object('method', 'totp',
      'timestamp', extract(epoch from now())::bigint)) end))::text end, true);
  perform set_config('role', case when p_role = 'postgres' then 'none' else p_role end, true);
end $f$;
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;
-- quantas linhas cada RPC devolve
create function pg_temp.n_ev() returns int language sql as $f$ select count(*)::int from public.team_eventos() $f$;
create function pg_temp.n_li(e uuid) returns int language sql as $f$ select count(*)::int from public.team_lista_ingressos(e) $f$;
create function pg_temp.tot(e uuid) returns int language sql as $f$ select coalesce((select total::int from public.team_contagem(e)), -1) $f$;
grant execute on function pg_temp.n_ev(), pg_temp.n_li(uuid), pg_temp.tot(uuid) to authenticated;

-- 01 produtor, 02 membro admin (aceita no teste), 03 viewer aceito, 04 editor pendente, 05 editor bloqueado,
-- 06 sem fator, 07 super_admin, 08 só com convite pendente (vira colaborador), 09 com fator em aal1,
-- 10 outro produtor, 11 editor aceito do produtor 10
insert into auth.users (id, email, raw_user_meta_data) values
  ('e2000000-0000-4000-8000-000000000001', 'p@teste-equipe.local', '{"role":"producer"}'),
  ('e2000000-0000-4000-8000-000000000002', 'm@teste-equipe.local', '{}'),
  ('e2000000-0000-4000-8000-000000000003', 'v@teste-equipe.local', '{}'),
  ('e2000000-0000-4000-8000-000000000004', 'n@teste-equipe.local', '{}'),
  ('e2000000-0000-4000-8000-000000000005', 'b@teste-equipe.local', '{}'),
  ('e2000000-0000-4000-8000-000000000006', 'o@teste-equipe.local', '{}'),
  ('e2000000-0000-4000-8000-000000000007', 's@teste-equipe.local', '{}'),
  ('e2000000-0000-4000-8000-000000000008', 'c@teste-equipe.local', '{}'),
  ('e2000000-0000-4000-8000-000000000009', 'a@teste-equipe.local', '{}'),
  ('e2000000-0000-4000-8000-000000000010', 'q@teste-equipe.local', '{"role":"producer"}'),
  ('e2000000-0000-4000-8000-000000000011', 'r@teste-equipe.local', '{}');
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
select ('e2000000-0000-4000-9000-0000000000' || n)::uuid, ('e2000000-0000-4000-8000-0000000000' || n)::uuid, 'teste', 'totp', 'verified', now(), now()
from unnest(array['01', '02', '03', '04', '05', '07', '08', '09', '10', '11']) n;
update public.profiles set role = 'producer' where id in ('e2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000010');
update public.profiles set role = 'admin', admin_permissions = array['super_admin']::text[] where id = 'e2000000-0000-4000-8000-000000000007';

insert into public.team_members (id, producer_id, user_id, role, accepted_at, blocked_at) values
  ('e2000000-0000-4000-a000-000000000002', 'e2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000002', 'admin', null, null),
  ('e2000000-0000-4000-a000-000000000003', 'e2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000003', 'viewer', now(), null),
  ('e2000000-0000-4000-a000-000000000004', 'e2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000004', 'editor', null, null),
  ('e2000000-0000-4000-a000-000000000005', 'e2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000005', 'editor', null, now()),
  ('e2000000-0000-4000-a000-000000000006', 'e2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000006', 'editor', null, null),
  ('e2000000-0000-4000-a000-000000000008', 'e2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000008', 'editor', null, null),
  ('e2000000-0000-4000-a000-000000000009', 'e2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000009', 'editor', null, null),
  ('e2000000-0000-4000-a000-000000000011', 'e2000000-0000-4000-8000-000000000010', 'e2000000-0000-4000-8000-000000000011', 'editor', now(), null);

-- b1: publicado e público; b5: publicado e privado; b6: rascunho
insert into public.events (id, producer_id, title, slug, status, approval_status, visibility) values
  ('e2000000-0000-4000-b000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'Festa da equipe', 'equipe-portaria-1', 'published', 'approved', 'public'),
  ('e2000000-0000-4000-b000-000000000005', 'e2000000-0000-4000-8000-000000000001', 'Festa fechada', 'equipe-portaria-2', 'published', 'approved', 'private'),
  ('e2000000-0000-4000-b000-000000000006', 'e2000000-0000-4000-8000-000000000001', 'Rascunho', 'equipe-portaria-3', 'draft', 'pending', 'public');
insert into public.ticket_types (id, event_id, name, is_active) values
  ('e2000000-0000-4000-b000-000000000002', 'e2000000-0000-4000-b000-000000000001', 'Pista', false),
  ('e2000000-0000-4000-b000-000000000007', 'e2000000-0000-4000-b000-000000000005', 'Camarote', true);
insert into public.orders (id, user_id, event_id, total, status) values ('e2000000-0000-4000-b000-000000000003', 'e2000000-0000-4000-8000-000000000006', 'e2000000-0000-4000-b000-000000000001', 100, 'paid');
insert into public.tickets (id, order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, buyer_cpf, status) values
  ('e2000000-0000-4000-b000-000000000004', 'e2000000-0000-4000-b000-000000000003', 'e2000000-0000-4000-b000-000000000002', 'e2000000-0000-4000-b000-000000000001', 'e2000000-0000-4000-8000-000000000006', 'Comprador', 'o@teste-equipe.local', '12345678909', 'active'),
  ('e2000000-0000-4000-b000-000000000008', 'e2000000-0000-4000-b000-000000000003', 'e2000000-0000-4000-b000-000000000007', 'e2000000-0000-4000-b000-000000000005', 'e2000000-0000-4000-8000-000000000006', 'Convidada', 'o@teste-equipe.local', null, 'used'),
  ('e2000000-0000-4000-b000-000000000009', 'e2000000-0000-4000-b000-000000000003', 'e2000000-0000-4000-b000-000000000007', 'e2000000-0000-4000-b000-000000000006', 'e2000000-0000-4000-8000-000000000006', 'Rascunho', 'o@teste-equipe.local', null, 'active');
-- denúncias liberadas ao produtor: contra o pendente (04) e contra o membro que vai aceitar (02)
insert into public.mesa_denuncias (denunciante, denunciado, evento, evento_em, motivo, mesma_mesa, liberada_produtor_em) values
  ('e2000000-0000-4000-8000-000000000006', 'e2000000-0000-4000-8000-000000000004', 'e2000000-0000-4000-b000-000000000001', now(), 'outro', false, now()),
  ('e2000000-0000-4000-8000-000000000006', 'e2000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-b000-000000000001', now(), 'outro', false, now());

-- permissões e formato
select ok(not has_function_privilege('anon', 'public.team_aceitar_convite(uuid)', 'execute'), 'anon não executa team_aceitar_convite');
select ok(not has_function_privilege('anon', 'public.team_meus_convites()', 'execute'), 'anon não executa team_meus_convites');
select ok(not has_function_privilege('anon', 'public.team_eventos()', 'execute'), 'anon não executa team_eventos');
select ok(not has_function_privilege('anon', 'public.team_lista_ingressos(uuid)', 'execute'), 'anon não executa team_lista_ingressos');
select ok(not has_function_privilege('authenticated', 'public.gf_portaria_ok(uuid)', 'execute'), 'gf_portaria_ok é só interna');
select ok(not has_function_privilege('anon', 'public.team_contagem(uuid)', 'execute'), 'anon não executa team_contagem');
select is((select count(*)::int from pg_policies where tablename = 'tickets' and policyname = 'tickets_equipe_select'), 0, 'nenhuma regra nova em tickets');
select is(to_regprocedure('public.gf_equipe_de(uuid)'), null, 'gf_equipe_de não existe');
select is(pg_get_function_result('public.team_lista_ingressos(uuid)'::regprocedure),
  'TABLE(id uuid, buyer_name text, status text, checked_in_at timestamp with time zone, tipo text)', 'lista devolve exatamente as 5 colunas');

-- membro 02 (aal2, com fator), ainda pendente
select pg_temp.como('authenticated', 'e2000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.team_meus_convites() where accepted_at is null), 1, 'membro vê o próprio convite pendente');
select is(pg_temp.n_ev(), 0, 'pendente: sem eventos');
select is(pg_temp.n_li('e2000000-0000-4000-b000-000000000001'), 0, 'pendente: lista vazia');
select throws_ok($$select public.team_aceitar_convite('e2000000-0000-4000-a000-000000000004')$$, 'P0001', 'Convite não encontrado ou já aceito.', 'convite de outra conta falha');
select lives_ok($$select public.team_aceitar_convite('e2000000-0000-4000-a000-000000000002')$$, 'aceita o próprio');
select throws_ok($$select public.team_aceitar_convite('e2000000-0000-4000-a000-000000000002')$$, 'P0001', 'Convite não encontrado ou já aceito.', 'reuso falha');
select throws_ok($$select public.team_aceitar_convite('e2000000-0000-4000-a000-0000000000ff')$$, 'P0001', 'Convite não encontrado ou já aceito.', 'convite inexistente: mesma mensagem');
select is((select count(*)::int from public.tickets), 0, 'membro aceito NÃO lê tickets direto');
select is((select array_agg(title order by title) from public.team_eventos()), array['Festa da equipe', 'Festa fechada'], 'membro aceito: eventos publicados, inclusive o privado; rascunho fora');
select is((select array_agg(buyer_name || '/' || tipo || '/' || status) from public.team_lista_ingressos('e2000000-0000-4000-b000-000000000001')),
  array['Comprador/Pista/active'], 'lista com o nome do tipo mesmo inativo');
select is(pg_temp.n_li('e2000000-0000-4000-b000-000000000005'), 1, 'evento privado: lista funciona');
select is(pg_temp.n_li('e2000000-0000-4000-b000-000000000006'), 0, 'rascunho: lista vazia');
select is(pg_temp.tot('e2000000-0000-4000-b000-000000000006'), 0, 'rascunho: contagem zero');
select is((select row(total, usados, cancelados, transferidos)::text from public.team_contagem('e2000000-0000-4000-b000-000000000005')), '(1,1,0,0)', 'contagem por status');

-- 2FA contínuo: o mesmo membro aceito em aal1 não lista nada; team_meus_convites avisa
select pg_temp.como('authenticated', 'e2000000-0000-4000-8000-000000000002', 'aal1');
select is(pg_temp.n_ev(), 0, 'aceito em aal1: sem eventos');
select is(pg_temp.n_li('e2000000-0000-4000-b000-000000000001'), 0, 'aceito em aal1: lista vazia');
select is(pg_temp.tot('e2000000-0000-4000-b000-000000000001'), 0, 'aceito em aal1: contagem zero');
select throws_ok($$select * from public.team_meus_convites()$$, '42501', null, 'aal1 com fator: meus convites pede o código');

-- bloqueado (05)
select pg_temp.como('authenticated', 'e2000000-0000-4000-8000-000000000005');
select throws_ok($$select public.team_aceitar_convite('e2000000-0000-4000-a000-000000000005')$$, 'P0001', 'Convite não encontrado ou já aceito.', 'bloqueado não aceita');
select is((select count(*)::int from public.team_meus_convites()), 0, 'bloqueado não aparece na lista');

-- 2FA no aceite
select pg_temp.como('authenticated', 'e2000000-0000-4000-8000-000000000009', 'aal1');
select throws_ok($$select public.team_aceitar_convite('e2000000-0000-4000-a000-000000000009')$$, '42501', null, 'com fator em aal1 não aceita');
select pg_temp.como('authenticated', 'e2000000-0000-4000-8000-000000000006', 'aal1');
select throws_ok($$select public.team_aceitar_convite('e2000000-0000-4000-a000-000000000006')$$, '42501', null, 'sem fator cadastrado não aceita');
select pg_temp.como('authenticated', 'e2000000-0000-4000-8000-000000000006', 'aal2');
select throws_ok($$select public.team_aceitar_convite('e2000000-0000-4000-a000-000000000006')$$, '42501', null, 'aal2 sem fator verified não aceita');

select pg_temp.como('postgres');
select is((select count(*)::int from public.team_members where accepted_at is not null), 3, 'só 02, 03 e 11 aceitos (falhas não mudaram linha)');
update public.team_members set accepted_at = now() where id in ('e2000000-0000-4000-a000-000000000005', 'e2000000-0000-4000-a000-000000000006');
update public.team_members set role = 'editor' where id = 'e2000000-0000-4000-a000-000000000002';

select pg_temp.como('authenticated', 'e2000000-0000-4000-8000-000000000002');
select is(pg_temp.n_li('e2000000-0000-4000-b000-000000000001'), 1, 'membro aceito (editor) lista');
select pg_temp.como('authenticated', 'e2000000-0000-4000-8000-000000000003');
select is(pg_temp.n_ev(), 0, 'viewer aceito: sem eventos');
select is(pg_temp.n_li('e2000000-0000-4000-b000-000000000001'), 0, 'viewer aceito: lista vazia');
select is(pg_temp.tot('e2000000-0000-4000-b000-000000000001'), 0, 'viewer aceito: contagem zero');
select pg_temp.como('authenticated', 'e2000000-0000-4000-8000-000000000004');
select is(pg_temp.n_li('e2000000-0000-4000-b000-000000000001'), 0, 'editor pendente: lista vazia');
select pg_temp.como('authenticated', 'e2000000-0000-4000-8000-000000000005');
select is(pg_temp.n_ev(), 0, 'aceito e bloqueado: sem eventos');
select is(pg_temp.n_li('e2000000-0000-4000-b000-000000000001'), 0, 'aceito e bloqueado: lista vazia');
select pg_temp.como('authenticated', 'e2000000-0000-4000-8000-000000000006', 'aal2');
select is(pg_temp.n_li('e2000000-0000-4000-b000-000000000001'), 0, 'aceito sem fator (mesmo com aal2 no token): lista vazia');
select pg_temp.como('authenticated', 'e2000000-0000-4000-8000-000000000006', 'aal1');
select is(pg_temp.n_ev(), 0, 'aceito sem fator em aal1: sem eventos');
select pg_temp.como('authenticated', 'e2000000-0000-4000-8000-000000000011');
select is(pg_temp.n_ev(), 0, 'membro de OUTRO produtor: sem eventos deste');
select is(pg_temp.n_li('e2000000-0000-4000-b000-000000000001'), 0, 'membro de OUTRO produtor: lista vazia');
select is(pg_temp.tot('e2000000-0000-4000-b000-000000000001'), 0, 'membro de OUTRO produtor: contagem zero');
select pg_temp.como('authenticated', 'e2000000-0000-4000-8000-000000000001');
select is(pg_temp.n_li('e2000000-0000-4000-b000-000000000001'), 0, 'o dono não usa a RPC da equipe (lê direto)');

-- MÉDIO do #206: pendente não é equipe
select is(jsonb_array_length(public.mesa_denuncias_do_evento('e2000000-0000-4000-b000-000000000001')), 1,
  'produtor vê a denúncia contra o pendente; a contra o membro aceito segue fora');
-- mesa_conflito e mesa_denuncia_que_remove são uso interno (sem execute para authenticated): como postgres com o sub do produtor
select pg_temp.como('postgres');
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-4000-8000-000000000001"}', true);
select is(public.mesa_conflito('e2000000-0000-4000-b000-000000000001', 'e2000000-0000-4000-8000-000000000004'), false, 'mesa_conflito: pendente não é conflito');
select is(public.mesa_conflito('e2000000-0000-4000-b000-000000000001', 'e2000000-0000-4000-8000-000000000002'), true, 'mesa_conflito: aceito é conflito');
select isnt(public.mesa_denuncia_que_remove('e2000000-0000-4000-b000-000000000001', 'e2000000-0000-4000-8000-000000000004', true), null,
  'mesa_denuncia_que_remove: denúncia contra pendente vale para o produtor');
select is(public.mesa_denuncia_que_remove('e2000000-0000-4000-b000-000000000001', 'e2000000-0000-4000-8000-000000000002', true), null,
  'mesa_denuncia_que_remove: contra membro aceito, não');

select pg_temp.como('authenticated', 'e2000000-0000-4000-8000-000000000007');
select lives_ok($$select public.convite_criar('c@teste-equipe.local', 'Atendimento', '{manage_support}', encode(sha256(convert_to('tok-c', 'UTF8')), 'hex'))$$,
  'convite de colaborador a quem só tem convite de equipe pendente passa');
select throws_ok($$select public.convite_criar('m@teste-equipe.local', 'Atendimento', '{manage_support}', repeat('b', 64))$$, 'P0001',
  'Este e-mail faz parte da equipe de um produtor. Convide outro e-mail, só para o trabalho na Evokaa.', 'membro aceito continua barrado em convite_criar');

-- convite_aceitar: pendente passa; depois, a conta admin não entra na equipe
select pg_temp.como('authenticated', 'e2000000-0000-4000-8000-000000000008');
select lives_ok($$select public.convite_aceitar('tok-c', jsonb_build_object('nome_completo', 'Clara Teste da Silva', 'cpf', '529.982.247-25',
  'rg', '12.345.678-9', 'data_nascimento', '1990-05-20', 'cep', '01310-100', 'rua', 'Avenida Paulista', 'numero', '1000',
  'complemento', 'Sala 1', 'bairro', 'Bela Vista', 'cidade', 'São Paulo', 'uf', 'SP', 'email_secundario', 'clara.pessoal@teste-convite.invalid',
  'telefone', '+5511987654321', 'whatsapp', '+5511987654321', 'emergencia_nome', 'Pedro Teste', 'emergencia_parentesco', 'Irmão',
  'emergencia_telefone', '+5511912345678', 'banco', 'Banco Teste', 'agencia', '0001', 'conta', '12345-6',
  'pix_tipo', 'email', 'pix_chave', 'Clara.Pix@teste-convite.invalid'))$$, 'convite_aceitar: quem só tem convite de equipe pendente vira colaborador');
select throws_ok($$select public.team_aceitar_convite('e2000000-0000-4000-a000-000000000008')$$, 'P0001', 'Convite não encontrado ou já aceito.',
  'colaborador da Evokaa (admin) não aceita convite de equipe');
select pg_temp.como('postgres');
select is((select accepted_at from public.team_members where id = 'e2000000-0000-4000-a000-000000000008'), null, 'e a linha não mudou');

-- membro aceito continua barrado em convite_aceitar (02); o convite entra direto (convite_criar já o recusa)
insert into public.admin_invites (email, cargo, permissions, token_hash, created_by)
values ('m@teste-equipe.local', 'Atendimento', '{manage_support}', encode(sha256(convert_to('tok-m', 'UTF8')), 'hex'), 'e2000000-0000-4000-8000-000000000007');
select pg_temp.como('authenticated', 'e2000000-0000-4000-8000-000000000002');
select throws_ok($$select public.convite_aceitar('tok-m', '{}'::jsonb)$$, 'P0001',
  'Este e-mail faz parte da equipe de um produtor. Convide outro e-mail, só para o trabalho na Evokaa.', 'membro aceito continua barrado em convite_aceitar');

-- evento com mais de 1000 ingressos: a lista para em 1000, a contagem conta todos
select pg_temp.como('postgres');
insert into public.tickets (order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, status)
select 'e2000000-0000-4000-b000-000000000003', 'e2000000-0000-4000-b000-000000000007', 'e2000000-0000-4000-b000-000000000005',
       'e2000000-0000-4000-8000-000000000006', 'Lote ' || g, 'o@teste-equipe.local', 'active'
from generate_series(1, 1005) g;
select pg_temp.como('authenticated', 'e2000000-0000-4000-8000-000000000002');
select is(pg_temp.n_li('e2000000-0000-4000-b000-000000000005'), 1000, 'lista limitada a 1000');
select is(pg_temp.tot('e2000000-0000-4000-b000-000000000005'), 1006, 'contagem conta todos (1 + 1005)');

select * from finish();
rollback;
