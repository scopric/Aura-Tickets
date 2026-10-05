-- =============================================================================
-- S4b, PARTE A (funções) do plano sparkling-gliding-harp (admin, Decisão 163 itens 3 e 11): PROFILES MÍNIMO. 05/10/2026.
-- Esta parte é INOFENSIVA com o front atual: só cria as RPCs e troca uma linha do gatilho; NÃO revoga nada. Com o SELECT da
-- tabela inteira ainda no lugar, o front do main segue igual (select * da própria linha continua funcionando).
-- A parte B (20261018b_admin_s4b_colunas.sql) é a que corta as colunas.
--   RPCs (SECURITY DEFINER, search_path '', execute só authenticated; anon e PUBLIC sem execute):
--      meu_perfil()           linha de auth.uid() sem cpf e stripe_customer_id (jsonb); nula se não houver linha. Replica a
--                             regra RESTRICTIVE gf_mfa_aal2 da tabela: quem tem fator 2FA confirmado e token aal1 lê
--                             NADA hoje (nem o próprio perfil) e continua assim (gf_mfa_ok()).
--      admin_equipe()         manage_team: id, full_name, email, avatar_url, admin_permissions de role = 'admin'.
--      chat_atendentes()      manage_support: id, full_name, email dos admins com super_admin ou manage_support.
--      admin_usuarios_lista() manage_users: o que Users.tsx lia (id, email, full_name, PHONE, role, created_at, avatar_url,
--                             producer_subscriptions, user_custom_features), jsonb. DECISÃO DO RICARDO (Decisão 163 item 11):
--                             o telefone continua na lista de Usuários, só para quem tem manage_users (ou super_admin).
--      Sem a permissão: 42501 (acesso negado), nunca lista vazia.
--   Gatilho gf_protect_profile_privileges (SECURITY INVOKER, tem de continuar assim: decide por current_user): lia
--   admin_permissions de OUTRO perfil na trava "nunca zero super_admin"; com a coluna retida (parte B), um super_admin que
--   rebaixa outro levaria 42501 (reproduzido no banco local). Só essa consulta vira gf_ha_outro_super_admin(uuid)
--   (SECURITY DEFINER, só de dentro de gatilho); a definição viva é lida, trocada por texto e regravada; se o trecho
--   esperado não estiver lá, aborta. O resto do gatilho fica como está.
--
-- ORDEM DE PUBLICAÇÃO (obrigatória, 3 passos): (1) ESTE arquivo no SQL Editor; (2) mesclar o PR do front
-- (fix/admin-s4b-perfil-minimo) e ESPERAR a Vercel publicar o main; (3) só então 20261018b_admin_s4b_colunas.sql.
-- Front antes da parte A: meu_perfil() dá 404, o authStore monta o usuário provisório 'user' (admin perde os menus,
-- produtor perde a área). Parte B antes do front: select * em profiles dá 42501 e as telas quebram.
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17). Uma transação só:
-- se a conferência do fim falhar, nada é gravado. Idempotente. lock_timeout de 5s. NÃO mover para supabase/migrations/.
-- Teste: supabase/tests/admin_s4b_profiles_colunas.test.sql (pgTAP; supõe A e B aplicadas; banco local descartável).
--
-- Funções que o bloco 0 confere (md5 de produção em 04/10/2026; a S4b não as recria, só depende delas):
--   select 'gf_admin_can' f, md5(pg_get_functiondef('public.gf_admin_can(text)'::regprocedure))
--   union all select 'gf_admin_can_any', md5(pg_get_functiondef('public.gf_admin_can_any(text[])'::regprocedure));
--   gf_admin_can be37ff87aa0f00c5f35a7e489ae4c18e | gf_admin_can_any b6284b43f339ea138177b772fbd44013
-- As funções mesa_* (INVOKER) leem birth_date de dentro de funções SECURITY DEFINER (dono postgres) e authenticated não as
-- executa: não são afetadas pela parte B. Edge Functions leem profiles com a chave de serviço.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos e conferência das definições de produção ----------------------------------------------------------
do $$
declare
  funcoes jsonb := jsonb_build_object(
    'gf_admin_can(text)', 'be37ff87aa0f00c5f35a7e489ae4c18e',
    'gf_admin_can_any(text[])', 'b6284b43f339ea138177b772fbd44013');
  f text;
begin
  if to_regclass('public.profiles') is null then raise exception 'falta a tabela public.profiles'; end if;
  foreach f in array array['public.producer_subscriptions', 'public.user_custom_features'] loop
    if to_regclass(f) is null then raise exception 'falta a tabela %', f; end if;
  end loop;
  foreach f in array array['gf_admin_can(text)', 'gf_admin_can_any(text[])', 'gf_mfa_ok()'] loop
    if to_regprocedure('public.' || f) is null then
      raise exception 'falta public.%: aplique antes o 20261014_admin_s3_permissao_dinheiro.sql', f;
    end if;
  end loop;
  -- recriadas ou não, são as de produção: nada de aceitar "parecida"
  for f in select jsonb_object_keys(funcoes) loop
    if md5(pg_get_functiondef(('public.' || f)::regprocedure)) <> funcoes ->> f then
      raise exception 'public.% mudou desde 04/10 (md5 diferente da produção): refazer o bloco a partir da definição atual', f;
    end if;
  end loop;
  -- regras de profiles como a S4 deixou (20261015): leitura do dono ou de admin com permissão, atendente só lê admin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'gf_profiles_select_own_or_admin' and cmd = 'SELECT' and permissive = 'PERMISSIVE'
      and qual like '%gf_admin_can_any%' and qual like '%manage_users%' and qual like '%manage_support%') then
    raise exception 'profiles sem a regra gf_profiles_select_own_or_admin da S4: aplique antes o 20261015_admin_s4_permissao_dados.sql';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'gf_profiles_admin_update' and cmd = 'UPDATE') then
    raise exception 'profiles sem a regra gf_profiles_admin_update';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'gf_mfa_aal2' and permissive = 'RESTRICTIVE') then
    raise exception 'public.profiles sem a regra RESTRICTIVE gf_mfa_aal2';
  end if;
end $$;

-- 3a. Trava "nunca zero super_admin" do gatilho sem depender do SELECT em admin_permissions ----------------------------
create or replace function public.gf_ha_outro_super_admin(p_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- só de dentro do gatilho: chamada direta pela API viraria oráculo de "quem é o único super_admin"
  if pg_trigger_depth() = 0 then
    raise exception 'uso interno' using errcode = '42501';
  end if;
  return exists (select 1 from public.profiles p
                 where p.id <> p_id and p.role = 'admin' and 'super_admin' = any(p.admin_permissions));
end;
$$;
alter function public.gf_ha_outro_super_admin(uuid) owner to postgres;
revoke all on function public.gf_ha_outro_super_admin(uuid) from public, anon;
grant execute on function public.gf_ha_outro_super_admin(uuid) to authenticated, service_role;

do $$
declare
  def text := pg_get_functiondef('public.gf_protect_profile_privileges()'::regprocedure);
  velho constant text := E'     and not exists (select 1 from public.profiles p\n'
    || E'                     where p.id <> old.id and p.role = ''admin'' and ''super_admin'' = any(p.admin_permissions)) then';
  novo constant text := E'     and not public.gf_ha_outro_super_admin(old.id) then';
begin
  if position('gf_ha_outro_super_admin' in def) = 0 then
    if position(velho in def) = 0 then
      raise exception 'gf_protect_profile_privileges mudou: o trecho da trava de super_admin não está como esperado; refazer o bloco 3a a partir da definição atual';
    end if;
    execute replace(def, velho, novo);
  end if;
end $$;

-- 3b. RPCs ---------------------------------------------------------------------------------------------------------------
create or replace function public.meu_perfil()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(p) - array['cpf', 'stripe_customer_id']
  from public.profiles p
  where p.id = (select auth.uid())
    and public.gf_mfa_ok(); -- a mesma regra RESTRICTIVE gf_mfa_aal2 da tabela
$$;

create or replace function public.admin_equipe()
returns table (id uuid, full_name text, email text, avatar_url text, admin_permissions text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.gf_admin_can('manage_team') then
    raise exception 'acesso negado: precisa da permissão manage_team' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, p.email, p.avatar_url, p.admin_permissions
    from public.profiles p
    where p.role = 'admin'
    order by p.full_name;
end;
$$;

create or replace function public.chat_atendentes()
returns table (id uuid, full_name text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.gf_admin_can('manage_support') then
    raise exception 'acesso negado: precisa da permissão manage_support' using errcode = '42501';
  end if;
  -- mesma regra do chat_update: admin com manage_support ou super_admin
  return query
    select p.id, p.full_name, p.email
    from public.profiles p
    where p.role = 'admin' and p.admin_permissions && array['super_admin', 'manage_support']
    order by p.full_name;
end;
$$;

create or replace function public.admin_usuarios_lista()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.gf_admin_can('manage_users') then
    raise exception 'acesso negado: precisa da permissão manage_users' using errcode = '42501';
  end if;
  -- mesma forma que o PostgREST devolvia a Users.tsx: assinatura 1:1 (objeto ou nulo) e recursos em lista
  -- ponytail: sem teto de linhas (22 perfis hoje, 05/10/2026); paginar (limit/offset na RPC e na tela) quando passar de ~1000
  return coalesce((
    select jsonb_agg(x.j order by x.created_at desc)
    from (
      select p.created_at, jsonb_build_object(
        'id', p.id, 'email', p.email, 'full_name', p.full_name, 'phone', p.phone, 'role', p.role,
        'created_at', p.created_at, 'avatar_url', p.avatar_url,
        'producer_subscriptions', (select jsonb_build_object('plan', s.plan, 'expires_at', s.expires_at, 'is_active', s.is_active)
                                   from public.producer_subscriptions s where s.producer_id = p.id limit 1),
        'user_custom_features', coalesce((select jsonb_agg(jsonb_build_object('feature_key', f.feature_key, 'expires_at', f.expires_at))
                                          from public.user_custom_features f where f.user_id = p.id), '[]'::jsonb)) as j
      from public.profiles p) x), '[]'::jsonb);
end;
$$;

alter function public.meu_perfil() owner to postgres;
alter function public.admin_equipe() owner to postgres;
alter function public.chat_atendentes() owner to postgres;
alter function public.admin_usuarios_lista() owner to postgres;
revoke all on function public.meu_perfil(), public.admin_equipe(), public.chat_atendentes(), public.admin_usuarios_lista()
  from public, anon;
grant execute on function public.meu_perfil(), public.admin_equipe(), public.chat_atendentes(), public.admin_usuarios_lista()
  to authenticated;

-- 4. Conferência que aborta (tudo ou nada) --------------------------------------------------------------------------
do $$
declare
  f regprocedure;
begin
  -- gatilho: troca feita, continua INVOKER, nenhuma leitura direta de profiles sobrou na trava
  if position('gf_ha_outro_super_admin' in pg_get_functiondef('public.gf_protect_profile_privileges()'::regprocedure)) = 0
     or position('from public.profiles' in pg_get_functiondef('public.gf_protect_profile_privileges()'::regprocedure)) > 0
     or (select prosecdef from pg_proc where oid = 'public.gf_protect_profile_privileges()'::regprocedure) then
    raise exception 'gf_protect_profile_privileges: troca não aplicada ou virou SECURITY DEFINER';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.profiles'::regclass
      and tgname = 'gf_protect_profile_privileges' and tgenabled = 'O') then
    raise exception 'gatilho gf_protect_profile_privileges de public.profiles ausente ou desligado';
  end if;
  foreach f in array array['public.meu_perfil()'::regprocedure, 'public.admin_equipe()'::regprocedure,
      'public.chat_atendentes()'::regprocedure, 'public.admin_usuarios_lista()'::regprocedure,
      'public.gf_ha_outro_super_admin(uuid)'::regprocedure] loop
    if has_function_privilege('anon', f, 'execute') or not has_function_privilege('authenticated', f, 'execute') then
      raise exception '%: anon executa ou authenticated não executa', f;
    end if;
    if not (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = f) then
      raise exception '% perdeu SECURITY DEFINER ou search_path', f;
    end if;
    if (select pg_get_userbyid(proowner) from pg_proc where oid = f) <> 'postgres' then
      raise exception '% não pertence ao postgres', f;
    end if;
  end loop;
end $$;

commit;

-- =============================================================================
-- Desfazer da PARTE A (SÓ DEPOIS de desfazer a parte B; a ordem inversa da publicação). Restaura o gatilho e tira as funções:
-- begin;
-- do $$ begin
--   execute replace(pg_get_functiondef('public.gf_protect_profile_privileges()'::regprocedure),
--     E'     and not public.gf_ha_outro_super_admin(old.id) then',
--     E'     and not exists (select 1 from public.profiles p\n                     where p.id <> old.id and p.role = ''admin'' and ''super_admin'' = any(p.admin_permissions)) then');
--   if position('gf_ha_outro_super_admin' in pg_get_functiondef('public.gf_protect_profile_privileges()'::regprocedure)) > 0 then
--     raise exception 'o gatilho ainda chama gf_ha_outro_super_admin: não apagar a função (todo UPDATE em profiles quebraria)';
--   end if;
-- end $$;
-- drop function if exists public.gf_ha_outro_super_admin(uuid), public.meu_perfil(), public.admin_equipe(),
--   public.chat_atendentes(), public.admin_usuarios_lista();
-- commit;
-- (o front novo chama as RPCs: tirar o front novo do ar antes, ou elas dão 404.)
-- =============================================================================
