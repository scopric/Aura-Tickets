-- =============================================================================
-- S4b, PARTE B (colunas) do plano sparkling-gliding-harp (admin, Decisão 163 itens 3 e 11): PROFILES MÍNIMO. 05/10/2026.
-- Hoje qualquer admin com uma das 9 permissões da regra gf_profiles_select_own_or_admin (S4) lê a LINHA INTEIRA de todo
-- perfil, com CPF, telefone, nascimento, redes e stripe_customer_id: a RLS escolhe linhas, não colunas. Este arquivo corta
-- por coluna (grant), no molde de 20261011_orders_tickets_colunas_pessoais.sql. Não mexe em nenhuma regra (RLS), nem em
-- INSERT, UPDATE ou DELETE.
--   revoke select em public.profiles de anon e authenticated; grant select de 7 colunas a authenticated:
--   id, email, full_name, avatar_url, role, created_at, avatar_moderacao (as que listas, selects e embeds do front leem).
--   ATENÇÃO: mesa_ok e mesa_cartao (SECURITY INVOKER) leem birth_date (retida) e mesa_ok também avatar_moderacao_hash; só
--   funcionam porque rodam sempre por dentro de funções SECURITY DEFINER do bloco mesa (formar_mesas, minha_mesa, mesas_para_escolher, escolher_mesa, mesa_remover_membro) e não têm
--   EXECUTE para authenticated (20261003_mesa_coletiva.sql). NUNCA dar EXECUTE delas a authenticated: daria 42501.
--   Retidas (17): phone, cpf, bio, city, birth_date, instagram, tiktok, linkedin,
--   stripe_customer_id, is_verified, updated_at, website, admin_permissions, avatar_moderado_em, avatar_moderacao_hash,
--   avatar_moderacao_tentativas, avatar_moderacao_reservada_ate. select('*') em profiles passa a dar 42501.
--
-- ORDEM DE PUBLICAÇÃO (obrigatória, 3 passos): (1) 20261018a_admin_s4b_funcoes.sql no SQL Editor; (2) mesclar o PR do front
-- (fix/admin-s4b-perfil-minimo) e ESPERAR a Vercel publicar o main com ele; (3) ESTE arquivo. O bloco 0 aborta se a parte
-- A não estiver aplicada (não confere o front: isso é do passo 2). Com este arquivo antes do front, o authStore dá 42501 e
-- as telas de Equipe, Atendimento e Usuários quebram. Depois de aplicar, entrar com um admin (aal2), um produtor e um
-- participante.
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17). Uma transação só.
-- Idempotente. lock_timeout de 5s. NÃO mover para supabase/migrations/.
-- Teste: supabase/tests/admin_s4b_profiles_colunas.test.sql (pgTAP; supõe A e B aplicadas; banco local descartável).
--
-- DECISÕES
-- 1. Grant por coluna + RPC, não view: o corte vale para todos os papéis da API de uma vez, sem mexer na RLS.
-- 2. Listas FIXAS e explícitas (revisáveis no PR). A conferência aborta se profiles tiver coluna que não está nem na lista
--    liberada nem na retida: coluna nova em profiles precisa entrar aqui (ou num SQL novo com o grant dela).
-- 3. admin_permissions fica retida: o próprio usuário lê pela meu_perfil() e a equipe pela admin_equipe() (manage_team).
-- 4. INSERT ... RETURNING e UPDATE ... RETURNING exigem SELECT nas colunas devolvidas; o front só pede id. UPDATE com
--    filtro em coluna retida (ex.: .is('birth_date', null)) dá 42501: o Checkout confere a data no cliente.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. A parte A tem de estar aplicada ------------------------------------------------------------------------------------
do $$
declare
  f text;
begin
  if to_regclass('public.profiles') is null then raise exception 'falta a tabela public.profiles'; end if;
  foreach f in array array['meu_perfil()', 'admin_equipe()', 'chat_atendentes()', 'admin_usuarios_lista()', 'gf_ha_outro_super_admin(uuid)'] loop
    if to_regprocedure('public.' || f) is null then
      raise exception 'falta public.%: aplique antes o 20261018a_admin_s4b_funcoes.sql (e o front, ver a ordem no cabeçalho)', f;
    end if;
  end loop;
  if position('gf_ha_outro_super_admin' in pg_get_functiondef('public.gf_protect_profile_privileges()'::regprocedure)) = 0 then
    raise exception 'o gatilho gf_protect_profile_privileges ainda lê admin_permissions direto: aplique antes a parte A (senão super_admin não rebaixa outro)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'gf_profiles_select_own_or_admin' and cmd = 'SELECT' and permissive = 'PERMISSIVE'
      and qual like '%gf_admin_can_any%' and qual like '%manage_users%' and qual like '%manage_support%') then
    raise exception 'profiles sem a regra gf_profiles_select_own_or_admin da S4: aplique antes o 20261015_admin_s4_permissao_dados.sql';
  end if;
end $$;

-- 1. Tira o SELECT da tabela inteira (revogar o da tabela também revoga os SELECT por coluna: rodar de novo é limpo) ---
revoke select on public.profiles from anon, authenticated;

-- 2. Devolve o SELECT a authenticated, coluna por coluna, sem as pessoais ------------------------------------------------
grant select (id, email, full_name, avatar_url, role, created_at, avatar_moderacao) on public.profiles to authenticated;

-- 3. Conferência que aborta (tudo ou nada) --------------------------------------------------------------------------
do $$
declare
  -- as MESMAS listas do grant acima; mudar aqui e lá juntos
  lib text[] := array['id', 'email', 'full_name', 'avatar_url', 'role', 'created_at', 'avatar_moderacao'];
  ret text[] := array['phone', 'cpf', 'bio', 'city', 'birth_date', 'instagram', 'tiktok', 'linkedin', 'stripe_customer_id',
    'is_verified', 'updated_at', 'website', 'admin_permissions', 'avatar_moderado_em', 'avatar_moderacao_hash',
    'avatar_moderacao_tentativas', 'avatar_moderacao_reservada_ate'];
  c text;
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
  -- INSERT e UPDATE não mudaram
  if not (has_table_privilege('authenticated', 'public.profiles', 'update') and has_table_privilege('authenticated', 'public.profiles', 'insert')) then
    raise exception 'profiles: authenticated perdeu INSERT ou UPDATE';
  end if;
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
-- ENSAIO COM ROLLBACK: trocar o "commit;" do fim do bloco 3 por "rollback;" e rodar tudo. Comportamento (CPF e telefone dão
-- 42501, meu_perfil, RPCs com e sem a permissão): supabase/tests/admin_s4b_profiles_colunas.test.sql.
--
-- Desfazer da PARTE B (volta ao estado de antes: SELECT na tabela inteira para anon e authenticated). Desfazer B primeiro,
-- depois, se for o caso, a parte A:
-- begin;
-- revoke select on public.profiles from anon, authenticated;  -- leva junto os SELECT por coluna
-- grant select on public.profiles to anon, authenticated;
-- commit;
-- =============================================================================
