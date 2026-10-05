-- pgTAP da S8 do admin (docs/sql/20261020_admin_s8_moderacao.sql, Decisão 163 item 15): ingresso alterado em evento aprovado
-- AVISA o admin (events.ingressos_alterados_em) sem devolver o evento à análise; admin_evento_decidir decide em um UPDATE.
-- Só em banco descartável: baseline + docs/sql até o estado do main + o SQL da S8, e rodar este arquivo
-- (psql -f ou `supabase test db`). Tudo em begin ... rollback. Nunca contra produção.
-- Os pgTAP da F1-b (docs/sql/20261012_f1b_reenvio_testes.sql) rodam à parte, depois do S8, e têm de continuar passando.
-- Contas: p1 (produtor dono), p2 (outro produtor), adm_ev (manage_events, 2FA), adm_fin (manage_finance, 2FA).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(56);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.headers', '', true);
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', case when p_role = 'postgres' then 'none' else p_role end, true);
end $f$;
create function pg_temp.u(n int) returns uuid language sql as $f$ select ('d8000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $f$;
create function pg_temp.marca(ev int) returns timestamptz language sql as $f$
  select ingressos_alterados_em from public.events where id = pg_temp.u(ev) $f$;
create function pg_temp.ver(ev int) returns timestamptz language sql as $f$
  select updated_at from public.events where id = pg_temp.u(ev) $f$;
create function pg_temp.avisos(ev int) returns bigint language sql as $f$
  select count(*) from public.notifications where metadata->>'event_id' = pg_temp.u(ev)::text $f$;
create function pg_temp.limpa(ev int) returns void language sql as $f$
  update public.events set ingressos_alterados_em = null where id = pg_temp.u(ev) $f$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;
grant execute on all functions in schema extensions to anon, authenticated, service_role;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select pg_temp.u(n), 'p' || n || '@teste-s8.local', now(), '{}' from unnest(array[1, 2, 8, 9]) n;
insert into public.profiles (id, email, role) select pg_temp.u(n), 'p' || n || '@teste-s8.local', 'user' from unnest(array[1, 2, 8, 9]) n
on conflict (id) do nothing;
insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at) select gen_random_uuid(), pg_temp.u(n), 'totp', 'verified', now(), now() from unnest(array[8, 9]) n;
update public.profiles set role = 'admin', admin_permissions = array['manage_events']::text[] where id = pg_temp.u(9);
update public.profiles set role = 'admin', admin_permissions = array['manage_finance']::text[] where id = pg_temp.u(8);

-- Eventos do produtor 1: 10 aprovado (ingressos) | 11 aprovado em destaque (revogar) | 12 aprovado (recusar)
-- 13 pending com marca antiga (aprovar) | 14 pending (ingresso não marca) | 15 cancelado aprovado (revogar) | 16 aprovado (versão)
-- 17 aprovado (decisão inválida e motivo) | 18 aprovado com marca (recusar mantém a marca)
-- 19 aprovado (revogar com versão velha) | 20 pending (aprovar com versão velha) | 22 rejected (revogar) | 21 do admin adm_fin (admin de outra área), com marca
insert into public.events (id, producer_id, title, slug, status, approval_status, approved_at, approved_by, featured_carousel) values
  (pg_temp.u(10), pg_temp.u(1), 'E10', 's8-e10', 'published', 'approved', now(), pg_temp.u(9), false),
  (pg_temp.u(11), pg_temp.u(1), 'E11', 's8-e11', 'published', 'approved', now(), pg_temp.u(9), true),
  (pg_temp.u(12), pg_temp.u(1), 'E12', 's8-e12', 'published', 'approved', now(), pg_temp.u(9), true),
  (pg_temp.u(13), pg_temp.u(1), 'E13', 's8-e13', 'published', 'pending', null, null, false),
  (pg_temp.u(14), pg_temp.u(1), 'E14', 's8-e14', 'published', 'pending', null, null, false),
  (pg_temp.u(15), pg_temp.u(1), 'E15', 's8-e15', 'cancelled', 'approved', now(), pg_temp.u(9), true),
  (pg_temp.u(16), pg_temp.u(1), 'E16', 's8-e16', 'published', 'approved', now(), pg_temp.u(9), false),
  (pg_temp.u(17), pg_temp.u(1), 'E17', 's8-e17', 'published', 'approved', now(), pg_temp.u(9), false),
  (pg_temp.u(18), pg_temp.u(1), 'E18', 's8-e18', 'published', 'approved', now(), pg_temp.u(9), false),
  (pg_temp.u(19), pg_temp.u(1), 'E19', 's8-e19', 'published', 'approved', now(), pg_temp.u(9), false),
  (pg_temp.u(20), pg_temp.u(1), 'E20', 's8-e20', 'published', 'pending', null, null, false),
  (pg_temp.u(21), pg_temp.u(8), 'E21', 's8-e21', 'published', 'approved', now(), pg_temp.u(9), false);
insert into public.events (id, producer_id, title, slug, status, approval_status, rejection_reason) values
  (pg_temp.u(22), pg_temp.u(1), 'E22', 's8-e22', 'draft', 'rejected', 'Faltou o alvará');
update public.events set ingressos_alterados_em = '2026-01-01' where id in (pg_temp.u(13), pg_temp.u(18), pg_temp.u(21));
insert into public.ticket_types (id, event_id, name, price, quantity_total) values
  (pg_temp.u(50), pg_temp.u(10), 'Pista', 50, 100), (pg_temp.u(51), pg_temp.u(14), 'Pista', 50, 100);
select pg_temp.limpa(10);  -- o INSERT acima já gravou a marca (evento 10 aprovado): zera para os testes partirem de null

-- A. A marca: material grava, o resto não, e nada devolve à análise ------------------------------------------------------
select pg_temp.como('authenticated', pg_temp.u(1));
update public.ticket_types set price = 80 where id = pg_temp.u(50);
select pg_temp.como('postgres');
select isnt(pg_temp.marca(10), null, 'produtor muda preço em evento aprovado: ingressos_alterados_em preenchido');
select is((select approval_status from public.events where id = pg_temp.u(10)), 'approved', '... e o evento continua approved');
select ok((select approved_at is not null and approved_by is not null and status = 'published' from public.events where id = pg_temp.u(10)),
  '... com approved_at, approved_by e status intactos');

select pg_temp.limpa(10);
select pg_temp.como('authenticated', pg_temp.u(1));
update public.ticket_types set is_active = false where id = pg_temp.u(50);
update public.ticket_types set sort_order = 3 where id = pg_temp.u(50);
update public.ticket_types set sale_start = now(), sale_end = now() + interval '1 day' where id = pg_temp.u(50);
select pg_temp.como('postgres');
select is(pg_temp.marca(10), null, 'pausar venda, sort_order e datas de venda não preenchem a marca');
update public.ticket_types set sold = 5, quantity_sold = 5 where id = pg_temp.u(50);
select is(pg_temp.marca(10), null, 'venda (sold, quantity_sold) não preenche a marca');

select pg_temp.como('authenticated', pg_temp.u(1));
update public.ticket_types set quantity_total = 200 where id = pg_temp.u(50);
select pg_temp.como('postgres');
select isnt(pg_temp.marca(10), null, 'mudar a quantidade preenche a marca');
select pg_temp.limpa(10);
select pg_temp.como('authenticated', pg_temp.u(1));
insert into public.ticket_types (id, event_id, name, price, quantity_total) values (pg_temp.u(52), pg_temp.u(10), 'VIP', 200, 10);
select pg_temp.como('postgres');
select isnt(pg_temp.marca(10), null, 'tipo novo de ingresso preenche a marca');
select pg_temp.limpa(10);
select pg_temp.como('authenticated', pg_temp.u(1));
update public.ticket_types set name = 'VIP Plus' where id = pg_temp.u(52);
select pg_temp.como('postgres');
select isnt(pg_temp.marca(10), null, 'mudar o nome preenche a marca');
select pg_temp.limpa(10);
select pg_temp.como('authenticated', pg_temp.u(1));
update public.ticket_types set inclui_bebida = true where id = pg_temp.u(52);
select pg_temp.como('postgres');
select isnt(pg_temp.marca(10), null, 'mudar inclui_bebida preenche a marca');
select pg_temp.limpa(10);
select pg_temp.como('authenticated', pg_temp.u(1));
update public.ticket_types set perks_array = array['open bar'] where id = pg_temp.u(52);
select pg_temp.como('postgres');
select isnt(pg_temp.marca(10), null, 'mudar perks_array preenche a marca');
select pg_temp.limpa(10);
select pg_temp.como('authenticated', pg_temp.u(1));
delete from public.ticket_types where id = pg_temp.u(52);
select pg_temp.como('postgres');
select isnt(pg_temp.marca(10), null, 'apagar um tipo de ingresso preenche a marca');
select is((select approval_status from public.events where id = pg_temp.u(10)), 'approved', '... e o evento segue approved depois de tantas mudanças');

select pg_temp.como('authenticated', pg_temp.u(1));
update public.ticket_types set price = 99 where id = pg_temp.u(51);
select pg_temp.como('postgres');
select is(pg_temp.marca(14), null, 'evento pending: mudar preço não preenche a marca');

-- B. O produtor não grava a marca nem aprovação direto ------------------------------------------------------------------
select pg_temp.como('authenticated', pg_temp.u(1));
select throws_ok($$update public.events set approval_status = 'approved' where id = 'd8000000-0000-4000-8000-000000000014'$$, '42501', null, 'produtor grava approval_status: 42501');
select throws_ok($$update public.events set ingressos_alterados_em = now() where id = 'd8000000-0000-4000-8000-000000000014'$$, '42501', 'ingressos_alterados_em é gravado só pelo banco', 'produtor grava a marca direto: 42501');
select throws_ok($$update public.events set ingressos_alterados_em = null where id = 'd8000000-0000-4000-8000-000000000018'$$, '42501', 'ingressos_alterados_em é gravado só pelo banco', 'produtor apaga a marca (esconder o aviso): 42501');
select throws_ok($$insert into public.events (producer_id, title, slug, ingressos_alterados_em) values ('d8000000-0000-4000-8000-000000000001', 'x', 's8-x', now())$$, '42501', null, 'produtor cria evento já com a marca: 42501');
select lives_ok($$update public.events set title = 'E14 novo' where id = 'd8000000-0000-4000-8000-000000000014'$$, 'produtor edita o evento normalmente (a marca não atrapalha)');
select pg_temp.como('postgres');
select is(pg_temp.marca(18), '2026-01-01'::timestamptz, 'a marca do evento 18 segue intacta');

-- C. A moderação da F1 segue como estava ------------------------------------------------------------------------------------
select is(md5(pg_get_functiondef('public.gf_protect_event_moderation'::regproc)), '31a06e7ddda4f033c8859a33fa67b725', 'gf_protect_event_moderation: md5 de produção, não recriada');
select is(position('ingressos_alterados_em' in pg_get_functiondef('public.gf_protect_event_moderation'::regproc)), 0, 'a coluna nova não está na lista de conteúdo da moderação');

-- D. admin_evento_decidir: quem pode ------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', pg_temp.u(1));
select throws_ok($$select public.admin_evento_decidir('d8000000-0000-4000-8000-000000000011', 'revogar', null, now())$$, '42501', null, 'produtor chama a RPC: 42501');
select pg_temp.como('authenticated', pg_temp.u(8), 'aal2');
select throws_ok($$select public.admin_evento_decidir('d8000000-0000-4000-8000-000000000011', 'revogar', null, now())$$, '42501', 'Sem permissão para moderar eventos', 'admin sem manage_events: 42501');
select pg_temp.como('anon');
select throws_ok($$select public.admin_evento_decidir('d8000000-0000-4000-8000-000000000011', 'revogar', null, now())$$, '42501', null, 'anon chama a RPC: 42501');
select pg_temp.como('authenticated', pg_temp.u(9), 'aal1');
select throws_ok($$select public.admin_evento_decidir('d8000000-0000-4000-8000-000000000011', 'revogar', null, now())$$, '42501', null, 'admin com manage_events sem 2FA nesta sessão (aal1): 42501');
select pg_temp.como('postgres');
select is((select approval_status from public.events where id = pg_temp.u(11)), 'approved', 'nenhuma dessas tentativas mudou o evento 11');

-- E. Trava de versão ---------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', pg_temp.u(9), 'aal2');
select throws_ok($$select public.admin_evento_decidir('d8000000-0000-4000-8000-000000000016', 'aprovar', null, '2020-01-01')$$, 'P0002',
  'O evento mudou desde que você abriu; recarregue.', 'aprovar com versão velha: P0002');
select throws_ok($$select public.admin_evento_decidir('d8000000-0000-4000-8000-000000000020', 'aprovar', null, '2020-01-01')$$, 'P0002', null, 'aprovar evento pending com versão velha: P0002');
select throws_ok($$select public.admin_evento_decidir('d8000000-0000-4000-8000-000000000016', 'recusar', 'x', '2020-01-01')$$, 'P0002', null, 'recusar com versão velha: P0002');
select pg_temp.como('postgres');
select ok((select approval_status = 'approved' and status = 'published' and approved_at is not null from public.events where id = pg_temp.u(16))
  and pg_temp.avisos(16) = 0, '... e nada muda (nem aviso ao produtor)');

-- F. Decisões ------------------------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', pg_temp.u(9), 'aal2');
select throws_ok($$select public.admin_evento_decidir('d8000000-0000-4000-8000-000000000017', 'banir', null, now())$$, '22023', null, 'decisão fora de aprovar/recusar/revogar: 22023');
select throws_ok($$select public.admin_evento_decidir('d8000000-0000-4000-8000-000000000017', 'recusar', null, now())$$, '22023', null, 'recusar sem motivo: 22023');
select throws_ok($$select public.admin_evento_decidir('d8000000-0000-4000-8000-000000000017', 'recusar', '   ', now())$$, '22023', null, 'recusar com motivo só de espaços: 22023');
select throws_ok(format($q$select public.admin_evento_decidir('d8000000-0000-4000-8000-000000000017', 'recusar', %L, now())$q$, repeat('x', 501)), '22023', null, 'recusar com motivo de 501 caracteres: 22023');

-- revogar: pending + draft + sem destaque, numa linha, 1 aviso, a marca fica
select pg_temp.como('postgres');
update public.events set ingressos_alterados_em = '2026-02-02' where id = pg_temp.u(11);
select pg_temp.como('authenticated', pg_temp.u(9), 'aal2');
select lives_ok(format($q$select public.admin_evento_decidir('d8000000-0000-4000-8000-000000000011', 'revogar', null, %L)$q$, (select updated_at from public.events where id = pg_temp.u(11))),
  'admin com manage_events revoga');
select pg_temp.como('postgres');
select ok((select approval_status = 'pending' and status = 'draft' and not featured_carousel and approved_at is null and approved_by is null
  and rejection_reason is null from public.events where id = pg_temp.u(11)), 'revogar: pending + draft + sem destaque + approved_at/by nulos, em uma linha');
select is(pg_temp.avisos(11), 1::bigint, 'revogar dispara 1 aviso ao produtor (antes eram 2 UPDATEs)');
select is(pg_temp.marca(11), '2026-02-02'::timestamptz, 'revogar não apaga a marca');

-- recusar: motivo gravado, 1 aviso, despublicado
select pg_temp.como('authenticated', pg_temp.u(9), 'aal2');
select lives_ok(format($q$select public.admin_evento_decidir('d8000000-0000-4000-8000-000000000012', 'recusar', %L, %L)$q$, '  Faltou o alvará  ', (select updated_at from public.events where id = pg_temp.u(12))),
  'recusar com motivo');
select pg_temp.como('postgres');
select ok((select approval_status = 'rejected' and rejection_reason = 'Faltou o alvará' and status = 'draft' and not featured_carousel
  and approved_at is null from public.events where id = pg_temp.u(12)), 'recusar: rejected, motivo (sem espaços nas pontas), draft, sem destaque');
select is(pg_temp.avisos(12), 1::bigint, 'recusar dispara 1 aviso ao produtor');

-- aprovar: zera a marca, grava approved_by, 1 aviso
select pg_temp.como('authenticated', pg_temp.u(9), 'aal2');
select lives_ok(format($q$select public.admin_evento_decidir('d8000000-0000-4000-8000-000000000013', 'aprovar', null, %L)$q$, (select updated_at from public.events where id = pg_temp.u(13))),
  'aprovar');
select pg_temp.como('postgres');
select ok((select approval_status = 'approved' and approved_by = pg_temp.u(9) and approved_at is not null and ingressos_alterados_em is null
  from public.events where id = pg_temp.u(13)), 'aprovar: approved, approved_by = o admin e a marca zerada');
select is(pg_temp.avisos(13), 1::bigint, 'aprovar dispara 1 aviso ao produtor');

-- revogar evento cancelado: não reabre como rascunho
select pg_temp.como('authenticated', pg_temp.u(9), 'aal2');
select lives_ok(format($q$select public.admin_evento_decidir('d8000000-0000-4000-8000-000000000015', 'revogar', null, %L)$q$, (select updated_at from public.events where id = pg_temp.u(15))),
  'revogar evento cancelado');
select pg_temp.como('postgres');
select is((select status from public.events where id = pg_temp.u(15)), 'cancelled', 'cancelled continua cancelled (só published vai a draft)');

-- recusar mantém a marca; o mesmo pedido repetido com a versão antiga falha (idempotência da trava)
select pg_temp.como('authenticated', pg_temp.u(9), 'aal2');
select lives_ok(format($q$select public.admin_evento_decidir('d8000000-0000-4000-8000-000000000018', 'recusar', 'x', %L)$q$, (select updated_at from public.events where id = pg_temp.u(18))),
  'recusar evento com marca');
select pg_temp.como('postgres');
select is(pg_temp.marca(18), '2026-01-01'::timestamptz, 'recusar não apaga a marca');
select is(pg_temp.avisos(18), 1::bigint, '... e dispara 1 aviso');

-- revogar ignora a versão (o produtor não impede a revogação mexendo no evento sem parar)
select pg_temp.como('authenticated', pg_temp.u(9), 'aal2');
select lives_ok($$select public.admin_evento_decidir('d8000000-0000-4000-8000-000000000019', 'revogar', null, '2020-01-01')$$, 'revogar com versão velha funciona');
select pg_temp.como('postgres');
select ok((select approval_status = 'pending' and status = 'draft' from public.events where id = pg_temp.u(19)), '... e o evento foi revogado');

-- revogar só vale em evento approved: revogar um rejected (tela velha) não apaga a recusa nem o motivo
select pg_temp.como('authenticated', pg_temp.u(9), 'aal2');
select throws_ok($$select public.admin_evento_decidir('d8000000-0000-4000-8000-000000000022', 'revogar', null, '2020-01-01')$$, 'P0002', null, 'revogar evento rejected: P0002');
select pg_temp.como('postgres');
select ok((select approval_status = 'rejected' and rejection_reason = 'Faltou o alvará' from public.events where id = pg_temp.u(22)), '... e a recusa e o motivo seguem intactos');
select is(pg_temp.avisos(22), 0::bigint, '... sem aviso ao produtor');

-- admin de outra área (sem manage_events), dono do evento, não apaga a marca
select pg_temp.como('authenticated', pg_temp.u(8), 'aal2');
select throws_ok($$update public.events set ingressos_alterados_em = null where id = 'd8000000-0000-4000-8000-000000000021'$$, '42501', 'ingressos_alterados_em é gravado só pelo banco', 'admin sem manage_events, dono do evento, apaga a marca: 42501');
select pg_temp.como('postgres');
select is(pg_temp.marca(21), '2026-01-01'::timestamptz, '... e a marca segue intacta');

select * from finish();
rollback;
