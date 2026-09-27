-- =============================================================================
-- Endurecimento de segurança — 2026-09-27
-- APLICADO MANUALMENTE em produção (projeto rwaezeqyuhxrssntcxdv) via Supabase MCP.
--
-- NÃO mover para supabase/migrations/: o histórico de migrations do banco está vazio e a
-- integração Supabase↔GitHub (branch "main", status MIGRATIONS_FAILED) pode tentar rodar
-- TODAS as migrations em produção num merge. A primeira, 00000000000000_init_schema.sql,
-- começa com DROP TABLE ... CASCADE em 33 tabelas.
--
-- Origem: auditoria do PR #3 + Security Advisor do Supabase (confirmado no banco).
--   1. Qualquer usuário podia virar admin: profiles.role editável pelo próprio usuário e
--      o cadastro copiava o role do formulário. gf_is_admin() confia em profiles.role.
--   2. profiles legível por anônimos (e-mail, telefone, CPF, nascimento).
--   3. producer_profiles legível por anônimos (conta bancária, PIX, CNPJ, api_key);
--      comissão e selo "verificado" editáveis pelo próprio produtor.
--   4. Perfis de matchmaking legíveis por qualquer usuário logado.
--   5. View collective_table_summary ignorava o RLS; event_summary exposta na API.
--   6. Antecipações editáveis pelo produtor (inclusive status); pesquisas e sessões de
--      suporte forjáveis.
-- Idempotente. Não altera dados.
-- =============================================================================

-- 1) gf_is_admin: SECURITY DEFINER com search_path fixo.
--    Lê profiles sem passar pelo RLS de profiles; senão a policy de leitura de profiles
--    (que usa esta função) entraria em recursão.
create or replace function public.gf_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;
grant execute on function public.gf_is_admin() to anon, authenticated;

-- 2) profiles: só admin (ou banco/servidor) muda role, admin_permissions, is_verified e
--    stripe_customer_id. SECURITY INVOKER de propósito. O teste pelo papel do JWT cobre
--    também chamadas feitas de dentro de funções SECURITY DEFINER.
create or replace function public.gf_protect_profile_privileges()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role
      or new.admin_permissions is distinct from old.admin_permissions
      or new.is_verified is distinct from old.is_verified
      or new.stripe_customer_id is distinct from old.stripe_customer_id)
     and (current_user in ('anon', 'authenticated')
          or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
     and not public.gf_is_admin() then
    raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists gf_protect_profile_privileges on public.profiles;
create trigger gf_protect_profile_privileges
  before update on public.profiles
  for each row execute function public.gf_protect_profile_privileges();

-- 3) Cadastro: o papel vindo do formulário só pode ser 'user' ou 'producer'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    case when new.raw_user_meta_data->>'role' = 'producer' then 'producer' else 'user' end
  );
  return new;
end;
$$;

-- 4) profiles: fim da leitura pública. Cada usuário lê o próprio perfil; admin lê todos.
drop policy if exists "Leitura pública de perfis" on public.profiles;
drop policy if exists "Perfis publicos" on public.profiles;
drop policy if exists gf_profiles_select_own_or_admin on public.profiles;
create policy gf_profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.gf_is_admin()));
drop policy if exists gf_profiles_admin_update on public.profiles;
create policy gf_profiles_admin_update on public.profiles
  for update to authenticated
  using ((select public.gf_is_admin()))
  with check ((select public.gf_is_admin()));

-- 5) producer_profiles: sem leitura pública (dados bancários, PIX, CNPJ, api_key).
--    O produtor segue lendo/editando o próprio registro ("Produtores gerenciam próprio perfil");
--    comissão e selo "verificado" só o admin altera (10.00 = default da coluna).
create or replace function public.gf_protect_producer_profile_privileges()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (current_user in ('anon', 'authenticated')
      or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
     and not public.gf_is_admin() then
    if tg_op = 'INSERT' then
      if new.is_verified or new.commission_rate is distinct from 10.00 then
        raise exception 'Campo protegido não permitido' using errcode = '42501';
      end if;
    elsif new.is_verified is distinct from old.is_verified
       or new.commission_rate is distinct from old.commission_rate then
      raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists gf_protect_producer_profile_privileges on public.producer_profiles;
create trigger gf_protect_producer_profile_privileges
  before insert or update on public.producer_profiles
  for each row execute function public.gf_protect_producer_profile_privileges();
drop policy if exists "Leitura pública de perfis de produtor" on public.producer_profiles;
drop policy if exists gf_producer_profiles_select_own_or_admin on public.producer_profiles;
create policy gf_producer_profiles_select_own_or_admin on public.producer_profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.gf_is_admin()));
drop policy if exists gf_producer_profiles_admin_update on public.producer_profiles;
create policy gf_producer_profiles_admin_update on public.producer_profiles
  for update to authenticated
  using ((select public.gf_is_admin()))
  with check ((select public.gf_is_admin()));

-- 6) Perfis de matchmaking: remove a leitura por qualquer usuário logado.
drop policy if exists gf_profiles_ext_read on public.user_profiles_ext;

-- 7) View de mesas passa a respeitar o RLS de quem consulta; sem acesso anônimo.
alter view public.collective_table_summary set (security_invoker = true);
revoke select on public.collective_table_summary from anon;

-- 8) Resumo de receita por produtor fora da API pública (não é usado pelo front).
revoke select on public.event_summary from anon, authenticated;

-- 9) Antecipações: o produtor cria pedido 'requested' de evento próprio e lê os seus;
--    só admin altera ou apaga. Valores ainda vêm do cliente: conferir antes de pagar.
drop policy if exists "Produtor gerencia advances" on public.revenue_advances;
drop policy if exists gf_revenue_advances_all on public.revenue_advances;
drop policy if exists gf_revenue_advances_select on public.revenue_advances;
drop policy if exists gf_revenue_advances_insert on public.revenue_advances;
drop policy if exists gf_revenue_advances_admin_update on public.revenue_advances;
drop policy if exists gf_revenue_advances_admin_delete on public.revenue_advances;
create policy gf_revenue_advances_select on public.revenue_advances
  for select to authenticated
  using (producer_id = (select auth.uid()) or (select public.gf_is_admin()));
create policy gf_revenue_advances_insert on public.revenue_advances
  for insert to authenticated
  with check (
    producer_id = (select auth.uid())
    and status = 'requested'
    and transferred_at is null
    and event_id in (select id from public.events where producer_id = (select auth.uid()))
  );
create policy gf_revenue_advances_admin_update on public.revenue_advances
  for update to authenticated
  using ((select public.gf_is_admin()))
  with check ((select public.gf_is_admin()));
create policy gf_revenue_advances_admin_delete on public.revenue_advances
  for delete to authenticated
  using ((select public.gf_is_admin()));

-- 10) Pesquisa pós-evento: só quem tem ingresso do evento responde.
drop policy if exists gf_event_surveys_insert on public.event_surveys;
create policy gf_event_surveys_insert on public.event_surveys
  for insert to authenticated
  with check (
    exists (
      select 1 from public.tickets t
      where t.event_id = event_surveys.event_id and t.user_id = (select auth.uid())
    )
  );

-- 11) Tarefas: o responsável só visualiza; quem gerencia é o produtor do evento (ou admin).
drop policy if exists gf_tasks_owner on public.tasks;
drop policy if exists gf_tasks_assignee_read on public.tasks;
create policy gf_tasks_owner on public.tasks
  for all
  using ((select public.gf_is_admin())
         or event_id in (select id from public.events where producer_id = (select auth.uid())))
  with check ((select public.gf_is_admin())
         or event_id in (select id from public.events where producer_id = (select auth.uid())));
create policy gf_tasks_assignee_read on public.tasks
  for select
  using (assignee_id = (select auth.uid()));

-- 12) Suporte: o insert aberto permitia criar sessão em nome de outro usuário.
--     gf_support_sessions_owner já exige user_id = auth.uid() (ou admin).
drop policy if exists gf_support_sessions_insert on public.support_sessions;
