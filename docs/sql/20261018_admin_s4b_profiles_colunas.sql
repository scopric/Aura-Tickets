-- =============================================================================
-- S4b do plano sparkling-gliding-harp (admin, Decisão 163 itens 3 e 11): PROFILES MÍNIMO. 05/10/2026.
-- Hoje qualquer admin com uma das 9 permissões da regra gf_profiles_select_own_or_admin (S4) lê a LINHA INTEIRA de todo
-- perfil, com CPF, telefone, nascimento, redes e stripe_customer_id: a RLS escolhe linhas, não colunas. Este arquivo corta
-- por coluna (grant), no molde de 20261011_orders_tickets_colunas_pessoais.sql, e põe RPCs no lugar das leituras que
-- precisavam da linha inteira. Não mexe em nenhuma regra (RLS), nem em INSERT, UPDATE ou DELETE.
--   1. revoke select em public.profiles de anon e authenticated; grant select de 7 colunas a authenticated:
--      id, email, full_name, avatar_url, role, created_at, avatar_moderacao (as que listas, selects e embeds do front e as
--      funções SECURITY INVOKER mesa_* leem). Retidas (17): phone, cpf, bio, city, birth_date, instagram, tiktok, linkedin,
--      stripe_customer_id, is_verified, updated_at, website, admin_permissions, avatar_moderado_em, avatar_moderacao_hash,
--      avatar_moderacao_tentativas, avatar_moderacao_reservada_ate. select('*') em profiles passa a dar 42501.
--   2. RPCs (SECURITY DEFINER, search_path '', execute só authenticated; anon e PUBLIC sem execute):
--      meu_perfil()           linha de auth.uid() sem cpf e stripe_customer_id (jsonb); nula se não houver linha. Replica a
--                             regra RESTRICTIVE gf_mfa_aal2 da tabela: quem tem fator 2FA confirmado e token aal1 lê
--                             NADA hoje (nem o próprio perfil) e continua assim (gf_mfa_ok()).
--      admin_equipe()         manage_team: id, full_name, email, avatar_url, admin_permissions de role = 'admin'.
--      chat_atendentes()      manage_support: id, full_name, email dos admins com super_admin ou manage_support.
--      admin_usuarios_lista() manage_users: o que Users.tsx lia (id, email, full_name, PHONE, role, created_at, avatar_url,
--                             producer_subscriptions, user_custom_features), jsonb. DECISÃO DO RICARDO (Decisão 163 item 11):
--                             o telefone continua na lista de Usuários, só para quem tem manage_users (ou super_admin).
--      Sem a permissão: 42501 (acesso negado), nunca lista vazia.
--
-- ORDEM DE PUBLICAÇÃO (obrigatória): (a) mesclar o PR do front (fix/admin-s4b-perfil-minimo), que troca o select('*') do
-- authStore e do useProducerSettings por meu_perfil(), a equipe, o Atendimento e a lista de Usuários pelas RPCs e o
-- Checkout (sem filtrar por birth_date no banco); (b) conferir que a Vercel publicou o main com ele; (c) só então este
-- SQL. Ao contrário, com o SQL antes do front, o authStore dá 42501, cai no "sem perfil" e o admin perde os menus (e
-- todo usuário perde telefone, cidade e bio no app), e as telas de Equipe, Atendimento e Usuários dão 42501.
-- Esta é a mudança mais sensível da S4: depois de aplicar, entrar com um admin (aal2), um produtor e um participante.
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17). Uma transação só:
-- se a conferência do fim falhar, nada é gravado. Idempotente (pode rodar de novo). lock_timeout de 5s: se algo segurar
-- profiles, o arquivo desiste sem gravar; rodar de novo. NÃO mover para supabase/migrations/.
-- Teste: supabase/tests/admin_s4b_profiles_colunas.test.sql (pgTAP; banco local descartável, nunca em produção).
--
-- Funções que o bloco 0 confere (md5 de produção em 04/10/2026; a S4b não as recria, só depende delas):
--   select 'gf_admin_can' f, md5(pg_get_functiondef('public.gf_admin_can(text)'::regprocedure))
--   union all select 'gf_admin_can_any', md5(pg_get_functiondef('public.gf_admin_can_any(text[])'::regprocedure));
--   gf_admin_can be37ff87aa0f00c5f35a7e489ae4c18e | gf_admin_can_any b6284b43f339ea138177b772fbd44013
--
-- DECISÕES
-- 1. Grant por coluna + RPC, não view: é o corte que vale para todos os papéis da API de uma vez, sem mexer na RLS.
-- 2. Listas FIXAS e explícitas (revisáveis no PR). A conferência aborta se profiles tiver coluna que não está nem na lista
--    liberada nem na retida: coluna nova em profiles precisa entrar aqui (ou num SQL novo com o grant dela), senão a API
--    não a enxerga.
-- 3. admin_permissions fica retida: o próprio usuário lê pela meu_perfil() e a equipe pela admin_equipe() (manage_team).
-- 4. O gatilho gf_protect_profile_privileges (SECURITY INVOKER, tem de continuar assim: decide por current_user) lia
--    admin_permissions de OUTRO perfil na trava "nunca zero super_admin"; com a coluna retida, um super_admin que
--    rebaixa outro super_admin levava 42501 (reproduzido no banco local). Correção mínima, bloco 3: a consulta vira
--    gf_ha_outro_super_admin(uuid) (SECURITY DEFINER) e SÓ essa linha do gatilho muda (a definição viva é lida, trocada
--    por texto e regravada; se o trecho esperado não estiver lá, aborta). O resto do gatilho fica como está.
-- 5. As funções mesa_* (INVOKER) leem birth_date de dentro de funções SECURITY DEFINER (dono postgres) e não têm execute
--    para authenticated: não são afetadas (conferido no banco local).
-- 6. INSERT ... RETURNING e UPDATE ... RETURNING exigem SELECT nas colunas devolvidas; o front só pede id. UPDATE com
--    filtro em coluna retida (ex.: .is('birth_date', null)) dá 42501: o Checkout confere a data no cliente.
-- 7. Edge Functions leem profiles com a chave de serviço (service_role mantém SELECT na tabela): não são afetadas.
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

-- 1. Tira o SELECT da tabela inteira (revogar o da tabela também revoga os SELECT por coluna: rodar de novo é limpo) ---
revoke select on public.profiles from anon, authenticated;

-- 2. Devolve o SELECT a authenticated, coluna por coluna, sem as pessoais ------------------------------------------------
grant select (id, email, full_name, avatar_url, role, created_at, avatar_moderacao) on public.profiles to authenticated;

-- 3a. Trava "nunca zero super_admin" do gatilho sem depender do SELECT em admin_permissions ----------------------------
create or replace function public.gf_ha_outro_super_admin(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p
                 where p.id <> p_id and p.role = 'admin' and 'super_admin' = any(p.admin_permissions));
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
  -- as MESMAS listas do grant acima; mudar aqui e lá juntos
  lib text[] := array['id', 'email', 'full_name', 'avatar_url', 'role', 'created_at', 'avatar_moderacao'];
  ret text[] := array['phone', 'cpf', 'bio', 'city', 'birth_date', 'instagram', 'tiktok', 'linkedin', 'stripe_customer_id',
    'is_verified', 'updated_at', 'website', 'admin_permissions', 'avatar_moderado_em', 'avatar_moderacao_hash',
    'avatar_moderacao_tentativas', 'avatar_moderacao_reservada_ate'];
  c text;
  f regprocedure;
begin
  -- coluna nova esquecida (nem liberada nem retida)
  select string_agg(a.attname, ', ') into c from pg_attribute a
  where a.attrelid = 'public.profiles'::regclass and a.attnum > 0 and not a.attisdropped and a.attname <> all (lib || ret);
  if c is not null then
    raise exception 'profiles: coluna fora das listas (%): classificar em liberada ou retida neste arquivo', c;
  end if;
  if has_table_privilege('authenticated', 'public.profiles', 'select') then
    raise exception 'profiles: authenticated ainda tem SELECT na tabela inteira (grant a PUBLIC?)';
  end if;
  foreach c in array ret loop
    if has_column_privilege('authenticated', 'public.profiles', c, 'select') then
      raise exception 'profiles.%: authenticated ainda lê a coluna retida', c;
    end if;
  end loop;
  foreach c in array lib loop
    if not has_column_privilege('authenticated', 'public.profiles', c, 'select') then
      raise exception 'profiles.%: authenticated perdeu a leitura de coluna liberada', c;
    end if;
  end loop;
  if has_table_privilege('anon', 'public.profiles', 'select') or has_any_column_privilege('anon', 'public.profiles', 'select') then
    raise exception 'profiles: anon ainda tem SELECT';
  end if;
  -- service_role e postgres seguem lendo tudo (Edge Functions)
  if not has_table_privilege('service_role', 'public.profiles', 'select') then
    raise exception 'profiles: service_role perdeu o SELECT';
  end if;
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
  -- INSERT e UPDATE não mudaram
  if not (has_table_privilege('authenticated', 'public.profiles', 'update') and has_table_privilege('authenticated', 'public.profiles', 'insert')) then
    raise exception 'profiles: authenticated perdeu INSERT ou UPDATE';
  end if;
  foreach f in array array['public.meu_perfil()'::regprocedure, 'public.admin_equipe()'::regprocedure,
      'public.chat_atendentes()'::regprocedure, 'public.admin_usuarios_lista()'::regprocedure] loop
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

-- Conferência (só leitura). Esperado: authenticated com SELECT em 7 colunas de profiles, sem as 17 retidas; anon sem linha.
select grantee::text, count(*) as colunas_com_select,
  bool_or(column_name in ('phone', 'cpf', 'birth_date', 'stripe_customer_id', 'admin_permissions')) as alguma_pessoal
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles' and privilege_type = 'SELECT'
  and grantee in ('anon', 'authenticated', 'PUBLIC')
group by 1 order by 1;

-- =============================================================================
-- ENSAIO COM ROLLBACK: trocar o "commit;" do fim do bloco 4 por "rollback;" e rodar tudo; a conferência que aborta já
-- rodou dentro da transação, e nada fica gravado. Comportamento (CPF e telefone dão 42501, meu_perfil, RPCs com e sem a
-- permissão): supabase/tests/admin_s4b_profiles_colunas.test.sql.
--
-- Desfazer (volta ao estado de antes: SELECT na tabela inteira para anon e authenticated; as RPCs saem):
-- begin;
-- revoke select on public.profiles from anon, authenticated;  -- leva junto os SELECT por coluna
-- grant select on public.profiles to anon, authenticated;
-- do $$ begin  -- devolve a consulta direta ao gatilho (só depois do grant acima) e tira a função auxiliar
--   execute replace(pg_get_functiondef('public.gf_protect_profile_privileges()'::regprocedure),
--     E'     and not public.gf_ha_outro_super_admin(old.id) then',
--     E'     and not exists (select 1 from public.profiles p\n                     where p.id <> old.id and p.role = ''admin'' and ''super_admin'' = any(p.admin_permissions)) then');
-- end $$;
-- drop function if exists public.gf_ha_outro_super_admin(uuid), public.meu_perfil(), public.admin_equipe(),
--   public.chat_atendentes(), public.admin_usuarios_lista();
-- commit;
-- (desfazer só depois de tirar o front novo do ar OU junto: o front novo chama as RPCs e dá 42501/404 sem elas.)
-- =============================================================================
