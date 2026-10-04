-- =============================================================================
-- F1-a da criação de evento (PR1 + PR2 do plano glittery-growing-crab; plano da sessão fancy-pondering-scott;
-- Decisões 87–95, 148 e 149). 04/10/2026. Acrescenta colunas, tabelas e regras; o único dado alterado é o start_date (bloco 1b).
--   1. events: temas, estilos, classificacao, local_modo, privado_alterado_em (+ CHECKs; no máximo 10 tags).
--   2. ticket_types.inclui_bebida (bebida marcada por ingresso, decisão do Ricardo em 04/10).
--   3. evento_privado: o link do evento online, lido só pelo dono, pelo admin e por quem tem ingresso.
--   4. Gatilho em evento_privado: mudar o link marca events.privado_alterado_em, e o gatilho da F0a devolve o
--      evento aprovado para análise.
--   5. evento_aceites: o aceite do produtor, gravado só pela função aceite-evento (chave de serviço).
--   6. aceite_evento_versao(): versão do texto do aceite em vigor.
--   7. gf_protect_event_moderation recriada a partir da definição de PRODUÇÃO.
--   8. start_date alinhado com date + time (horário de Brasília) nos eventos em que diverge.
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17).
-- APLICAR FORA DO HORÁRIO DE PICO: os ALTER TABLE em events e ticket_types pedem bloqueio exclusivo até o fim da
-- transação; o lock_timeout de 5 s faz o arquivo desistir sem gravar nada se algo estiver segurando a tabela.
-- Uma transação só; idempotente (pode rodar de novo). NÃO mover para supabase/migrations/.
-- Testes: 20261009_f1a_tipo_evento_testes.sql (só em banco descartável).
-- ORDEM: (a) PASSO 0; (b) este SQL; (c) o merge do front do PR e, no mesmo momento, publicar a função `agent`
-- (o Evo novo manda `formato` em vez de `genero`: front e função fora de sincronia recusam o "Planejar");
-- (d) RODAR ESTE SQL DE NOVO depois do merge: o bloco 1b realinha o start_date de evento criado pelas telas antigas
-- entre (b) e (c); (e) a função aceite-evento só junto do PR3 (antes dele ninguém a chama).
--
-- PASSO 0 (só leitura; rodar SOZINHO antes, em produção):
--   select max(cardinality(tags)) as max_tags, count(*) filter (where cardinality(tags) > 10) as acima_de_10
--   from public.events;
--   select md5(pg_get_functiondef('public.gf_protect_event_moderation'::regproc));
--   Esperado: acima_de_10 = 0; md5 = 46d4fede8ab706031caa1fe5b1b7567e (a definição conferida em 04/10/2026,
--   igual ao bloco 2 de 20260930_f0a_moderacao_eventos.sql). Se o md5 for outro, alguém mudou a função depois:
--   NÃO aplicar; comparar e refazer o bloco 7 a partir da definição nova (o bloco 0 também confere e aborta).
--
-- DECISÕES
-- 1. Listas fechadas como CHECK (não enum nem tabela): mudar a lista é um SQL novo, e a paridade com
--    app/src/lib/tipoEvento.ts e supabase/functions/_shared/tipoEvento.ts é testada em app/src/test/tipoEvento.test.ts
--    (ele lê as listas DESTE arquivo por regex: manter o formato array['a', 'b', ...]).
-- 2. estilos só com o tema 'musica' (desenho 3.3). Formato continua em category (texto livre até o PR6, que migra
--    os 4 eventos antigos e trava a lista). classificacao nula = ainda não preenchida (a trava de publicação é do PR6).
-- 3. local_modo not null default 'presencial': os eventos existentes são presenciais. 'a_definir' não vende
--    (trava em order_items só no PR6; até lá, só a tela).
-- 4. evento_privado separado de events porque events é legível por qualquer um quando publicado; o link online
--    só pode ir para quem comprou (desenho 3.2). Leitura do comprador: ingresso 'active' ou 'used' do PRÓPRIO
--    usuário, com filtro direto em tickets (tem_ingresso() não olha o status: reembolsado leria). Escrita: dono
--    e admin com manage_events (o mesmo de gf_events_admin_write).
-- 5. O gatilho de evento_privado NÃO grava approval_status (a F0a recusa isso para quem não é admin, 42501):
--    ele marca events.privado_alterado_em, que está na lista de conteúdo do gatilho da F0a. Roda como quem
--    chamou (security invoker): o UPDATE em events passa pela RLS de events e pelos gatilhos dela, como se o
--    produtor tivesse editado o evento. Pôr o primeiro link depois da aprovação também volta para análise.
--    Admin que muda o link não devolve para análise (a F0a deixa o admin passar). No DELETE em cascata do
--    próprio evento o UPDATE não acha a linha e não faz nada.
-- 6. evento_aceites sem nenhuma regra de escrita: authenticated não grava, troca nem apaga. Só a função
--    aceite-evento (service_role) grava, com IP, navegador, hash do texto calculado no servidor e
--    aceito_em = now() do banco. event_id on delete set null: o aceite é prova e sobrevive ao evento.
--    tem_bebida é calculado pela função a partir de ticket_types.inclui_bebida, não vem do navegador.
-- 7. aceite_evento_versao(): constante, no molde de mesa_termo_versao() (20261003_mesa_coletiva.sql). Texto novo
--    do aceite = SQL novo com a versão nova (Decisão 6). O texto fica em _shared/tipoEvento.ts (ACEITE_TEXTO).
-- 8. gf_protect_event_moderation: igual à de produção, mais temas, estilos, classificacao, local_modo e
--    privado_alterado_em na lista de conteúdo, e local_modo na trava de data e local depois da venda.
--    accent_color e mostrar_contagem continuam fora (V6a, Decisão 142).
-- 9. ticket_types.inclui_bebida: mudar em evento aprovado NÃO volta para análise (limite já aceito para preço e
--    ingresso no plano-mãe; F2). O mesa_tipo_guard só olha type, então a coluna nova não o afeta.
-- 10. evento_privado: o link não muda de evento (UPDATE de event_id dá 42501). Sem isso, um link posto num rascunho
--     era levado a um evento aprovado trocando só o event_id, sem passar por análise (revisor e seguranca, 04/10).
-- 11. evento_aceites é prova: nem a service_role altera ou apaga (o padrão do Supabase dá tudo a ela). O dono do
--     banco (postgres, SQL Editor) continua podendo; o on delete set null roda como dono e segue funcionando.
-- 12. start_date (bloco 1b): o front novo grava date, time e start_date juntos; as telas antigas não gravavam
--     start_date (ficava a hora da criação). Sem alinhar, o 1º salvamento pelo front novo mudaria start_date: evento
--     aprovado voltaria para análise e evento com venda daria 42501 na trava de data (O que não pode quebrar, 17).
--     Roda como postgres, que o gatilho da F0a deixa passar: não muda aprovação. Em 04/10: 4 eventos divergentes,
--     nenhum com venda. A data exibida e as listas usam date/time; start_date passa a ser o mesmo instante.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos ---------------------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.events') is null or to_regclass('public.ticket_types') is null
     or to_regclass('public.tickets') is null then
    raise exception 'events, ticket_types ou tickets não existem';
  end if;
  if to_regprocedure('public.gf_mfa_ok()') is null or to_regprocedure('public.gf_is_admin()') is null
     or to_regprocedure('public.gf_admin_can(text)') is null then
    raise exception 'Faltam gf_mfa_ok/gf_is_admin/gf_admin_can (20260930_2fa_no_banco.sql e seg4): aplicar antes';
  end if;
  if not exists (select 1 from pg_trigger
                 where tgrelid = 'public.events'::regclass and tgname = 'gf_protect_event_moderation') then
    raise exception 'Falta o gatilho gf_protect_event_moderation (20260930_f0a_moderacao_eventos.sql): aplicar antes';
  end if;
  -- a função é recriada abaixo a partir da definição conferida em 04/10; outra versão = alguém mudou depois.
  -- Na 2ª aplicação ela já é a deste arquivo (cita privado_alterado_em) e passa.
  if md5(pg_get_functiondef('public.gf_protect_event_moderation'::regproc)) <> '46d4fede8ab706031caa1fe5b1b7567e'
     and position('privado_alterado_em' in pg_get_functiondef('public.gf_protect_event_moderation'::regproc)) = 0 then
    raise exception 'gf_protect_event_moderation mudou desde 04/10 (md5 diferente): refazer o bloco 7 a partir dela';
  end if;
  if exists (select 1 from public.events where cardinality(tags) > 10) then
    raise exception 'Há evento com mais de 10 etiquetas: decidir antes de travar';
  end if;
end $$;

-- 1. Colunas de events --------------------------------------------------------------------------------------
alter table public.events add column if not exists temas text[] not null default '{}';
alter table public.events add column if not exists estilos text[] not null default '{}';
alter table public.events add column if not exists classificacao text;
alter table public.events add column if not exists local_modo text not null default 'presencial';
alter table public.events add column if not exists privado_alterado_em timestamptz;

alter table public.events drop constraint if exists events_temas_check;
alter table public.events add constraint events_temas_check check (
  cardinality(temas) <= 3
  and temas <@ array['musica', 'gastronomia_bebidas', 'negocios', 'tecnologia', 'arte_cultura', 'bem_estar',
                     'esportes', 'religiao', 'infantil_familia', 'educacao', 'moda', 'causas_sociais', 'ar_livre',
                     'datas_comemorativas']::text[]);
alter table public.events drop constraint if exists events_estilos_check;
alter table public.events add constraint events_estilos_check check (
  cardinality(estilos) <= 3
  and (cardinality(estilos) = 0 or 'musica' = any (temas))
  and estilos <@ array['sertanejo', 'funk', 'rock', 'pop', 'eletronica', 'mpb', 'samba_pagode', 'forro', 'rap_trap',
                       'jazz_blues', 'indie', 'reggae', 'kpop', 'gospel', 'axe', 'classica', 'outro']::text[]);
alter table public.events drop constraint if exists events_classificacao_check;
alter table public.events add constraint events_classificacao_check check (
  classificacao = any (array['AL', 'A6', 'A10', 'A12', 'A14', 'A16', 'A18']::text[]));   -- nula passa
alter table public.events drop constraint if exists events_local_modo_check;
alter table public.events add constraint events_local_modo_check check (
  local_modo = any (array['presencial', 'online', 'hibrido', 'a_definir']::text[]));
alter table public.events drop constraint if exists events_tags_max_check;
alter table public.events add constraint events_tags_max_check check (cardinality(tags) <= 10);

-- 1b. start_date = date + time em Brasília (idempotente: só onde diverge) ------------------------------------------
update public.events
set start_date = (date + coalesce(time, time '00:00')) at time zone 'America/Sao_Paulo'
where date is not null
  and start_date is distinct from (date + coalesce(time, time '00:00')) at time zone 'America/Sao_Paulo';

-- 2. Bebida por ingresso -------------------------------------------------------------------------------------
alter table public.ticket_types add column if not exists inclui_bebida boolean not null default false;

-- 3. evento_privado -------------------------------------------------------------------------------------------
create table if not exists public.evento_privado (
  event_id uuid primary key references public.events (id) on delete cascade,
  online_url text check (online_url ~ '^https://[^\s]+$' and char_length(online_url) <= 500)
);
alter table public.evento_privado enable row level security;

drop policy if exists evento_privado_select on public.evento_privado;
create policy evento_privado_select on public.evento_privado for select to authenticated using (
  exists (select 1 from public.events e where e.id = evento_privado.event_id and e.producer_id = (select auth.uid()))
  or (select public.gf_is_admin())
  or exists (select 1 from public.tickets t
             where t.event_id = evento_privado.event_id and t.user_id = (select auth.uid())
               and t.status in ('active', 'used')));
drop policy if exists evento_privado_write on public.evento_privado;
create policy evento_privado_write on public.evento_privado for all to authenticated
  using (exists (select 1 from public.events e where e.id = evento_privado.event_id and e.producer_id = (select auth.uid()))
         or (select public.gf_admin_can('manage_events')))
  with check (exists (select 1 from public.events e where e.id = evento_privado.event_id and e.producer_id = (select auth.uid()))
              or (select public.gf_admin_can('manage_events')));
drop policy if exists gf_mfa_aal2 on public.evento_privado;
create policy gf_mfa_aal2 on public.evento_privado as restrictive for all to authenticated
  using ((select public.gf_mfa_ok())) with check ((select public.gf_mfa_ok()));

revoke all on public.evento_privado from public, anon, authenticated;
grant select, insert, update, delete on public.evento_privado to authenticated;

-- 4. Gatilho: link mudado marca o evento ------------------------------------------------------------------------
create or replace function public.evento_privado_marca()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.event_id is distinct from old.event_id then
    raise exception 'O link do evento não muda de evento' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.online_url is not distinct from old.online_url then
    return null;
  end if;
  update public.events set privado_alterado_em = clock_timestamp()
  where id = case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  return null;
end;
$$;
revoke all on function public.evento_privado_marca() from public, anon, authenticated;

drop trigger if exists evento_privado_marca on public.evento_privado;
create trigger evento_privado_marca
  after insert or update or delete on public.evento_privado
  for each row execute function public.evento_privado_marca();

-- 5. evento_aceites ---------------------------------------------------------------------------------------------
create table if not exists public.evento_aceites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id) on delete set null,
  producer_id uuid not null,
  versao text not null,
  texto_hash text not null check (texto_hash ~ '^[0-9a-f]{64}$'),
  classificacao text check (classificacao = any (array['AL', 'A6', 'A10', 'A12', 'A14', 'A16', 'A18']::text[])),
  tem_bebida boolean not null,
  ip text,
  forwarded_for text,
  user_agent text check (char_length(user_agent) <= 500),
  aceito_em timestamptz not null default now()
);
create index if not exists evento_aceites_event_id_idx on public.evento_aceites (event_id, aceito_em desc);
alter table public.evento_aceites enable row level security;

drop policy if exists evento_aceites_select on public.evento_aceites;
create policy evento_aceites_select on public.evento_aceites for select to authenticated using (
  producer_id = (select auth.uid()) or (select public.gf_is_admin()));
drop policy if exists gf_mfa_aal2 on public.evento_aceites;
create policy gf_mfa_aal2 on public.evento_aceites as restrictive for all to authenticated
  using ((select public.gf_mfa_ok())) with check ((select public.gf_mfa_ok()));

revoke all on public.evento_aceites from public, anon, authenticated;
grant select on public.evento_aceites to authenticated;
revoke update, delete, truncate on public.evento_aceites from service_role;
grant select, insert on public.evento_aceites to service_role;

-- 6. Versão do aceite --------------------------------------------------------------------------------------------
-- TODO Ricardo: data da versão do texto do aceite (Decisão 148, item 6). O PR não sai com 'A-DEFINIR'.
create or replace function public.aceite_evento_versao()
returns text
language sql
immutable
set search_path = ''
as $$ select 'A-DEFINIR' $$;
revoke all on function public.aceite_evento_versao() from public, anon, authenticated;
grant execute on function public.aceite_evento_versao() to authenticated, service_role;

-- 7. Moderação: as colunas novas são conteúdo ----------------------------------------------------------------------
create or replace function public.gf_protect_event_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not ((current_setting('role', true) in ('anon', 'authenticated')
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
      new.venue_state, new.venue_zip, new.venue_lat, new.venue_lng, new.local_modo)
     is distinct from
     (old.date, old.time, old.start_date, old.end_date, old.venue_name, old.venue_address, old.venue_city,
      old.venue_state, old.venue_zip, old.venue_lat, old.venue_lng, old.local_modo)
     and exists (select 1 from public.tickets t
                 where t.event_id = old.id and coalesce(t.status, 'active') not in ('cancelled', 'refunded')) then
    raise exception 'Evento com ingresso vendido: data e local só mudam pelo admin (Decreto 13.108, arts. 20 a 22)'
      using errcode = '42501';
  end if;

  if old.approval_status in ('approved', 'rejected')
     and (new.title, new.subtitle, new.description, new.short_description, new.cover_image, new.image_url,
          new.gallery, new.category, new.tags, new.meta_title, new.meta_description, new.date, new.time, new.start_date, new.end_date, new.venue_name,
          new.venue_address, new.venue_city, new.venue_state, new.venue_zip, new.venue_lat, new.venue_lng,
          new.temas, new.estilos, new.classificacao, new.local_modo, new.privado_alterado_em)
         is distinct from
         (old.title, old.subtitle, old.description, old.short_description, old.cover_image, old.image_url,
          old.gallery, old.category, old.tags, old.meta_title, old.meta_description, old.date, old.time, old.start_date, old.end_date, old.venue_name,
          old.venue_address, old.venue_city, old.venue_state, old.venue_zip, old.venue_lat, old.venue_lng,
          old.temas, old.estilos, old.classificacao, old.local_modo, old.privado_alterado_em) then
    new.approval_status := 'pending';
    new.featured_carousel := false;
    new.approved_at := null;
    new.approved_by := null; -- rejection_reason fica: é o histórico da recusa
  end if;
  return new;
end;
$$;

-- 8. Conferência que aborta (tudo ou nada) ----------------------------------------------------------------------
do $$
declare
  def text := pg_get_functiondef('public.gf_protect_event_moderation'::regproc);
begin
  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'events'
      and column_name in ('temas', 'estilos', 'classificacao', 'local_modo', 'privado_alterado_em')) <> 5
     or not exists (select 1 from information_schema.columns where table_schema = 'public'
                    and table_name = 'ticket_types' and column_name = 'inclui_bebida') then
    raise exception 'colunas novas faltando';
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.events'::regclass and not convalidated
             and conname in ('events_temas_check', 'events_estilos_check', 'events_classificacao_check',
                             'events_local_modo_check', 'events_tags_max_check')) then
    raise exception 'CHECK de events não validado';
  end if;
  if exists (select 1 from public.events where date is not null
             and start_date is distinct from (date + coalesce(time, time '00:00')) at time zone 'America/Sao_Paulo') then
    raise exception 'start_date ainda diverge de date + time';
  end if;
  if position('new.privado_alterado_em' in def) = 0 or position('new.temas' in def) = 0
     or position('new.local_modo)' in def) = 0 then
    raise exception 'gf_protect_event_moderation sem as colunas novas';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.evento_privado'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.evento_aceites'::regclass) then
    raise exception 'RLS desligada em evento_privado ou evento_aceites';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename in ('evento_privado', 'evento_aceites')
      and policyname = 'gf_mfa_aal2' and permissive = 'RESTRICTIVE') <> 2 then
    raise exception 'falta gf_mfa_aal2 nas tabelas novas';
  end if;
  -- aceite: authenticated só lê; nenhuma regra de escrita
  if has_table_privilege('authenticated', 'public.evento_aceites', 'insert')
     or has_table_privilege('authenticated', 'public.evento_aceites', 'update')
     or has_table_privilege('authenticated', 'public.evento_aceites', 'delete')
     or has_table_privilege('anon', 'public.evento_aceites', 'select')
     or has_table_privilege('service_role', 'public.evento_aceites', 'update')
     or has_table_privilege('service_role', 'public.evento_aceites', 'delete')
     or has_table_privilege('anon', 'public.evento_privado', 'select')
     or exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'evento_aceites'
                and cmd <> 'SELECT' and policyname <> 'gf_mfa_aal2') then
    raise exception 'privilégios de evento_aceites/evento_privado errados';
  end if;
  if has_function_privilege('anon', 'public.aceite_evento_versao()', 'execute')
     or has_function_privilege('authenticated', 'public.evento_privado_marca()', 'execute') then
    raise exception 'EXECUTE errado';
  end if;
end $$;

commit;

-- Conferência (só leitura). Esperado: 5 colunas novas em events, inclui_bebida em ticket_types, 5 CHECKs validados,
-- 3 regras em evento_privado e 2 em evento_aceites, versão do aceite.
select 'coluna' as item, table_name || '.' || column_name as nome, data_type as valor
from information_schema.columns
where table_schema = 'public' and ((table_name = 'events' and column_name in ('temas', 'estilos', 'classificacao',
      'local_modo', 'privado_alterado_em')) or (table_name = 'ticket_types' and column_name = 'inclui_bebida'))
union all
select 'check', conname, convalidated::text from pg_constraint
where conrelid = 'public.events'::regclass and conname in ('events_temas_check', 'events_estilos_check',
      'events_classificacao_check', 'events_local_modo_check', 'events_tags_max_check')
union all
select 'regra', tablename || '.' || policyname, cmd from pg_policies
where schemaname = 'public' and tablename in ('evento_privado', 'evento_aceites')
union all
select 'versao_aceite', public.aceite_evento_versao(), null
order by 1, 2;
