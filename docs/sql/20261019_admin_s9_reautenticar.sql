-- =============================================================================
-- S9 do plano sparkling-gliding-harp (admin, Decisão 163 itens 12 a 14), PR1: REAUTENTICAÇÃO RECENTE PARA DINHEIRO. 05/10/2026.
-- Plano: Claude/Entregas/2026-10-05 Admin — plano do 2FA e da sessão (S9). Hoje quem está logado em aal2 (código digitado
-- na entrada, às vezes horas atrás) mexe em saque, comissão, taxa e Pix. Depois deste arquivo essas ações pedem um código
-- do aplicativo digitado há no máximo 5 minutos (300 s, Decisão 163 item 12). A tela de 2FA, o reset por outro admin e o
-- aviso de código errado ficam para os PR2, PR3 e PR4.
--   1. public.gf_reauth_recente(p_segundos int): aal2 E um item de auth.jwt()->'amr' com method 'totp' e timestamp dentro
--      da janela. Código de recuperação (method 'mfa/recovery_code' ou outro) NÃO conta: só o aplicativo.
--   2. Gatilhos BEFORE novos e separados (as funções da S3/S5 não foram tocadas), só para quem chega pelo site (current_user
--      ou role do JWT em anon/authenticated; service_role e o SQL Editor passam). Sem reautenticação: 42501 com hint
--      'reautenticar' (o front pede o código e repete a ação, hooks/useReautenticar.tsx):
--        withdrawals         withdrawals_reauth_dinheiro            quando `status` muda
--        producer_profiles   gf_reauth_dinheiro_upd / _ins          quando `commission_rate` muda (insert: fora de 10.00, o padrão)
--        platform_settings   platform_settings_reauth_dinheiro_ins / _upd / _del   key = 'fees' (insert, update, delete)
--        staff_profiles      staff_profiles_reauth_dinheiro         quando muda banco, agencia, conta, pix_tipo ou pix_chave
--   3. gf_is_admin, gf_admin_can, gf_admin_can_any e gf_tem_2fa passam a exigir fator factor_type = 'totp' (hoje só
--      status 'verified'): admin só com fator de aplicativo. Corpo = o de produção + uma condição.
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17). Uma transação só:
-- se o bloco 0 ou a conferência do fim falhar, nada é gravado. Idempotente. `set local lock_timeout = '5s'`: se algo
-- segurar as tabelas, desiste sem gravar; rodar de novo. NÃO mover para supabase/migrations/ (motivo no cabeçalho de
-- 20260927_security_hardening.sql). Teste: supabase/tests/admin_s9_reautenticar.test.sql (pgTAP; banco descartável, nunca produção).
-- ORDEM: depois da S3 (20261014: gf_admin_can_any), da S4 e da S5. Antes de aplicar, fechar o front do PR (o hook só
-- repete a ação se o app já estiver no ar; sem ele o erro aparece como "não foi possível salvar").
--
-- PASSO 0 (só leitura; rodar SOZINHO antes, em produção; o bloco 0 também confere e aborta):
--   select 'gf_is_admin' f, md5(pg_get_functiondef('public.gf_is_admin()'::regprocedure))
--   union all select 'gf_admin_can', md5(pg_get_functiondef('public.gf_admin_can(text)'::regprocedure))
--   union all select 'gf_admin_can_any', md5(pg_get_functiondef('public.gf_admin_can_any(text[])'::regprocedure))
--   union all select 'gf_tem_2fa', md5(pg_get_functiondef('public.gf_tem_2fa(uuid)'::regprocedure))
--   union all select 'gf_mfa_ok', md5(pg_get_functiondef('public.gf_mfa_ok()'::regprocedure));
--   Esperado (produção em 05/10/2026, lido pelo MCP só leitura):
--     gf_is_admin 4c96fe6821f9ca8deea4ec9cefbcca2e | gf_admin_can be37ff87aa0f00c5f35a7e489ae4c18e
--     gf_admin_can_any b6284b43f339ea138177b772fbd44013 | gf_tem_2fa 3b37b03a026872ce222393acd0ce8dcf
--     gf_mfa_ok 947db8951761c72a522732b008891fac
--   Se for outro, alguém mudou a função: NÃO aplicar; refazer o bloco a partir da definição nova.
--
-- DECISÕES
-- 1. Janela de 300 s (Decisão 163 item 12). O relógio é o do banco (now()) contra o timestamp do amr, que o Auth grava
--    no verify do código: se o relógio do Auth e o do banco divergirem, a janela encolhe ou estica na diferença.
-- 2. gf_mfa_ok NÃO muda (md5 conferido no bloco 0 e na conferência final): ela é a regra restritiva gf_mfa_aal2 de TODAS
--    as tabelas ("aal2 ou nenhum fator confirmado"), também de produtor e participante. Olhar só TOTP ali abriria uma
--    brecha: quem tivesse só um fator de outro tipo (hoje o app só cadastra TOTP, mas o Auth aceita outros) voltaria a
--    passar em aal1. Mantida como está, qualquer fator confirmado exige aal2. Dentro de gf_is_admin ela segue na conta.
-- 3. gf_tem_2fa só conta TOTP: promover a admin e editar a ficha (staff_profiles_proprio_edita) pedem fator de aplicativo.
--    Efeito: admin que hoje só tenha fator de outro tipo deixa de ser admin ao aplicar; o bloco 0 confere e ABORTA
--    (Conferência 1, como a seg4) listando quem for.
-- 4. Os gatilhos rodam DEPOIS dos de permissão (ordem alfabética dos BEFORE: gf_protect_withdrawals e
--    withdrawals_quem_processou < withdrawals_reauth_dinheiro; gf_protect_producer_profile_privileges <
--    gf_reauth_dinheiro_*): quem não tem a permissão recebe o erro de permissão, não o pedido de código. A conferência
--    final trava esses nomes. O que a RLS barra nem chega ao gatilho.
-- 5. REAPLICAR. Este arquivo recria gf_is_admin, gf_admin_can, gf_admin_can_any e gf_tem_2fa: rodar de novo a seg4
--    (20261001) ou a S3 (20261014) DEPOIS dele devolve as funções sem a exigência de TOTP (a S3 até aborta no bloco 0,
--    porque o md5 de gf_is_admin deixou de ser o de produção: nesse caso refazê-la a partir da definição daqui). Se
--    rodar, reaplicar este arquivo em seguida (aceita o md5 de produção e o da versão S9).
-- 6. FICA DE FORA: comissão, taxa e saque ainda não têm tela no admin (Fase 4); o gatilho já protege o dia em que tiverem.
--    Gatilho não existe em auth.mfa_factors (dono supabase_auth_admin; não verificado se é permitido): o reset do 2FA é o PR3.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Conferência das definições de produção --------------------------------------------------------------------------
do $$
declare
  f text;
  n int;
  quem text;
  -- md5 de produção (05/10/2026) das funções recriadas aqui, e da versão S9 (2ª aplicação)
  producao jsonb := jsonb_build_object(
    'gf_is_admin()', '4c96fe6821f9ca8deea4ec9cefbcca2e',
    'gf_admin_can(text)', 'be37ff87aa0f00c5f35a7e489ae4c18e',
    'gf_admin_can_any(text[])', 'b6284b43f339ea138177b772fbd44013',
    'gf_tem_2fa(uuid)', '3b37b03a026872ce222393acd0ce8dcf');
  versao_s9 jsonb := jsonb_build_object(
    'gf_is_admin()', '5171aa86c00538cf3b2754ec78617225',
    'gf_admin_can(text)', '0f661e18944891e6da7dadf94b1b2505',
    'gf_admin_can_any(text[])', '3f943162f9953d4860accc0e7c3e7a4b',
    'gf_tem_2fa(uuid)', '01c820c111f55cd014bb0026de8af8af');
begin
  foreach f in array array['withdrawals', 'producer_profiles', 'platform_settings', 'staff_profiles'] loop
    if to_regclass('public.' || f) is null then raise exception 'falta a tabela public.%', f; end if;
  end loop;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'withdrawals' and column_name = 'status')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'producer_profiles' and column_name = 'commission_rate')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'platform_settings' and column_name = 'key')
     or (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'staff_profiles'
           and column_name in ('banco', 'agencia', 'conta', 'pix_tipo', 'pix_chave')) <> 5 then
    raise exception 'falta uma coluna de dinheiro (withdrawals.status, producer_profiles.commission_rate, platform_settings.key ou banco/agencia/conta/pix_tipo/pix_chave de staff_profiles)';
  end if;
  if to_regprocedure('public.gf_admin_can_any(text[])') is null then
    raise exception 'falta public.gf_admin_can_any(text[]): aplique antes o 20261014_admin_s3_permissao_dinheiro.sql';
  end if;
  -- funções recriadas: a de produção ou exatamente a deste arquivo (2ª aplicação)
  for f in select jsonb_object_keys(producao) loop
    if to_regprocedure('public.' || f) is null then raise exception 'falta public.%', f; end if;
    if md5(pg_get_functiondef(('public.' || f)::regprocedure)) not in (producao ->> f, versao_s9 ->> f) then
      raise exception 'public.% mudou desde 05/10 (md5 diferente): refazer este arquivo a partir da definição atual', f;
    end if;
  end loop;
  -- gf_mfa_ok não é recriada e tem de ser a de produção (decisão 2)
  if md5(pg_get_functiondef('public.gf_mfa_ok()'::regprocedure)) <> '947db8951761c72a522732b008891fac' then
    raise exception 'public.gf_mfa_ok() mudou desde 05/10 (md5 diferente): conferir a decisão 2 antes de aplicar';
  end if;
  -- Conferência 1: nenhum admin que hoje passa deixa de passar por falta de fator TOTP
  select count(*), string_agg(coalesce(p.email, p.id::text), ', ') into n, quem
  from public.profiles p
  where p.role = 'admin'
    and not exists (select 1 from auth.mfa_factors m where m.user_id = p.id and m.factor_type = 'totp' and m.status = 'verified');
  if n > 0 then
    raise exception '% admin(s) sem fator TOTP confirmado (%): cadastrar o aplicativo ou tirar o papel admin antes de aplicar; nada foi gravado', n, quem;
  end if;
end $$;

-- 1. gf_reauth_recente: aal2 e um TOTP digitado dentro da janela ------------------------------------------------------
-- amr do token do Supabase: [{"method":"password","timestamp":1700000000},{"method":"totp","timestamp":1700000100}].
-- Timestamp que não é número (token que não é do Auth) nunca conta; o JWT chega assinado, a guarda é só de segurança.
create or replace function public.gf_reauth_recente(p_segundos int)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and coalesce((
      select bool_or(
        a ->> 'method' = 'totp'
        and case when (a ->> 'timestamp') ~ '^[0-9]+(\.[0-9]+)?$' then (a ->> 'timestamp')::numeric end
            >= extract(epoch from now()) - p_segundos)
      from jsonb_array_elements(case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end) a
    ), false);
$$;
alter function public.gf_reauth_recente(int) owner to postgres;
revoke execute on function public.gf_reauth_recente(int) from public, anon;
grant execute on function public.gf_reauth_recente(int) to authenticated, service_role;

-- 2. Funções de admin: fator TOTP confirmado (corpo de produção + factor_type = 'totp') --------------------------------
create or replace function public.gf_is_admin()
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  ) and public.gf_mfa_ok()
    -- Decisão 99: admin só com fator confirmado e o código digitado nesta sessão
    -- S9: o fator é o de aplicativo (TOTP)
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.factor_type = 'totp' and f.status = 'verified');
$function$;

create or replace function public.gf_admin_can(p text)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (
    select 1 from public.profiles pr
    where pr.id = (select auth.uid())
      and pr.role = 'admin'
      and ('super_admin' = any(pr.admin_permissions) or p = any(pr.admin_permissions))
  ) and public.gf_mfa_ok()
    -- Decisão 99: admin só com fator confirmado e o código digitado nesta sessão
    -- S9: o fator é o de aplicativo (TOTP)
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.factor_type = 'totp' and f.status = 'verified');
$function$;

create or replace function public.gf_admin_can_any(p text[])
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (
    select 1 from public.profiles pr
    where pr.id = (select auth.uid())
      and pr.role = 'admin'
      and ('super_admin' = any(pr.admin_permissions) or pr.admin_permissions && p)
  ) and public.gf_mfa_ok()
    -- Decisão 99: admin só com fator confirmado e o código digitado nesta sessão
    -- S9: o fator é o de aplicativo (TOTP)
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.factor_type = 'totp' and f.status = 'verified');
$function$;

create or replace function public.gf_tem_2fa(p_user uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select case
    when p_user = (select auth.uid())
      or (select public.gf_admin_can('super_admin'))
      or (select auth.role()) = 'service_role'
    then exists (select 1 from auth.mfa_factors f where f.user_id = p_user and f.factor_type = 'totp' and f.status = 'verified')
  end;
$function$;

-- 3. Trava dos gatilhos: uma função só; a condição de cada tabela fica no WHEN do gatilho -----------------------------
-- (platform_settings tem um gatilho por comando porque o WHEN não enxerga OLD no INSERT nem NEW no DELETE.)
create or replace function public.gf_reauth_dinheiro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- só chamadas do site; chave de serviço e SQL Editor seguem livres
  if (current_user in ('anon', 'authenticated') or coalesce(auth.jwt() ->> 'role', '') in ('anon', 'authenticated'))
     and not public.gf_reauth_recente(300) then
    raise exception 'Confirme o código da verificação em duas etapas para continuar.' using errcode = '42501', hint = 'reautenticar';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
alter function public.gf_reauth_dinheiro() owner to postgres;
revoke all on function public.gf_reauth_dinheiro() from public, anon, authenticated, service_role;

drop trigger if exists withdrawals_reauth_dinheiro on public.withdrawals;
create trigger withdrawals_reauth_dinheiro before update on public.withdrawals
  for each row when (old.status is distinct from new.status) execute function public.gf_reauth_dinheiro();

drop trigger if exists gf_reauth_dinheiro_upd on public.producer_profiles;
create trigger gf_reauth_dinheiro_upd before update on public.producer_profiles
  for each row when (old.commission_rate is distinct from new.commission_rate) execute function public.gf_reauth_dinheiro();
-- 10.00 é o padrão da coluna e o único valor que o dono grava ao criar a própria linha (gatilho do L4)
drop trigger if exists gf_reauth_dinheiro_ins on public.producer_profiles;
create trigger gf_reauth_dinheiro_ins before insert on public.producer_profiles
  for each row when (new.commission_rate is distinct from 10.00) execute function public.gf_reauth_dinheiro();

drop trigger if exists platform_settings_reauth_dinheiro_ins on public.platform_settings;
create trigger platform_settings_reauth_dinheiro_ins before insert on public.platform_settings
  for each row when (new.key = 'fees') execute function public.gf_reauth_dinheiro();
drop trigger if exists platform_settings_reauth_dinheiro_upd on public.platform_settings;
create trigger platform_settings_reauth_dinheiro_upd before update on public.platform_settings
  for each row when (old.key = 'fees' or new.key = 'fees') execute function public.gf_reauth_dinheiro();
drop trigger if exists platform_settings_reauth_dinheiro_del on public.platform_settings;
create trigger platform_settings_reauth_dinheiro_del before delete on public.platform_settings
  for each row when (old.key = 'fees') execute function public.gf_reauth_dinheiro();

drop trigger if exists staff_profiles_reauth_dinheiro on public.staff_profiles;
create trigger staff_profiles_reauth_dinheiro before update on public.staff_profiles
  for each row when (old.banco is distinct from new.banco or old.agencia is distinct from new.agencia
    or old.conta is distinct from new.conta or old.pix_tipo is distinct from new.pix_tipo
    or old.pix_chave is distinct from new.pix_chave) execute function public.gf_reauth_dinheiro();

-- Conferência final: nada é gravado se falhar ------------------------------------------------------------------------
do $$
declare
  f regprocedure;
  t record;
  d text;
begin
  if not (select prosecdef and proconfig @> array['search_path=""'] and proowner = 'postgres'::regrole
          from pg_proc where oid = 'public.gf_reauth_recente(int)'::regprocedure) then
    raise exception 'gf_reauth_recente sem SECURITY DEFINER, search_path ou dono postgres';
  end if;
  if has_function_privilege('anon', 'public.gf_reauth_recente(int)', 'execute')
     or not has_function_privilege('authenticated', 'public.gf_reauth_recente(int)', 'execute')
     or not has_function_privilege('service_role', 'public.gf_reauth_recente(int)', 'execute') then
    raise exception 'gf_reauth_recente: anon executa ou authenticated/service_role não executa';
  end if;
  foreach f in array array['public.gf_is_admin()'::regprocedure, 'public.gf_admin_can(text)'::regprocedure,
      'public.gf_admin_can_any(text[])'::regprocedure, 'public.gf_tem_2fa(uuid)'::regprocedure] loop
    d := pg_get_functiondef(f);
    if position('factor_type = ''totp''' in d) = 0 or position('mfa_factors' in d) = 0 then
      raise exception '% sem a exigência do fator TOTP', f;
    end if;
    if not (select prosecdef and proconfig @> array['search_path=""'] and proowner = 'postgres'::regrole from pg_proc where oid = f) then
      raise exception '% perdeu SECURITY DEFINER, search_path ou dono', f;
    end if;
    if has_function_privilege('anon', f, 'execute') or not has_function_privilege('authenticated', f, 'execute') then
      raise exception '%: anon executa ou authenticated não executa', f;
    end if;
  end loop;
  if md5(pg_get_functiondef('public.gf_mfa_ok()'::regprocedure)) <> '947db8951761c72a522732b008891fac' then
    raise exception 'gf_mfa_ok mudou (decisão 2)';
  end if;
  if has_function_privilege('anon', 'public.gf_reauth_dinheiro()', 'execute')
     or has_function_privilege('authenticated', 'public.gf_reauth_dinheiro()', 'execute') then
    raise exception 'gf_reauth_dinheiro executável pelo navegador';
  end if;
  -- cada gatilho existe, ligado, BEFORE de linha, e roda DEPOIS dos de permissão (ordem pelo nome, decisão 4)
  for t in select * from (values
      ('public.withdrawals'::regclass, 'withdrawals_reauth_dinheiro', array['gf_protect_withdrawals', 'withdrawals_quem_processou']),
      ('public.producer_profiles'::regclass, 'gf_reauth_dinheiro_upd', array['gf_protect_producer_profile_privileges']),
      ('public.producer_profiles'::regclass, 'gf_reauth_dinheiro_ins', array['gf_protect_producer_profile_privileges']),
      ('public.platform_settings'::regclass, 'platform_settings_reauth_dinheiro_ins', array[]::text[]),
      ('public.platform_settings'::regclass, 'platform_settings_reauth_dinheiro_upd', array[]::text[]),
      ('public.platform_settings'::regclass, 'platform_settings_reauth_dinheiro_del', array[]::text[]),
      ('public.staff_profiles'::regclass, 'staff_profiles_reauth_dinheiro', array[]::text[])
    ) v(tab, nome, antes) loop
    if not exists (select 1 from pg_trigger g where g.tgrelid = t.tab and g.tgname = t.nome and g.tgenabled = 'O'
        and g.tgfoid = 'public.gf_reauth_dinheiro()'::regprocedure and (g.tgtype & 3) = 3) then
      raise exception 'gatilho % de % ausente, desligado ou não é BEFORE de linha', t.nome, t.tab;
    end if;
    if exists (select 1 from unnest(t.antes) a where a collate "C" > t.nome collate "C") then
      raise exception 'gatilho % deixaria de rodar depois dos de permissão (%)', t.nome, t.antes;
    end if;
    if exists (select 1 from unnest(t.antes) a where not exists (
        select 1 from pg_trigger g where g.tgrelid = t.tab and g.tgname = a and g.tgenabled = 'O')) then
      raise exception 'gatilho de permissão de % sumiu (%): conferir a ordem antes de aplicar', t.tab, t.antes;
    end if;
  end loop;
end $$;

commit;

-- Desfazer (volta às funções de produção e tira a trava; só com decisão nova que substitua a 163 item 12).
-- Tire o "-- " do começo das linhas. Os gatilhos primeiro, depois as funções (corpos exatos de produção em 05/10/2026,
-- md5 no PASSO 0). gf_reauth_recente pode ficar (nada mais a chama); para tirar: drop function public.gf_reauth_recente(int);
-- drop trigger if exists withdrawals_reauth_dinheiro on public.withdrawals;
-- drop trigger if exists gf_reauth_dinheiro_upd on public.producer_profiles;
-- drop trigger if exists gf_reauth_dinheiro_ins on public.producer_profiles;
-- drop trigger if exists platform_settings_reauth_dinheiro_ins on public.platform_settings;
-- drop trigger if exists platform_settings_reauth_dinheiro_upd on public.platform_settings;
-- drop trigger if exists platform_settings_reauth_dinheiro_del on public.platform_settings;
-- drop trigger if exists staff_profiles_reauth_dinheiro on public.staff_profiles;
-- drop function if exists public.gf_reauth_dinheiro();
-- CREATE OR REPLACE FUNCTION public.gf_is_admin()
--  RETURNS boolean
--  LANGUAGE sql
--  STABLE SECURITY DEFINER
--  SET search_path TO ''
-- AS $function$
--   select exists (
--     select 1 from public.profiles
--     where id = (select auth.uid()) and role = 'admin'
--   ) and public.gf_mfa_ok()
--     -- Decisão 99: admin só com fator confirmado e o código digitado nesta sessão
--     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
--     and exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified');
-- $function$;
-- CREATE OR REPLACE FUNCTION public.gf_admin_can(p text)
--  RETURNS boolean
--  LANGUAGE sql
--  STABLE SECURITY DEFINER
--  SET search_path TO ''
-- AS $function$
--   select exists (
--     select 1 from public.profiles pr
--     where pr.id = (select auth.uid())
--       and pr.role = 'admin'
--       and ('super_admin' = any(pr.admin_permissions) or p = any(pr.admin_permissions))
--   ) and public.gf_mfa_ok()
--     -- Decisão 99: admin só com fator confirmado e o código digitado nesta sessão
--     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
--     and exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified');
-- $function$;
-- CREATE OR REPLACE FUNCTION public.gf_admin_can_any(p text[])
--  RETURNS boolean
--  LANGUAGE sql
--  STABLE SECURITY DEFINER
--  SET search_path TO ''
-- AS $function$
--   select exists (
--     select 1 from public.profiles pr
--     where pr.id = (select auth.uid())
--       and pr.role = 'admin'
--       and ('super_admin' = any(pr.admin_permissions) or pr.admin_permissions && p)
--   ) and public.gf_mfa_ok()
--     -- Decisão 99: admin só com fator confirmado e o código digitado nesta sessão
--     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
--     and exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified');
-- $function$;
-- CREATE OR REPLACE FUNCTION public.gf_tem_2fa(p_user uuid)
--  RETURNS boolean
--  LANGUAGE sql
--  STABLE SECURITY DEFINER
--  SET search_path TO ''
-- AS $function$
--   select case
--     when p_user = (select auth.uid())
--       or (select public.gf_admin_can('super_admin'))
--       or (select auth.role()) = 'service_role'
--     then exists (select 1 from auth.mfa_factors f where f.user_id = p_user and f.status = 'verified')
--   end;
-- $function$;
