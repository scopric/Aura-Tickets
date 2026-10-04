-- =============================================================================
-- F1-b PR3a — TESTES de 20261012_f1b_reenvio.sql (o código fica lá; este arquivo não vai para produção).
-- Rodar só em banco descartável, DEPOIS de aplicar 20261009_f1a_tipo_evento.sql e o arquivo de código (duas vezes;
-- a F1-a NÃO pode ser reaplicada depois da F1-b: o bloco 0 dela aborta).
-- Um bloco begin … rollback. Cada teste termina com "NOTICE: Tn OK"; falha = ERROR com o valor recebido.
-- Ambiente usado (04/10/2026): contêiner supabase/postgres:17.6.1.171 (descartável) com o esquema auth/storage/public
-- (pg_dump -s) do banco local (baseline de supabase/migrations/20260930134600_baseline.sql) e a F1-a aplicada; mesmos papéis e
-- jwt simulados de 20261009_f1a_tipo_evento_testes.sql.
-- =============================================================================
begin;

create function pg_temp.como(p uuid, aal text default 'aal1') returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true);
  perform set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated', 'aal', aal)::text end, true);
  perform set_config('role', case when p is null then 'postgres' else 'authenticated' end, true);
end $f$;
create function pg_temp.erro(q text) returns text language plpgsql as $f$
begin execute q; return 'ok'; exception when others then return sqlstate; end $f$;
create function pg_temp.u(n int) returns uuid language sql as $f$ select ('f1b00000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $f$;
-- updated_at antigo (2020): tr_events_updated_at força now() em todo UPDATE, e now() é fixo dentro da transação
create function pg_temp.velho(ev int) returns void language plpgsql as $f$
begin
  alter table public.events disable trigger tr_events_updated_at;
  update public.events set updated_at = '2020-01-01' where id = pg_temp.u(ev);
  alter table public.events enable trigger tr_events_updated_at;
end $f$;
create function pg_temp.upd(ev int) returns timestamptz language sql as $f$
  select updated_at from public.events where id = pg_temp.u(ev) $f$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- Contas: 1 produtor, 9 admin (manage_events, 2FA)
insert into auth.users (id, email) select pg_temp.u(n), 'f1b-' || n || '@teste.invalid' from unnest(array[1, 9]) n;
insert into public.profiles (id, email, role) select pg_temp.u(n), 'f1b-' || n || '@teste.invalid', 'user' from unnest(array[1, 9]) n
on conflict (id) do nothing;
update public.profiles set role = 'admin', admin_permissions = array['manage_events'] where id = pg_temp.u(9);
insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
values (gen_random_uuid(), pg_temp.u(9), 'totp', 'verified', now(), now());

-- Eventos do produtor 1:
--  40 rascunho recusado (com motivo) | 41 publicado, aprovado, em destaque | 42 publicado e aprovado (só edição)
--  43 rascunho recusado (para o admin) | 44 rascunho aprovado em destaque (para o admin)
insert into public.events (id, producer_id, title, slug, status, approval_status, rejection_reason, approved_at, approved_by, featured_carousel)
values
  (pg_temp.u(40), pg_temp.u(1), 'Evento 40', 'f1b-evento-40', 'draft',     'rejected', 'Faltou o alvará', null, null, false),
  (pg_temp.u(41), pg_temp.u(1), 'Evento 41', 'f1b-evento-41', 'published', 'approved', null, now(), pg_temp.u(9), true),
  (pg_temp.u(42), pg_temp.u(1), 'Evento 42', 'f1b-evento-42', 'published', 'approved', null, now(), pg_temp.u(9), true),
  (pg_temp.u(43), pg_temp.u(1), 'Evento 43', 'f1b-evento-43', 'draft',     'rejected', 'Faltou o alvará', null, null, false),
  (pg_temp.u(44), pg_temp.u(1), 'Evento 44', 'f1b-evento-44', 'draft',     'approved', null, now(), pg_temp.u(9), true);
-- 45 publicado e aprovado, com ingresso (50) | 46 com ingressos, para apagar
insert into public.events (id, producer_id, title, slug, status, approval_status, approved_at, approved_by, featured_carousel)
values
  (pg_temp.u(45), pg_temp.u(1), 'Evento 45', 'f1b-evento-45', 'published', 'approved', now(), pg_temp.u(9), false),
  (pg_temp.u(46), pg_temp.u(1), 'Evento 46', 'f1b-evento-46', 'published', 'approved', now(), pg_temp.u(9), false);
insert into public.ticket_types (id, event_id, name, price, quantity_total) values
  (pg_temp.u(50), pg_temp.u(45), 'Pista', 50, 100), (pg_temp.u(51), pg_temp.u(46), 'A', 10, 10), (pg_temp.u(52), pg_temp.u(46), 'B', 20, 10);

do $$
declare r text; e public.events%rowtype;
begin
  -- T1: recusado (draft + rejected) que o produtor publica de novo fica pending e mantém o motivo
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.events set status = 'published' where id = 'f1b00000-0000-4000-8000-000000000040'$q$);
  perform pg_temp.como(null);
  select * into e from public.events where id = pg_temp.u(40);
  if r <> 'ok' or e.status <> 'published' or e.approval_status <> 'pending' or e.rejection_reason is distinct from 'Faltou o alvará' then
    raise exception 'T1 recusado reenviado: % / % / % / %', r, e.status, e.approval_status, e.rejection_reason;
  end if;
  raise notice 'T1 OK';

  -- T2: aprovado em destaque que vai a rascunho e volta a published fica pending, sem destaque, approved_at/by nulos
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.events set status = 'draft' where id = 'f1b00000-0000-4000-8000-000000000041'$q$);
  perform pg_temp.como(null);
  select * into e from public.events where id = pg_temp.u(41);
  if r <> 'ok' or e.approval_status <> 'approved' or not e.featured_carousel then
    raise exception 'T2a ir a rascunho não é a regra nova: % / % / %', r, e.approval_status, e.featured_carousel;
  end if;
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.events set status = 'published' where id = 'f1b00000-0000-4000-8000-000000000041'$q$);
  perform pg_temp.como(null);
  select * into e from public.events where id = pg_temp.u(41);
  if r <> 'ok' or e.status <> 'published' or e.approval_status <> 'pending' or e.featured_carousel
     or e.approved_at is not null or e.approved_by is not null then
    raise exception 'T2b aprovado reenviado: % / % / % / % / %', r, e.approval_status, e.featured_carousel, e.approved_at, e.approved_by;
  end if;
  raise notice 'T2 OK';

  -- T3: edição de evento já published (status continua published) não mexe na aprovação
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.events set status = 'published', settings = '{"x":1}'::jsonb where id = 'f1b00000-0000-4000-8000-000000000042'$q$);
  perform pg_temp.como(null);
  select * into e from public.events where id = pg_temp.u(42);
  if r <> 'ok' or e.approval_status <> 'approved' or not e.featured_carousel or e.approved_at is null or e.approved_by is null then
    raise exception 'T3a edição fora do conteúdo: % / % / %', r, e.approval_status, e.featured_carousel;
  end if;
  -- e a regra de conteúdo continua valendo (título muda: volta para análise)
  perform pg_temp.como(pg_temp.u(1));
  update public.events set title = 'Evento 42 novo' where id = pg_temp.u(42);
  perform pg_temp.como(null);
  if (select approval_status from public.events where id = pg_temp.u(42)) <> 'pending' then
    raise exception 'T3b regra de conteúdo parou de valer';
  end if;
  raise notice 'T3 OK';

  -- T4: admin fazendo draft -> published não é afetado (recusado continua recusado; aprovado em destaque continua)
  perform pg_temp.como(pg_temp.u(9), 'aal2');
  r := pg_temp.erro($q$update public.events set status = 'published' where id in ('f1b00000-0000-4000-8000-000000000043', 'f1b00000-0000-4000-8000-000000000044')$q$);
  perform pg_temp.como(null);
  select * into e from public.events where id = pg_temp.u(43);
  if r <> 'ok' or e.status <> 'published' or e.approval_status <> 'rejected' then
    raise exception 'T4a admin, recusado: % / % / %', r, e.status, e.approval_status;
  end if;
  select * into e from public.events where id = pg_temp.u(44);
  if e.status <> 'published' or e.approval_status <> 'approved' or not e.featured_carousel or e.approved_at is null then
    raise exception 'T4b admin, aprovado: % / % / %', e.status, e.approval_status, e.featured_carousel;
  end if;
  raise notice 'T4 OK';

  -- T5: produtor mandando aprovação ou destaque direto continua 42501 (com ou sem mudar o status junto)
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.events set approval_status = 'approved' where id = 'f1b00000-0000-4000-8000-000000000040'$q$);
  if r <> '42501' then raise exception 'T5a approval_status direto: %', r; end if;
  r := pg_temp.erro($q$update public.events set status = 'draft', approval_status = 'approved' where id = 'f1b00000-0000-4000-8000-000000000043'$q$);
  if r <> '42501' then raise exception 'T5b approval_status com status: %', r; end if;
  r := pg_temp.erro($q$update public.events set featured_carousel = true where id = 'f1b00000-0000-4000-8000-000000000040'$q$);
  if r <> '42501' then raise exception 'T5c destaque direto: %', r; end if;
  -- rascunho -> published mandando approval_status junto: a recusa vem antes da regra nova
  update public.events set status = 'draft' where id = pg_temp.u(40);
  r := pg_temp.erro($q$update public.events set status = 'published', approval_status = 'approved' where id = 'f1b00000-0000-4000-8000-000000000040'$q$);
  if r <> '42501' then raise exception 'T5d publicar mandando approval_status: %', r; end if;
  perform pg_temp.como(null);
  raise notice 'T5 OK';

  -- T6: INSERT continua como era (published + pending passa; approved é 42501)
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$insert into public.events (producer_id, title, slug, status, approval_status) values ('f1b00000-0000-4000-8000-000000000001', 'N1', 'f1b-novo-1', 'published', 'pending')$q$);
  if r <> 'ok' then raise exception 'T6a insert published pending: %', r; end if;
  r := pg_temp.erro($q$insert into public.events (producer_id, title, slug, status, approval_status) values ('f1b00000-0000-4000-8000-000000000001', 'N2', 'f1b-novo-2', 'published', 'approved')$q$);
  if r <> '42501' then raise exception 'T6b insert approved: %', r; end if;
  perform pg_temp.como(null);
  raise notice 'T6 OK';

  -- T7: a função tem a regra nova e o gatilho segue ligado em events
  if position('voltou a published' in pg_get_functiondef('public.gf_protect_event_moderation'::regproc)) = 0 then
    raise exception 'T7a função sem a regra nova';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.events'::regclass
                 and tgname = 'gf_protect_event_moderation' and tgenabled = 'O') then
    raise exception 'T7b gatilho não está ligado';
  end if;
  raise notice 'T7 OK';

  -- T8: mudar o conteúdo de um ingresso muda events.updated_at e não mexe na aprovação (nem dá 42501)
  perform pg_temp.velho(45);
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.ticket_types set price = 60 where id = 'f1b00000-0000-4000-8000-000000000050'$q$);
  perform pg_temp.como(null);
  if r <> 'ok' or pg_temp.upd(45) < '2021-01-01' then raise exception 'T8a preço: % / %', r, pg_temp.upd(45); end if;
  perform pg_temp.velho(45);
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.ticket_types set inclui_bebida = true where id = 'f1b00000-0000-4000-8000-000000000050'$q$);
  perform pg_temp.como(null);
  if r <> 'ok' or pg_temp.upd(45) < '2021-01-01' then raise exception 'T8b bebida: % / %', r, pg_temp.upd(45); end if;
  perform pg_temp.velho(45);
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$insert into public.ticket_types (event_id, name, price, quantity_total) values ('f1b00000-0000-4000-8000-000000000045', 'Novo', 5, 5)$q$);
  perform pg_temp.como(null);
  if r <> 'ok' or pg_temp.upd(45) < '2021-01-01' then raise exception 'T8c ingresso novo: % / %', r, pg_temp.upd(45); end if;
  perform pg_temp.velho(45);
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$delete from public.ticket_types where event_id = 'f1b00000-0000-4000-8000-000000000045' and name = 'Novo'$q$);
  perform pg_temp.como(null);
  if r <> 'ok' or pg_temp.upd(45) < '2021-01-01' then raise exception 'T8d ingresso apagado: % / %', r, pg_temp.upd(45); end if;
  select * into e from public.events where id = pg_temp.u(45);
  if e.approval_status <> 'approved' or e.approved_at is null or e.status <> 'published' then
    raise exception 'T8e aprovação mexeu: % / %', e.approval_status, e.status;
  end if;
  raise notice 'T8 OK';

  -- T9: venda (sold, quantity_sold) não muda updated_at do evento; admin mudando ingresso não mexe na aprovação
  perform pg_temp.velho(45);
  r := pg_temp.erro($q$update public.ticket_types set sold = sold + 1, quantity_sold = quantity_sold + 1 where id = 'f1b00000-0000-4000-8000-000000000050'$q$);
  if r <> 'ok' or pg_temp.upd(45) >= '2021-01-01' then raise exception 'T9a venda mexeu no updated_at: % / %', r, pg_temp.upd(45); end if;
  perform pg_temp.como(pg_temp.u(9), 'aal2');
  r := pg_temp.erro($q$update public.ticket_types set price = 70 where id = 'f1b00000-0000-4000-8000-000000000050'$q$);
  perform pg_temp.como(null);
  select * into e from public.events where id = pg_temp.u(45);
  if r <> 'ok' or e.approval_status <> 'approved' then raise exception 'T9b admin muda ingresso: % / %', r, e.approval_status; end if;
  raise notice 'T9 OK';

  -- T10: apagar evento com ingressos funciona (o DELETE em cascata não falha), como produtor
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$delete from public.events where id = 'f1b00000-0000-4000-8000-000000000046'$q$);
  perform pg_temp.como(null);
  if r <> 'ok' or exists (select 1 from public.events where id = pg_temp.u(46))
     or exists (select 1 from public.ticket_types where event_id = pg_temp.u(46)) then
    raise exception 'T10 apagar evento com ingressos: %', r;
  end if;
  raise notice 'T10 OK';

  -- T11: gatilho de ingresso ligado e funções de gatilho sem EXECUTE para anon/authenticated
  if not exists (select 1 from pg_trigger where tgrelid = 'public.ticket_types'::regclass
                 and tgname = 'gf_ticket_types_toca_evento' and tgenabled = 'O') then
    raise exception 'T11a gatilho de ingresso não está ligado';
  end if;
  if has_function_privilege('authenticated', 'public.gf_protect_event_moderation()', 'execute')
     or has_function_privilege('anon', 'public.gf_protect_event_moderation()', 'execute')
     or has_function_privilege('authenticated', 'public.gf_ticket_types_toca_evento()', 'execute')
     or has_function_privilege('anon', 'public.gf_ticket_types_toca_evento()', 'execute') then
    raise exception 'T11b EXECUTE aberto';
  end if;
  raise notice 'T11 OK';

  -- T12: qualquer coluna fora as contagens de venda conta (perks, min_per_order); venda + perks juntos conta;
  --      mudar o event_id toca os dois eventos; só venda não toca
  perform pg_temp.velho(45);
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.ticket_types set perks = '["brinde"]'::jsonb where id = 'f1b00000-0000-4000-8000-000000000050'$q$);
  perform pg_temp.como(null);
  if r <> 'ok' or pg_temp.upd(45) < '2021-01-01' then raise exception 'T12a perks: % / %', r, pg_temp.upd(45); end if;
  perform pg_temp.velho(45);
  r := pg_temp.erro($q$update public.ticket_types set min_per_order = 2 where id = 'f1b00000-0000-4000-8000-000000000050'$q$);
  if r <> 'ok' or pg_temp.upd(45) < '2021-01-01' then raise exception 'T12b min_per_order: % / %', r, pg_temp.upd(45); end if;
  perform pg_temp.velho(45);
  r := pg_temp.erro($q$update public.ticket_types set sold = sold + 1, perks = '["outro"]'::jsonb where id = 'f1b00000-0000-4000-8000-000000000050'$q$);
  if r <> 'ok' or pg_temp.upd(45) < '2021-01-01' then raise exception 'T12c venda e perks: % / %', r, pg_temp.upd(45); end if;
  perform pg_temp.velho(45);
  r := pg_temp.erro($q$update public.ticket_types set sold = sold + 1, quantity_sold = quantity_sold + 1 where id = 'f1b00000-0000-4000-8000-000000000050'$q$);
  if r <> 'ok' or pg_temp.upd(45) >= '2021-01-01' then raise exception 'T12d só venda tocou: % / %', r, pg_temp.upd(45); end if;
  insert into public.events (id, producer_id, title, slug, status, approval_status)
  values (pg_temp.u(47), pg_temp.u(1), 'Evento 47', 'f1b-evento-47', 'draft', 'pending');
  perform pg_temp.velho(45);
  perform pg_temp.velho(47);
  r := pg_temp.erro($q$update public.ticket_types set event_id = 'f1b00000-0000-4000-8000-000000000047' where id = 'f1b00000-0000-4000-8000-000000000050'$q$);
  if r <> 'ok' or pg_temp.upd(45) < '2021-01-01' or pg_temp.upd(47) < '2021-01-01' then
    raise exception 'T12e event_id mudou: % / % / %', r, pg_temp.upd(45), pg_temp.upd(47);
  end if;
  raise notice 'T12 OK';

  -- T13: índice do limite de aceites
  if to_regclass('public.evento_aceites_producer_aceito_idx') is null then raise exception 'T13 sem o índice'; end if;
  raise notice 'T13 OK';
end $$;

rollback;
