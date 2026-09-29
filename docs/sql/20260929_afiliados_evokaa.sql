-- Afiliados Evokaa (idempotente) — Decisão 64, 29/09/2026.
-- São os afiliados que revendem a PLATAFORMA aos produtores. Não confundir com `affiliates`,
-- que são os afiliados de EVENTO que o produtor cadastra.
-- Comissão: 50% do valor do plano na 1ª venda (regra geral, no cálculo da Fase 4) e recorrência
-- de 15% a 25% conforme o acordo de cada afiliado (recurring_percent). Nenhuma comissão é paga
-- enquanto a cobrança de planos não existir.

create table if not exists public.platform_affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id),
  referral_code text not null,
  recurring_percent numeric not null check (recurring_percent between 15 and 25),
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  agreement_date date not null default current_date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_affiliates_code_chk check (referral_code ~ '^[A-Z0-9_-]{3,30}$')
);

create unique index if not exists platform_affiliates_code_upper_idx
  on public.platform_affiliates (upper(referral_code));

-- Carteira: cada produtor pertence a no máximo UM afiliado (chave primária = produtor),
-- senão duas pessoas receberiam a recorrência do mesmo cliente.
create table if not exists public.platform_affiliate_producers (
  producer_id uuid primary key references public.profiles(id),
  affiliate_id uuid not null references public.platform_affiliates(id),
  source text not null default 'manual' check (source in ('manual', 'coupon', 'link')),
  linked_at timestamptz not null default now(),
  linked_by uuid references public.profiles(id)
);

create index if not exists platform_affiliate_producers_affiliate_idx
  on public.platform_affiliate_producers (affiliate_id);

alter table public.platform_affiliates enable row level security;
alter table public.platform_affiliate_producers enable row level security;

-- Admin gerencia tudo
drop policy if exists "Admin gerencia afiliados evokaa" on public.platform_affiliates;
create policy "Admin gerencia afiliados evokaa" on public.platform_affiliates
  for all to authenticated
  using ((select public.gf_is_admin()))
  with check ((select public.gf_is_admin()));

drop policy if exists "Admin gerencia carteira de afiliados" on public.platform_affiliate_producers;
create policy "Admin gerencia carteira de afiliados" on public.platform_affiliate_producers
  for all to authenticated
  using ((select public.gf_is_admin()))
  with check ((select public.gf_is_admin()));

-- O afiliado só LÊ o próprio cadastro e a própria carteira (área dele vem numa etapa seguinte)
drop policy if exists "Afiliado le o proprio cadastro" on public.platform_affiliates;
create policy "Afiliado le o proprio cadastro" on public.platform_affiliates
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Afiliado le a propria carteira" on public.platform_affiliate_producers;
create policy "Afiliado le a propria carteira" on public.platform_affiliate_producers
  for select to authenticated
  using (affiliate_id in (select id from public.platform_affiliates where user_id = (select auth.uid())));

-- Conferência:
-- select tablename, policyname, cmd from pg_policies where tablename like 'platform_affiliate%';
