-- =============================================================================
-- Tabela user_activities (rastreamento de navegação) — 2026-09-27
-- APLICADA MANUALMENTE em produção (projeto rwaezeqyuhxrssntcxdv) via Supabase MCP.
-- NÃO mover para supabase/migrations/ (motivo em docs/sql/20260927_security_hardening.sql).
--
-- Origem: app/src/lib/tracking.ts grava em user_activities a cada página (com consentimento
-- de cookies analíticos) e as telas de admin (Analytics, Users, AdminSettings) leem dela.
-- A tabela nunca existiu no banco: a migration supabase/migrations/00000000000008_user_tracking_system.sql
-- (raiz do repositório) não foi aplicada, e cada página gerava um erro no console.
-- Base: essa migration, com quatro ajustes:
--   - INSERT só com user_id nulo ou igual ao próprio usuário (ninguém grava em nome de outro);
--   - event_type restrito à lista que o código envia;
--   - leitura de admin via gf_is_admin(), padrão das demais policies;
--   - tetos de tamanho em session_id, path e metadata (INSERT anônimo sem limite enche a tabela).
-- Junto com este SQL, o código passou a exigir consentimento de cookies para TODOS os eventos
-- (antes só page_view) e deixou de gravar o e-mail no evento de login (LGPD, minimização).
-- Idempotente. Não altera dados.
-- =============================================================================

create table if not exists public.user_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade, -- nulo para visitante anônimo
  session_id text not null check (length(session_id) <= 64),      -- id de sessão gerado no navegador
  event_type text not null
    check (event_type in ('session_start','page_view','login','logout','add_to_cart','purchase','session_end')),
  path text check (length(path) <= 2048),
  metadata jsonb not null default '{}'::jsonb check (pg_column_size(metadata) <= 4096),
  created_at timestamptz not null default now()
);

create index if not exists idx_user_activities_user_id on public.user_activities(user_id);
create index if not exists idx_user_activities_session_id on public.user_activities(session_id);
create index if not exists idx_user_activities_created_at on public.user_activities(created_at desc);

alter table public.user_activities enable row level security;

-- Privilégios explícitos (não depender dos padrões do Supabase): site só insere; leitura só logado.
revoke all on public.user_activities from anon, authenticated;
grant insert on public.user_activities to anon, authenticated;
grant select on public.user_activities to authenticated;

drop policy if exists "user_activities_insert_own" on public.user_activities;
create policy "user_activities_insert_own" on public.user_activities
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

drop policy if exists "user_activities_select_admin" on public.user_activities;
create policy "user_activities_select_admin" on public.user_activities
  for select to authenticated
  using (public.gf_is_admin());

drop policy if exists "user_activities_select_own" on public.user_activities;
create policy "user_activities_select_own" on public.user_activities
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Sem UPDATE/DELETE pelo site: só o service_role (painel do Supabase) apaga logs.
