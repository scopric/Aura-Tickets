-- ATENÇÃO (30/09/2026): este arquivo recria funções que docs/sql/20260930_2fa_no_banco.sql protege com o
-- 2FA. Se for rodado de novo, rode também o 20260930_2fa_no_banco.sql logo depois.
-- Afiliados Evokaa v2 (idempotente) — Decisões 64 e 65, pedidos do Ricardo em 29/09/2026:
--   1. cadastro completo do afiliado (nome, CPF, nascimento, endereço, e-mail, telefone, WhatsApp);
--   2. conta de recebimento do afiliado no gateway (para o split — gateway ainda não definido);
--   3. rastreio pelo link/código do afiliado no cadastro do produtor;
--   4. histórico completo dos produtores indicados (vínculo encerrado não é apagado);
--   5. cupom do afiliado (pedido pelo afiliado, criado pelo admin) e cupom de upgrade.
-- Depende de 20260929_cupons_admin.sql e 20260929_afiliados_evokaa.sql (aplicados em 29/09).
-- Tabelas de afiliados, indicados e cupons vazias em 29/09/2026 (conferido): as mudanças de
-- chave e os CHECKs entram sem conflito.

-- ---------------------------------------------------------------------------------------------
-- 0. Planos (Decisão 67): Evo Free, Evo Starter, Evo Plus, Evo Pro e Evo Enterprise.
-- O banco só conhecia free/starter/pro/enterprise; entra o 'plus'.
-- ---------------------------------------------------------------------------------------------
alter table public.producer_subscriptions drop constraint if exists producer_subscriptions_plan_check;
alter table public.producer_subscriptions add constraint producer_subscriptions_plan_check
  check (plan in ('free', 'starter', 'plus', 'pro', 'enterprise'));

alter table public.coupons drop constraint if exists coupons_plans_chk;
alter table public.coupons add constraint coupons_plans_chk
  check (plans is null or plans <@ array['starter', 'plus', 'pro', 'enterprise']::text[]);

-- ---------------------------------------------------------------------------------------------
-- 1 e 2. Cadastro completo + conta de recebimento
-- Dados pessoais (LGPD): finalidade = contrato de afiliação, pagamento da comissão e obrigações
-- fiscais. Leitura só pelo admin e pelo próprio afiliado (políticas já existentes).
-- ---------------------------------------------------------------------------------------------

-- CPF: 11 dígitos, não repetidos, com os dois dígitos verificadores corretos
create or replace function public.gf_cpf_valido(p text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  d int[];
  s int;
  i int;
  dv1 int;
  dv2 int;
begin
  if p is null or p !~ '^[0-9]{11}$' or p ~ '^(.)\1{10}$' then
    return false;
  end if;
  d := array(select substr(p, g, 1)::int from generate_series(1, 11) g);
  s := 0;
  for i in 1..9 loop s := s + d[i] * (11 - i); end loop;
  dv1 := case when s % 11 < 2 then 0 else 11 - s % 11 end;
  s := 0;
  for i in 1..10 loop s := s + d[i] * (12 - i); end loop;
  dv2 := case when s % 11 < 2 then 0 else 11 - s % 11 end;
  return d[10] = dv1 and d[11] = dv2;
end;
$$;

alter table public.platform_affiliates
  add column if not exists full_name text,
  add column if not exists cpf text,
  add column if not exists birth_date date,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists whatsapp text,
  add column if not exists cep text,
  add column if not exists street text,
  add column if not exists street_number text,
  add column if not exists complement text,
  add column if not exists neighborhood text,
  add column if not exists city text,
  add column if not exists state text,
  -- id da conta do afiliado no gateway que fizer o split (ex.: walletId no Asaas).
  -- Genérico de propósito: o gateway ainda não foi escolhido (Ricardo, 29/09/2026).
  add column if not exists payout_account_id text;

do $$ begin
  alter table public.platform_affiliates add constraint platform_affiliates_dados_chk
    check ((cpf is null or public.gf_cpf_valido(cpf))
       and (birth_date is null or birth_date between date '1900-01-01' and current_date - interval '18 years')
       and (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
       and (phone is null or phone ~ '^[0-9]{10,13}$')
       and (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$')
       and (cep is null or cep ~ '^[0-9]{8}$')
       and (state is null or state ~ '^[A-Z]{2}$')
       and (full_name is null or char_length(full_name) between 3 and 150));
exception when duplicate_object then null; end $$;

create unique index if not exists platform_affiliates_cpf_idx
  on public.platform_affiliates (cpf) where cpf is not null;
create unique index if not exists platform_affiliates_payout_idx
  on public.platform_affiliates (payout_account_id) where payout_account_id is not null;

-- As políticas de indicados foram renomeadas ("carteira" → "indicados", Decisão 64). Se o arquivo
-- antigo for rodado de novo, os nomes antigos voltariam em dobro; aqui garantimos só os novos.
drop policy if exists "Admin gerencia carteira de afiliados" on public.platform_affiliate_producers;
drop policy if exists "Afiliado le a propria carteira" on public.platform_affiliate_producers;
drop policy if exists "Admin gerencia indicados de afiliados" on public.platform_affiliate_producers;
create policy "Admin gerencia indicados de afiliados" on public.platform_affiliate_producers
  for all to authenticated
  using ((select public.gf_is_admin()))
  with check ((select public.gf_is_admin()));
drop policy if exists "Afiliado le os proprios indicados" on public.platform_affiliate_producers;
create policy "Afiliado le os proprios indicados" on public.platform_affiliate_producers
  for select to authenticated
  using (affiliate_id in (select id from public.platform_affiliates where user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------------------------
-- 3 e 4. Indicados com histórico e origem do vínculo
-- Antes: 1 linha por produtor (PK = producer_id) e "retirar" apagava a linha. Agora o vínculo
-- é encerrado (ended_at) e fica no histórico; continua valendo no máximo UM vínculo ATIVO
-- por produtor (índice único parcial), para duas pessoas não receberem pelo mesmo cliente.
-- ---------------------------------------------------------------------------------------------

alter table public.platform_affiliate_producers
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists ref_first_seen_at timestamptz,   -- quando o link do afiliado foi aberto
  add column if not exists ended_at timestamptz,
  add column if not exists ended_by uuid references public.profiles(id),
  add column if not exists end_reason text check (char_length(end_reason) <= 500);

do $$
begin
  -- troca a chave primária de producer_id para id (só na primeira execução)
  if exists (
    select 1 from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.platform_affiliate_producers'::regclass
      and c.contype = 'p' and a.attname = 'producer_id'
  ) then
    alter table public.platform_affiliate_producers drop constraint platform_affiliate_producers_pkey;
    alter table public.platform_affiliate_producers add constraint platform_affiliate_producers_pkey primary key (id);
  end if;
end $$;

create unique index if not exists platform_affiliate_producers_ativo_idx
  on public.platform_affiliate_producers (producer_id) where ended_at is null;

-- 'code' = o produtor digitou o código no cadastro; 'link' = veio pelo link do afiliado
alter table public.platform_affiliate_producers drop constraint if exists platform_affiliate_producers_source_check;
do $$ begin
  alter table public.platform_affiliate_producers add constraint platform_affiliate_producers_source_chk
    check (source in ('manual', 'link', 'code', 'coupon'));
exception when duplicate_object then null; end $$;

-- Links do afiliado (Ricardo, 29/09/2026): cada afiliado cria links com o nome que quiser
-- ("instagram", "grupo-whatsapp"); o link público é www.evokaa.com.br/p/CODIGO/nome e cai na
-- seção de planos. Guardamos cliques (só um contador, sem dado pessoal) e de qual link veio
-- cada produtor indicado.
create table if not exists public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.platform_affiliates(id),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 40),
  label text check (char_length(label) <= 80),
  clicks integer not null default 0 check (clicks >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (affiliate_id, slug)
);

alter table public.affiliate_links enable row level security;

drop policy if exists "Admin gerencia links de afiliado" on public.affiliate_links;
create policy "Admin gerencia links de afiliado" on public.affiliate_links
  for all to authenticated
  using ((select public.gf_is_admin()))
  with check ((select public.gf_is_admin()));

drop policy if exists "Afiliado le os proprios links" on public.affiliate_links;
create policy "Afiliado le os proprios links" on public.affiliate_links
  for select to authenticated
  using (affiliate_id in (select id from public.platform_affiliates where user_id = (select auth.uid())));

-- Afiliado ATIVO cria link só para si, começando com 0 clique
drop policy if exists "Afiliado ativo cria link" on public.affiliate_links;
create policy "Afiliado ativo cria link" on public.affiliate_links
  for insert to authenticated
  with check (
    affiliate_id in (select id from public.platform_affiliates where user_id = (select auth.uid()) and status = 'active')
    and clicks = 0
  );

-- Afiliado pode desativar/reativar o próprio link (a trava de colunas fica no gatilho abaixo)
drop policy if exists "Afiliado atualiza os proprios links" on public.affiliate_links;
create policy "Afiliado atualiza os proprios links" on public.affiliate_links
  for update to authenticated
  using (affiliate_id in (select id from public.platform_affiliates where user_id = (select auth.uid())))
  with check (affiliate_id in (select id from public.platform_affiliates where user_id = (select auth.uid())));

-- O afiliado só muda is_active e label; slug, dono e cliques ficam como estão
create or replace function public.gf_protect_affiliate_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- só trava quem edita pelo site (papéis do PostgREST); a contagem de cliques roda dentro de
  -- affiliate_link_hit (security definer, como dona da função) e passa
  if current_user in ('authenticated', 'anon') and not (select public.gf_is_admin())
     and (new.slug is distinct from old.slug or new.affiliate_id is distinct from old.affiliate_id
          or new.clicks is distinct from old.clicks or new.created_at is distinct from old.created_at) then
    raise exception 'Só é possível alterar o nome de exibição e ativar/desativar o link.';
  end if;
  return new;
end;
$$;

drop trigger if exists gf_protect_affiliate_link on public.affiliate_links;
create trigger gf_protect_affiliate_link before update on public.affiliate_links
  for each row execute function public.gf_protect_affiliate_link();

-- Clique no link público: qualquer visitante (anônimo) conta +1. Não grava quem clicou.
-- ponytail: contador simples, sem limite por IP — é número informativo, não gera dinheiro;
-- se virar base de pagamento, trocar por registro por visitante com limite de taxa.
create or replace function public.affiliate_link_hit(p_code text, p_slug text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.affiliate_links l
     set clicks = l.clicks + 1
    from public.platform_affiliates a
   where a.id = l.affiliate_id
     and upper(a.referral_code) = upper(p_code)
     and a.status = 'active'
     and l.slug = lower(p_slug)
     and l.is_active;
$$;

revoke all on function public.affiliate_link_hit(text, text) from public;
grant execute on function public.affiliate_link_hit(text, text) to anon, authenticated;

alter table public.platform_affiliate_producers
  add column if not exists affiliate_link_id uuid references public.affiliate_links(id);

-- Vincula o PRÓPRIO produtor recém-cadastrado ao afiliado do código. Sem isto o produtor não
-- consegue gravar (só o admin grava na tabela). Recusa em silêncio (retorna false) quando:
-- não é produtor, código inexistente ou afiliado inativo, autoindicação (Decisão 64), ou o
-- produtor já tem vínculo ativo — não revela nada sobre outros afiliados.
drop function if exists public.link_me_to_affiliate(text, timestamptz);
create or replace function public.link_me_to_affiliate(p_code text, p_ref_first_seen_at timestamptz default null, p_link text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_aff uuid;
begin
  if v_uid is null or p_code is null or p_code !~* '^[A-Z0-9_-]{3,30}$' then
    return false;
  end if;
  -- só no momento do cadastro (conta com até 1 hora) e só se o produtor nunca teve afiliado,
  -- nem vínculo já encerrado pelo admin: senão um produtor antigo se ligaria a um afiliado
  -- amigo depois e dividiria a comissão (achado da revisão de 29/09/2026)
  if not exists (select 1 from public.profiles
                  where id = v_uid and role = 'producer' and created_at > now() - interval '1 hour') then
    return false;
  end if;
  if exists (select 1 from public.platform_affiliate_producers where producer_id = v_uid) then
    return false;
  end if;
  select id into v_aff from public.platform_affiliates
   where upper(referral_code) = upper(p_code) and status = 'active' and user_id <> v_uid;
  if v_aff is null then
    return false;
  end if;
  insert into public.platform_affiliate_producers (producer_id, affiliate_id, source, ref_first_seen_at, affiliate_link_id)
  values (v_uid, v_aff,
          case when p_ref_first_seen_at is null then 'code' else 'link' end,
          -- data do link: nunca no futuro nem mais de 30 dias atrás (o navegador pode mentir)
          case when p_ref_first_seen_at between now() - interval '720 hours' and now() then p_ref_first_seen_at end,
          (select l.id from public.affiliate_links l where l.affiliate_id = v_aff and l.slug = lower(p_link)))
  on conflict do nothing;
  return found;
end;
$$;

revoke all on function public.link_me_to_affiliate(text, timestamptz, text) from public, anon;
grant execute on function public.link_me_to_affiliate(text, timestamptz, text) to authenticated;

-- O afiliado não lê `profiles` de terceiros (RLS). Esta função devolve o histórico DELE:
-- nome do produtor, datas do vínculo e desde quando o produtor está na plataforma —
-- sem e-mail nem telefone do produtor.
drop function if exists public.affiliate_my_producers();
create or replace function public.affiliate_my_producers()
returns table (full_name text, linked_at timestamptz, ended_at timestamptz, source text, producer_since timestamptz, link_slug text)
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
  where a.user_id = (select auth.uid())
  order by v.linked_at desc;
$$;

revoke all on function public.affiliate_my_producers() from public, anon;
grant execute on function public.affiliate_my_producers() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. Cupom do afiliado, cupom de upgrade e pedidos de cupom
-- ---------------------------------------------------------------------------------------------

alter table public.coupons
  add column if not exists affiliate_id uuid references public.platform_affiliates(id),
  add column if not exists upgrade_from text[];

do $$ begin
  alter table public.coupons add constraint coupons_upgrade_chk
    check (upgrade_from is null
        or (producer_id is null and cardinality(upgrade_from) > 0
            and upgrade_from <@ array['free', 'starter', 'plus', 'pro']::text[]));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.coupons add constraint coupons_afiliado_chk
    check (affiliate_id is null
        or (producer_id is null
            and discount_type = 'percent'
            and discount_value in (5, 10, 15, 20, 25)
            and valid_until is not null
            -- 720 horas (e não '30 days') para o resultado não depender de fuso/horário de verão
            and valid_until <= coalesce(valid_from, created_at) + interval '720 hours'
            and max_uses_per_user = 1));
exception when duplicate_object then null; end $$;

drop policy if exists "Afiliado le os proprios cupons" on public.coupons;
create policy "Afiliado le os proprios cupons" on public.coupons
  for select to authenticated
  using (affiliate_id in (select id from public.platform_affiliates where user_id = (select auth.uid())));

create table if not exists public.affiliate_coupon_requests (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.platform_affiliates(id),
  discount_percent numeric not null check (discount_percent in (5, 10, 15, 20, 25)),
  valid_days integer not null check (valid_days between 1 and 30),
  plans text[] check (plans is null or plans <@ array['starter', 'plus', 'pro', 'enterprise']::text[]),
  prospect text check (char_length(prospect) <= 200),   -- para quem é (empresa/produtor)
  reason text check (char_length(reason) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text check (char_length(admin_notes) <= 500),
  coupon_id uuid references public.coupons(id),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id)
);

create index if not exists affiliate_coupon_requests_affiliate_idx
  on public.affiliate_coupon_requests (affiliate_id, created_at desc);

alter table public.affiliate_coupon_requests enable row level security;

drop policy if exists "Admin gerencia pedidos de cupom" on public.affiliate_coupon_requests;
create policy "Admin gerencia pedidos de cupom" on public.affiliate_coupon_requests
  for all to authenticated
  using ((select public.gf_is_admin()))
  with check ((select public.gf_is_admin()));

drop policy if exists "Afiliado le os proprios pedidos" on public.affiliate_coupon_requests;
create policy "Afiliado le os proprios pedidos" on public.affiliate_coupon_requests
  for select to authenticated
  using (affiliate_id in (select id from public.platform_affiliates where user_id = (select auth.uid())));

-- Afiliado ATIVO cria pedido só em nome próprio, sempre pendente e sem decisão preenchida
drop policy if exists "Afiliado ativo cria pedido" on public.affiliate_coupon_requests;
create policy "Afiliado ativo cria pedido" on public.affiliate_coupon_requests
  for insert to authenticated
  with check (
    affiliate_id in (select id from public.platform_affiliates where user_id = (select auth.uid()) and status = 'active')
    and status = 'pending' and coupon_id is null and decided_at is null and decided_by is null and admin_notes is null
  );

-- Conferência:
-- select public.gf_cpf_valido('52998224725') as deve_ser_true, public.gf_cpf_valido('11111111111') as deve_ser_false;
-- select policyname from pg_policies where tablename in ('coupons', 'affiliate_coupon_requests', 'platform_affiliate_producers');
-- select indexname from pg_indexes where tablename = 'platform_affiliate_producers';
