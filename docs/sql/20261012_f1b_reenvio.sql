-- =============================================================================
-- F1-b PR3a da criação de evento (plano glistening-drifting-firefly). 04/10/2026.
-- Evento que volta a 'published' (recusado ou revogado que o produtor reenvia, ou aprovado que passou por rascunho)
-- volta para análise: approval_status = 'pending', sem destaque, approved_at/approved_by nulos. rejection_reason fica
-- (o painel mostra o motivo). Fecha a pendência "evento que volta a published sem nova análise".
--   1. gf_protect_event_moderation recriada a partir da definição de PRODUÇÃO de 04/10/2026 (a da F1-a), mais a regra
--      nova, depois da regra de conteúdo e antes do `return new` final.
--   2. ticket_types: mudar um ingresso (menos as contagens de venda), criar ou apagar atualiza events.updated_at,
--      para a trava de aprovação por updated_at (useApproveEvent) cobrir também os ingressos.
--   3. Índice evento_aceites (producer_id, aceito_em desc), para o limite de 20 aceites por hora da aceite-evento.
--
-- DEPOIS DESTE SQL: NÃO RODAR 20261009_f1a_tipo_evento.sql DE NOVO (ele recriaria a função sem a regra do reenvio; o
-- bloco 0 dele aborta se a F1-b já estiver aplicada). O realinhamento de start_date da F1-a já foi feito em produção.
-- Quem recriar gf_protect_event_moderation no futuro deve partir da definição que está em PRODUÇÃO
-- (pg_get_functiondef), nunca de um arquivo antigo do repositório, e manter a regra "voltou a published".
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17).
-- Uma transação só; idempotente (pode rodar de novo). NÃO mover para supabase/migrations/.
-- Testes: 20261012_f1b_reenvio_testes.sql (só em banco descartável).
--
-- PASSO 0 (só leitura; rodar SOZINHO antes, em produção):
--   select md5(pg_get_functiondef('public.gf_protect_event_moderation'::regproc));
--   Esperado: bf3eb6c7fa5af17c191c0b1846cf03c3 (a definição de 04/10/2026, a do bloco 7 de 20261009_f1a_tipo_evento.sql).
--   Se for outro, alguém mudou a função: NÃO aplicar; refazer o bloco 1 a partir da definição nova (o bloco 0 também
--   confere e aborta).
--
-- DECISÕES
-- 1. A regra nasce no gatilho (e não no front) porque o produtor grava status direto pelo PostgREST. Admin e
--    service_role saem no início da função (`return new`), então a aprovação do admin não é afetada.
-- 2. Ordem dentro da função: a atribuição vem DEPOIS da checagem que dá 42501 (aprovação e destaque são do admin),
--    que compara new com old antes da nossa mudança. O produtor não manda approval_status; o gatilho muda sozinho.
-- 3. Evento publicado e aprovado que o produtor só edita (status continua published) não passa por esta regra:
--    a regra de conteúdo já devolve para análise quando muda campo de conteúdo.
-- 4. Evento novo (INSERT) não passa por aqui: já entra pending.
-- 5. Gatilho em ticket_types: INSERT, DELETE e UPDATE em que mudou QUALQUER coluna menos as contagens de venda
--    (sold, quantity_sold) e updated_at: venda não deve dar "o evento mudou" ao admin, e coluna nova de conteúdo no
--    futuro já conta sem mexer aqui. Se o event_id do ingresso mudar, os dois eventos são tocados. O UPDATE em events só mexe em updated_at: para a função de moderação (que roda com o papel de
--    quem chamou) nada de aprovação, data, local, conteúdo ou status muda, então não cai em exceção. No DELETE em
--    cascata do evento o UPDATE não acha a linha e não faz nada.
-- 6. Índice (producer_id, aceito_em) em evento_aceites: a função aceite-evento conta os aceites da última hora do
--    produtor (limite de 20 por hora).
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos ---------------------------------------------------------------------------------------
do $$
declare
  def text;
begin
  if to_regclass('public.events') is null or to_regclass('public.ticket_types') is null
     or to_regclass('public.evento_aceites') is null
     or to_regprocedure('public.gf_protect_event_moderation()') is null
     or to_regprocedure('public.gf_is_admin()') is null then
    raise exception 'events, gf_protect_event_moderation ou gf_is_admin não existem';
  end if;
  if not exists (select 1 from pg_trigger
                 where tgrelid = 'public.events'::regclass and tgname = 'gf_protect_event_moderation') then
    raise exception 'Falta o gatilho gf_protect_event_moderation (20260930_f0a_moderacao_eventos.sql): aplicar antes';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public'
                 and table_name = 'ticket_types' and column_name = 'inclui_bebida') then
    raise exception 'Falta ticket_types.inclui_bebida (20261009_f1a_tipo_evento.sql): aplicar antes';
  end if;
  def := pg_get_functiondef('public.gf_protect_event_moderation'::regproc);
  -- a função é recriada abaixo a partir da definição conferida em 04/10; outra versão = alguém mudou depois.
  -- Na 2ª aplicação ela já é a deste arquivo (cita "voltou a published") e passa.
  if md5(def) <> 'bf3eb6c7fa5af17c191c0b1846cf03c3' and position('voltou a published' in def) = 0 then
    raise exception 'gf_protect_event_moderation mudou desde 04/10 (md5 diferente): refazer o bloco 1 a partir dela';
  end if;
end $$;

-- 1. Moderação: reenvio volta para análise ---------------------------------------------------------------------
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

  -- voltou a published (recusado reenviado, revogado, aprovado que passou por rascunho): nova análise
  if old.status is distinct from 'published' and new.status = 'published' then
    new.approval_status := 'pending';
    new.featured_carousel := false;
    new.approved_at := null;
    new.approved_by := null; -- rejection_reason fica: o painel mostra o motivo
  end if;
  return new;
end;
$$;

-- 2. Ingresso mudado = evento mudado -------------------------------------------------------------------------------
create or replace function public.gf_ticket_types_toca_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  antigo uuid;
  novo uuid;
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(old) - array['sold', 'quantity_sold', 'updated_at'])
         is not distinct from (to_jsonb(new) - array['sold', 'quantity_sold', 'updated_at']) then
    return null; -- só venda (ou nada): não é mudança do evento
  end if;
  if tg_op <> 'INSERT' then antigo := old.event_id; end if;
  if tg_op <> 'DELETE' then novo := new.event_id; end if;
  update public.events set updated_at = now() where id in (antigo, novo);
  return null;
end;
$$;
revoke all on function public.gf_ticket_types_toca_evento() from public, anon, authenticated;

drop trigger if exists gf_ticket_types_toca_evento on public.ticket_types;
create trigger gf_ticket_types_toca_evento
  after insert or delete or update on public.ticket_types
  for each row execute function public.gf_ticket_types_toca_evento();

-- Limite de aceites por hora (aceite-evento): a contagem filtra producer_id e aceito_em
create index if not exists evento_aceites_producer_aceito_idx on public.evento_aceites (producer_id, aceito_em desc);

-- 3. Conferência que aborta (tudo ou nada) ----------------------------------------------------------------------
do $$
declare
  def text := pg_get_functiondef('public.gf_protect_event_moderation'::regproc);
begin
  if position('voltou a published' in def) = 0
     or position('old.status is distinct from ''published'' and new.status = ''published''' in def) = 0
     or position('new.privado_alterado_em' in def) = 0 then
    raise exception 'gf_protect_event_moderation sem a regra de reenvio (ou perdeu a da F1-a)';
  end if;
  -- a regra nova vem depois da checagem 42501
  if position('Aprovação e destaque do evento são do admin' in def) > position('voltou a published' in def) then
    raise exception 'regra de reenvio antes da checagem de aprovação';
  end if;
  if not exists (select 1 from pg_trigger
                 where tgrelid = 'public.events'::regclass and tgname = 'gf_protect_event_moderation'
                   and tgenabled <> 'D') then
    raise exception 'gatilho gf_protect_event_moderation desligado ou ausente em events';
  end if;
  if has_function_privilege('authenticated', 'public.gf_protect_event_moderation()', 'execute')
     or has_function_privilege('anon', 'public.gf_protect_event_moderation()', 'execute')
     or has_function_privilege('authenticated', 'public.gf_ticket_types_toca_evento()', 'execute')
     or has_function_privilege('anon', 'public.gf_ticket_types_toca_evento()', 'execute') then
    raise exception 'EXECUTE errado: anon/authenticated executam função de gatilho';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.ticket_types'::regclass
                 and tgname = 'gf_ticket_types_toca_evento' and tgenabled <> 'D') then
    raise exception 'gatilho gf_ticket_types_toca_evento ausente ou desligado em ticket_types';
  end if;
  if to_regclass('public.evento_aceites_producer_aceito_idx') is null then
    raise exception 'índice evento_aceites_producer_aceito_idx ausente';
  end if;
end $$;

commit;

-- Conferência (só leitura). Esperado: 1 linha, regra_reenvio = true, gatilho = O, gatilho_ingresso = O.
select position('voltou a published' in pg_get_functiondef('public.gf_protect_event_moderation'::regproc)) > 0 as regra_reenvio,
       (select tgenabled::text from pg_trigger
         where tgrelid = 'public.events'::regclass and tgname = 'gf_protect_event_moderation') as gatilho,
       (select tgenabled::text from pg_trigger
         where tgrelid = 'public.ticket_types'::regclass and tgname = 'gf_ticket_types_toca_evento') as gatilho_ingresso;
