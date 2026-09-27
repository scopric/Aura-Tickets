-- =============================================================================
-- Regras de acesso para o painel de administração (alpha) — fase A3 do plano do Admin
-- Aplicar à mão no SQL Editor do Supabase (Decisão 16). NÃO vai para supabase/migrations (Decisão 02).
-- Pré-requisito: PR A2a no ar (tira a chave de CEP de platform_settings.general; sem isso a regra 1
-- exporia a chave a qualquer visitante).
-- Padrão: quem é admin = public.gf_is_admin() (SECURITY DEFINER, criada em 20260927_security_hardening.sql),
-- sempre dentro de (select ...) para ser avaliada uma vez por consulta.
-- Idempotente: pode rodar de novo.
-- =============================================================================
begin;

-- 0. Trava do pré-requisito: se a linha 'general' ainda guardar chave de CEP (código anterior ao PR A2a),
--    o script para aqui em vez de expor a chave a visitantes.
do $$
begin
  if exists (
    select 1 from public.platform_settings
    where key = 'general' and coalesce(value->>'cepApiKey', '') <> ''
  ) then
    raise exception 'platform_settings.general ainda contém cepApiKey: publique o PR A2a e salve as Configurações antes de rodar este script';
  end if;
end $$;

-- 1. platform_settings: leitura pública só das chaves sem segredo (o checkout lê a moeda sem login);
--    admin lê e grava tudo. NÃO usar as regras da migration 05 (abriam leitura total com USING (true)).
drop policy if exists "Settings readable by all" on public.platform_settings;
drop policy if exists "Admins can manage settings" on public.platform_settings;
drop policy if exists gf_platform_settings_public_read on public.platform_settings;
drop policy if exists gf_platform_settings_admin_all on public.platform_settings;
create policy gf_platform_settings_public_read on public.platform_settings
  for select to anon, authenticated
  using (key in ('general', 'fees'));
create policy gf_platform_settings_admin_all on public.platform_settings
  for all to authenticated
  using ((select public.gf_is_admin()))
  with check ((select public.gf_is_admin()));

-- 2. Leitura de admin nas tabelas do painel (só SELECT; ninguém mais ganha nada)
do $$
declare t text;
begin
  foreach t in array array['orders','order_items','tickets','transactions','withdrawals','check_ins'] loop
    execute format('drop policy if exists gf_%s_admin_select on public.%I', t, t);
    execute format('create policy gf_%s_admin_select on public.%I for select to authenticated using ((select public.gf_is_admin()))', t, t);
  end loop;
end $$;

-- 2b. Saques: admin altera o status (valores do CHECK: pending, processing, completed, failed)
drop policy if exists gf_withdrawals_admin_update on public.withdrawals;
create policy gf_withdrawals_admin_update on public.withdrawals
  for update to authenticated
  using ((select public.gf_is_admin()))
  with check ((select public.gf_is_admin()));

-- 2c. Planos: admin gerencia; o produtor lê só o próprio (useFeatures lê o plano do usuário logado)
drop policy if exists gf_producer_subscriptions_admin_all on public.producer_subscriptions;
drop policy if exists gf_producer_subscriptions_owner_select on public.producer_subscriptions;
create policy gf_producer_subscriptions_admin_all on public.producer_subscriptions
  for all to authenticated
  using ((select public.gf_is_admin()))
  with check ((select public.gf_is_admin()));
create policy gf_producer_subscriptions_owner_select on public.producer_subscriptions
  for select to authenticated
  using (producer_id = (select auth.uid()));
create index if not exists producer_subscriptions_producer_id_idx on public.producer_subscriptions (producer_id);

-- 2d. Cadastro de produtor: admin pode criar a linha que falta (8 dos 9 produtores não têm)
drop policy if exists gf_producer_profiles_admin_insert on public.producer_profiles;
create policy gf_producer_profiles_admin_insert on public.producer_profiles
  for insert to authenticated
  with check ((select public.gf_is_admin()));

-- 3. feedback: colunas de tratamento (Decisão 31), envio pelo botão flutuante e gestão pelo admin
alter table public.feedback add column if not exists status text not null default 'novo';
alter table public.feedback drop constraint if exists feedback_status_check;
alter table public.feedback add constraint feedback_status_check check (status in ('novo','lido','respondido','resolvido'));
alter table public.feedback add column if not exists admin_notes text;
drop policy if exists gf_feedback_insert on public.feedback;
drop policy if exists gf_feedback_admin_select on public.feedback;
drop policy if exists gf_feedback_admin_update on public.feedback;
drop policy if exists gf_feedback_admin_delete on public.feedback;
-- visitante e usuário podem enviar; limites para reduzir abuso (o botão do site não exige login)
create policy gf_feedback_insert on public.feedback
  for insert to anon, authenticated
  with check (
    length(coalesce(message, '')) between 1 and 2000
    and (rating is null or rating between 1 and 5)
    and status = 'novo' and admin_notes is null   -- ninguém envia feedback já "resolvido"
  );
create policy gf_feedback_admin_select on public.feedback for select to authenticated using ((select public.gf_is_admin()));
create policy gf_feedback_admin_update on public.feedback for update to authenticated using ((select public.gf_is_admin())) with check ((select public.gf_is_admin()));
create policy gf_feedback_admin_delete on public.feedback for delete to authenticated using ((select public.gf_is_admin()));
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

-- 4. Números do Analytics: sessões distintas exigem count(distinct), que o PostgREST não faz.
--    Função só para admin; erro explícito para quem não é.
create or replace function public.admin_activity_stats(desde timestamptz)
returns table (sessoes bigint, visualizacoes bigint, logins bigint, contas_ativas bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.gf_is_admin() then
    raise exception 'acesso negado: só administradores' using errcode = '42501';
  end if;
  return query
    select count(distinct a.session_id),
           count(*) filter (where a.event_type = 'page_view'),
           count(*) filter (where a.event_type = 'login'),
           count(distinct a.user_id)
    from public.user_activities a
    where a.created_at >= desde;
end;
$$;
revoke execute on function public.admin_activity_stats(timestamptz) from public, anon;
grant execute on function public.admin_activity_stats(timestamptz) to authenticated;

commit;

-- 5. Índice da tabela de rastreio FORA da transação e sem bloquear gravações (create index concurrently
--    não roda dentro de begin/commit). Rodar como comando separado, depois do commit acima:
create index concurrently if not exists user_activities_created_at_idx on public.user_activities (created_at);

-- =============================================================================
-- CONFERÊNCIA (só leitura) — rodar depois:
-- select tablename, policyname, cmd, roles::text from pg_policies
--  where tablename in ('platform_settings','orders','order_items','tickets','transactions','withdrawals',
--                      'check_ins','producer_subscriptions','producer_profiles','feedback')
--  order by 1, 3;
-- set role anon; select count(*) from public.orders; reset role;              -- deve dar 0
-- set role anon; select key from public.platform_settings; reset role;        -- só general/fees
-- select column_name from information_schema.columns where table_name='feedback' and column_name in ('status','admin_notes');
-- Depois: Security Advisor no painel do Supabase.
-- =============================================================================
