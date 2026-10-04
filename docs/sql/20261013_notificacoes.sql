-- =============================================================================
-- P1 da fila de auditorias (participante + produtor; absorve a L5 do produtor): notificações de verdade. 04/10/2026.
-- Hoje a tabela public.notifications tem só a regra RESTRICTIVE gf_mfa_aal2: ninguém consegue ler (o sino do app
-- sempre vem vazio), `anon` tem todos os privilégios de tabela do baseline e nada grava nela. Este arquivo:
--   (a) deixa o DONO (user_id = auth.uid()) ler, marcar como lida e apagar o próprio aviso; mais nada;
--   (b) cria os gatilhos que gravam avisos nos eventos que JÁ existem, sem depender de pedido pago.
--
-- Origens dos avisos (public.gf_notificar_evento, gatilho AFTER UPDATE em events):
--   1. evento do produtor aprovado ou recusado pela moderação  -> aviso ao produtor (L5);
--   2. evento publicado e aprovado que muda de data ou de local -> aviso a quem salvou (public.favoritos) (P09 b);
--   3. evento publicado e aprovado que é cancelado             -> aviso a quem salvou (P09 b).
--   Cada aviso leva metadata.url (caminho interno): o front o abre ao clicar.
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17).
-- Uma transação só: se a conferência do fim falhar, nada é gravado. Idempotente (pode rodar de novo).
-- `set local lock_timeout = '5s'`: se algo segurar notifications ou events, o arquivo desiste sem gravar; rodar de novo.
-- NÃO mover para supabase/migrations/ (motivo no cabeçalho de 20260927_security_hardening.sql).
-- Teste: supabase/tests/notificacoes.test.sql (pgTAP; banco local, nunca em produção).
-- Ordem: depende de 20261008_favoritos.sql (já em produção). Pode ser aplicado antes ou depois do front: sem este
-- SQL o sino do front só mostra "Não foi possível carregar"; sem o front, nada muda para o usuário.
--
-- DECISÕES
-- 1. Quem escreve: só gatilhos SECURITY DEFINER (search_path vazio) e a chave de serviço. authenticated NÃO tem
--    INSERT: ninguém cria aviso para outra pessoa pela API (aviso falso = phishing dentro do app). A função do
--    gatilho não tem EXECUTE para ninguém (gatilho dispensa).
-- 2. Marcar como lida: o baseline dá UPDATE na tabela inteira a authenticated e revogar uma coluna não tira o que
--    veio pela tabela. Por isso: revoke de tudo e grant de UPDATE só em (is_read). Alterar title, body, type,
--    metadata ou user_id dá 42501 (o plano pede que o UPDATE de title falhe). Nada de gatilho a mais.
-- 3. `anon` perde tudo (o baseline lhe dava até TRUNCATE; a RLS sem regra já barrava, aqui o privilégio sai
--    também). service_role mantém tudo (padrão do Supabase; delete-account apaga os avisos da pessoa).
-- 4. O gatilho nunca derruba a moderação: o destinatário só recebe se existir em profiles (a chave estrangeira de
--    notifications.user_id aponta para profiles). Conta apagada de forma suave continua em profiles; ok.
-- 5. type: o CHECK do baseline só aceita info, sale, reminder, promo e system; mantido. Aprovação = info;
--    recusa e cancelamento = system (o front pinta system como alerta).
-- 6. Fica de fora (outra fase): aviso para quem COMPROU ingresso quando o evento muda (depende de pedido pago,
--    fase de pagamentos); mensagem nova do chat de suporte (o chat já tem contador e tempo real próprios); aviso
--    da Política (vai por e-mail pela aviso-politica). A re-aprovação de evento editado pelo produtor não
--    avisa quem salvou: o banco já devolve o evento a "em análise" na edição e não guarda o valor antigo.
-- 7. Índice (user_id, created_at desc): o sino lê "meus avisos, mais novos primeiro".
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos
do $$
begin
  if to_regclass('public.notifications') is null then raise exception 'public.notifications não existe'; end if;
  if to_regclass('public.events') is null then raise exception 'public.events não existe'; end if;
  if to_regclass('public.favoritos') is null then
    raise exception 'Falta public.favoritos (20261008_favoritos.sql): aplicar antes';
  end if;
  if to_regproc('public.gf_mfa_ok') is null then
    raise exception 'Falta public.gf_mfa_ok (20260930_2fa_no_banco.sql): aplicar antes';
  end if;
end $$;

-- 1. Privilégios de tabela ------------------------------------------------------------------------------------------
revoke all on table public.notifications from anon, authenticated;
grant select, delete on table public.notifications to authenticated;
grant update (is_read) on table public.notifications to authenticated;

-- 2. Regras (RLS): só o dono. gf_mfa_aal2 (RESTRICTIVE, 2FA) fica intacta ---------------------------------------------
alter table public.notifications enable row level security;

drop policy if exists gf_notifications_select_dono on public.notifications;
create policy gf_notifications_select_dono on public.notifications
  as permissive for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists gf_notifications_update_dono on public.notifications;
create policy gf_notifications_update_dono on public.notifications
  as permissive for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists gf_notifications_delete_dono on public.notifications;
create policy gf_notifications_delete_dono on public.notifications
  as permissive for delete to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

-- 3. Gatilho de eventos ---------------------------------------------------------------------------------------------
create or replace function public.gf_notificar_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publico_antes boolean := old.status = 'published' and old.approval_status = 'approved';
  v_publico_agora boolean := new.status = 'published' and new.approval_status = 'approved';
begin
  -- 1. Moderação decidiu (aprovou ou recusou): avisa o produtor
  if new.approval_status is distinct from old.approval_status and new.approval_status in ('approved', 'rejected') then
    insert into public.notifications (user_id, title, body, type, metadata)
    select p.id,
           case new.approval_status when 'approved' then 'Seu evento foi aprovado' else 'Seu evento foi recusado' end,
           case new.approval_status
             when 'approved' then '"' || new.title || '" já está no ar.'
             else '"' || new.title || '" foi recusado.'
                  || coalesce(' Motivo: ' || nullif(btrim(new.rejection_reason), ''), '')
           end,
           case new.approval_status when 'approved' then 'info' else 'system' end,
           jsonb_build_object('origem', 'moderacao', 'event_id', new.id, 'url', '/producer/events/' || new.id || '/edit')
    from public.profiles p
    where p.id = new.producer_id;
  end if;

  -- 2. Evento no ar mudou de data ou de local: avisa quem salvou
  if v_publico_antes and v_publico_agora
     and (new.date, new."time", new.start_date, new.end_date, new.venue_name, new.venue_address, new.venue_city, new.venue_state)
         is distinct from
         (old.date, old."time", old.start_date, old.end_date, old.venue_name, old.venue_address, old.venue_city, old.venue_state)
  then
    insert into public.notifications (user_id, title, body, type, metadata)
    select p.id, 'Um evento salvo mudou de data ou local',
           '"' || new.title || '" tem novos dados. Confira antes de se planejar.',
           'info',
           jsonb_build_object('origem', 'evento_salvo', 'event_id', new.id, 'url', '/event/' || new.id)
    from public.favoritos f
    join public.profiles p on p.id = f.user_id
    where f.event_id = new.id;
  end if;

  -- 3. Evento no ar foi cancelado: avisa quem salvou
  if v_publico_antes and new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    insert into public.notifications (user_id, title, body, type, metadata)
    select p.id, 'Um evento salvo foi cancelado',
           '"' || new.title || '" foi cancelado.',
           'system',
           jsonb_build_object('origem', 'evento_salvo', 'event_id', new.id, 'url', '/event/' || new.id)
    from public.favoritos f
    join public.profiles p on p.id = f.user_id
    where f.event_id = new.id;
  end if;

  return null; -- AFTER: o retorno é ignorado
end;
$$;
revoke execute on function public.gf_notificar_evento() from public, anon, authenticated;

drop trigger if exists gf_notificar_evento on public.events;
create trigger gf_notificar_evento
  after update of approval_status, status, date, "time", start_date, end_date, venue_name, venue_address, venue_city, venue_state
  on public.events
  for each row execute function public.gf_notificar_evento();

-- 4. Conferência: qualquer divergência aborta e nada é gravado ------------------------------------------------------
do $$
declare
  v_pol text;
begin
  select string_agg(policyname, ',' order by policyname) into v_pol
  from pg_policies where schemaname = 'public' and tablename = 'notifications' and permissive = 'PERMISSIVE';
  if v_pol is distinct from 'gf_notifications_delete_dono,gf_notifications_select_dono,gf_notifications_update_dono' then
    raise exception 'notifications: regras permissivas inesperadas (%)', v_pol;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications'
             and policyname <> 'gf_mfa_aal2' and roles <> '{authenticated}') then
    raise exception 'notifications: regra que não é só de authenticated';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications'
                 and policyname = 'gf_mfa_aal2' and permissive = 'RESTRICTIVE') then
    raise exception 'notifications: faltou a regra gf_mfa_aal2';
  end if;
  if has_table_privilege('anon', 'public.notifications', 'select, insert, update, delete, truncate') then
    raise exception 'notifications: anon ainda tem privilégio';
  end if;
  if has_table_privilege('authenticated', 'public.notifications', 'insert')
     or has_table_privilege('authenticated', 'public.notifications', 'update')
     or has_table_privilege('authenticated', 'public.notifications', 'truncate') then
    raise exception 'notifications: authenticated com privilégio de tabela demais';
  end if;
  if not has_column_privilege('authenticated', 'public.notifications', 'is_read', 'update')
     or has_column_privilege('authenticated', 'public.notifications', 'title', 'update')
     or has_column_privilege('authenticated', 'public.notifications', 'user_id', 'update') then
    raise exception 'notifications: UPDATE de coluna fora do desenhado';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'gf_notificar_evento' and tgrelid = 'public.events'::regclass and not tgisinternal) then
    raise exception 'events: faltou o gatilho gf_notificar_evento';
  end if;
  if not exists (select 1 from pg_proc where oid = 'public.gf_notificar_evento()'::regprocedure
                 and prosecdef and proconfig @> array['search_path=""']) then
    raise exception 'gf_notificar_evento: precisa de security definer e search_path vazio';
  end if;
end $$;

commit;
