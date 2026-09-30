-- PR 4 do plano de segurança: 2FA obrigatório para admin e super_admin (Decisão 99, 30/09/2026).
-- Antes: gf_is_admin() e gf_admin_can() usavam gf_mfa_ok(), que libera quem NÃO tem fator ("2FA só de quem
-- ativou"). Um admin sem 2FA agia com a senha sozinha. Agora admin só passa com fator confirmado
-- (auth.mfa_factors, status verified) E token aal2 (código digitado nesta sessão). Produtor e participante
-- não mudam: continuam com 2FA opcional (gf_mfa_ok e a regra gf_mfa_aal2 ficam como estão).
--
-- ORDEM DE APLICAÇÃO (as três partes do PR funcionam em qualquer ordem entre si, sem janela quebrada):
--   0. Todo profiles.role = 'admin' com 2FA ativado. A conferência do começo ABORTA se faltar alguém (senão ele
--      perde o painel ao aplicar). Em 30/09 a produção tinha 1 admin (super_admin) e com fator.
--   1. Front do PR (alpha): admin sem fator vê a tela de cadastro do 2FA em vez do painel.
--   2. Este arquivo inteiro no SQL Editor (uma transação: se a conferência falhar, nada é gravado).
--   3. Edge Functions do PR: send-email, check-in-validate, agent e aviso-politica (passam a perguntar
--      "é admin" ao banco com o JWT de quem chama, em vez de ler profiles com a service role).
-- Idempotente. REAPLICAR depois de rodar de novo 20260930_2fa_no_banco.sql, 20260927_security_hardening.sql,
-- 20260929_agente_evo.sql ou 20260930_permissoes_admin.sql: eles recriam gf_is_admin/gf_admin_can ou o gatilho
-- gf_protect_profile_privileges sem esta exigência, sem erro nenhum.
--
-- DECISÕES
-- 1. Recria só gf_is_admin e gf_admin_can, com o corpo do baseline + duas condições (fator confirmado e aal2).
--    "create or replace" mantém dono, grants (seg6: sem anon), SECURITY DEFINER e search_path ''.
--    public.gf_mfa_ok() continua no corpo (redundante com aal2, mas a conferência de "O que não pode quebrar"
--    conta as 9 funções que a chamam).
-- 2. Quem usa as duas passa a exigir o mesmo para admin: 58 regras (47 com gf_is_admin, 11 com gf_admin_can)
--    e 9 funções/gatilhos (admin_activity_stats, ai_admin_resumo, ai_key_status, ai_set_gemini_key, chat_role,
--    gf_protect_affiliate_link, gf_protect_event_moderation, gf_protect_producer_profile_privileges,
--    gf_protect_profile_privileges), contados no banco local com o baseline + seg6 em 30/09.
--    Admin em aal1 ou sem fator vira usuário comum: lê o que é dele, não o que é "de admin" (T1, T2).
--    Para quem não é admin nada muda: as duas já devolviam falso (testado abaixo, T3).
-- 3. Fora deste arquivo (achado, não corrigido aqui): newsletters."Apenas admins leem e gerenciam campanhas" e
--    newsletter_subscribers."Apenas admins gerenciam subscribers" conferem profiles.role = 'admin' direto,
--    sem gf_is_admin: admin sem fator ainda passa nelas. Trocar por (select public.gf_is_admin()) "to
--    authenticated" junto com o PR 5 (que mexe nas regras dessas tabelas).
-- 4. Recuperação de quem perde o celular: docs/SEGURANCA-2FA.md. Nunca desligar esta regra.
-- 5. Promover a admin exige 2FA confirmado na conta promovida (gatilho gf_protect_profile_privileges, T4). O
--    gatilho roda como quem chama e authenticated/service_role não leem auth.mfa_factors: a pergunta vai para
--    public.gf_tem_2fa(uuid) (security definer), que só responde sobre a própria conta, para o super_admin e
--    para a chave de serviço (os demais recebem null). O dono do banco (postgres, SQL Editor) segue livre:
--    é a saída de emergência documentada em docs/SEGURANCA-2FA.md.
begin;

-- Conferência 1 (antes de tudo): nenhum admin sem 2FA confirmado.
do $$
declare
  n int;
  quem text;
begin
  select count(*), string_agg(coalesce(p.email, p.id::text), ', ')
    into n, quem
  from public.profiles p
  where p.role = 'admin'
    and not exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified');
  if n > 0 then
    raise exception '% admin(s) sem 2FA confirmado (%): ative o 2FA dessas contas ou tire o papel admin antes de aplicar; nada foi gravado', n, quem;
  end if;
end;
$$;

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
  ) and public.gf_mfa_ok()
    -- Decisão 99: admin só com fator confirmado e o código digitado nesta sessão
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified');
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
  ) and public.gf_mfa_ok()
    -- Decisão 99: admin só com fator confirmado e o código digitado nesta sessão
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified');
$$;

-- "Esta conta tem 2FA confirmado?" O gatilho abaixo NÃO é security definer (roda como quem chama) e
-- authenticated/service_role não leem auth.mfa_factors; por isso a pergunta passa por aqui. Só responde para a
-- própria conta, para o super_admin (em aal2 com fator) e para a chave de serviço; para os demais devolve null
-- (não vira um "quem é admin com 2FA" aberto a qualquer usuário).
create or replace function public.gf_tem_2fa(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_user = (select auth.uid())
      or (select public.gf_admin_can('super_admin'))
      or (select auth.role()) = 'service_role'
    then exists (select 1 from auth.mfa_factors f where f.user_id = p_user and f.status = 'verified')
  end;
$$;
alter function public.gf_tem_2fa(uuid) owner to postgres;
revoke all on function public.gf_tem_2fa(uuid) from public, anon;
grant execute on function public.gf_tem_2fa(uuid) to authenticated, service_role;

-- Gatilho de profiles: corpo do baseline (20260930134600, igual à produção) + a regra "só vira admin quem tem 2FA
-- confirmado". Vale para usuário e chave de serviço; o dono do banco (SQL Editor) fica livre para a recuperação
-- de emergência de docs/SEGURANCA-2FA.md. "create or replace" mantém dono, grants, plpgsql e search_path ''.
create or replace function public.gf_protect_profile_privileges()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  -- Quem sai do papel admin perde as permissões (senão voltar a admin depois recupera as antigas)
  if old.role = 'admin' and new.role is distinct from 'admin' then
    new.admin_permissions := '{}';
  end if;

  -- Nunca sobrar zero super_admin (vale para todos, inclusive a chave de serviço do delete-account).
  -- A trava serializa dois super_admins que se rebaixam ao mesmo tempo (senão os dois passariam).
  if old.role = 'admin' and 'super_admin' = any(coalesce(old.admin_permissions, '{}')) then
    perform pg_advisory_xact_lock(hashtext('gf_super_admin'));
  end if;
  if old.role = 'admin' and 'super_admin' = any(coalesce(old.admin_permissions, '{}'))
     and not (new.role = 'admin' and 'super_admin' = any(coalesce(new.admin_permissions, '{}')))
     and not exists (select 1 from public.profiles p
                     where p.id <> old.id and p.role = 'admin' and 'super_admin' = any(p.admin_permissions)) then
    raise exception 'A plataforma precisa de pelo menos um super_admin' using errcode = '42501';
  end if;

  -- Decisão 99: só vira admin quem já tem 2FA confirmado (usuário e chave de serviço; o dono do banco fica livre)
  if new.role = 'admin' and old.role is distinct from 'admin'
     and current_user not in ('postgres', 'supabase_admin')
     and public.gf_tem_2fa(new.id) is not true then
    raise exception 'Só dá para promover a admin uma conta com 2FA confirmado.' using errcode = '42501';
  end if;

  -- Daqui para baixo, só chamadas de usuário; chave de serviço e postgres seguem livres
  if not (current_user in ('anon', 'authenticated')
          or coalesce(auth.jwt() ->> 'role', '') in ('anon', 'authenticated')) then
    return new;
  end if;

  -- Trocar o id "moveria" o perfil (com papel e permissões) para outro login
  if new.id is distinct from old.id then
    raise exception 'O id do perfil não pode ser alterado' using errcode = '42501';
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
     and not public.gf_admin_can('manage_users') then
    raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
  end if;
  return new;
end;
$function$;

-- Conferência 2: as duas com a regra nova, fechadas para anon e abertas para authenticated; gf_tem_2fa e a regra
-- nova no gatilho de profiles.
do $$
declare
  f regprocedure;
begin
  if position('gf_tem_2fa(new.id) is not true' in pg_get_functiondef('public.gf_protect_profile_privileges()'::regprocedure)) = 0 then
    raise exception 'gf_protect_profile_privileges sem a exigência do 2FA para promover a admin';
  end if;
  if not (select prosecdef and proconfig @> array['search_path=""'] and proowner = 'postgres'::regrole
          from pg_proc where oid = 'public.gf_tem_2fa(uuid)'::regprocedure) then
    raise exception 'gf_tem_2fa sem SECURITY DEFINER, search_path ou dono postgres';
  end if;
  if has_function_privilege('anon', 'public.gf_tem_2fa(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.gf_tem_2fa(uuid)', 'execute')
     or not has_function_privilege('service_role', 'public.gf_tem_2fa(uuid)', 'execute') then
    raise exception 'gf_tem_2fa: anon executa ou authenticated/service_role não executa';
  end if;
  foreach f in array array['public.gf_is_admin()'::regprocedure, 'public.gf_admin_can(text)'::regprocedure] loop
    if position('aal2' in pg_get_functiondef(f)) = 0 or position('mfa_factors' in pg_get_functiondef(f)) = 0
       or position('gf_mfa_ok' in pg_get_functiondef(f)) = 0 then
      raise exception '% sem a exigência do 2FA para admin', f;
    end if;
    if not (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = f) then
      raise exception '% perdeu SECURITY DEFINER ou search_path', f;
    end if;
    if has_function_privilege('anon', f, 'execute') or not has_function_privilege('authenticated', f, 'execute') then
      raise exception '%: anon executa ou authenticated não executa', f;
    end if;
  end loop;
end;
$$;

commit;

-- Desfazer (volta ao "2FA só de quem ativou" para admin; só com decisão nova que substitua a 99):
-- a) reaplicar a seção 4a de docs/sql/20260930_2fa_no_banco.sql (gf_is_admin e gf_admin_can);
-- b) gatilho de profiles com o corpo do baseline (sem a regra de promover) e apagar gf_tem_2fa, nesta ordem
--    (tire o "-- " do começo das linhas):
-- create or replace function public.gf_protect_profile_privileges()
--  returns trigger
--  language plpgsql
--  set search_path to ''
-- as $function$
-- begin
--   -- Quem sai do papel admin perde as permissões (senão voltar a admin depois recupera as antigas)
--   if old.role = 'admin' and new.role is distinct from 'admin' then
--     new.admin_permissions := '{}';
--   end if;
--
--   -- Nunca sobrar zero super_admin (vale para todos, inclusive a chave de serviço do delete-account).
--   -- A trava serializa dois super_admins que se rebaixam ao mesmo tempo (senão os dois passariam).
--   if old.role = 'admin' and 'super_admin' = any(coalesce(old.admin_permissions, '{}')) then
--     perform pg_advisory_xact_lock(hashtext('gf_super_admin'));
--   end if;
--   if old.role = 'admin' and 'super_admin' = any(coalesce(old.admin_permissions, '{}'))
--      and not (new.role = 'admin' and 'super_admin' = any(coalesce(new.admin_permissions, '{}')))
--      and not exists (select 1 from public.profiles p
--                      where p.id <> old.id and p.role = 'admin' and 'super_admin' = any(p.admin_permissions)) then
--     raise exception 'A plataforma precisa de pelo menos um super_admin' using errcode = '42501';
--   end if;
--
--   -- Daqui para baixo, só chamadas de usuário; chave de serviço e postgres seguem livres
--   if not (current_user in ('anon', 'authenticated')
--           or coalesce(auth.jwt() ->> 'role', '') in ('anon', 'authenticated')) then
--     return new;
--   end if;
--
--   -- Trocar o id "moveria" o perfil (com papel e permissões) para outro login
--   if new.id is distinct from old.id then
--     raise exception 'O id do perfil não pode ser alterado' using errcode = '42501';
--   end if;
--
--   if new.admin_permissions is distinct from old.admin_permissions
--      or (new.role is distinct from old.role and 'admin' in (new.role, old.role)) then
--     if not public.gf_admin_can('super_admin') then
--       raise exception 'Só o super_admin altera papel de admin e permissões' using errcode = '42501';
--     end if;
--     if new.id = (select auth.uid()) then
--       raise exception 'Ninguém altera o próprio papel nem as próprias permissões' using errcode = '42501';
--     end if;
--   elsif new.role is distinct from old.role then
--     -- participante, cliente, produtor e editor: quem gerencia usuários
--     if not public.gf_admin_can('manage_users') then
--       raise exception 'Alteração de papel exige a permissão manage_users' using errcode = '42501';
--     end if;
--   end if;
--
--   if (new.is_verified is distinct from old.is_verified
--       or new.stripe_customer_id is distinct from old.stripe_customer_id)
--      and not public.gf_admin_can('manage_users') then
--     raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
--   end if;
--   return new;
-- end;
-- $function$;
-- drop function public.gf_tem_2fa(uuid);

-- =============================================================================
-- TESTES (rodar à mão num banco local ou descartável, NUNCA em produção: tire o "-- " do começo das linhas
-- abaixo e rode tudo de uma vez; está num begin … rollback e não deixa nada gravado). Rodados em 30/09/2026
-- no `supabase start` do repositório (baseline 20260930134600 + 20261001_seg6_menor_privilegio.sql), com
-- este arquivo aplicado duas vezes. Cada teste termina com "NOTICE: Tn OK". pg_temp.como() troca o papel da
-- sessão E as claims do JWT (inclusive aal), como o PostgREST.
-- T5 (conferência aborta com admin sem fator) roda à parte, pelo terminal, e também não grava nada:
--   (echo "begin; insert into auth.users (id, email) values ('5e400000-0000-4000-8000-000000000009', 'x@teste-seg4.evokaa.invalid');
--    update public.profiles set role = 'admin' where id = '5e400000-0000-4000-8000-000000000009';"; cat docs/sql/20261001_seg4_2fa_admin.sql) \
--   | docker exec -i supabase_db_evokaa psql -U postgres -v ON_ERROR_STOP=1
--   → "ERROR: 1 admin(s) sem 2FA confirmado (x@teste-seg4.evokaa.invalid) …" e a conexão fecha sem commit.
-- =============================================================================
-- begin;
-- create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void language plpgsql as $f$
-- begin
--   perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
--     'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
--   perform set_config('role', p_role, true);
-- end $f$;
-- grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated, service_role;
--
-- -- Dados: admin com fator (1), admin sem fator (2, criado depois da aplicação), produtor (3) e participante (4)
-- -- sem fator; evento rascunho do produtor e pedido do participante.
-- insert into auth.users (id, email, raw_user_meta_data) values
--   ('5e400000-0000-4000-8000-000000000001', 'admin@teste-seg4.evokaa.invalid', '{}'),
--   ('5e400000-0000-4000-8000-000000000002', 'admin2@teste-seg4.evokaa.invalid', '{}'),
--   ('5e400000-0000-4000-8000-000000000003', 'produtor@teste-seg4.evokaa.invalid', '{"role":"producer"}'),
--   ('5e400000-0000-4000-8000-000000000004', 'participante@teste-seg4.evokaa.invalid', '{}');
-- update public.profiles set role = 'admin', admin_permissions = '{super_admin}'
--   where id in ('5e400000-0000-4000-8000-000000000001', '5e400000-0000-4000-8000-000000000002');
-- insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
--   values (gen_random_uuid(), '5e400000-0000-4000-8000-000000000001', 'seg4', 'totp', 'verified', now(), now(), 'x');
-- insert into public.events (id, producer_id, title, slug, status, approval_status) values
--   ('5e400000-0000-4000-8000-000000000101', '5e400000-0000-4000-8000-000000000003', 'Rascunho seg4', 'seg4-a', 'draft', 'pending');
-- insert into public.orders (id, event_id, user_id)
--   values ('5e400000-0000-4000-8000-000000000201', '5e400000-0000-4000-8000-000000000101', '5e400000-0000-4000-8000-000000000004');
--
-- -- T0. Admin com fator e aal2: é admin, lê o rascunho de outro produtor e altera papel de outra conta.
-- do $t$ begin
--   perform pg_temp.como('authenticated', '5e400000-0000-4000-8000-000000000001', 'aal2');
--   assert public.gf_is_admin(), 'admin com fator em aal2 não é admin';
--   assert public.gf_admin_can('manage_users'), 'super_admin em aal2 sem manage_users';
--   assert (select count(*) from public.events where slug = 'seg4-a') = 1, 'admin aal2 não lê o rascunho';
--   update public.profiles set role = 'producer' where id = '5e400000-0000-4000-8000-000000000004';
--   update public.profiles set role = 'user' where id = '5e400000-0000-4000-8000-000000000004';
--   perform pg_temp.como('postgres');
--   raise notice 'T0 OK: admin com fator e aal2 segue admin';
-- end $t$;
--
-- -- T1. Admin com fator e aal1: não é admin (e a regra gf_mfa_aal2 já barra as tabelas).
-- do $t$ begin
--   perform pg_temp.como('authenticated', '5e400000-0000-4000-8000-000000000001', 'aal1');
--   assert not public.gf_is_admin(), 'admin com fator em aal1 ainda é admin';
--   assert not public.gf_admin_can('super_admin'), 'admin com fator em aal1 ainda tem super_admin';
--   assert (select count(*) from public.events where slug = 'seg4-a') = 0, 'admin aal1 lê o rascunho';
--   perform pg_temp.como('postgres');
--   raise notice 'T1 OK: admin com fator em aal1 perde o admin';
-- end $t$;
--
-- -- T2. Admin sem fator, com aal1 e com "aal2" forjado no claim: não é admin, não lê o que é de admin e o
-- --     gatilho gf_protect_profile_privileges recusa mudar papel; o próprio perfil ele lê.
-- do $t$
-- declare a text;
-- begin
--   foreach a in array array['aal1', 'aal2'] loop
--     perform pg_temp.como('authenticated', '5e400000-0000-4000-8000-000000000002', a);
--     assert not public.gf_is_admin(), 'admin sem fator é admin em ' || a;
--     assert not public.gf_admin_can('super_admin'), 'admin sem fator tem super_admin em ' || a;
--     assert (select count(*) from public.events where slug = 'seg4-a') = 0, 'admin sem fator lê o rascunho em ' || a;
--     assert (select count(*) from public.profiles where id = '5e400000-0000-4000-8000-000000000002') = 1, 'não lê o próprio perfil';
--     begin
--       update public.profiles set role = 'producer' where id = '5e400000-0000-4000-8000-000000000004';
--       -- sem manage_users a regra de update de profiles nem enxerga a linha: 0 linhas, sem erro
--       assert not found, 'admin sem fator mudou o papel de outra conta em ' || a;
--     exception when insufficient_privilege then null;
--     end;
--     -- gatilho gf_protect_profile_privileges: campo protegido no próprio perfil exige gf_admin_can('manage_users')
--     begin
--       update public.profiles set is_verified = true where id = '5e400000-0000-4000-8000-000000000002';
--       raise exception 'admin sem fator alterou campo protegido em %', a;
--     exception when insufficient_privilege then null;
--     end;
--   end loop;
--   perform pg_temp.como('postgres');
--   assert (select role from public.profiles where id = '5e400000-0000-4000-8000-000000000004') = 'user', 'papel mudou';
--   raise notice 'T2 OK: admin sem fator (aal1 ou aal2 forjado) não é admin';
-- end $t$;
--
-- -- T3. Produtor e participante sem fator (aal1) continuam lendo o que é deles, sem erro.
-- do $t$ begin
--   perform pg_temp.como('authenticated', '5e400000-0000-4000-8000-000000000003', 'aal1');
--   assert not public.gf_is_admin(), 'produtor virou admin';
--   assert (select count(*) from public.events where slug = 'seg4-a') = 1, 'produtor não lê o próprio rascunho';
--   perform pg_temp.como('authenticated', '5e400000-0000-4000-8000-000000000004', 'aal1');
--   assert (select count(*) from public.orders where id = '5e400000-0000-4000-8000-000000000201') = 1, 'participante não lê o próprio pedido';
--   assert (select count(*) from public.profiles where id = '5e400000-0000-4000-8000-000000000004') = 1, 'participante não lê o próprio perfil';
--   perform pg_temp.como('postgres');
--   raise notice 'T3 OK: produtor e participante sem 2FA seguem iguais';
-- end $t$;
--
-- -- T4. Promover a admin exige 2FA confirmado na conta promovida; gf_tem_2fa só responde a quem pode saber.
-- --     Produtor (3) ganha fator; participante (4) segue sem. Controle negativo: com o gatilho antigo (bloco
-- --     "Desfazer" b, sem o drop), o caso "sem fator" passa e este T4 falha em 'promoveu conta sem 2FA'.
-- do $t$
-- declare m text;
-- begin
--   insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
--     values (gen_random_uuid(), '5e400000-0000-4000-8000-000000000003', 'seg4', 'totp', 'verified', now(), now(), 'x');
--   -- usuário comum: sobre outra conta, null; sobre si, a resposta de verdade
--   perform pg_temp.como('authenticated', '5e400000-0000-4000-8000-000000000004', 'aal1');
--   assert public.gf_tem_2fa('5e400000-0000-4000-8000-000000000003') is null, 'comum soube do 2FA de outra conta';
--   assert public.gf_tem_2fa('5e400000-0000-4000-8000-000000000004') = false, 'comum sem fator: não deu false para si';
--   perform pg_temp.como('authenticated', '5e400000-0000-4000-8000-000000000003', 'aal1');
--   assert public.gf_tem_2fa('5e400000-0000-4000-8000-000000000003') = true, 'produtor com fator: não deu true para si';
--   -- admin sem fator (não é super_admin de fato) também não sabe dos outros
--   perform pg_temp.como('authenticated', '5e400000-0000-4000-8000-000000000002', 'aal2');
--   assert public.gf_tem_2fa('5e400000-0000-4000-8000-000000000003') is null, 'admin sem fator soube do 2FA de outra conta';
--   -- super_admin em aal2: com fator promove; sem fator, 42501 com a mensagem
--   perform pg_temp.como('authenticated', '5e400000-0000-4000-8000-000000000001', 'aal2');
--   assert public.gf_tem_2fa('5e400000-0000-4000-8000-000000000004') = false, 'super_admin não soube do 2FA';
--   update public.profiles set role = 'admin' where id = '5e400000-0000-4000-8000-000000000003';
--   assert found, 'super_admin não promoveu conta com fator';
--   begin
--     update public.profiles set role = 'admin' where id = '5e400000-0000-4000-8000-000000000004';
--     raise exception 'promoveu conta sem 2FA';
--   exception when insufficient_privilege then
--     get stacked diagnostics m = message_text;
--     assert m = 'Só dá para promover a admin uma conta com 2FA confirmado.', 'mensagem errada: ' || m;
--   end;
--   -- chave de serviço sabe, e também não promove sem fator
--   perform pg_temp.como('service_role');
--   assert public.gf_tem_2fa('5e400000-0000-4000-8000-000000000003') = true, 'service_role não soube do 2FA';
--   begin
--     update public.profiles set role = 'admin' where id = '5e400000-0000-4000-8000-000000000004';
--     raise exception 'service_role promoveu conta sem 2FA';
--   exception when insufficient_privilege then null;
--   end;
--   -- dono do banco (SQL Editor): emergência, promove sem fator
--   perform pg_temp.como('postgres');
--   update public.profiles set role = 'admin' where id = '5e400000-0000-4000-8000-000000000004';
--   assert found, 'postgres não promoveu';
--   assert (select count(*) from public.profiles where role = 'admin' and id in
--     ('5e400000-0000-4000-8000-000000000003', '5e400000-0000-4000-8000-000000000004')) = 2, 'papéis não gravaram';
--   raise notice 'T4 OK: só vira admin quem tem 2FA (dono do banco livre); gf_tem_2fa não vaza';
-- end $t$;
-- rollback;
