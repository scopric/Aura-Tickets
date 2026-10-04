-- =============================================================================
-- S4 do plano sparkling-gliding-harp (admin, Decisão 163): o banco passa a exigir a PERMISSÃO DA TELA nas tabelas de
-- DADO PESSOAL e no resto. 04/10/2026. Hoje qualquer admin (gf_is_admin) lê e grava tudo; depois deste arquivo cada
-- regra pede a permissão da área. super_admin passa em todas. Depende da S3 (cria gf_admin_can_any).
--   1. Regras trocadas (mesmos nomes, drop + create, padrão `(select fn())`, ramo do dono/comprador intacto):
--      profiles        SELECT dono ou [manage_users, manage_team, manage_affiliates, manage_events, manage_finance,
--                      manage_tickets, manage_coupons, manage_support, view_analytics, manage_settings]
--      events          SELECT admin [manage_events, manage_users, manage_finance, manage_tickets, view_analytics,
--                      manage_coupons, moderate_mesa]
--      ticket_types    SELECT admin [manage_tickets, manage_events, moderate_mesa]
--      tickets         SELECT admin [manage_tickets, manage_users]
--      check_ins       SELECT admin [manage_tickets]
--      user_activities SELECT admin [manage_users, view_analytics, manage_settings]
--      feedback        SELECT/UPDATE/DELETE manage_feedback
--      contact_messages  UMA regra ALL manage_feedback (gf_contact_admin_read some)
--      evento_aceites  SELECT dono ou manage_events;  evento_privado SELECT dono, manage_events ou comprador com ingresso
--      customers, event_banners, event_budget_boxes, event_photos, event_surveys, event_timeline_items, event_zones,
--      piggy_transactions, tasks, academy_courses: o ramo "admin" vira super_admin (nenhuma tela de admin usa); o ramo do
--                      dono e as regras do produtor ficam
--   2. admin_activity_stats pede view_analytics (e vira STABLE); gf_protect_event_cancel pede manage_events.
--   3. RPC nova chat_cliente_contexto(p_user): o painel do cliente em Atendimento (papel, plano, últimos ingressos e
--      pedidos) sem abrir tickets, orders, producer_subscriptions e profiles ao suporte. Remove a regra provisória
--      gf_producer_subscriptions_support_select da S3.
-- FICA DE FORA: support_messages e support_sessions (a sessão do participante é a dona), gf_protect_event_moderation (F1),
-- colaboradores_resumo (qualquer admin, Decisão 163 item 8), a RESTRICTIVE gf_mfa_aal2 de cada tabela, RPC admin_painel do
-- Dashboard e de agregado de Analytics (fases próprias).
--
-- Como aplicar: DEPOIS do 20261014_admin_s3_permissao_dinheiro.sql. Colar o arquivo inteiro no SQL Editor (UTF-8 via
-- pbcopy, NUNCA pelo TextEdit: erro 17). Uma transação só: se o bloco 0 ou a conferência do fim falhar, nada é gravado.
-- Idempotente. `set local lock_timeout = '5s'`: se algo segurar as tabelas, desiste sem gravar; rodar de novo.
-- NÃO mover para supabase/migrations/ (motivo no cabeçalho de 20260927_security_hardening.sql).
-- Teste: supabase/tests/admin_s4_permissao_dados.test.sql (pgTAP; banco descartável, nunca produção).
--
-- PASSO 0 (só leitura; o bloco 0 também confere e aborta). Esperado em produção em 04/10/2026:
--   select 'admin_activity_stats' f, md5(pg_get_functiondef('public.admin_activity_stats(timestamptz)'::regprocedure))
--   union all select 'gf_protect_event_cancel', md5(pg_get_functiondef('public.gf_protect_event_cancel()'::regprocedure));
--   admin_activity_stats fed37226a310506ee5fa8d5f0a89b8b2 | gf_protect_event_cancel 3c42b43723e092d45ffd579e42bfd377
--
-- DECISÕES
-- 1. profiles NÃO inclui manage_feedback, manage_newsletter nem moderate_mesa: conferido no front (grep, 04/10) que
--    Feedback.tsx só lê feedback e contact_messages, Newsletter.tsx lê newsletter_subscribers, newsletters e events, e
--    Match de Mesa (useAdminEvents) embute profiles!producer_id, mas a tela só usa ticket_types e o título (o embed volta
--    null, sem erro, e nada é exibido a partir dele).
-- 2. events NÃO inclui manage_newsletter: Newsletter.tsx:170 lê só published+approved, que a regra pública já entrega.
--    manage_events já lia events pela regra gf_events_admin_write (ALL).
-- 3. event_budget_boxes: há outra regra "Produtor gerencia budget boxes" (dono); só o ramo admin muda.
-- 4. Papéis: iguais aos de hoje em cada regra (várias são `public`; anon já não executa gf_is_admin/gf_admin_can desde a
--    seg6, o que não muda).
-- 5. chat_cliente_contexto: security definer, search_path '', 42501 sem manage_support e também para cliente SEM
--    conversa (suporte só vê o contexto de quem o procurou). Devolve papel, plano, até 5 ingressos e 5 pedidos (sem CPF,
--    telefone ou e-mail) na mesma forma que o front já lia.
-- TELAS QUE PODEM FICAR VAZIAS: Dashboard (sem permissão própria: lê profiles e events) para admin só de feedback,
-- newsletter ou moderate_mesa (profiles) e só de feedback/newsletter (events); exportações de Configurações (matriz).
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos e conferência das definições de produção ----------------------------------------------------------
do $$
declare
  t text;
  f text;
  def text;
  funcoes jsonb := jsonb_build_object(
    'admin_activity_stats(timestamptz)', 'fed37226a310506ee5fa8d5f0a89b8b2',
    'gf_protect_event_cancel()', '3c42b43723e092d45ffd579e42bfd377');
begin
  if to_regprocedure('public.gf_admin_can_any(text[])') is null then
    raise exception 'falta public.gf_admin_can_any(text[]): aplique antes o 20261014_admin_s3_permissao_dinheiro.sql';
  end if;
  if to_regprocedure('public.gf_admin_can(text)') is null then raise exception 'falta public.gf_admin_can(text)'; end if;
  foreach t in array array['academy_courses', 'check_ins', 'contact_messages', 'customers', 'event_banners',
      'event_budget_boxes', 'event_photos', 'event_surveys', 'event_timeline_items', 'event_zones', 'evento_aceites',
      'evento_privado', 'events', 'feedback', 'piggy_transactions', 'profiles', 'tasks', 'ticket_types', 'tickets',
      'user_activities', 'conversations', 'orders', 'producer_subscriptions'] loop
    if to_regclass('public.' || t) is null then raise exception 'falta a tabela public.%', t; end if;
  end loop;
  foreach t in array array['academy_courses', 'check_ins', 'contact_messages', 'customers', 'event_banners',
      'event_budget_boxes', 'event_photos', 'event_surveys', 'event_timeline_items', 'event_zones', 'evento_aceites',
      'evento_privado', 'events', 'feedback', 'piggy_transactions', 'profiles', 'tasks', 'ticket_types', 'tickets',
      'user_activities'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t
        and policyname = 'gf_mfa_aal2' and permissive = 'RESTRICTIVE') then
      raise exception 'public.% sem a regra RESTRICTIVE gf_mfa_aal2', t;
    end if;
  end loop;
  -- recriadas aqui: ou a de produção ou já a deste arquivo (2ª aplicação)
  for f in select jsonb_object_keys(funcoes) loop
    if to_regprocedure('public.' || f) is null then raise exception 'falta public.%', f; end if;
    def := pg_get_functiondef(('public.' || f)::regprocedure);
    if md5(def) <> funcoes ->> f and position('Decisão 163' in def) = 0 then
      raise exception 'public.% mudou desde 04/10 (md5 diferente): refazer o bloco a partir da definição atual', f;
    end if;
  end loop;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.events'::regclass
      and tgname = 'gf_protect_event_cancel' and tgenabled = 'O') then
    raise exception 'gatilho gf_protect_event_cancel de public.events ausente ou desligado';
  end if;
end $$;

-- 1. Regras ------------------------------------------------------------------------------------------------------------
-- profiles
drop policy if exists gf_profiles_select_own_or_admin on public.profiles;
create policy gf_profiles_select_own_or_admin on public.profiles as permissive for select to authenticated
  using (id = (select auth.uid()) or (select public.gf_admin_can_any(array['manage_users', 'manage_team',
    'manage_affiliates', 'manage_events', 'manage_finance', 'manage_tickets', 'manage_coupons', 'manage_support',
    'view_analytics', 'manage_settings'])));

-- events, ticket_types, tickets, check_ins, user_activities
drop policy if exists gf_events_admin_select on public.events;
create policy gf_events_admin_select on public.events as permissive for select to authenticated
  using ((select public.gf_admin_can_any(array['manage_events', 'manage_users', 'manage_finance', 'manage_tickets',
    'view_analytics', 'manage_coupons', 'moderate_mesa'])));
drop policy if exists gf_ticket_types_admin_select on public.ticket_types;
create policy gf_ticket_types_admin_select on public.ticket_types as permissive for select to authenticated
  using ((select public.gf_admin_can_any(array['manage_tickets', 'manage_events', 'moderate_mesa'])));
drop policy if exists gf_tickets_admin_select on public.tickets;
create policy gf_tickets_admin_select on public.tickets as permissive for select to authenticated
  using ((select public.gf_admin_can_any(array['manage_tickets', 'manage_users'])));
drop policy if exists gf_check_ins_admin_select on public.check_ins;
create policy gf_check_ins_admin_select on public.check_ins as permissive for select to authenticated
  using ((select public.gf_admin_can('manage_tickets')));
drop policy if exists user_activities_select_admin on public.user_activities;
create policy user_activities_select_admin on public.user_activities as permissive for select to authenticated
  using ((select public.gf_admin_can_any(array['manage_users', 'view_analytics', 'manage_settings'])));

-- feedback e contact_messages
drop policy if exists gf_feedback_admin_select on public.feedback;
create policy gf_feedback_admin_select on public.feedback as permissive for select to authenticated
  using ((select public.gf_admin_can('manage_feedback')));
drop policy if exists gf_feedback_admin_update on public.feedback;
create policy gf_feedback_admin_update on public.feedback as permissive for update to authenticated
  using ((select public.gf_admin_can('manage_feedback'))) with check ((select public.gf_admin_can('manage_feedback')));
drop policy if exists gf_feedback_admin_delete on public.feedback;
create policy gf_feedback_admin_delete on public.feedback as permissive for delete to authenticated
  using ((select public.gf_admin_can('manage_feedback')));
drop policy if exists gf_contact_admin_read on public.contact_messages;
drop policy if exists gf_contact_messages_admin_all on public.contact_messages;
create policy gf_contact_messages_admin_all on public.contact_messages as permissive for all to authenticated
  using ((select public.gf_admin_can('manage_feedback'))) with check ((select public.gf_admin_can('manage_feedback')));

-- evento_aceites e evento_privado (o dono e o comprador ficam)
drop policy if exists evento_aceites_select on public.evento_aceites;
create policy evento_aceites_select on public.evento_aceites as permissive for select to authenticated
  using (producer_id = (select auth.uid()) or (select public.gf_admin_can('manage_events')));
drop policy if exists evento_privado_select on public.evento_privado;
create policy evento_privado_select on public.evento_privado as permissive for select to authenticated
  using (
    exists (select 1 from public.events e where e.id = evento_privado.event_id and e.producer_id = (select auth.uid()))
    or (select public.gf_admin_can('manage_events'))
    or exists (select 1 from public.tickets t where t.event_id = evento_privado.event_id
               and t.user_id = (select auth.uid()) and t.status = any (array['active', 'used'])));

-- tabelas sem tela de admin: o ramo admin vira super_admin; o do dono fica
drop policy if exists gf_customers_owner on public.customers;
create policy gf_customers_owner on public.customers as permissive for all to public
  using ((select public.gf_admin_can('super_admin'))
         or event_id in (select e.id from public.events e where e.producer_id = (select auth.uid())))
  with check ((select public.gf_admin_can('super_admin'))
         or event_id in (select e.id from public.events e where e.producer_id = (select auth.uid())));
drop policy if exists gf_event_banners_all on public.event_banners;
create policy gf_event_banners_all on public.event_banners as permissive for all to public
  using (producer_id = (select auth.uid()) or (select public.gf_admin_can('super_admin')))
  with check (producer_id = (select auth.uid()) or (select public.gf_admin_can('super_admin')));
drop policy if exists gf_budget_boxes_all on public.event_budget_boxes;
create policy gf_budget_boxes_all on public.event_budget_boxes as permissive for all to authenticated
  using ((select public.gf_admin_can('super_admin'))) with check ((select public.gf_admin_can('super_admin')));
drop policy if exists gf_event_photos_all on public.event_photos;
create policy gf_event_photos_all on public.event_photos as permissive for all to public
  using (producer_id = (select auth.uid()) or (select public.gf_admin_can('super_admin')))
  with check (producer_id = (select auth.uid()) or (select public.gf_admin_can('super_admin')));
drop policy if exists gf_event_surveys_owner on public.event_surveys;
create policy gf_event_surveys_owner on public.event_surveys as permissive for all to public
  using ((select public.gf_admin_can('super_admin'))
         or event_id in (select e.id from public.events e where e.producer_id = (select auth.uid())))
  with check ((select public.gf_admin_can('super_admin'))
         or event_id in (select e.id from public.events e where e.producer_id = (select auth.uid())));
drop policy if exists gf_event_timeline_all on public.event_timeline_items;
create policy gf_event_timeline_all on public.event_timeline_items as permissive for all to public
  using (producer_id = (select auth.uid()) or (select public.gf_admin_can('super_admin')))
  with check (producer_id = (select auth.uid()) or (select public.gf_admin_can('super_admin')));
drop policy if exists gf_event_zones_owner on public.event_zones;
create policy gf_event_zones_owner on public.event_zones as permissive for all to public
  using ((select public.gf_admin_can('super_admin'))
         or event_id in (select e.id from public.events e where e.producer_id = (select auth.uid())))
  with check ((select public.gf_admin_can('super_admin'))
         or event_id in (select e.id from public.events e where e.producer_id = (select auth.uid())));
drop policy if exists gf_piggy_tx_owner on public.piggy_transactions;
create policy gf_piggy_tx_owner on public.piggy_transactions as permissive for all to public
  using ((select public.gf_admin_can('super_admin'))
         or box_id in (select b.id from public.event_budget_boxes b where b.producer_id = (select auth.uid())))
  with check ((select public.gf_admin_can('super_admin'))
         or box_id in (select b.id from public.event_budget_boxes b where b.producer_id = (select auth.uid())));
drop policy if exists gf_tasks_owner on public.tasks;
create policy gf_tasks_owner on public.tasks as permissive for all to public
  using ((select public.gf_admin_can('super_admin'))
         or event_id in (select e.id from public.events e where e.producer_id = (select auth.uid())))
  with check ((select public.gf_admin_can('super_admin'))
         or event_id in (select e.id from public.events e where e.producer_id = (select auth.uid())));
drop policy if exists gf_academy_admin_write on public.academy_courses;
create policy gf_academy_admin_write on public.academy_courses as permissive for all to public
  using ((select public.gf_admin_can('super_admin'))) with check ((select public.gf_admin_can('super_admin')));

-- a regra provisória da S3 sai: o Atendimento passa a usar chat_cliente_contexto
drop policy if exists gf_producer_subscriptions_support_select on public.producer_subscriptions;

-- 2. Funções -----------------------------------------------------------------------------------------------------------
create or replace function public.admin_activity_stats(desde timestamp with time zone)
 returns table(sessoes bigint, visualizacoes bigint, logins bigint, contas_ativas bigint)
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
begin
  -- Decisão 163: a permissão da tela (Analytics), não "qualquer admin"
  if not public.gf_admin_can('view_analytics') then
    raise exception 'acesso negado: precisa da permissão view_analytics' using errcode = '42501';
  end if;
  return query
    select count(distinct a.session_id),
           count(*) filter (where a.event_type = 'page_view'),
           count(*) filter (where a.event_type = 'login'),
           count(distinct a.user_id)
    from public.user_activities a
    where a.created_at >= desde;
end;
$function$;

create or replace function public.gf_protect_event_cancel()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  -- Decisão 163: quem mexe em evento alheio com ingresso vendido é quem tem manage_events (era qualquer admin)
  if not ((current_setting('role', true) in ('anon', 'authenticated')
           or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
          and not public.gf_admin_can('manage_events')) then
    return new;
  end if;
  -- vendido: mesmo critério da trava de data e local da F0a (inclui 'transferred')
  if not exists (select 1 from public.tickets t
                 where t.event_id = old.id and coalesce(t.status, 'active') not in ('cancelled', 'refunded')) then
    return new;
  end if;
  if old.status = 'cancelled' then
    raise exception 'Evento cancelado com ingressos vendidos só é reaberto pelo suporte da Evokaa.'
      using errcode = 'EV003';
  end if;
  if new.status = 'cancelled' then
    raise exception 'Este evento tem ingressos vendidos. Para cancelar, fale com o suporte da Evokaa.'
      using errcode = 'EV001';
  end if;
  -- maior data conhecida da linha antiga (DECISÕES 7)
  if (new.status = 'draft' and old.status = 'published')
     or (new.status = 'ended'
         and greatest(old.end_date, old.start_date,
                      (old.date + coalesce(old.time, time '23:59:59')) at time zone 'America/Sao_Paulo') > now()) then
    raise exception 'Este evento tem ingressos vendidos e não pode sair do ar. Fale com o suporte da Evokaa.'
      using errcode = 'EV002';
  end if;
  return new;
end;
$function$;

-- 3. RPC do painel do cliente em Atendimento --------------------------------------------------------------------------
create or replace function public.chat_cliente_contexto(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.gf_admin_can('manage_support') then
    raise exception 'acesso negado: precisa da permissão manage_support' using errcode = '42501';
  end if;
  if p_user is null or not exists (select 1 from public.conversations c where c.user_id = p_user) then
    raise exception 'este cliente não tem conversa' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'papel', (select pr.role from public.profiles pr where pr.id = p_user),
    'plano', (select jsonb_build_object('plan', s.plan, 'is_active', s.is_active, 'expires_at', s.expires_at)
              from public.producer_subscriptions s where s.producer_id = p_user limit 1),
    'ingressos', coalesce((select jsonb_agg(x.j order by x.created_at desc) from (
        select t.created_at, jsonb_build_object('id', t.id, 'status', t.status, 'created_at', t.created_at,
          'ticket_types', jsonb_build_object('name', tt.name, 'events', jsonb_build_object('title', e.title))) as j
        from public.tickets t
        left join public.ticket_types tt on tt.id = t.ticket_type_id
        left join public.events e on e.id = tt.event_id
        where t.user_id = p_user order by t.created_at desc limit 5) x), '[]'::jsonb),
    'pedidos', coalesce((select jsonb_agg(x.j order by x.created_at desc) from (
        select o.created_at, jsonb_build_object('id', o.id, 'total', o.total, 'status', o.status,
          'created_at', o.created_at, 'events', jsonb_build_object('title', e.title)) as j
        from public.orders o
        left join public.events e on e.id = o.event_id
        where o.user_id = p_user order by o.created_at desc limit 5) x), '[]'::jsonb));
end;
$$;
revoke execute on function public.chat_cliente_contexto(uuid) from public, anon;
grant execute on function public.chat_cliente_contexto(uuid) to authenticated, service_role;
revoke execute on function public.admin_activity_stats(timestamptz) from public, anon;
grant execute on function public.admin_activity_stats(timestamptz) to authenticated, service_role;

-- 4. Conferência (aborta e desfaz tudo se algo estiver fora do esperado) ---------------------------------------------
do $$
declare
  t text;
  n int;
begin
  foreach t in array array['academy_courses', 'check_ins', 'contact_messages', 'customers', 'event_banners',
      'event_budget_boxes', 'event_photos', 'event_surveys', 'event_timeline_items', 'event_zones', 'evento_aceites',
      'evento_privado', 'events', 'feedback', 'piggy_transactions', 'profiles', 'tasks', 'ticket_types', 'tickets',
      'user_activities'] loop
    select count(*) into n from pg_policies
      where schemaname = 'public' and tablename = t and permissive = 'PERMISSIVE'
        and (coalesce(qual, '') || coalesce(with_check, '')) like '%gf_is_admin%';
    if n > 0 then raise exception 'public.% ainda tem % regra(s) com gf_is_admin', t, n; end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t
        and policyname = 'gf_mfa_aal2' and permissive = 'RESTRICTIVE') then
      raise exception 'gf_mfa_aal2 sumiu de public.%', t;
    end if;
  end loop;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contact_messages'
      and policyname = 'gf_contact_admin_read')
     or (select count(*) from pg_policies where schemaname = 'public' and tablename = 'contact_messages'
         and permissive = 'PERMISSIVE' and (coalesce(qual, '') like '%manage_feedback%')) <> 1 then
    raise exception 'contact_messages: deve ficar uma só regra de admin (manage_feedback)';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producer_subscriptions'
      and policyname = 'gf_producer_subscriptions_support_select') then
    raise exception 'gf_producer_subscriptions_support_select ainda existe';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'event_budget_boxes'
      and policyname = 'Produtor gerencia budget boxes') then
    raise exception 'event_budget_boxes: a regra do produtor sumiu';
  end if;
  if not (select prosecdef and provolatile = 's' and proconfig @> array['search_path=""']
          from pg_proc where oid = 'public.admin_activity_stats(timestamptz)'::regprocedure)
     or position('view_analytics' in (select prosrc from pg_proc where oid = 'public.admin_activity_stats(timestamptz)'::regprocedure)) = 0 then
    raise exception 'admin_activity_stats fora do esperado';
  end if;
  if position('manage_events' in (select prosrc from pg_proc where oid = 'public.gf_protect_event_cancel()'::regprocedure)) = 0
     or position('gf_is_admin' in (select prosrc from pg_proc where oid = 'public.gf_protect_event_cancel()'::regprocedure)) > 0 then
    raise exception 'gf_protect_event_cancel fora do esperado';
  end if;
  if not (select prosecdef and proconfig @> array['search_path=""'] from pg_proc
          where oid = 'public.chat_cliente_contexto(uuid)'::regprocedure) then
    raise exception 'chat_cliente_contexto sem SECURITY DEFINER ou search_path';
  end if;
  if has_function_privilege('anon', 'public.chat_cliente_contexto(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.chat_cliente_contexto(uuid)', 'execute')
     or has_function_privilege('anon', 'public.admin_activity_stats(timestamptz)', 'execute') then
    raise exception 'chat_cliente_contexto/admin_activity_stats: anon executa ou authenticated não executa';
  end if;
end $$;

commit;

-- Conferência (só leitura). Esperado: nenhuma regra PERMISSIVE dessas tabelas citando gf_is_admin.
select tablename::text as tabela, policyname::text as nome, cmd::text as comando, coalesce(qual, with_check) as regra
from pg_policies
where schemaname = 'public' and permissive = 'PERMISSIVE'
  and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'gf_admin_can|gf_is_admin'
  and tablename in ('academy_courses', 'check_ins', 'contact_messages', 'customers', 'event_banners',
      'event_budget_boxes', 'event_photos', 'event_surveys', 'event_timeline_items', 'event_zones', 'evento_aceites',
      'evento_privado', 'events', 'feedback', 'piggy_transactions', 'profiles', 'tasks', 'ticket_types', 'tickets',
      'user_activities')
order by 1, 2;

-- =============================================================================
-- ENSAIO COM ROLLBACK: trocar o "commit;" do fim do bloco de conferência por "rollback;" e rodar tudo. Comportamento
-- por papel: supabase/tests/admin_s4_permissao_dados.test.sql, em banco descartável.
--
-- Desfazer (volta ao estado de produção de 04/10/2026; as regras e funções abaixo são as lidas na época. A regra
-- gf_producer_subscriptions_support_select NÃO volta: era da S3 e este arquivo a removeu):
-- begin;
-- drop policy if exists gf_profiles_select_own_or_admin on public.profiles;
-- create policy gf_profiles_select_own_or_admin on public.profiles for select to authenticated
--   using (id = (select auth.uid()) or (select public.gf_is_admin()));
-- drop policy if exists gf_events_admin_select on public.events;
-- create policy gf_events_admin_select on public.events for select to authenticated using ((select public.gf_is_admin()));
-- drop policy if exists gf_ticket_types_admin_select on public.ticket_types;
-- create policy gf_ticket_types_admin_select on public.ticket_types for select to authenticated using ((select public.gf_is_admin()));
-- drop policy if exists gf_tickets_admin_select on public.tickets;
-- create policy gf_tickets_admin_select on public.tickets for select to authenticated using ((select public.gf_is_admin()));
-- drop policy if exists gf_check_ins_admin_select on public.check_ins;
-- create policy gf_check_ins_admin_select on public.check_ins for select to authenticated using ((select public.gf_is_admin()));
-- drop policy if exists user_activities_select_admin on public.user_activities;
-- create policy user_activities_select_admin on public.user_activities for select to authenticated using (public.gf_is_admin());
-- drop policy if exists gf_feedback_admin_select on public.feedback;
-- create policy gf_feedback_admin_select on public.feedback for select to authenticated using ((select public.gf_is_admin()));
-- drop policy if exists gf_feedback_admin_update on public.feedback;
-- create policy gf_feedback_admin_update on public.feedback for update to authenticated
--   using ((select public.gf_is_admin())) with check ((select public.gf_is_admin()));
-- drop policy if exists gf_feedback_admin_delete on public.feedback;
-- create policy gf_feedback_admin_delete on public.feedback for delete to authenticated using ((select public.gf_is_admin()));
-- drop policy if exists gf_contact_messages_admin_all on public.contact_messages;
-- create policy gf_contact_messages_admin_all on public.contact_messages for all to authenticated
--   using ((select public.gf_is_admin())) with check ((select public.gf_is_admin()));
-- create policy gf_contact_admin_read on public.contact_messages for select to authenticated using (public.gf_is_admin());
-- drop policy if exists evento_aceites_select on public.evento_aceites;
-- create policy evento_aceites_select on public.evento_aceites for select to authenticated
--   using (producer_id = (select auth.uid()) or (select public.gf_is_admin()));
-- drop policy if exists evento_privado_select on public.evento_privado;
-- create policy evento_privado_select on public.evento_privado for select to authenticated
--   using (exists (select 1 from public.events e where e.id = evento_privado.event_id and e.producer_id = (select auth.uid()))
--     or (select public.gf_is_admin())
--     or exists (select 1 from public.tickets t where t.event_id = evento_privado.event_id
--                and t.user_id = (select auth.uid()) and t.status = any (array['active', 'used'])));
-- drop policy if exists gf_customers_owner on public.customers;
-- create policy gf_customers_owner on public.customers for all to public
--   using (public.gf_is_admin() or event_id in (select id from public.events where producer_id = auth.uid()))
--   with check (public.gf_is_admin() or event_id in (select id from public.events where producer_id = auth.uid()));
-- drop policy if exists gf_event_banners_all on public.event_banners;
-- create policy gf_event_banners_all on public.event_banners for all to public
--   using (producer_id = auth.uid() or public.gf_is_admin()) with check (producer_id = auth.uid() or public.gf_is_admin());
-- drop policy if exists gf_budget_boxes_all on public.event_budget_boxes;
-- create policy gf_budget_boxes_all on public.event_budget_boxes for all to authenticated
--   using ((select public.gf_is_admin())) with check ((select public.gf_is_admin()));
-- drop policy if exists gf_event_photos_all on public.event_photos;
-- create policy gf_event_photos_all on public.event_photos for all to public
--   using (producer_id = auth.uid() or public.gf_is_admin()) with check (producer_id = auth.uid() or public.gf_is_admin());
-- drop policy if exists gf_event_surveys_owner on public.event_surveys;
-- create policy gf_event_surveys_owner on public.event_surveys for all to public
--   using (public.gf_is_admin() or event_id in (select id from public.events where producer_id = auth.uid()))
--   with check (public.gf_is_admin() or event_id in (select id from public.events where producer_id = auth.uid()));
-- drop policy if exists gf_event_timeline_all on public.event_timeline_items;
-- create policy gf_event_timeline_all on public.event_timeline_items for all to public
--   using (producer_id = auth.uid() or public.gf_is_admin()) with check (producer_id = auth.uid() or public.gf_is_admin());
-- drop policy if exists gf_event_zones_owner on public.event_zones;
-- create policy gf_event_zones_owner on public.event_zones for all to public
--   using (public.gf_is_admin() or event_id in (select id from public.events where producer_id = auth.uid()))
--   with check (public.gf_is_admin() or event_id in (select id from public.events where producer_id = auth.uid()));
-- drop policy if exists gf_piggy_tx_owner on public.piggy_transactions;
-- create policy gf_piggy_tx_owner on public.piggy_transactions for all to public
--   using (public.gf_is_admin() or box_id in (select id from public.event_budget_boxes where producer_id = auth.uid()))
--   with check (public.gf_is_admin() or box_id in (select id from public.event_budget_boxes where producer_id = auth.uid()));
-- drop policy if exists gf_tasks_owner on public.tasks;
-- create policy gf_tasks_owner on public.tasks for all to public
--   using ((select public.gf_is_admin()) or event_id in (select id from public.events where producer_id = (select auth.uid())))
--   with check ((select public.gf_is_admin()) or event_id in (select id from public.events where producer_id = (select auth.uid())));
-- drop policy if exists gf_academy_admin_write on public.academy_courses;
-- create policy gf_academy_admin_write on public.academy_courses for all to public
--   using (public.gf_is_admin()) with check (public.gf_is_admin());
-- create or replace function public.admin_activity_stats(desde timestamp with time zone)
--  returns table(sessoes bigint, visualizacoes bigint, logins bigint, contas_ativas bigint)
--  language plpgsql security definer set search_path to ''
-- as $f$
-- begin
--   if not public.gf_is_admin() then
--     raise exception 'acesso negado: só administradores' using errcode = '42501';
--   end if;
--   return query
--     select count(distinct a.session_id),
--            count(*) filter (where a.event_type = 'page_view'),
--            count(*) filter (where a.event_type = 'login'),
--            count(distinct a.user_id)
--     from public.user_activities a
--     where a.created_at >= desde;
-- end;
-- $f$;
-- create or replace function public.gf_protect_event_cancel()
--  returns trigger language plpgsql security definer set search_path to ''
-- as $f$
-- begin
--   if not ((current_setting('role', true) in ('anon', 'authenticated')
--            or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
--           and not public.gf_is_admin()) then
--     return new;
--   end if;
--   -- vendido: mesmo critério da trava de data e local da F0a (inclui 'transferred')
--   if not exists (select 1 from public.tickets t
--                  where t.event_id = old.id and coalesce(t.status, 'active') not in ('cancelled', 'refunded')) then
--     return new;
--   end if;
--   if old.status = 'cancelled' then
--     raise exception 'Evento cancelado com ingressos vendidos só é reaberto pelo suporte da Evokaa.'
--       using errcode = 'EV003';
--   end if;
--   if new.status = 'cancelled' then
--     raise exception 'Este evento tem ingressos vendidos. Para cancelar, fale com o suporte da Evokaa.'
--       using errcode = 'EV001';
--   end if;
--   -- maior data conhecida da linha antiga (DECISÕES 7)
--   if (new.status = 'draft' and old.status = 'published')
--      or (new.status = 'ended'
--          and greatest(old.end_date, old.start_date,
--                       (old.date + coalesce(old.time, time '23:59:59')) at time zone 'America/Sao_Paulo') > now()) then
--     raise exception 'Este evento tem ingressos vendidos e não pode sair do ar. Fale com o suporte da Evokaa.'
--       using errcode = 'EV002';
--   end if;
--   return new;
-- end;
-- $f$;
-- drop function if exists public.chat_cliente_contexto(uuid);
-- commit;
-- =============================================================================
