-- =============================================================================
-- Registros de acesso (Marco Civil da Internet, art. 15) e prova de aceite dos
-- Termos e da Política (LGPD, art. 8º, § 2º). Evokaa — 28/09/2026.
--
-- Aplicar pelo Ricardo no SQL Editor do Supabase (Decisões 02 e 16). Idempotente.
-- Quem grava é só a Edge Function `record-access` (chave de serviço): nenhuma
-- regra libera INSERT/UPDATE/DELETE para o site.
-- =============================================================================

-- 1. Registros de acesso: data/hora + IP de cada login, guardados por 6 meses
--    (art. 15 do Marco Civil: "registros de acesso a aplicações de internet").
create table if not exists public.access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,                     -- sem FK de propósito: o registro precisa sobreviver à conta
  event text not null default 'login' check (event in ('login')),
  ip inet,                          -- candidato (cf-connecting-ip ou 1º do x-forwarded-for)
  forwarded_for text check (length(forwarded_for) <= 200),  -- cadeia completa: o cliente não apaga o fim
  user_agent text check (length(user_agent) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists access_logs_created_at_idx on public.access_logs (created_at);
create index if not exists access_logs_user_id_idx on public.access_logs (user_id);
alter table public.access_logs enable row level security;
-- sem policies: só service_role lê e grava (sigilo, art. 15)
revoke all on public.access_logs from anon, authenticated;

-- 2. Aceites: qual versão dos Termos/Política a pessoa aceitou, quando e de onde.
--    A prova é recorded_at + ip (servidor); accepted_at é o que o cliente informou no cadastro.
create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,            -- sem FK: a prova do aceite fica mesmo se a conta for apagada
  terms_version text not null check (length(terms_version) <= 20),
  privacy_version text not null check (length(privacy_version) <= 20),
  marketing_consent boolean not null default false,
  data_sharing_consent boolean not null default false,
  accepted_at timestamptz not null,          -- momento do cadastro (metadados do signUp)
  recorded_at timestamptz not null default now(),  -- momento em que o servidor gravou (1º login)
  ip inet,
  forwarded_for text check (length(forwarded_for) <= 200),
  user_agent text check (length(user_agent) <= 300),
  unique (user_id, terms_version, privacy_version)
);
alter table public.user_consents enable row level security;
revoke all on public.user_consents from anon, authenticated;
-- a pessoa pode ver o próprio aceite (direito de acesso, art. 18, II)
grant select on public.user_consents to authenticated;
drop policy if exists user_consents_select_own on public.user_consents;
create policy user_consents_select_own on public.user_consents
  for select to authenticated using (user_id = auth.uid());

-- 3. Limpeza automática: acessos com mais de 6 meses saem todo dia às 03:17 UTC.
create extension if not exists pg_cron;
select cron.unschedule('limpar_access_logs') where exists (select 1 from cron.job where jobname = 'limpar_access_logs');
select cron.schedule('limpar_access_logs', '17 3 * * *',
  $$delete from public.access_logs where created_at < now() - interval '6 months'$$);

-- Conferência:
-- select jobname, schedule, command from cron.job;
-- select count(*) from public.access_logs; select count(*) from public.user_consents;
