-- =============================================================================
-- Tela 03 do lançamento (Decisão 170). 24/10/2026. Trava de aceite no banco.
-- Até aqui só o front (enviarEvento) chamava a Edge Function aceite-evento antes de publicar. Agora o gatilho
-- gf_protect_event_moderation recusa (42501) a passagem para 'published' de anon/authenticated não admin sem linha em
-- evento_aceites com a versão atual do texto, a classificação atual (esporte = nula) e tem_bebida igual ao que os
-- ingressos têm hoje (mesmos critérios de supabase/functions/aceite-evento/index.ts). Admin e service_role saem no
-- início da função. Evento já publicado que só é editado não passa pela regra. INSERT já em 'published' também cai
-- (o evento novo ainda não tem aceite). Não toca em ticket_types nem em max_per_order (#217).
--
-- Base: definição de PRODUÇÃO lida em 07/10/2026 (md5 31a06e7ddda4f033c8859a33fa67b725). Quem recriar a função no
-- futuro deve partir de pg_get_functiondef em produção e manter as regras "aceite" e "voltou a published".
-- Aplicar: colar inteiro no SQL Editor (UTF-8 via pbcopy, nunca TextEdit). Uma transação; idempotente na 2ª vez
-- (o bloco 0 aceita a função já com a regra). NÃO mover para supabase/migrations/.
-- Testes: 20261024_trava_aceite_publicar_testes.sql (só em banco descartável).
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos ---------------------------------------------------------------------------------------
do $$
declare
  def text;
begin
  if to_regprocedure('public.gf_protect_event_moderation()') is null or to_regprocedure('public.aceite_evento_versao()') is null
     or to_regclass('public.evento_aceites') is null or to_regprocedure('public.gf_is_admin()') is null then
    raise exception 'gf_protect_event_moderation, aceite_evento_versao, evento_aceites ou gf_is_admin não existem';
  end if;
  def := pg_get_functiondef('public.gf_protect_event_moderation'::regproc);
  if md5(def) <> '31a06e7ddda4f033c8859a33fa67b725' and position('aceite do produtor (20261024)' in def) = 0 then
    raise exception 'gf_protect_event_moderation mudou desde 07/10 (md5 diferente): refazer o bloco 1 a partir dela';
  end if;
end $$;

-- 1. Gatilho com a trava de aceite ---------------------------------------------------------------------------
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

  -- aceite do produtor (20261024): passar para published exige aceite gravado para a versão, a classificação e a bebida atuais
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if not exists (select 1 from public.evento_aceites a
                   where a.event_id = new.id
                     and a.versao = public.aceite_evento_versao()
                     and a.classificacao is not distinct from (case when new.category = 'esporte' then null else new.classificacao end)
                     and a.tem_bebida = exists (select 1 from public.ticket_types t where t.event_id = new.id and t.inclui_bebida)) then
      raise exception 'Evento sem aceite do produtor para a classificação e a bebida atuais' using errcode = '42501';
    end if;
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

-- 2. Conferências finais (abortam) -----------------------------------------------------------------------------
do $$
declare
  def text := pg_get_functiondef('public.gf_protect_event_moderation'::regproc);
begin
  if position('Evento sem aceite do produtor' in def) = 0 then raise exception 'regra do aceite ausente'; end if;
  if position('Evento sem aceite do produtor' in def) > position('Evento novo entra em análise' in def)
     or position('Evento sem aceite do produtor' in def) > position('voltou a published' in def) then
    raise exception 'regra do aceite fora de ordem (antes do INSERT e da regra voltou a published)';
  end if;
  if position('Aprovação e destaque do evento são do admin' in def) = 0 or position('voltou a published' in def) = 0 then
    raise exception 'regras anteriores sumiram da função';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.events'::regclass and tgname = 'gf_protect_event_moderation' and tgenabled <> 'D') then
    raise exception 'gatilho gf_protect_event_moderation desligado ou ausente';
  end if;
  if has_function_privilege('anon', 'public.gf_protect_event_moderation()', 'execute')
     or has_function_privilege('authenticated', 'public.gf_protect_event_moderation()', 'execute') then
    raise exception 'EXECUTE da função de gatilho deve estar revogado de anon/authenticated';
  end if;
end $$;

commit;
