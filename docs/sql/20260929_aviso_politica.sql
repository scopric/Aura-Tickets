-- =============================================================================
-- Aviso por e-mail da nova Política de Privacidade (versão 2026-09-29) — banco — 2026-09-29
-- Aplicar à mão no SQL Editor do Supabase. NÃO vai para supabase/migrations (Decisão 02).
-- Quem usa: a Edge Function "aviso-politica" (service_role), disparada por um admin.
-- policy_notices guarda quem já recebeu cada versão: é o que faz o envio ser único
-- (a função pula quem já tem linha). Ninguém do navegador lê nem grava: RLS ligada, sem políticas.
-- O Supabase dá EXECUTE/ALL a anon e authenticated por padrão (default privileges): por isso
-- cada função e tabela tem revoke explícito seguido do grant mínimo.
-- Idempotente: pode rodar de novo.
-- =============================================================================
begin;

-- 1. Quem já recebeu o aviso de cada versão da política.
create table if not exists public.policy_notices (
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null check (char_length(version) between 8 and 20),
  sent_at timestamptz not null default now(),
  primary key (user_id, version)
);
alter table public.policy_notices enable row level security;
revoke all on public.policy_notices from public, anon, authenticated;

-- 2. Destinatários ainda não avisados desta versão: conta ativa (sem deleted_at), e-mail
--    confirmado e não anonimizado pela exclusão de conta (removido-<uid>@anonimo.evokaa.com.br).
create or replace function public.aviso_politica_destinatarios(p_version text)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text
  from auth.users u
  where u.deleted_at is null
    and u.email_confirmed_at is not null
    and u.email is not null
    and u.email not ilike '%@anonimo.evokaa.com.br'
    -- exclusão de conta que parou no meio: o perfil já foi anonimizado, mas o login ainda existe
    and not exists (
      select 1 from public.profiles p
      where p.id = u.id and p.email ilike '%@anonimo.evokaa.com.br'
    )
    -- contas de teste: aura.com é domínio real de terceiros (contas antigas do tempo "Aura");
    -- domínios de teste não existem e voltariam como devolução (reputação do domínio de envio)
    and split_part(lower(u.email), '@', 2) not in ('aura.com', 'aura.teste')
    and u.email !~* '\.(test|teste|invalid|example|localhost)$'
    and not exists (
      select 1 from public.policy_notices n
      where n.user_id = u.id and n.version = p_version
    )
  order by u.created_at;
$$;

-- 3. Registra que o usuário recebeu o aviso desta versão (chamado depois do 2xx da Resend).
create or replace function public.aviso_politica_registrar(p_user uuid, p_version text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.policy_notices (user_id, version)
  values (p_user, p_version)
  on conflict do nothing;
$$;

-- 4. Só o servidor (service_role) executa.
revoke all on function public.aviso_politica_destinatarios(text) from public, anon, authenticated, service_role;
grant execute on function public.aviso_politica_destinatarios(text) to service_role;

revoke all on function public.aviso_politica_registrar(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.aviso_politica_registrar(uuid, text) to service_role;

commit;

-- =============================================================================
-- TESTES (rodar à mão no editor SQL; cada bloco desfaz tudo no fim)
-- =============================================================================
--
-- T1. Privilégios: anon e authenticated não leem a tabela nem executam as funções.
-- select has_table_privilege('anon', 'public.policy_notices', 'select') as anon_sel,                          -- false
--        has_table_privilege('authenticated', 'public.policy_notices', 'select') as authn_sel,                -- false
--        has_table_privilege('authenticated', 'public.policy_notices', 'insert') as authn_ins,                -- false
--        has_function_privilege('anon', 'public.aviso_politica_destinatarios(text)', 'execute') as anon_dest, -- false
--        has_function_privilege('authenticated', 'public.aviso_politica_destinatarios(text)', 'execute') as authn_dest, -- false
--        has_function_privilege('authenticated', 'public.aviso_politica_registrar(uuid, text)', 'execute') as authn_reg,   -- false
--        has_function_privilege('service_role', 'public.aviso_politica_destinatarios(text)', 'execute') as srv_dest,       -- true
--        has_function_privilege('service_role', 'public.aviso_politica_registrar(uuid, text)', 'execute') as srv_reg;      -- true
--
-- T2. Destinatários excluem deletado, não confirmado, anonimizado (no login ou só no perfil), domínios de
--     teste e já avisado; registrar é idempotente. (e-mails de teste em domínio que PASSA no filtro)
-- begin;
-- do $$
-- declare
--   ok uuid := gen_random_uuid(); del uuid := gen_random_uuid(); nc uuid := gen_random_uuid();
--   an uuid := gen_random_uuid(); av uuid := gen_random_uuid(); pa uuid := gen_random_uuid();
--   at uuid := gen_random_uuid(); ac uuid := gen_random_uuid(); tl uuid := gen_random_uuid();
--   lista uuid[];
-- begin
--   insert into auth.users (id, email, email_confirmed_at, deleted_at, created_at) values
--     (ok,  't-ok@evokaa-teste.com.br',  now(), null,  now()),
--     (del, 't-del@evokaa-teste.com.br', now(), now(), now()),
--     (nc,  't-nc@evokaa-teste.com.br',  null,  null,  now()),
--     (an,  'removido-' || an || '@ANONIMO.evokaa.com.br', now(), null, now()),
--     (av,  't-av@evokaa-teste.com.br',  now(), null,  now()),
--     (pa,  't-pa@evokaa-teste.com.br',  now(), null,  now()),   -- exclusão parou no meio: perfil anonimizado
--     (at,  'produtor@aura.teste',       now(), null,  now()),
--     (ac,  'admin@aura.com',            now(), null,  now()),
--     (tl,  't-tl@alguma.invalid',       now(), null,  now());
--   insert into public.profiles (id, email) values (pa, 'removido-' || pa || '@anonimo.evokaa.com.br');
--   perform public.aviso_politica_registrar(av, 'teste-v1');
--   perform public.aviso_politica_registrar(av, 'teste-v1');  -- 2ª vez: sem erro, sem duplicar
--   assert (select count(*) from public.policy_notices where user_id = av) = 1, 'registrar duplicou';
--   select array_agg(d.user_id) into lista from public.aviso_politica_destinatarios('teste-v1') d
--   where d.user_id in (ok, del, nc, an, av, pa, at, ac, tl);
--   assert lista = array[ok], format('esperado só ok, veio %s', lista);
--   -- outra versão: quem foi avisado da teste-v1 volta a ser destinatário
--   assert exists (select 1 from public.aviso_politica_destinatarios('teste-v2') d where d.user_id = av), 'versão não separa';
--   raise notice 'T2 OK';
-- end $$;
-- rollback;
--
-- T3. authenticated não executa as funções.
-- begin;
-- set local role authenticated;
-- select * from public.aviso_politica_destinatarios('2026-09-29');  -- esperado: ERROR 42501 permission denied for function
-- rollback;
