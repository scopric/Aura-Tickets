-- Cupons do admin = cupons dos PLANOS que a Evokaa vende aos produtores (idempotente).
-- Decisão do Ricardo em 29/09/2026: cupom de EVENTO é do produtor (ele cria e paga, padrão do
-- mercado); o admin só cria cupom de plano (starter, pro, enterprise).
-- Cupom do admin = producer_id NULL: a regra "Produtor gerencia coupons" (producer_id = auth.uid())
-- nunca o alcança. Tabela vazia em 29/09/2026 (conferido), então os CHECKs entram sem conflito.
-- Duração no mesmo formato do Stripe (docs.stripe.com/api/coupons/object, lido em 29/09/2026):
-- once = só na 1ª cobrança; repeating = nos primeiros N meses; forever = toda a assinatura.

alter table public.coupons alter column producer_id drop not null;

alter table public.coupons
  add column if not exists description text,
  add column if not exists valid_from timestamptz,
  add column if not exists max_uses_per_user integer,
  add column if not exists min_order_value numeric,
  add column if not exists max_discount numeric,
  add column if not exists audience text not null default 'all',
  add column if not exists plans text[],
  add column if not exists duration text,
  add column if not exists duration_months integer,
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists updated_at timestamptz not null default now();

-- first_subscription vale para plano; first_purchase fica para o cupom de evento do produtor
do $$ begin
  alter table public.coupons add constraint coupons_audience_chk
    check (audience in ('all', 'first_purchase', 'first_subscription', 'private'));
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
       and (max_discount is null or max_discount > 0)
       and uses >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.coupons add constraint coupons_plans_chk
    check (plans is null or plans <@ array['starter', 'pro', 'enterprise']::text[]);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.coupons add constraint coupons_duracao_chk
    check ((duration is null and duration_months is null)
        or (duration in ('once', 'forever') and duration_months is null)
        or (duration = 'repeating' and duration_months between 1 and 36));
exception when duplicate_object then null; end $$;

-- Cupom do admin é de plano (tem duração, não tem evento); cupom de produtor é de evento
-- (sem plano, sem duração). A regra antiga do produtor aceita qualquer usuário logado:
-- sem isto, um cupom "de produtor" poderia se declarar válido para planos.
do $$ begin
  alter table public.coupons add constraint coupons_tipo_chk
    check ((producer_id is null and event_id is null and duration is not null)
        or (producer_id is not null and plans is null and duration is null));
exception when duplicate_object then null; end $$;

-- "BLACK10" e "black10" seriam dois cupons diferentes com o UNIQUE(code) que já existe
create unique index if not exists coupons_code_upper_idx on public.coupons (upper(code));

-- Admin lê todos os cupons (supervisão) e grava só os de plano (producer_id NULL)
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
-- select conname from pg_constraint where conrelid = 'public.coupons'::regclass order by 1;
