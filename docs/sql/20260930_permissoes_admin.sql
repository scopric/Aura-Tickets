-- Só o super_admin mexe em papel de admin e em permissões (auditoria do #72, 30/09/2026).
-- Antes: o banco só conferia "é admin". Qualquer admin se dava super_admin, rebaixava outro admin,
-- transformava qualquer conta em admin pela tela Usuários e alterava qualquer evento.
-- Decisão do Ricardo (30/09/2026): só o super_admin promove, rebaixa e altera permissões.
-- Aplicar DEPOIS de docs/sql/20260930_2fa_no_banco.sql (gf_admin_can já exige o código do 2FA).
-- Idempotente. Rodar de novo depois de reaplicar 20260927_security_hardening.sql (recria o gatilho).
begin;

-- 1. Gatilho de profiles. gf_admin_can('super_admin') = é admin com super_admin e passou pelo 2FA.
create or replace function public.gf_protect_profile_privileges()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  -- Nunca sobrar zero super_admin (vale para todos, inclusive a chave de serviço do delete-account)
  if old.role = 'admin' and 'super_admin' = any(coalesce(old.admin_permissions, '{}'))
     and not (new.role = 'admin' and 'super_admin' = any(coalesce(new.admin_permissions, '{}')))
     and not exists (select 1 from public.profiles p
                     where p.id <> old.id and p.role = 'admin' and 'super_admin' = any(p.admin_permissions)) then
    raise exception 'A plataforma precisa de pelo menos um super_admin' using errcode = '42501';
  end if;

  -- Daqui para baixo, só chamadas de usuário; chave de serviço e postgres seguem livres
  if not (current_user in ('anon', 'authenticated')
          or coalesce(auth.jwt() ->> 'role', '') in ('anon', 'authenticated')) then
    return new;
  end if;

  if new.admin_permissions is distinct from old.admin_permissions
     or (new.role is distinct from old.role and 'admin' in (new.role, old.role)) then
    if not public.gf_admin_can('super_admin') then
      raise exception 'Só o super_admin altera papel de admin e permissões' using errcode = '42501';
    end if;
    if new.id = (select auth.uid()) then
      raise exception 'Ninguém altera o próprio papel nem as próprias permissões' using errcode = '42501';
    end if;
  elsif new.role is distinct from old.role then
    -- participante, cliente, produtor e editor: quem gerencia usuários
    if not public.gf_admin_can('manage_users') then
      raise exception 'Alteração de papel exige a permissão manage_users' using errcode = '42501';
    end if;
  end if;

  if (new.is_verified is distinct from old.is_verified
      or new.stripe_customer_id is distinct from old.stripe_customer_id)
     and not public.gf_is_admin() then
    raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 2. Admin só edita o perfil dos outros com manage_users (super_admin incluído); o próprio perfil
--    segue pela regra "Usuários modificam próprio perfil".
drop policy if exists gf_profiles_admin_update on public.profiles;
create policy gf_profiles_admin_update on public.profiles for update to authenticated
  using ((select public.gf_admin_can('manage_users')))
  with check ((select public.gf_admin_can('manage_users')));

-- 3. Eventos: qualquer admin lê (Dashboard, Newsletter, Usuários, Financeiro); escrever exige manage_events.
drop policy if exists "Admins gerenciam todos os eventos" on public.events;
drop policy if exists gf_events_admin_select on public.events;
drop policy if exists gf_events_admin_write on public.events;
create policy gf_events_admin_select on public.events for select to authenticated
  using ((select public.gf_is_admin()));
create policy gf_events_admin_write on public.events for all to authenticated
  using ((select public.gf_admin_can('manage_events')))
  with check ((select public.gf_admin_can('manage_events')));

-- 4. Conferência obrigatória: se algo faltar, nada deste arquivo é gravado.
do $$
begin
  if position('gf_admin_can(''super_admin'')' in pg_get_functiondef('public.gf_protect_profile_privileges'::regproc)) = 0 then
    raise exception 'gatilho de profiles sem a regra do super_admin';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'events'
             and policyname = 'Admins gerenciam todos os eventos') then
    raise exception 'regra antiga de eventos ainda existe';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
                 and policyname = 'gf_profiles_admin_update' and qual like '%manage_users%') then
    raise exception 'regra de update de profiles sem manage_users';
  end if;
  if not exists (select 1 from public.profiles where role = 'admin' and 'super_admin' = any(admin_permissions)) then
    raise exception 'nenhum super_admin na plataforma';
  end if;
end;
$$;

commit;

-- Desfazer: reaplicar a versão do gatilho de docs/sql/20260927_security_hardening.sql e recriar
-- "Admins gerenciam todos os eventos" (ALL, using exists(profile admin)) e gf_profiles_admin_update
-- com gf_is_admin().
