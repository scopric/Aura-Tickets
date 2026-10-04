-- =============================================================================
-- Admin S8 (moderação de evento). 05/10/2026. Decisão 163, item 15.
-- Mudar preço, quantidade ou criar tipo de ingresso em evento JÁ APROVADO NÃO devolve o evento à análise: o admin é
-- AVISADO. Marca events.ingressos_alterados_em (data/hora), mostrada na fila e no detalhe do evento.
--   1. events.ingressos_alterados_em timestamptz.
--   2. gf_ticket_types_toca_evento recriada a partir da definição de PRODUÇÃO (20261012_f1b_reenvio.sql): além de tocar
--      updated_at, grava a marca SÓ quando o evento está approved e a mudança é material.
--   3. Gatilho gf_events_ingressos_marca: quem não é admin não grava nem apaga a marca direto em events.
--   4. RPC admin_evento_decidir: aprovar, recusar ou revogar em UM UPDATE (antes eram 2 no revogar), com a trava por
--      updated_at (p_versao).
--
-- NÃO recria gf_protect_event_moderation (é da F1) e NÃO põe a coluna nova na lista de conteúdo dela. Não mexe em
-- políticas de SELECT de events, ticket_types, orders ou favoritos.
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17).
-- Uma transação só; idempotente (pode rodar de novo). NÃO mover para supabase/migrations/.
-- Testes: supabase/tests/admin_s8_moderacao.test.sql (só em banco descartável).
--
-- PASSO 0 (só leitura; rodar SOZINHO antes, em produção):
--   select md5(pg_get_functiondef('public.gf_ticket_types_toca_evento'::regproc)),
--          md5(pg_get_functiondef('public.gf_protect_event_moderation'::regproc));
--   Esperado: 3c030a882acc57d4df25b4b3e05286b7 e 31a06e7ddda4f033c8859a33fa67b725 (o bloco 0 também confere e aborta).
--
-- DECISÕES
-- 1. "Material" = INSERT, DELETE, ou UPDATE em event_id, price, quantity_total, capacity, type, name, description,
--    inclui_bebida, perks, perks_array. Não contam: is_active (pausar), sort_order, datas de venda, min/max por pedido,
--    validade, sold e quantity_sold (venda).
-- 2. A marca não está na lista de conteúdo de gf_protect_event_moderation: gravá-la não muda approval_status (provado
--    nos testes). O UPDATE do gatilho de ingresso roda como dono da função (security definer): current_user deixa de ser
--    authenticated, e é isso que o gatilho do item 3 usa para deixar só ele gravar.
-- 3. O gatilho do item 3 é SECURITY INVOKER de propósito (precisa ver o current_user de quem grava). Sem ele o produtor
--    apagaria a marca do próprio evento (UPDATE ... = null) e esconderia o aviso do admin. Admin (gf_is_admin) pode,
--    porque a aprovação zera a marca.
-- 4. admin_evento_decidir é SECURITY INVOKER: a RLS de events (gf_events_admin_write) e os gatilhos valem como sempre.
--    Um UPDATE só dispara um aviso ao produtor (gf_notificar_evento) e uma linha de trilha (audit_events_upd).
--    Recusar e revogar tiram o destaque; revogar e recusar despublicam (published -> draft); cancelled/ended ficam.
--    A marca só zera ao aprovar. Sem linha (updated_at mudou ou id inexistente): P0002.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos -----------------------------------------------------------------------------------------
do $$
declare
  def text;
begin
  if to_regclass('public.events') is null or to_regclass('public.ticket_types') is null
     or to_regprocedure('public.gf_admin_can(text)') is null or to_regprocedure('public.gf_is_admin()') is null
     or to_regprocedure('public.gf_ticket_types_toca_evento()') is null
     or to_regprocedure('public.gf_protect_event_moderation()') is null then
    raise exception 'events, ticket_types, gf_admin_can, gf_is_admin ou as funções de gatilho não existem';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public'
                 and table_name = 'ticket_types' and column_name = 'inclui_bebida') then
    raise exception 'Falta ticket_types.inclui_bebida (20261009_f1a_tipo_evento.sql): aplicar antes';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.events'::regclass
                 and tgname = 'gf_notificar_evento' and not tgisinternal) then
    raise exception 'Falta o gatilho gf_notificar_evento (20261013_notificacoes.sql): aplicar antes';
  end if;
  -- gf_protect_event_moderation: só conferir (a F1 é dona dela); este arquivo não a recria
  if md5(pg_get_functiondef('public.gf_protect_event_moderation'::regproc)) <> '31a06e7ddda4f033c8859a33fa67b725' then
    raise exception 'gf_protect_event_moderation mudou (md5 diferente de 31a06e7d…): conferir com a F1 antes de seguir';
  end if;
  -- gf_ticket_types_toca_evento: recriada abaixo a partir da definição de 04/10. Na 2ª aplicação já é a deste arquivo.
  def := pg_get_functiondef('public.gf_ticket_types_toca_evento'::regproc);
  if md5(def) <> '3c030a882acc57d4df25b4b3e05286b7' and position('ingressos_alterados_em' in def) = 0 then
    raise exception 'gf_ticket_types_toca_evento mudou desde 04/10 (md5 diferente): refazer o bloco 2 a partir dela';
  end if;
end $$;

-- 1. A marca ------------------------------------------------------------------------------------------------
alter table public.events add column if not exists ingressos_alterados_em timestamptz;

-- 2. Ingresso mudado = evento mudado; em evento aprovado, mudança material grava a marca -------------------------
create or replace function public.gf_ticket_types_toca_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  antigo uuid;
  novo uuid;
  material boolean;
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(old) - array['sold', 'quantity_sold', 'updated_at'])
         is not distinct from (to_jsonb(new) - array['sold', 'quantity_sold', 'updated_at']) then
    return null; -- só venda (ou nada): não é mudança do evento
  end if;
  -- Decisão 163 item 15: preço, quantidade e tipo novo avisam o admin; pausar, ordem e datas de venda não
  material := tg_op <> 'UPDATE'
    or (old.event_id, old.price, old.quantity_total, old.capacity, old.type, old.name, old.description,
        old.inclui_bebida, old.perks, old.perks_array)
       is distinct from
       (new.event_id, new.price, new.quantity_total, new.capacity, new.type, new.name, new.description,
        new.inclui_bebida, new.perks, new.perks_array);
  if tg_op <> 'INSERT' then antigo := old.event_id; end if;
  if tg_op <> 'DELETE' then novo := new.event_id; end if;
  update public.events
     set updated_at = now(),
         ingressos_alterados_em = case when material and approval_status = 'approved'
                                       then clock_timestamp() else ingressos_alterados_em end
   where id in (antigo, novo);
  return null;
end;
$$;
revoke all on function public.gf_ticket_types_toca_evento() from public, anon, authenticated;

-- 3. Só o gatilho de ingresso e o admin mexem na marca ---------------------------------------------------------
create or replace function public.gf_events_ingressos_marca()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ingressos_alterados_em is distinct from (case when tg_op = 'UPDATE' then old.ingressos_alterados_em end)
     and current_user in ('authenticated', 'anon')
     and not public.gf_is_admin() then
    raise exception 'ingressos_alterados_em é gravado só pelo banco' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.gf_events_ingressos_marca() from public, anon, authenticated;

drop trigger if exists gf_events_ingressos_marca on public.events;
create trigger gf_events_ingressos_marca
  before insert or update on public.events
  for each row execute function public.gf_events_ingressos_marca();

-- 4. Decisão de moderação em UM UPDATE ------------------------------------------------------------------------
create or replace function public.admin_evento_decidir(p_id uuid, p_decisao text, p_motivo text, p_versao timestamptz)
returns public.events
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_aprova boolean := p_decisao = 'aprovar';
  v_motivo text := nullif(btrim(p_motivo), '');
  v_ev public.events;
begin
  if not (select public.gf_admin_can('manage_events')) then
    raise exception 'Sem permissão para moderar eventos' using errcode = '42501';
  end if;
  if p_decisao is null or p_decisao not in ('aprovar', 'recusar', 'revogar') then
    raise exception 'Decisão inválida: use aprovar, recusar ou revogar' using errcode = '22023';
  end if;
  if p_decisao = 'recusar' and (v_motivo is null or char_length(v_motivo) > 500) then
    raise exception 'Recusar exige um motivo de até 500 caracteres' using errcode = '22023';
  end if;

  update public.events set
    approval_status = case p_decisao when 'aprovar' then 'approved' when 'recusar' then 'rejected' else 'pending' end,
    approved_at = case when v_aprova then now() end,
    approved_by = case when v_aprova then (select auth.uid()) end,
    rejection_reason = case when p_decisao = 'recusar' then v_motivo end,
    featured_carousel = case when v_aprova then featured_carousel else false end,
    -- só o que está no ar sai do ar: cancelled e ended são decisão do produtor
    status = case when not v_aprova and status = 'published' then 'draft' else status end,
    ingressos_alterados_em = case when v_aprova then null else ingressos_alterados_em end
  where id = p_id and updated_at = p_versao
  returning * into v_ev;

  if not found then
    raise exception 'O evento mudou desde que você abriu; recarregue.' using errcode = 'P0002';
  end if;
  return v_ev;
end;
$$;
revoke all on function public.admin_evento_decidir(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.admin_evento_decidir(uuid, text, text, timestamptz) to authenticated;

-- 5. Conferência que aborta (tudo ou nada) --------------------------------------------------------------------
do $$
declare
  def text := pg_get_functiondef('public.gf_ticket_types_toca_evento'::regproc);
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'events'
                 and column_name = 'ingressos_alterados_em' and data_type = 'timestamp with time zone') then
    raise exception 'events.ingressos_alterados_em ausente';
  end if;
  if position('clock_timestamp' in def) = 0 or position('inclui_bebida' in def) = 0
     or position('updated_at = now()' in def) = 0 then
    raise exception 'gf_ticket_types_toca_evento sem a marca';
  end if;
  if md5(pg_get_functiondef('public.gf_protect_event_moderation'::regproc)) <> '31a06e7ddda4f033c8859a33fa67b725'
     or position('ingressos_alterados_em' in pg_get_functiondef('public.gf_protect_event_moderation'::regproc)) > 0 then
    raise exception 'gf_protect_event_moderation foi alterada: ela não pode citar a marca';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.ticket_types'::regclass
                 and tgname = 'gf_ticket_types_toca_evento' and tgenabled <> 'D')
     or not exists (select 1 from pg_trigger where tgrelid = 'public.events'::regclass
                    and tgname = 'gf_events_ingressos_marca' and tgenabled <> 'D') then
    raise exception 'gatilho de ingresso ou da marca ausente ou desligado';
  end if;
  if has_function_privilege('anon', 'public.gf_ticket_types_toca_evento()', 'execute')
     or has_function_privilege('authenticated', 'public.gf_ticket_types_toca_evento()', 'execute')
     or has_function_privilege('authenticated', 'public.gf_events_ingressos_marca()', 'execute')
     or has_function_privilege('anon', 'public.admin_evento_decidir(uuid,text,text,timestamptz)', 'execute')
     or not has_function_privilege('authenticated', 'public.admin_evento_decidir(uuid,text,text,timestamptz)', 'execute') then
    raise exception 'EXECUTE errado nas funções do S8';
  end if;
  if (select p.prosecdef from pg_proc p where p.oid = 'public.admin_evento_decidir(uuid,text,text,timestamptz)'::regprocedure) then
    raise exception 'admin_evento_decidir tem de ser SECURITY INVOKER';
  end if;
end $$;

commit;

-- Conferência (só leitura). Esperado: 1 linha, tudo true.
select exists (select 1 from information_schema.columns where table_name = 'events' and column_name = 'ingressos_alterados_em') as coluna,
       position('clock_timestamp' in pg_get_functiondef('public.gf_ticket_types_toca_evento'::regproc)) > 0 as marca_no_gatilho,
       md5(pg_get_functiondef('public.gf_protect_event_moderation'::regproc)) = '31a06e7ddda4f033c8859a33fa67b725' as moderacao_intacta,
       to_regprocedure('public.admin_evento_decidir(uuid,text,text,timestamptz)') is not null as rpc;

-- DESFAZER (só se precisar; colar à parte). Volta a função de ingresso à de 04/10 (md5 3c030a88…) e tira o resto:
--   begin;
--   drop function if exists public.admin_evento_decidir(uuid, text, text, timestamptz);
--   drop trigger if exists gf_events_ingressos_marca on public.events;
--   drop function if exists public.gf_events_ingressos_marca();
--   create or replace function public.gf_ticket_types_toca_evento() returns trigger language plpgsql security definer
--     set search_path = '' as $f$
--   declare antigo uuid; novo uuid;
--   begin
--     if tg_op = 'UPDATE' and (to_jsonb(old) - array['sold', 'quantity_sold', 'updated_at'])
--          is not distinct from (to_jsonb(new) - array['sold', 'quantity_sold', 'updated_at']) then return null; end if;
--     if tg_op <> 'INSERT' then antigo := old.event_id; end if;
--     if tg_op <> 'DELETE' then novo := new.event_id; end if;
--     update public.events set updated_at = now() where id in (antigo, novo);
--     return null;
--   end; $f$;
--   revoke all on function public.gf_ticket_types_toca_evento() from public, anon, authenticated;
--   alter table public.events drop column if exists ingressos_alterados_em;
--   commit;
