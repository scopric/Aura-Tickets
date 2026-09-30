-- F0a: moderação de eventos no banco e leitura só de evento aprovado (30/09/2026).
-- Corrige: (1) o produtor se autoaprovava e entrava no carrossel da home gravando approval_status e
-- featured_carousel direto pela API; (2) evento aprovado ou recusado editado não voltava para análise;
-- (3) tipos de ingresso de rascunho ou de evento não aprovado eram legíveis por qualquer um.
-- Também: depois da primeira venda, data e local só mudam pelo admin (até a F4; Decreto 13.108,
-- arts. 20 a 22), e quem tem ingresso continua lendo o evento e o tipo ("Meus ingressos").
-- NÃO recria gf_is_admin nem gf_mfa_ok: não precisa reaplicar o 20260930_2fa_no_banco.sql.
-- ORDEM: mesclar o PR e depois aplicar. Na ordem inversa nada quebra, exceto a tela de edição do
-- produtor em evento aprovado ou recusado, que dá erro até o front novo subir (o antigo manda
-- approval_status = 'pending'). Idempotente: pode rodar de novo.
-- NÃO mover para supabase/migrations/ (motivo no cabeçalho de 20260927_security_hardening.sql).
begin;

-- 1. O usuário tem ingresso do evento (qualquer status: vale o histórico). SECURITY DEFINER: lê
--    tickets sem passar pela RLS de tickets, que consulta events; assim as políticas não se chamam em ciclo.
create or replace function public.tem_ingresso(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tickets t
    where t.event_id = p_event and t.user_id = (select auth.uid())
  );
$$;
revoke execute on function public.tem_ingresso(uuid) from public, anon;
grant execute on function public.tem_ingresso(uuid) to authenticated, service_role;

-- 2. Moderação: aprovação e destaque são só do admin; conteúdo editado volta para análise; data e
--    local travam depois da venda. SECURITY DEFINER para ler tickets; por isso current_user é o dono
--    e quem decide "é usuário do app" é o papel do JWT (mesma checagem de gf_protect_profile_privileges).
--    Banco, servidor (service_role), pg_cron e admin passam direto.
create or replace function public.gf_protect_event_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not ((current_user in ('anon', 'authenticated')
           or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
          and not public.gf_is_admin()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.approval_status is distinct from 'pending'
       or new.approved_at is not null or new.approved_by is not null
       or new.rejection_reason is not null or coalesce(new.featured_carousel, false) then
      raise exception 'Evento novo entra em análise; aprovação e destaque são do admin' using errcode = '42501';
    end if;
    return new;
  end if;

  if (new.approval_status, new.approved_at, new.approved_by, new.rejection_reason, new.featured_carousel)
     is distinct from
     (old.approval_status, old.approved_at, old.approved_by, old.rejection_reason, old.featured_carousel) then
    raise exception 'Aprovação e destaque do evento são do admin' using errcode = '42501';
  end if;

  if (new.date, new.time, new.start_date, new.end_date, new.venue_name, new.venue_address, new.venue_city,
      new.venue_state, new.venue_zip, new.venue_lat, new.venue_lng)
     is distinct from
     (old.date, old.time, old.start_date, old.end_date, old.venue_name, old.venue_address, old.venue_city,
      old.venue_state, old.venue_zip, old.venue_lat, old.venue_lng)
     and exists (select 1 from public.tickets t
                 where t.event_id = old.id and t.status not in ('cancelled', 'refunded')) then
    raise exception 'Evento com ingresso vendido: data e local só mudam pelo admin (Decreto 13.108, arts. 20 a 22)'
      using errcode = '42501';
  end if;

  if old.approval_status in ('approved', 'rejected')
     and (new.title, new.subtitle, new.description, new.short_description, new.cover_image, new.image_url,
          new.gallery, new.category, new.date, new.time, new.start_date, new.end_date, new.venue_name,
          new.venue_address, new.venue_city, new.venue_state, new.venue_zip, new.venue_lat, new.venue_lng)
         is distinct from
         (old.title, old.subtitle, old.description, old.short_description, old.cover_image, old.image_url,
          old.gallery, old.category, old.date, old.time, old.start_date, old.end_date, old.venue_name,
          old.venue_address, old.venue_city, old.venue_state, old.venue_zip, old.venue_lat, old.venue_lng) then
    new.approval_status := 'pending';
    new.featured_carousel := false;
    new.approved_at := null;
    new.approved_by := null; -- rejection_reason fica: é o histórico da recusa
  end if;
  return new;
end;
$$;
revoke execute on function public.gf_protect_event_moderation() from public, anon, authenticated;
drop trigger if exists gf_protect_event_moderation on public.events;
create trigger gf_protect_event_moderation
  before insert or update on public.events
  for each row execute function public.gf_protect_event_moderation();

-- 3. events: quem tem ingresso lê o evento mesmo se ele sair do ar ("Meus ingressos").
--    "Eventos públicos ou do produtor" (aprovado ou do dono) continua como está.
drop policy if exists "Eventos publicos" on public.events;
drop policy if exists "Quem tem ingresso lê o evento" on public.events;
create policy "Quem tem ingresso lê o evento" on public.events
  for select to authenticated using (public.tem_ingresso(id));

-- 4. ticket_types: público só vê tipo ativo de evento publicado e aprovado; dono segue pela política
--    ALL "Produtores gerenciam ingressos dos próprios eventos"; admin e quem tem ingresso leem.
drop policy if exists "Ticket types publicos" on public.ticket_types;
drop policy if exists "Ingressos visíveis ao público ou ao produtor" on public.ticket_types;
drop policy if exists "Ingressos à venda de evento aprovado" on public.ticket_types;
drop policy if exists "Quem tem ingresso lê o tipo" on public.ticket_types;
drop policy if exists gf_ticket_types_admin_select on public.ticket_types;
create policy "Ingressos à venda de evento aprovado" on public.ticket_types
  for select to anon, authenticated
  using (is_active and exists (
    select 1 from public.events e
    where e.id = ticket_types.event_id and e.status = 'published' and e.approval_status = 'approved'));
create policy "Quem tem ingresso lê o tipo" on public.ticket_types
  for select to authenticated using (public.tem_ingresso(event_id));
create policy gf_ticket_types_admin_select on public.ticket_types
  for select to authenticated using ((select public.gf_is_admin()));

commit;

-- Conferência (só leitura). Esperado em events: "Admins gerenciam todos os eventos", "Eventos públicos
-- ou do produtor", "Produtor gerencia eventos", "Produtores gerenciam próprios eventos", "Quem tem
-- ingresso lê o evento", gf_mfa_aal2. Em ticket_types: "Ingressos à venda de evento aprovado",
-- "Produtores gerenciam ingressos dos próprios eventos", "Quem tem ingresso lê o tipo",
-- gf_mfa_aal2, gf_ticket_types_admin_select. Gatilhos em events: gf_protect_event_moderation e
-- tr_events_updated_at.
select tablename, policyname, cmd, roles::text
from pg_policies
where schemaname = 'public' and tablename in ('events', 'ticket_types')
union all
select 'events (gatilho)', tgname, null, null
from pg_trigger
where tgrelid = 'public.events'::regclass and not tgisinternal
order by 1, 2;

-- =============================================================================
-- TESTES (rodar à mão: tire o "-- " do começo das linhas abaixo e rode tudo de uma vez; o bloco
-- inteiro está num begin … rollback e não deixa nada gravado). Rodados em 30/09/2026 num Postgres
-- descartável (imagem supabase/postgres:17.6.1.171), com o arquivo aplicado duas vezes, sobre stubs
-- fora do repositório: auth.uid()/auth.jwt() de produção, auth.mfa_factors, profiles/events/
-- ticket_types/tickets/orders/order_items com as colunas de produção, gf_mfa_ok/gf_is_admin e as
-- políticas de produção de 30/09 (inclusive gf_mfa_aal2). Cada teste termina com "NOTICE: Tn OK";
-- falha = ERROR com o que deu errado. As claims do JWT (role, sub, aal) são obrigatórias em
-- pg_temp.como(): o gatilho é SECURITY DEFINER e decide pelo papel do JWT; sem elas o teste passa
-- em falso. Contas de teste com ids fixos f0a00000-…; em produção o upsert só ajusta nome e papel.
-- =============================================================================
-- begin;
-- create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void language plpgsql as $f$
-- begin
--   perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true);
--   perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
--     'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
--   perform set_config('role', p_role, true);
-- end $f$;
-- create function pg_temp.erro(q text) returns text language plpgsql as $f$
-- begin execute q; return 'ok'; exception when others then return sqlstate; end $f$;
-- create function pg_temp.linhas(q text) returns int language plpgsql as $f$
-- declare n int; begin execute q; get diagnostics n = row_count; return n; end $f$;
--
-- -- T0. Contas: P (produtor), C (comprador), O (outro), AD (admin sem 2FA), AF (admin com 2FA).
-- --     Eventos de P: e1 aprovado+destaque, e2 recusado, e3 publicado pendente, e4 aprovado com ingresso
-- --     ativo de C, e5 aprovado só com ingresso cancelado, e6 rascunho com ingresso usado de C, e7 aprovado.
-- insert into auth.users (id, email) values
--   ('f0a00000-0000-4000-8000-000000000001', 'produtor@teste-f0a.evokaa.invalid'),
--   ('f0a00000-0000-4000-8000-000000000002', 'comprador@teste-f0a.evokaa.invalid'),
--   ('f0a00000-0000-4000-8000-000000000003', 'outro@teste-f0a.evokaa.invalid'),
--   ('f0a00000-0000-4000-8000-000000000004', 'admin@teste-f0a.evokaa.invalid'),
--   ('f0a00000-0000-4000-8000-000000000005', 'admin2fa@teste-f0a.evokaa.invalid');
-- insert into public.profiles (id, email, full_name, role) values
--   ('f0a00000-0000-4000-8000-000000000001', 'produtor@teste-f0a.evokaa.invalid', 'Paula', 'producer'),
--   ('f0a00000-0000-4000-8000-000000000002', 'comprador@teste-f0a.evokaa.invalid', 'Caio', 'user'),
--   ('f0a00000-0000-4000-8000-000000000003', 'outro@teste-f0a.evokaa.invalid', 'Olga', 'user'),
--   ('f0a00000-0000-4000-8000-000000000004', 'admin@teste-f0a.evokaa.invalid', 'Ada', 'admin'),
--   ('f0a00000-0000-4000-8000-000000000005', 'admin2fa@teste-f0a.evokaa.invalid', 'Afonso', 'admin')
-- on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;
-- insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
-- values (gen_random_uuid(), 'f0a00000-0000-4000-8000-000000000005', 'teste', 'totp', 'verified', now(), now());
-- insert into public.events (id, producer_id, title, slug, status, approval_status, approved_at, approved_by,
--   rejection_reason, featured_carousel, date, venue_name) values
--   ('f0a00000-0000-4000-8000-000000000101', 'f0a00000-0000-4000-8000-000000000001', 'Aprovado', 'f0a-e1', 'published', 'approved', now(), 'f0a00000-0000-4000-8000-000000000004', null, true, '2026-11-20', 'Arena'),
--   ('f0a00000-0000-4000-8000-000000000102', 'f0a00000-0000-4000-8000-000000000001', 'Recusado', 'f0a-e2', 'published', 'rejected', null, null, 'Falta a capa', false, '2026-11-20', 'Arena'),
--   ('f0a00000-0000-4000-8000-000000000103', 'f0a00000-0000-4000-8000-000000000001', 'Pendente', 'f0a-e3', 'published', 'pending', null, null, null, false, '2026-11-20', 'Arena'),
--   ('f0a00000-0000-4000-8000-000000000104', 'f0a00000-0000-4000-8000-000000000001', 'Com venda', 'f0a-e4', 'published', 'approved', now(), 'f0a00000-0000-4000-8000-000000000004', null, false, '2026-11-20', 'Arena'),
--   ('f0a00000-0000-4000-8000-000000000105', 'f0a00000-0000-4000-8000-000000000001', 'Só cancelado', 'f0a-e5', 'published', 'approved', now(), 'f0a00000-0000-4000-8000-000000000004', null, false, '2026-11-20', 'Arena'),
--   ('f0a00000-0000-4000-8000-000000000106', 'f0a00000-0000-4000-8000-000000000001', 'Rascunho', 'f0a-e6', 'draft', 'pending', null, null, null, false, '2026-11-20', 'Arena'),
--   ('f0a00000-0000-4000-8000-000000000107', 'f0a00000-0000-4000-8000-000000000001', 'Galeria', 'f0a-e7', 'published', 'approved', now(), 'f0a00000-0000-4000-8000-000000000004', null, false, '2026-11-20', 'Arena');
-- insert into public.ticket_types (id, event_id, name, price, is_active) values
--   ('f0a00000-0000-4000-8000-000000000201', 'f0a00000-0000-4000-8000-000000000101', 'Pista', 50, true),
--   ('f0a00000-0000-4000-8000-000000000202', 'f0a00000-0000-4000-8000-000000000101', 'Oculto', 50, false),
--   ('f0a00000-0000-4000-8000-000000000203', 'f0a00000-0000-4000-8000-000000000103', 'Pista', 50, true),
--   ('f0a00000-0000-4000-8000-000000000204', 'f0a00000-0000-4000-8000-000000000104', 'Pista', 50, true),
--   ('f0a00000-0000-4000-8000-000000000205', 'f0a00000-0000-4000-8000-000000000105', 'Pista', 50, true),
--   ('f0a00000-0000-4000-8000-000000000206', 'f0a00000-0000-4000-8000-000000000106', 'Oculto', 50, false);
-- insert into public.orders (id, user_id, event_id, status) values
--   ('f0a00000-0000-4000-8000-000000000304', 'f0a00000-0000-4000-8000-000000000002', 'f0a00000-0000-4000-8000-000000000104', 'paid'),
--   ('f0a00000-0000-4000-8000-000000000305', 'f0a00000-0000-4000-8000-000000000002', 'f0a00000-0000-4000-8000-000000000105', 'paid'),
--   ('f0a00000-0000-4000-8000-000000000306', 'f0a00000-0000-4000-8000-000000000002', 'f0a00000-0000-4000-8000-000000000106', 'paid');
-- insert into public.order_items (id, order_id, ticket_type_id, quantity) values
--   ('f0a00000-0000-4000-8000-000000000404', 'f0a00000-0000-4000-8000-000000000304', 'f0a00000-0000-4000-8000-000000000204', 1),
--   ('f0a00000-0000-4000-8000-000000000405', 'f0a00000-0000-4000-8000-000000000305', 'f0a00000-0000-4000-8000-000000000205', 1),
--   ('f0a00000-0000-4000-8000-000000000406', 'f0a00000-0000-4000-8000-000000000306', 'f0a00000-0000-4000-8000-000000000206', 1);
-- insert into public.tickets (order_item_id, order_id, ticket_type_id, event_id, user_id, status) values
--   ('f0a00000-0000-4000-8000-000000000404', 'f0a00000-0000-4000-8000-000000000304', 'f0a00000-0000-4000-8000-000000000204', 'f0a00000-0000-4000-8000-000000000104', 'f0a00000-0000-4000-8000-000000000002', 'active'),
--   ('f0a00000-0000-4000-8000-000000000405', 'f0a00000-0000-4000-8000-000000000305', 'f0a00000-0000-4000-8000-000000000205', 'f0a00000-0000-4000-8000-000000000105', 'f0a00000-0000-4000-8000-000000000002', 'cancelled'),
--   ('f0a00000-0000-4000-8000-000000000406', 'f0a00000-0000-4000-8000-000000000306', 'f0a00000-0000-4000-8000-000000000206', 'f0a00000-0000-4000-8000-000000000106', 'f0a00000-0000-4000-8000-000000000002', 'used');
--
-- -- T1. Leitura: público só vê aprovado e tipo ativo; quem tem ingresso, admin e dono veem o resto
-- do $t$
-- declare p uuid := 'f0a00000-0000-4000-8000-000000000001'; c uuid := 'f0a00000-0000-4000-8000-000000000002';
--   o uuid := 'f0a00000-0000-4000-8000-000000000003'; ad uuid := 'f0a00000-0000-4000-8000-000000000004';
--   af uuid := 'f0a00000-0000-4000-8000-000000000005';
--   e1 uuid := 'f0a00000-0000-4000-8000-000000000101'; e2 uuid := 'f0a00000-0000-4000-8000-000000000102';
--   e3 uuid := 'f0a00000-0000-4000-8000-000000000103'; e6 uuid := 'f0a00000-0000-4000-8000-000000000106';
--   t1a uuid := 'f0a00000-0000-4000-8000-000000000201'; t1b uuid := 'f0a00000-0000-4000-8000-000000000202';
--   t3 uuid := 'f0a00000-0000-4000-8000-000000000203'; t6 uuid := 'f0a00000-0000-4000-8000-000000000206';
-- begin
--   perform pg_temp.como('anon');
--   assert (select count(*) from public.events where id = e1) = 1, 'anon não lê evento aprovado';
--   assert (select count(*) from public.events where id in (e2, e3, e6)) = 0, 'anon lê evento recusado/pendente/rascunho';
--   assert (select count(*) from public.ticket_types where id = t1a) = 1, 'anon não lê tipo ativo de evento aprovado';
--   assert (select count(*) from public.ticket_types where id in (t1b, t3, t6)) = 0, 'anon lê tipo inativo ou de evento pendente';
--   perform pg_temp.como('authenticated', c);
--   assert (select count(*) from public.events where id = e6) = 1, 'comprador não lê o evento pendente do seu ingresso';
--   assert (select count(*) from public.ticket_types where id = t6) = 1, 'comprador não lê o tipo (inativo) do seu ingresso';
--   assert (select count(*) from public.events where id = e3) = 0, 'comprador lê evento pendente sem ingresso';
--   assert (select count(*) from public.ticket_types where id in (t1b, t3)) = 0, 'comprador lê tipo inativo/pendente sem ingresso';
--   perform pg_temp.como('authenticated', o);
--   assert (select count(*) from public.events where id in (e3, e6)) = 0, 'outro usuário lê evento pendente';
--   assert (select count(*) from public.ticket_types where id in (t1b, t3, t6)) = 0, 'outro usuário lê tipo oculto/pendente';
--   perform pg_temp.como('authenticated', ad);
--   assert (select count(*) from public.ticket_types where id in (t1b, t3, t6)) = 3, 'admin sem 2FA não lê tipos de evento pendente';
--   perform pg_temp.como('authenticated', af, 'aal2');
--   assert (select count(*) from public.ticket_types where id in (t1b, t3, t6)) = 3, 'admin com 2FA (aal2) não lê tipos de evento pendente';
--   perform pg_temp.como('authenticated', af, 'aal1');
--   assert (select count(*) from public.ticket_types) = 0, 'admin com 2FA em aal1 lê tipos';
--   perform pg_temp.como('authenticated', p);
--   assert (select count(*) from public.ticket_types where id in (t1b, t3, t6)) = 3, 'produtor não lê os próprios tipos inativos/pendentes';
--   perform pg_temp.como('postgres');
--   raise notice 'T1 OK: público só vê aprovado e tipo ativo; comprador, admin e dono leem o resto';
-- end $t$;
--
-- -- T2. Sem 42P17 (recursão de política) nas leituras; "Meus ingressos"; compra só de evento aprovado
-- do $t$
-- declare p uuid := 'f0a00000-0000-4000-8000-000000000001'; c uuid := 'f0a00000-0000-4000-8000-000000000002';
--   q text; quem record; r text;
-- begin
--   for quem in select * from (values ('anon', null::uuid), ('authenticated', p), ('authenticated', c)) v(papel, id) loop
--     perform pg_temp.como(quem.papel, quem.id);
--     foreach q in array array['events', 'tickets', 'orders', 'order_items', 'ticket_types'] loop
--       r := pg_temp.erro(format('select count(*) from public.%I', q));
--       assert r = 'ok', format('%s %s lendo %s: %s', quem.papel, quem.id, q, r);
--     end loop;
--   end loop;
--   perform pg_temp.como('authenticated', c);
--   assert (select count(*) from public.tickets t
--           join public.ticket_types tt on tt.id = t.ticket_type_id
--           join public.events e on e.id = tt.event_id
--           where t.user_id = c) = 3, 'Meus ingressos não trouxe os 3 ingressos com tipo e evento';
--   insert into public.orders (id, user_id, event_id, status) values
--     ('f0a00000-0000-4000-8000-000000000301', c, 'f0a00000-0000-4000-8000-000000000101', 'pending'),
--     ('f0a00000-0000-4000-8000-000000000303', c, 'f0a00000-0000-4000-8000-000000000103', 'pending');
--   assert pg_temp.erro('insert into public.order_items (order_id, ticket_type_id, quantity) values '
--     '(''f0a00000-0000-4000-8000-000000000301'', ''f0a00000-0000-4000-8000-000000000201'', 1)') = 'ok',
--     'comprador não comprou tipo ativo de evento aprovado';
--   assert pg_temp.erro('insert into public.order_items (order_id, ticket_type_id, quantity) values '
--     '(''f0a00000-0000-4000-8000-000000000303'', ''f0a00000-0000-4000-8000-000000000203'', 1)') = '42501',
--     'comprador comprou tipo de evento pendente';
--   perform pg_temp.como('postgres');
--   raise notice 'T2 OK: leituras sem 42P17, Meus ingressos completo, compra só de evento aprovado';
-- end $t$;
--
-- -- T3. Produtor não se aprova nem entra no carrossel (INSERT e UPDATE); o gatilho dispara para authenticated
-- do $t$
-- declare p uuid := 'f0a00000-0000-4000-8000-000000000001'; ad uuid := 'f0a00000-0000-4000-8000-000000000004';
--   e2 uuid := 'f0a00000-0000-4000-8000-000000000102'; e3 uuid := 'f0a00000-0000-4000-8000-000000000103';
--   e7 uuid := 'f0a00000-0000-4000-8000-000000000107';
--   ins text := 'insert into public.events (producer_id, title, slug, %s) values (%L, %L, %L, %s)';
-- begin
--   assert not has_function_privilege('authenticated', 'public.gf_protect_event_moderation()', 'execute'), 'authenticated executa a função do gatilho';
--   assert not has_function_privilege('anon', 'public.tem_ingresso(uuid)', 'execute'), 'anon executa tem_ingresso';
--   perform pg_temp.como('authenticated', p);
--   assert pg_temp.erro(format(ins, 'approval_status', p, 'x', 'f0a-i1', quote_literal('approved'))) = '42501', 'INSERT já aprovado';
--   assert pg_temp.erro(format(ins, 'featured_carousel', p, 'x', 'f0a-i2', 'true')) = '42501', 'INSERT no carrossel';
--   assert pg_temp.erro(format(ins, 'approved_by', p, 'x', 'f0a-i3', quote_literal(ad))) = '42501', 'INSERT com approved_by';
--   assert pg_temp.erro(format(ins, 'approved_at', p, 'x', 'f0a-i4', 'now()')) = '42501', 'INSERT com approved_at';
--   assert pg_temp.erro(format(ins, 'rejection_reason', p, 'x', 'f0a-i5', quote_literal('x'))) = '42501', 'INSERT com rejection_reason';
--   assert pg_temp.erro(format(ins, 'status', p, 'x', 'f0a-i6', quote_literal('draft'))) = 'ok', 'produtor não criou evento pendente';
--   assert pg_temp.erro(format('update public.events set approval_status = %L where id = %L', 'approved', e3)) = '42501', 'UPDATE autoaprovação';
--   assert pg_temp.erro(format('update public.events set featured_carousel = true where id = %L', e7)) = '42501', 'UPDATE carrossel';
--   assert pg_temp.erro(format('update public.events set approved_by = %L where id = %L', p, e3)) = '42501', 'UPDATE approved_by';
--   assert pg_temp.erro(format('update public.events set approved_at = now() where id = %L', e3)) = '42501', 'UPDATE approved_at';
--   assert pg_temp.erro(format('update public.events set rejection_reason = null where id = %L', e2)) = '42501', 'UPDATE rejection_reason';
--   perform pg_temp.como('postgres');
--   assert (select approval_status = 'pending' and approved_by is null from public.events where id = e3), 'e3 mudou';
--   assert (select not featured_carousel from public.events where id = e7), 'e7 entrou no carrossel';
--   raise notice 'T3 OK: produtor não se aprova nem entra no carrossel';
-- end $t$;
--
-- -- T4. Edição de conteúdo: aprovado ou recusado volta para análise; mesmo valor e só status não mudam nada
-- do $t$
-- declare p uuid := 'f0a00000-0000-4000-8000-000000000001';
--   e1 uuid := 'f0a00000-0000-4000-8000-000000000101'; e2 uuid := 'f0a00000-0000-4000-8000-000000000102';
--   e7 uuid := 'f0a00000-0000-4000-8000-000000000107';
-- begin
--   perform pg_temp.como('authenticated', p);
--   assert pg_temp.linhas(format('update public.events set title = %L where id = %L', 'Aprovado', e1)) = 1, 'produtor não regravou o título';
--   assert (select approval_status = 'approved' and featured_carousel and approved_by is not null and approved_at is not null
--           from public.events where id = e1), 'regravar o mesmo título tirou a aprovação';
--   assert pg_temp.linhas(format('update public.events set status = %L where id = %L', 'ended', e1)) = 1, 'produtor não mudou o status';
--   assert (select approval_status = 'approved' and featured_carousel from public.events where id = e1), 'mudar só o status tirou a aprovação';
--   assert pg_temp.linhas(format('update public.events set title = %L where id = %L', 'Título novo', e1)) = 1, 'produtor não mudou o título';
--   assert (select approval_status = 'pending' and not featured_carousel and approved_at is null and approved_by is null
--           from public.events where id = e1), 'título novo não voltou para análise';
--   assert pg_temp.linhas(format('update public.events set description = %L where id = %L', 'Com capa agora', e2)) = 1, 'produtor não editou o recusado';
--   assert (select approval_status = 'pending' and rejection_reason = 'Falta a capa' from public.events where id = e2), 'recusado editado não voltou para análise';
--   assert pg_temp.linhas(format('update public.events set gallery = %L where id = %L', '["/g.jpg"]', e7)) = 1, 'produtor não mudou a galeria';
--   assert (select approval_status = 'pending' from public.events where id = e7), 'galeria nova não voltou para análise';
--   perform pg_temp.como('postgres');
--   raise notice 'T4 OK: conteúdo editado volta para análise; mesmo valor e status não';
-- end $t$;
--
-- -- T5. Depois da venda, data e local só pelo admin; ingresso só cancelado não trava
-- do $t$
-- declare p uuid := 'f0a00000-0000-4000-8000-000000000001';
--   e4 uuid := 'f0a00000-0000-4000-8000-000000000104'; e5 uuid := 'f0a00000-0000-4000-8000-000000000105';
-- begin
--   perform pg_temp.como('authenticated', p);
--   assert pg_temp.erro(format('update public.events set date = %L where id = %L', '2026-12-01', e4)) = '42501', 'produtor mudou a data com venda';
--   assert pg_temp.erro(format('update public.events set start_date = %L where id = %L', '2026-12-01 20:00-03', e4)) = '42501', 'produtor mudou start_date com venda';
--   assert pg_temp.erro(format('update public.events set venue_name = %L where id = %L', 'Outro lugar', e4)) = '42501', 'produtor mudou o local com venda';
--   assert pg_temp.erro(format('update public.events set venue_lat = 1 where id = %L', e4)) = '42501', 'produtor mudou venue_lat com venda';
--   assert pg_temp.linhas(format('update public.events set title = %L where id = %L', 'Com venda 2', e4)) = 1, 'produtor não mudou o título com venda';
--   assert (select approval_status = 'pending' and date = '2026-11-20' from public.events where id = e4), 'título com venda: esperado pendente e mesma data';
--   assert pg_temp.linhas(format('update public.events set date = %L where id = %L', '2026-12-01', e5)) = 1, 'ingresso cancelado travou a data';
--   perform pg_temp.como('postgres');
--   raise notice 'T5 OK: data e local travados depois da venda; cancelado não trava';
-- end $t$;
--
-- -- T6. Admin (sem 2FA e com 2FA em aal2) aprova, destaca e muda data de evento com venda
-- do $t$
-- declare ad uuid := 'f0a00000-0000-4000-8000-000000000004'; af uuid := 'f0a00000-0000-4000-8000-000000000005';
--   e2 uuid := 'f0a00000-0000-4000-8000-000000000102'; e4 uuid := 'f0a00000-0000-4000-8000-000000000104';
-- begin
--   perform pg_temp.como('authenticated', ad);
--   assert pg_temp.linhas(format('update public.events set approval_status = %L, approved_at = now(), approved_by = %L, '
--     'featured_carousel = true where id = %L', 'approved', ad, e4)) = 1, 'admin não aprovou nem destacou';
--   assert pg_temp.linhas(format('update public.events set date = %L, venue_name = %L where id = %L', '2027-01-15', 'Novo local', e4)) = 1,
--     'admin não mudou data e local com venda';
--   assert (select approval_status = 'approved' and featured_carousel and date = '2027-01-15' from public.events where id = e4),
--     'edição do admin tirou a aprovação';
--   perform pg_temp.como('authenticated', af, 'aal2');
--   assert pg_temp.linhas(format('update public.events set approval_status = %L, approved_at = now(), approved_by = %L, '
--     'rejection_reason = null where id = %L', 'approved', af, e2)) = 1, 'admin com 2FA não aprovou';
--   assert pg_temp.linhas(format('update public.events set start_date = %L where id = %L', '2027-01-15 21:00-03', e4)) = 1,
--     'admin com 2FA não mudou a data com venda';
--   assert (select approval_status = 'approved' and featured_carousel from public.events where id = e4), 'data do admin 2FA tirou a aprovação';
--   perform pg_temp.como('postgres');
--   assert (select approval_status = 'approved' and rejection_reason is null from public.events where id = e2), 'e2 não ficou aprovado';
--   raise notice 'T6 OK: admin aprova, destaca e muda data com venda';
-- end $t$;
--
-- -- T7. Servidor (service_role) grava aprovação e destaque
-- do $t$
-- declare p uuid := 'f0a00000-0000-4000-8000-000000000001'; e3 uuid := 'f0a00000-0000-4000-8000-000000000103';
-- begin
--   perform pg_temp.como('service_role');
--   assert pg_temp.linhas(format('update public.events set approval_status = %L, featured_carousel = true, approved_at = now() where id = %L',
--     'approved', e3)) = 1, 'service_role não aprovou';
--   assert pg_temp.erro(format('insert into public.events (producer_id, title, slug, approval_status, featured_carousel) values (%L, %L, %L, %L, true)',
--     p, 'Servidor', 'f0a-s1', 'approved')) = 'ok', 'service_role não inseriu aprovado';
--   perform pg_temp.como('postgres');
--   assert (select approval_status = 'approved' and featured_carousel from public.events where id = e3), 'e3 não ficou aprovado';
--   raise notice 'T7 OK: service_role grava aprovação e destaque';
-- end $t$;
-- rollback;
