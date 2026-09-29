-- Cupons criados pelo admin (idempotente).
-- Cupom do admin = producer_id NULL. A regra "Produtor gerencia coupons" (producer_id = auth.uid())
-- continua valendo só para os cupons do próprio produtor; nenhum produtor edita cupom do admin.
-- O alcance do cupom do admin fica nas listas abaixo (vazio/NULL = vale para todos).
-- Tabela vazia em 29/09/2026 (conferido), então os CHECKs e o índice entram sem conflito.

alter table public.coupons alter column producer_id drop not null;

alter table public.coupons
  add column if not exists description text,
  add column if not exists valid_from timestamptz,
  add column if not exists max_uses_per_user integer,
  add column if not exists min_order_value numeric,
  add column if not exists max_discount numeric,
  add column if not exists audience text not null default 'all',
  add column if not exists event_ids uuid[],
  add column if not exists producer_ids uuid[],
  add column if not exists categories text[],
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.coupons add constraint coupons_audience_chk
    check (audience in ('all', 'first_purchase', 'newsletter', 'private'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.coupons add constraint coupons_value_chk
    check (discount_value > 0 and (discount_type <> 'percent' or discount_value <= 100));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.coupons add constraint coupons_periodo_chk
    check (valid_from is null or valid_until is null or valid_until > valid_from);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.coupons add constraint coupons_limites_chk
    check ((max_uses is null or max_uses >= 1)
       and (max_uses_per_user is null or max_uses_per_user >= 1)
       and (min_order_value is null or min_order_value >= 0)
       and (max_discount is null or max_discount > 0));
exception when duplicate_object then null; end $$;

-- As listas de alcance são só do cupom do admin: a regra antiga do produtor aceita qualquer
-- usuário logado, e sem isto um cupom "de produtor" poderia se declarar válido em eventos e
-- produtores alheios. A coluna antiga event_id fica só para cupom de produtor.
do $$ begin
  alter table public.coupons add constraint coupons_alcance_admin_chk
    check (producer_id is null or (event_ids is null and producer_ids is null and categories is null));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.coupons add constraint coupons_event_id_produtor_chk
    check (producer_id is not null or event_id is null);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.coupons add constraint coupons_uses_chk check (uses >= 0);
exception when duplicate_object then null; end $$;

-- "BLACK10" e "black10" seriam dois cupons diferentes com o UNIQUE(code) que já existe
create unique index if not exists coupons_code_upper_idx on public.coupons (upper(code));

-- Admin lê todos os cupons (supervisão) e grava só os da plataforma (producer_id NULL)
drop policy if exists "Admin le coupons" on public.coupons;
create policy "Admin le coupons" on public.coupons
  for select to authenticated
  using ((select public.gf_is_admin()));

drop policy if exists "Admin gerencia coupons da plataforma" on public.coupons;
create policy "Admin gerencia coupons da plataforma" on public.coupons
  for all to authenticated
  using (producer_id is null and (select public.gf_is_admin()))
  with check (producer_id is null and (select public.gf_is_admin()));

-- Conferência:
-- select policyname, cmd from pg_policies where tablename = 'coupons';
-- select conname from pg_constraint where conrelid = 'public.coupons'::regclass;
