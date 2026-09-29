-- 2FA exigido pelo banco, e não só pela tela (achado ALTO da segurança no PR #63, 29/09/2026).
-- Antes: quem tinha só a senha de uma conta com 2FA recebia um token "aal1" e lia/gravava pela
-- API, pelas funções e pelo Realtime sem digitar o código. Agora vale o padrão oficial do
-- Supabase "exigir só de quem ativou" (docs: Auth → MFA → Enforce only for users that have opted-in):
-- conta SEM 2FA segue igual (aal1 ou aal2); conta COM 2FA só passa com aal2.
--
-- ORDEM: aplicar DEPOIS que o front do mesmo PR (Login.tsx) estiver no ar; senão o admin com 2FA
-- não consegue entrar (o login lia o perfil antes do código). Idempotente: pode rodar de novo.
-- REAPLICAR ESTE ARQUIVO depois de rodar de novo qualquer SQL que recrie gf_is_admin, gf_admin_can,
-- chat_role, chat_start, affiliate_my_producers, link_me_to_affiliate, ai_balance ou rls_auto_enable
-- (hardening de 27/09, agente_evo, afiliados_v2, chat): eles voltam sem a checagem do 2FA.
begin;

-- 1. Regra única: aal2 no token OU nenhum fator confirmado. SECURITY DEFINER porque o usuário
--    não lê auth.mfa_factors; só devolve verdadeiro/falso sobre a própria conta.
create or replace function public.gf_mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = (select auth.uid()) and f.status = 'verified'
      );
$$;
revoke execute on function public.gf_mfa_ok() from public, anon;
grant execute on function public.gf_mfa_ok() to authenticated, service_role;

-- 2. Regra restritiva em todas as tabelas de public (e no Storage). Restritiva = vale junto
--    com as outras regras, em qualquer comando. Só para "authenticated": anon e service_role
--    não mudam. O (select …) faz o Postgres calcular uma vez por consulta.
do $$
declare
  t record;
begin
  for t in
    select format('%I.%I', schemaname, tablename) as nome
    from pg_tables
    where schemaname = 'public'
       or (schemaname = 'storage' and tablename = 'objects')
  loop
    execute format('drop policy if exists gf_mfa_aal2 on %s', t.nome);
    execute format(
      'create policy gf_mfa_aal2 on %s as restrictive for all to authenticated '
      'using ((select public.gf_mfa_ok())) with check ((select public.gf_mfa_ok()))', t.nome);
  end loop;
end;
$$;

-- 3. Tabela nova de public: o gatilho que já liga o RLS passa a criar também a regra do 2FA.
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
     if cmd.schema_name is not null and cmd.schema_name in ('public') and cmd.schema_name not in ('pg_catalog','information_schema') and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
      begin
        execute format(
          'create policy gf_mfa_aal2 on %s as restrictive for all to authenticated '
          'using ((select public.gf_mfa_ok())) with check ((select public.gf_mfa_ok()))', cmd.object_identity);
      exception
        when others then
          raise warning 'rls_auto_enable: sem a regra gf_mfa_aal2 em % (%)', cmd.object_identity, sqlerrm;
      end;
     else
        raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     end if;
  end loop;
end;
$function$;

-- 4. Funções SECURITY DEFINER passam por cima do RLS: a checagem entra nos pontos por onde elas passam.
-- 4a. Admin: todas as regras e funções de admin usam estas duas.
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
  ) and public.gf_mfa_ok();
$$;

create or replace function public.gf_admin_can(p text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles pr
    where pr.id = (select auth.uid())
      and pr.role = 'admin'
      and ('super_admin' = any(pr.admin_permissions) or p = any(pr.admin_permissions))
  ) and public.gf_mfa_ok();
$$;

-- 4b. Chat: chat_send, chat_update, chat_rate, chat_mark_read, chat_role_path, chat_can_upload e
--     o Storage do chat decidem por chat_role; sem o código ela devolve nulo (sem papel).
create or replace function public.chat_role(p_conv uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when c.user_id = (select auth.uid()) then 'customer'
    when c.producer_id = (select auth.uid()) then 'producer'
    when (c.kind = 'evokaa' or coalesce(t.mediation, false)) and public.gf_admin_can('manage_support') then 'agent'
  end
  from public.conversations c
  left join public.chat_topics t on t.id = c.topic_id
  where c.id = p_conv and public.gf_mfa_ok();
$$;

-- 4c. Afiliado: lista de produtores indicados.
create or replace function public.affiliate_my_producers()
returns table(full_name text, linked_at timestamptz, ended_at timestamptz, source text, producer_since timestamptz, link_slug text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.full_name, v.linked_at, v.ended_at, v.source, p.created_at, l.slug
  from public.platform_affiliate_producers v
  join public.platform_affiliates a on a.id = v.affiliate_id
  join public.profiles p on p.id = v.producer_id
  left join public.affiliate_links l on l.id = v.affiliate_link_id
  where a.user_id = (select auth.uid()) and public.gf_mfa_ok()
  order by v.linked_at desc;
$$;

-- 4d. chat_start, link_me_to_affiliate e ai_balance só usam auth.uid(): uma linha logo após o "begin".
--     Lida da definição atual do banco para não sobrescrever a versão do chat com uma cópia velha.
do $$
declare
  f text;
  def text;
begin
  foreach f in array array['chat_start', 'link_me_to_affiliate', 'ai_balance'] loop
    -- strict: aborta se houver duas versões (sobrecarga) com o mesmo nome
    select pg_get_functiondef(p.oid) into strict def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = f;
    if def is null then
      raise exception 'função public.% não encontrada', f;
    end if;
    if position('gf_mfa_ok' in def) = 0 then
      if (select count(*) from regexp_matches(def, '\mbegin\M', 'gi')) <> 1 then
        raise exception 'public.%: esperava um único "begin"; conferir à mão', f;
      end if;
      execute regexp_replace(def, '\mbegin\M',
        E'begin\n  if not public.gf_mfa_ok() then\n    raise exception ''Confirme o código do 2FA'' using errcode = ''42501'';\n  end if;', 'i');
    end if;
  end loop;
end;
$$;

-- 5. Conferência obrigatória: se faltar a regra em alguma tabela ou a checagem em alguma função,
--    nada deste arquivo é gravado.
do $$
declare
  v_faltam text;
begin
  select string_agg(t.tablename, ', ') into v_faltam
  from pg_tables t
  where t.schemaname = 'public'
    and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename
                    and p.policyname = 'gf_mfa_aal2' and p.permissive = 'RESTRICTIVE');
  if v_faltam is not null then
    raise exception 'tabelas sem gf_mfa_aal2: %', v_faltam;
  end if;
  select string_agg(f, ', ') into v_faltam
  from unnest(array['gf_is_admin', 'gf_admin_can', 'chat_role', 'affiliate_my_producers', 'chat_start',
                    'link_me_to_affiliate', 'ai_balance', 'rls_auto_enable']) f
  where not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = f
                    and pg_get_functiondef(p.oid) like '%gf_mfa_ok%');
  if v_faltam is not null then
    raise exception 'funções sem a checagem do 2FA: %', v_faltam;
  end if;
end;
$$;

commit;

-- Conferência (só leitura):
-- select count(*) filter (where p.policyname is null) as sem_regra, count(*) as tabelas
--   from pg_tables t left join pg_policies p
--     on p.schemaname = t.schemaname and p.tablename = t.tablename and p.policyname = 'gf_mfa_aal2'
--  where t.schemaname = 'public';                                   -- sem_regra deve ser 0
-- select tablename from pg_policies where schemaname = 'storage' and policyname = 'gf_mfa_aal2';  -- objects
-- select proname from pg_proc where pronamespace = 'public'::regnamespace
--    and pg_get_functiondef(oid) like '%gf_mfa_ok%' order by 1;     -- 9 (8 acima + gf_mfa_ok)
-- select tablename from pg_tables where schemaname = 'public' and not rowsecurity;   -- nenhuma
-- select relname from pg_class where relnamespace = 'public'::regnamespace and relkind in ('v','m')
--    and coalesce(array_to_string(reloptions, ','), '') not like '%security_invoker=true%'
--    and has_table_privilege('authenticated', oid, 'select');     -- nenhuma (view assim passa por cima do RLS)
--
-- Desfazer:
-- do $$ declare t record; begin
--   for t in select format('%I.%I', schemaname, tablename) nome from pg_policies where policyname = 'gf_mfa_aal2'
--   loop execute format('drop policy gf_mfa_aal2 on %s', t.nome); end loop; end $$;
-- e recriar gf_is_admin, gf_admin_can, chat_role, affiliate_my_producers, rls_auto_enable, chat_start,
-- link_me_to_affiliate e ai_balance sem a condição (versões anteriores: docs/sql do chat, dos afiliados e do hardening).
