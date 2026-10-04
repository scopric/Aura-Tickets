-- =============================================================================
-- S3 do plano sparkling-gliding-harp (admin, Decisão 163): o banco passa a exigir a PERMISSÃO DA TELA nas tabelas de
-- DINHEIRO. 04/10/2026. Hoje qualquer admin (gf_is_admin) lê e grava tudo; depois deste arquivo, cada regra pede a
-- permissão da área (manage_finance, manage_users, ...). super_admin passa em todas (gf_admin_can já aceita).
--   1. Função nova gf_admin_can_any(text[]): mesmo corpo de gf_admin_can (aal2 + fator verificado), aceita QUALQUER
--      uma das permissões da lista (ou super_admin). Evita uma regra com vários OR.
--   2. Regras trocadas (mesmos nomes, drop + create, padrão `(select fn())`, mesmos papéis de hoje):
--      producer_profiles   SELECT dono ou [manage_users, manage_finance]; INSERT e UPDATE só manage_users (manage_finance
--                          lê e não grava; as COLUNAS ficam por conta do gatilho, item 3)
--      withdrawals         SELECT e UPDATE manage_finance; gatilho novo: o site só muda status e processed_at (item 5)
--      revenue_advances    SELECT dono ou manage_finance; UPDATE e DELETE manage_finance
--      platform_settings   ALL manage_settings (a leitura pública de general e fees fica)
--      producer_subscriptions  ALL manage_users (o dono continua lendo a dele); regra NOVA só de leitura para
--                          manage_support (gf_producer_subscriptions_support_select; a S4 troca por RPC e a remove)
--      user_custom_features    ALL manage_users; SELECT dono ou manage_users
--      orders              SELECT [manage_finance, view_analytics, manage_support] (ver DECISÕES 2)
--      order_items, transactions  SELECT manage_finance
--      coupons             ALL da plataforma (producer_id is null) manage_coupons; SELECT manage_coupons
--      affiliate_coupon_requests  ALL manage_coupons
--      platform_affiliates ALL manage_affiliates (manage_coupons NÃO lê a tabela: usa o RPC afiliados_para_cupons)
--      platform_affiliate_producers e affiliate_links  ALL manage_affiliates
--   3. gf_protect_producer_profile_privileges recriada: regra por COLUNA para quem chega pelo site (anon/authenticated).
--      id e created_at nunca mudam pelo site (a troca de id em duas etapas punha o Pix de um admin na linha da vítima).
--      pix_key, bank_account, cnpj, company_name: só o dono (nem super_admin; Decisão 163, item 8).
--      is_verified: só manage_users (o dono não). commission_rate, webhook_url, stripe_account_id, woovi_account_id: só
--      super_admin. service_role e SQL Editor seguem livres (não passam por aqui).
--   4. gf_protect_coupon_uses passa a pedir manage_coupons (era gf_is_admin); gf_protect_affiliate_link pede
--      manage_affiliates (era gf_is_admin).
--   5. gf_protect_withdrawals (gatilho novo): pelo site, saque só muda status e processed_at; producer_id, amount,
--      pix_key, bank_account, created_at (e coluna futura) ficam travados. service_role e SQL Editor passam.
--   6. gf_protect_platform_affiliate_payout (gatilho novo): user_id e referral_code nunca mudam pelo site; e
--      affiliate_id de affiliate_links nunca muda (item 4, mesmo para manage_affiliates: senão desvia comissão).
--      payout_account_id (única coluna de conta de recebimento de
--      platform_affiliates; cpf é dado pessoal, não conta) só se preenche quando está nulo; trocar valor já preenchido dá
--      42501 para qualquer um do site, inclusive super_admin (Decisão 163, item 10). PENDÊNCIA: tela do afiliado para
--      trocar a própria conta (hoje ele não grava a própria linha; até lá a troca é só por service_role/SQL Editor).
--   7. RPC afiliados_para_cupons(): Cupons vê do afiliado só id, nome, código e se está ativo (manage_coupons ou
--      manage_affiliates; senão 42501). Coupons.tsx passa a usar o RPC e casa por affiliate_id no front.
-- FICA DE FORA (outras fases): events, tickets, profiles, feedback etc. (S4); trilha de auditoria (S5); máscara de
-- Pix/CNPJ na leitura (S7b: quem lê a linha de producer_profiles ainda lê o pix_key); RPC de agregado para Analytics e
-- Atendimento (matriz, "orders melhor por RPC"); a RESTRICTIVE gf_mfa_aal2 de cada tabela não muda.
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17).
-- Uma transação só: se o bloco 0 ou a conferência do fim falhar, nada é gravado. Idempotente (pode rodar de novo).
-- `set local lock_timeout = '5s'`: se algo segurar as tabelas, desiste sem gravar; rodar de novo.
-- NÃO mover para supabase/migrations/ (motivo no cabeçalho de 20260927_security_hardening.sql).
-- Teste: supabase/tests/admin_s3_permissao_dinheiro.test.sql (pgTAP; banco descartável, nunca produção).
--
-- PASSO 0 (só leitura; rodar SOZINHO antes, em produção; o bloco 0 também confere e aborta):
--   select 'gf_admin_can' f, md5(pg_get_functiondef('public.gf_admin_can(text)'::regprocedure))
--   union all select 'gf_is_admin', md5(pg_get_functiondef('public.gf_is_admin()'::regprocedure))
--   union all select 'gf_mfa_ok', md5(pg_get_functiondef('public.gf_mfa_ok()'::regprocedure))
--   union all select 'gf_protect_producer_profile_privileges', md5(pg_get_functiondef('public.gf_protect_producer_profile_privileges()'::regprocedure))
--   union all select 'gf_protect_coupon_uses', md5(pg_get_functiondef('public.gf_protect_coupon_uses()'::regprocedure))
--   union all select 'gf_protect_affiliate_link', md5(pg_get_functiondef('public.gf_protect_affiliate_link()'::regprocedure));
--   Esperado (produção em 04/10/2026, lido pelo MCP só leitura):
--     gf_admin_can be37ff87aa0f00c5f35a7e489ae4c18e | gf_is_admin 4c96fe6821f9ca8deea4ec9cefbcca2e
--     gf_mfa_ok 947db8951761c72a522732b008891fac | gf_protect_producer_profile_privileges 4c54ac1c4b549d478a71ec021a6b111a
--     gf_protect_coupon_uses 73c7e315fce49fa3d503625fa108185c | gf_protect_affiliate_link 9981d9aacfdfac0e94e5858a5b270f07
--   Se for outro, alguém mudou a função: NÃO aplicar; refazer o bloco a partir da definição nova. As três funções de
--   gatilho são recriadas aqui a partir dessas definições; na 2ª aplicação só passa a versão exata deste arquivo (md5 gravado no bloco 0).
--
-- DECISÕES
-- 1. gf_admin_can_any é cópia de gf_admin_can com uma só linha trocada (`admin_permissions && p`). SECURITY DEFINER,
--    search_path '' e EXECUTE só a authenticated e service_role (seg6: sem anon), como gf_is_admin/gf_admin_can.
-- 2. orders: a matriz propunha [manage_finance, view_analytics, manage_tickets, manage_users], mas conferido no front
--    (grep em app/src, 04/10): Users.tsx e Tickets.tsx NÃO leem orders; quem lê é Financeiro (manage_finance),
--    Analytics.tsx:442 (view_analytics) e Atendimento.tsx:129 (manage_support, pedidos do cliente). Sem manage_support
--    o painel "pedidos" do Atendimento ficaria vazio sem erro; manage_tickets e manage_users não entram (nenhuma tela
--    deles lê orders). A exportação "Transações" de Configurações lê orders: passa a exigir manage_finance (resposta
--    do Ricardo, 04/10: cada exportação exige a permissão da área).
-- 3. Atendimento (manage_support) lê producer_subscriptions do cliente (Atendimento.tsx:131): regra só de leitura
--    gf_producer_subscriptions_support_select, para o "plano" não voltar vazio sem erro. A S4 troca por RPC e a remove.
--    TELA QUE PODE FICAR VAZIA/ABERTA (fora da S3): Analytics lê orders em linha (nome e e-mail ficam abertos a
--    view_analytics até o RPC de agregado).
-- 4. Papéis das regras: iguais aos de hoje, menos user_custom_features (hoje `public`, com gf_is_admin sem wrapper):
--    vira `authenticated`, porque anon não executa gf_admin_can_any (seg6) e uma regra `public` faria a consulta
--    anônima dar "permission denied for function". Anônimo nunca leu essa tabela.
-- 5. producer_profiles, INSERT por quem não é dono: a S0 tirou o "Completar cadastro" do admin (grep em app/src:
--    nenhum insert de admin em producer_profiles; Producers.tsx só faz update de is_verified). A regra de INSERT
--    ainda existe (matriz): quem tem manage_users pode criar a linha de OUTRA pessoa, mas só com cnpj nulo, Pix vazio
--    e conta {} (o gatilho barra o resto); company_name é obrigatória na tabela e passa. is_verified = true no INSERT
--    pede manage_users; comissão fora de 10.00, webhook, Stripe e Woovi pedem super_admin.
-- 6. O upsert do produtor (hooks/useProducerSettings.ts:75-130) manda só id, company_name, cnpj, bank_account,
--    pix_key e notification_settings: no INSERT, comissão nasce 10.00 (default), is_verified false e as três contas
--    nulas; no UPDATE o dono só mexe nas colunas dele. Passa. Mandar o MESMO valor de coluna protegida passa.
-- 7. Quem muda is_verified e é o próprio dono continua barrado (só manage_users). Admin que também é produtor mexe
--    em Pix e conta da PRÓPRIA linha como dono, nunca na dos outros.
-- 8. gf_protect_coupon_uses: cupom de produtor passa a ter `uses` alterável por admin só com manage_coupons (antes
--    qualquer admin). O incremento do checkout segue pela chave de serviço.
-- 9. Bloco 0, reaplicação: só vale o md5 de produção OU o md5 exato da versão desta S3 (gravado no bloco, calculado no
--    ensaio); nunca uma frase. Mudou depois da S3 = aborta e refaz a partir da definição atual.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos e conferência das definições de produção ----------------------------------------------------------
do $$
declare
  t text;
  c text;
  f text;
  def text;
  esperado jsonb := jsonb_build_object(
    'gf_admin_can(text)', 'be37ff87aa0f00c5f35a7e489ae4c18e',
    'gf_is_admin()', '4c96fe6821f9ca8deea4ec9cefbcca2e',
    'gf_mfa_ok()', '947db8951761c72a522732b008891fac');
  gatilhos jsonb := jsonb_build_object(
    'gf_protect_producer_profile_privileges()', '4c54ac1c4b549d478a71ec021a6b111a',
    'gf_protect_coupon_uses()', '73c7e315fce49fa3d503625fa108185c',
    'gf_protect_affiliate_link()', '9981d9aacfdfac0e94e5858a5b270f07');
  -- funções NOVAS: ou não existem ou são exatamente as desta S3
  novas jsonb := jsonb_build_object(
    'gf_protect_withdrawals()', '9c576419ef85417faa73fae3d6072a42',
    'gf_protect_platform_affiliate_payout()', 'd215e0f14e0027973965bffda5115a94',
    'afiliados_para_cupons()', 'e92d3eece72279afa23af23ec4d14e0f');
  -- md5 exato das versões desta S3 (2ª aplicação)
  versao_s3 jsonb := jsonb_build_object(
    'gf_protect_producer_profile_privileges()', '5c97dec667d533f5e761742ce43fa698',
    'gf_protect_coupon_uses()', '4065ca8d3ee0ae40bb3fca910a21cddb',
    'gf_protect_affiliate_link()', '80fcbfa04ce8c5e6a310321b33c1e416');
begin
  foreach t in array array['affiliate_coupon_requests', 'affiliate_links', 'coupons', 'order_items', 'orders',
      'platform_affiliate_producers', 'platform_affiliates', 'platform_settings', 'producer_profiles',
      'producer_subscriptions', 'revenue_advances', 'transactions', 'user_custom_features', 'withdrawals'] loop
    if to_regclass('public.' || t) is null then raise exception 'falta a tabela public.%', t; end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t
        and policyname = 'gf_mfa_aal2' and permissive = 'RESTRICTIVE') then
      raise exception 'public.% sem a regra RESTRICTIVE gf_mfa_aal2', t;
    end if;
  end loop;
  foreach c in array array['company_name', 'cnpj', 'bank_account', 'pix_key', 'is_verified', 'commission_rate',
      'webhook_url', 'stripe_account_id', 'woovi_account_id'] loop
    if not exists (select 1 from information_schema.columns where table_schema = 'public'
        and table_name = 'producer_profiles' and column_name = c) then
      raise exception 'falta producer_profiles.%', c;
    end if;
  end loop;
  if not exists (select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'platform_affiliates' and column_name = 'payout_account_id') then
    raise exception 'falta platform_affiliates.payout_account_id';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'admin_permissions') then
    raise exception 'falta profiles.admin_permissions';
  end if;
  -- funções que NÃO mudam: têm de ser exatamente as de produção
  for f in select jsonb_object_keys(esperado) loop
    if to_regprocedure('public.' || f) is null then raise exception 'falta public.%', f; end if;
    if md5(pg_get_functiondef(('public.' || f)::regprocedure)) <> esperado ->> f then
      raise exception 'public.% mudou desde 04/10 (md5 diferente): refazer este arquivo a partir da definição atual', f;
    end if;
  end loop;
  -- funções recriadas aqui: ou a de produção ou exatamente a deste arquivo (2ª aplicação)
  for f in select jsonb_object_keys(gatilhos) loop
    if to_regprocedure('public.' || f) is null then raise exception 'falta public.%', f; end if;
    def := pg_get_functiondef(('public.' || f)::regprocedure);
    if md5(def) <> gatilhos ->> f and md5(def) <> versao_s3 ->> f then
      raise exception 'public.% mudou desde 04/10 (md5 diferente): refazer o bloco a partir da definição atual', f;
    end if;
  end loop;
  for f in select jsonb_object_keys(novas) loop
    if to_regprocedure('public.' || f) is not null
       and md5(pg_get_functiondef(('public.' || f)::regprocedure)) <> novas ->> f then
      raise exception 'public.% existe e não é a versão desta S3 (md5 diferente): conferir antes de sobrescrever', f;
    end if;
  end loop;
  foreach t in array array['producer_profiles', 'coupons', 'affiliate_links'] loop
    if not exists (select 1 from pg_trigger where tgrelid = ('public.' || t)::regclass
        and tgname = case t when 'producer_profiles' then 'gf_protect_producer_profile_privileges'
                            when 'coupons' then 'gf_protect_coupon_uses' else 'gf_protect_affiliate_link' end
        and tgenabled = 'O') then
      raise exception 'gatilho de public.% ausente ou desligado', t;
    end if;
  end loop;
end $$;

-- 1. Função nova: qualquer uma das permissões da lista ----------------------------------------------------------------
create or replace function public.gf_admin_can_any(p text[])
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
      and ('super_admin' = any(pr.admin_permissions) or pr.admin_permissions && p)
  ) and public.gf_mfa_ok()
    -- Decisão 99: admin só com fator confirmado e o código digitado nesta sessão
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified');
$$;
revoke execute on function public.gf_admin_can_any(text[]) from public, anon;
grant execute on function public.gf_admin_can_any(text[]) to authenticated, service_role;

-- 2. Regras ------------------------------------------------------------------------------------------------------------
-- producer_profiles
drop policy if exists gf_producer_profiles_select_own_or_admin on public.producer_profiles;
create policy gf_producer_profiles_select_own_or_admin on public.producer_profiles as permissive for select to authenticated
  using (id = (select auth.uid()) or (select public.gf_admin_can_any(array['manage_users', 'manage_finance'])));
drop policy if exists gf_producer_profiles_admin_insert on public.producer_profiles;
create policy gf_producer_profiles_admin_insert on public.producer_profiles as permissive for insert to authenticated
  with check ((select public.gf_admin_can('manage_users')));
drop policy if exists gf_producer_profiles_admin_update on public.producer_profiles;
create policy gf_producer_profiles_admin_update on public.producer_profiles as permissive for update to authenticated
  using ((select public.gf_admin_can('manage_users')))
  with check ((select public.gf_admin_can('manage_users')));

-- withdrawals
drop policy if exists gf_withdrawals_admin_select on public.withdrawals;
create policy gf_withdrawals_admin_select on public.withdrawals as permissive for select to authenticated
  using ((select public.gf_admin_can('manage_finance')));
drop policy if exists gf_withdrawals_admin_update on public.withdrawals;
create policy gf_withdrawals_admin_update on public.withdrawals as permissive for update to authenticated
  using ((select public.gf_admin_can('manage_finance')))
  with check ((select public.gf_admin_can('manage_finance')));

-- revenue_advances
drop policy if exists gf_revenue_advances_select on public.revenue_advances;
create policy gf_revenue_advances_select on public.revenue_advances as permissive for select to authenticated
  using (producer_id = (select auth.uid()) or (select public.gf_admin_can('manage_finance')));
drop policy if exists gf_revenue_advances_admin_update on public.revenue_advances;
create policy gf_revenue_advances_admin_update on public.revenue_advances as permissive for update to authenticated
  using ((select public.gf_admin_can('manage_finance')))
  with check ((select public.gf_admin_can('manage_finance')));
drop policy if exists gf_revenue_advances_admin_delete on public.revenue_advances;
create policy gf_revenue_advances_admin_delete on public.revenue_advances as permissive for delete to authenticated
  using ((select public.gf_admin_can('manage_finance')));

-- platform_settings (gf_platform_settings_public_read fica)
drop policy if exists gf_platform_settings_admin_all on public.platform_settings;
create policy gf_platform_settings_admin_all on public.platform_settings as permissive for all to authenticated
  using ((select public.gf_admin_can('manage_settings')))
  with check ((select public.gf_admin_can('manage_settings')));

-- producer_subscriptions (gf_producer_subscriptions_owner_select fica)
drop policy if exists gf_producer_subscriptions_admin_all on public.producer_subscriptions;
create policy gf_producer_subscriptions_admin_all on public.producer_subscriptions as permissive for all to authenticated
  using ((select public.gf_admin_can('manage_users')))
  with check ((select public.gf_admin_can('manage_users')));

drop policy if exists gf_producer_subscriptions_support_select on public.producer_subscriptions;
create policy gf_producer_subscriptions_support_select on public.producer_subscriptions as permissive for select to authenticated
  using ((select public.gf_admin_can('manage_support')));

-- user_custom_features (hoje `public`; vira authenticated: DECISÕES 4)
drop policy if exists gf_custom_features_admin_write on public.user_custom_features;
create policy gf_custom_features_admin_write on public.user_custom_features as permissive for all to authenticated
  using ((select public.gf_admin_can('manage_users')))
  with check ((select public.gf_admin_can('manage_users')));
drop policy if exists gf_custom_features_read on public.user_custom_features;
create policy gf_custom_features_read on public.user_custom_features as permissive for select to authenticated
  using (user_id = (select auth.uid()) or (select public.gf_admin_can('manage_users')));

-- orders, order_items, transactions (regras do produtor e do comprador ficam)
drop policy if exists gf_orders_admin_select on public.orders;
create policy gf_orders_admin_select on public.orders as permissive for select to authenticated
  using ((select public.gf_admin_can_any(array['manage_finance', 'view_analytics', 'manage_support'])));
drop policy if exists gf_order_items_admin_select on public.order_items;
create policy gf_order_items_admin_select on public.order_items as permissive for select to authenticated
  using ((select public.gf_admin_can('manage_finance')));
drop policy if exists gf_transactions_admin_select on public.transactions;
create policy gf_transactions_admin_select on public.transactions as permissive for select to authenticated
  using ((select public.gf_admin_can('manage_finance')));

-- coupons (só os da plataforma; "Produtor gerencia coupons" e "Afiliado le os proprios cupons" ficam)
drop policy if exists "Admin gerencia coupons da plataforma" on public.coupons;
create policy "Admin gerencia coupons da plataforma" on public.coupons as permissive for all to authenticated
  using (producer_id is null and (select public.gf_admin_can('manage_coupons')))
  with check (producer_id is null and (select public.gf_admin_can('manage_coupons')));
drop policy if exists "Admin le coupons" on public.coupons;
create policy "Admin le coupons" on public.coupons as permissive for select to authenticated
  using ((select public.gf_admin_can('manage_coupons')));

-- affiliate_coupon_requests, platform_affiliates, platform_affiliate_producers, affiliate_links
drop policy if exists "Admin gerencia pedidos de cupom" on public.affiliate_coupon_requests;
create policy "Admin gerencia pedidos de cupom" on public.affiliate_coupon_requests as permissive for all to authenticated
  using ((select public.gf_admin_can('manage_coupons')))
  with check ((select public.gf_admin_can('manage_coupons')));
drop policy if exists "Admin gerencia afiliados evokaa" on public.platform_affiliates;
create policy "Admin gerencia afiliados evokaa" on public.platform_affiliates as permissive for all to authenticated
  using ((select public.gf_admin_can('manage_affiliates')))
  with check ((select public.gf_admin_can('manage_affiliates')));
drop policy if exists gf_platform_affiliates_admin_select on public.platform_affiliates;
drop policy if exists "Admin gerencia indicados de afiliados" on public.platform_affiliate_producers;
create policy "Admin gerencia indicados de afiliados" on public.platform_affiliate_producers as permissive for all to authenticated
  using ((select public.gf_admin_can('manage_affiliates')))
  with check ((select public.gf_admin_can('manage_affiliates')));
drop policy if exists "Admin gerencia links de afiliado" on public.affiliate_links;
create policy "Admin gerencia links de afiliado" on public.affiliate_links as permissive for all to authenticated
  using ((select public.gf_admin_can('manage_affiliates')))
  with check ((select public.gf_admin_can('manage_affiliates')));

-- 3. producer_profiles: regra por coluna ------------------------------------------------------------------------------
-- Definição de PRODUÇÃO de 04/10/2026 (md5 4c54ac1c...) reescrita. Vale só para quem chega pelo site (anon/authenticated,
-- por current_user ou pelo role do JWT); service_role e SQL Editor passam direto. Erro 42501 (a tela não pode dizer
-- "salvo" com o valor descartado); mandar o MESMO valor passa.
create or replace function public.gf_protect_producer_profile_privileges()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_dono boolean;
begin
  -- S3 (Decisão 163): regra por coluna
  if not (current_user in ('anon', 'authenticated')
          or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated')) then
    return new;
  end if;
  v_dono := coalesce(auth.uid() = (case when tg_op = 'INSERT' then new.id else old.id end), false);
  if tg_op = 'INSERT' then
    -- cadastro de OUTRA pessoa (admin com manage_users): sem CNPJ, Pix e conta bancária
    if not v_dono and (new.cnpj is not null or coalesce(new.pix_key, '') <> ''
                       or new.bank_account is distinct from '{}'::jsonb) then
      raise exception 'Campo protegido não permitido' using errcode = '42501';
    end if;
    if new.is_verified and not public.gf_admin_can('manage_users') then
      raise exception 'Campo protegido não permitido' using errcode = '42501';
    end if;
    if (new.commission_rate is distinct from 10.00
        or new.webhook_url is not null or new.stripe_account_id is not null or new.woovi_account_id is not null)
       and not public.gf_admin_can('super_admin') then
      raise exception 'Campo protegido não permitido' using errcode = '42501';
    end if;
  else
    -- a linha não "muda de dono": id e created_at nunca mudam pelo site
    if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
      raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
    end if;
    if not v_dono and (new.pix_key is distinct from old.pix_key
                       or new.bank_account is distinct from old.bank_account
                       or new.cnpj is distinct from old.cnpj
                       or new.company_name is distinct from old.company_name) then
      raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
    end if;
    if new.is_verified is distinct from old.is_verified and not public.gf_admin_can('manage_users') then
      raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
    end if;
    if (new.commission_rate is distinct from old.commission_rate
        or new.webhook_url is distinct from old.webhook_url
        or new.stripe_account_id is distinct from old.stripe_account_id
        or new.woovi_account_id is distinct from old.woovi_account_id)
       and not public.gf_admin_can('super_admin') then
      raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists gf_protect_producer_profile_privileges on public.producer_profiles;
create trigger gf_protect_producer_profile_privileges
  before insert or update on public.producer_profiles
  for each row execute function public.gf_protect_producer_profile_privileges();

-- 4. Gatilhos de cupom e de link de afiliado: a permissão da área no lugar de "qualquer admin" ------------------------
create or replace function public.gf_protect_coupon_uses()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- S3 (Decisão 163): manage_coupons no lugar de gf_is_admin
  if (current_user in ('anon', 'authenticated')
      or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
     and not public.gf_admin_can('manage_coupons') then
    if tg_op = 'INSERT' then
      if new.uses <> 0 then
        raise exception 'Campo protegido não permitido' using errcode = '42501';
      end if;
    elsif new.uses is distinct from old.uses then
      raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists gf_protect_coupon_uses on public.coupons;
create trigger gf_protect_coupon_uses
  before insert or update on public.coupons
  for each row execute function public.gf_protect_coupon_uses();

create or replace function public.gf_protect_affiliate_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- S3 (Decisão 163): manage_affiliates no lugar de gf_is_admin
  -- o link não muda de afiliado depois de criado, nem por manage_affiliates (desviaria comissão; Decisão 163)
  if current_user in ('authenticated', 'anon') and new.affiliate_id is distinct from old.affiliate_id then
    raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
  end if;
  -- só trava quem edita pelo site (papéis do PostgREST); a contagem de cliques roda dentro de
  -- affiliate_link_hit (security definer, como dona da função) e passa
  if current_user in ('authenticated', 'anon') and not (select public.gf_admin_can('manage_affiliates'))
     and (new.slug is distinct from old.slug or new.affiliate_id is distinct from old.affiliate_id
          or new.clicks is distinct from old.clicks or new.created_at is distinct from old.created_at) then
    raise exception 'Só é possível alterar o nome de exibição e ativar/desativar o link.';
  end if;
  return new;
end;
$$;
-- o gatilho de affiliate_links já existe em produção e continua apontando para a função pelo nome

-- 5. withdrawals: o site só muda status e processed_at --------------------------------------------------------------
create or replace function public.gf_protect_withdrawals()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- S3 (Decisão 163): travado por lista de exceção, então coluna futura já nasce travada
  if (current_user in ('anon', 'authenticated')
      or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
     and (to_jsonb(new) - 'status' - 'processed_at') is distinct from (to_jsonb(old) - 'status' - 'processed_at') then
    raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists gf_protect_withdrawals on public.withdrawals;
create trigger gf_protect_withdrawals
  before update on public.withdrawals
  for each row execute function public.gf_protect_withdrawals();

-- 6. platform_affiliates: conta de recebimento só se preenche quando está nula ------------------------------------------
create or replace function public.gf_protect_platform_affiliate_payout()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- S3 (Decisão 163, item 10): nem super_admin troca a conta já preenchida, nem muda de quem é a linha
  -- (user_id) ou o código de indicação (referral_code): desviaria a comissão do afiliado
  if (current_user in ('anon', 'authenticated')
      or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
     and ((old.payout_account_id is not null and new.payout_account_id is distinct from old.payout_account_id)
          or new.user_id is distinct from old.user_id
          or new.referral_code is distinct from old.referral_code) then
    raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists gf_protect_platform_affiliate_payout on public.platform_affiliates;
create trigger gf_protect_platform_affiliate_payout
  before update on public.platform_affiliates
  for each row execute function public.gf_protect_platform_affiliate_payout();

-- 7. RPC para a tela de Cupons: do afiliado, só id, nome, código e se está ativo ------------------------------------
create or replace function public.afiliados_para_cupons()
returns table (id uuid, nome text, codigo text, ativo boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.gf_admin_can_any(array['manage_coupons', 'manage_affiliates']) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  return query
    select pa.id, coalesce(pr.full_name, pa.full_name), pa.referral_code, pa.status = 'active'
    from public.platform_affiliates pa
    left join public.profiles pr on pr.id = pa.user_id
    order by pa.referral_code;
end;
$$;
revoke execute on function public.afiliados_para_cupons() from public, anon;
grant execute on function public.afiliados_para_cupons() to authenticated, service_role;

-- 8. Conferência (aborta e desfaz tudo se algo estiver fora do esperado) ---------------------------------------------
do $$
declare
  t text;
  n int;
begin
  foreach t in array array['affiliate_coupon_requests', 'affiliate_links', 'coupons', 'order_items', 'orders',
      'platform_affiliate_producers', 'platform_affiliates', 'platform_settings', 'producer_profiles',
      'producer_subscriptions', 'revenue_advances', 'transactions', 'user_custom_features', 'withdrawals'] loop
    select count(*) into n from pg_policies
      where schemaname = 'public' and tablename = t and permissive = 'PERMISSIVE'
        and (coalesce(qual, '') || coalesce(with_check, '')) like '%gf_is_admin%';
    if n > 0 then raise exception 'public.% ainda tem % regra(s) com gf_is_admin', t, n; end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t
        and policyname = 'gf_mfa_aal2' and permissive = 'RESTRICTIVE') then
      raise exception 'gf_mfa_aal2 sumiu de public.%', t;
    end if;
    select count(*) into n from pg_policies
      where schemaname = 'public' and tablename = t and permissive = 'PERMISSIVE'
        and roles <> array['authenticated']::name[]
        and (coalesce(qual, '') || coalesce(with_check, '')) like '%gf_admin_can%';
    if n > 0 then raise exception 'public.% tem regra de admin para outro papel que não authenticated', t; end if;
  end loop;
  if not (select prosecdef and proconfig @> array['search_path=""'] from pg_proc
          where oid = 'public.gf_admin_can_any(text[])'::regprocedure) then
    raise exception 'gf_admin_can_any sem SECURITY DEFINER ou search_path';
  end if;
  if has_function_privilege('anon', 'public.gf_admin_can_any(text[])', 'execute')
     or not has_function_privilege('authenticated', 'public.gf_admin_can_any(text[])', 'execute') then
    raise exception 'gf_admin_can_any: anon executa ou authenticated não executa';
  end if;
  if has_function_privilege('anon', 'public.afiliados_para_cupons()', 'execute')
     or not has_function_privilege('authenticated', 'public.afiliados_para_cupons()', 'execute') then
    raise exception 'afiliados_para_cupons: anon executa ou authenticated não executa';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'platform_settings'
      and policyname = 'gf_platform_settings_public_read' and cmd = 'SELECT') then
    raise exception 'gf_platform_settings_public_read sumiu';
  end if;
  for t in select unnest(array['public.gf_protect_producer_profile_privileges()', 'public.gf_protect_coupon_uses()',
      'public.gf_protect_affiliate_link()']) loop
    if position('Decisão 163' in pg_get_functiondef(t::regprocedure)) = 0
       or not (select prosrc ~ 'gf_admin_can' from pg_proc where oid = t::regprocedure) then
      raise exception '% não é a versão da S3', t;
    end if;
  end loop;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.withdrawals'::regclass
      and tgname = 'gf_protect_withdrawals' and tgenabled = 'O')
     or not exists (select 1 from pg_trigger where tgrelid = 'public.platform_affiliates'::regclass
      and tgname = 'gf_protect_platform_affiliate_payout' and tgenabled = 'O')
     or not exists (select 1 from pg_trigger where tgrelid = 'public.producer_profiles'::regclass
      and tgname = 'gf_protect_producer_profile_privileges' and tgenabled = 'O')
     or not exists (select 1 from pg_trigger where tgrelid = 'public.coupons'::regclass
      and tgname = 'gf_protect_coupon_uses' and tgenabled = 'O')
     or not exists (select 1 from pg_trigger where tgrelid = 'public.affiliate_links'::regclass
      and tgname = 'gf_protect_affiliate_link' and tgenabled = 'O') then
    raise exception 'gatilho da S3 ausente ou desligado';
  end if;
end $$;

commit;

-- Conferência (só leitura). Esperado: nenhuma regra PERMISSIVE das 14 tabelas citando gf_is_admin (as 3 colunas do fim
-- mostram a permissão de cada regra).
select tablename::text as tabela, policyname::text as nome, cmd::text as comando,
       coalesce(qual, with_check) as regra
from pg_policies
where schemaname = 'public' and permissive = 'PERMISSIVE'
  and tablename in ('affiliate_coupon_requests', 'affiliate_links', 'coupons', 'order_items', 'orders',
      'platform_affiliate_producers', 'platform_affiliates', 'platform_settings', 'producer_profiles',
      'producer_subscriptions', 'revenue_advances', 'transactions', 'user_custom_features', 'withdrawals')
order by 1, 2;

-- =============================================================================
-- ENSAIO COM ROLLBACK: trocar o "commit;" do fim do bloco de conferência por "rollback;" e rodar tudo; os blocos que
-- abortam já rodaram dentro da transação e nada fica gravado. Comportamento por papel e por coluna:
-- supabase/tests/admin_s3_permissao_dinheiro.test.sql, em banco descartável.
--
-- Desfazer (volta ao estado de produção de 04/10/2026; as regras e funções abaixo são as lidas na época):
-- begin;
-- drop trigger if exists gf_protect_withdrawals on public.withdrawals;
-- drop function if exists public.gf_protect_withdrawals();
-- drop trigger if exists gf_protect_platform_affiliate_payout on public.platform_affiliates;
-- drop function if exists public.gf_protect_platform_affiliate_payout();
-- drop function if exists public.afiliados_para_cupons();
-- drop policy if exists gf_platform_affiliates_admin_select on public.platform_affiliates;
-- drop policy if exists gf_producer_subscriptions_support_select on public.producer_subscriptions;
-- drop policy if exists gf_producer_profiles_select_own_or_admin on public.producer_profiles;
-- create policy gf_producer_profiles_select_own_or_admin on public.producer_profiles for select to authenticated
--   using (id = (select auth.uid()) or (select public.gf_is_admin()));
-- drop policy if exists gf_producer_profiles_admin_insert on public.producer_profiles;
-- create policy gf_producer_profiles_admin_insert on public.producer_profiles for insert to authenticated
--   with check ((select public.gf_is_admin()));
-- drop policy if exists gf_producer_profiles_admin_update on public.producer_profiles;
-- create policy gf_producer_profiles_admin_update on public.producer_profiles for update to authenticated
--   using ((select public.gf_is_admin())) with check ((select public.gf_is_admin()));
-- drop policy if exists gf_withdrawals_admin_select on public.withdrawals;
-- create policy gf_withdrawals_admin_select on public.withdrawals for select to authenticated using ((select public.gf_is_admin()));
-- drop policy if exists gf_withdrawals_admin_update on public.withdrawals;
-- create policy gf_withdrawals_admin_update on public.withdrawals for update to authenticated
--   using ((select public.gf_is_admin())) with check ((select public.gf_is_admin()));
-- drop policy if exists gf_revenue_advances_select on public.revenue_advances;
-- create policy gf_revenue_advances_select on public.revenue_advances for select to authenticated
--   using (producer_id = (select auth.uid()) or (select public.gf_is_admin()));
-- drop policy if exists gf_revenue_advances_admin_update on public.revenue_advances;
-- create policy gf_revenue_advances_admin_update on public.revenue_advances for update to authenticated
--   using ((select public.gf_is_admin())) with check ((select public.gf_is_admin()));
-- drop policy if exists gf_revenue_advances_admin_delete on public.revenue_advances;
-- create policy gf_revenue_advances_admin_delete on public.revenue_advances for delete to authenticated using ((select public.gf_is_admin()));
-- drop policy if exists gf_platform_settings_admin_all on public.platform_settings;
-- create policy gf_platform_settings_admin_all on public.platform_settings for all to authenticated
--   using ((select public.gf_is_admin())) with check ((select public.gf_is_admin()));
-- drop policy if exists gf_producer_subscriptions_admin_all on public.producer_subscriptions;
-- create policy gf_producer_subscriptions_admin_all on public.producer_subscriptions for all to authenticated
--   using ((select public.gf_is_admin())) with check ((select public.gf_is_admin()));
-- drop policy if exists gf_custom_features_admin_write on public.user_custom_features;
-- create policy gf_custom_features_admin_write on public.user_custom_features for all to public
--   using (public.gf_is_admin()) with check (public.gf_is_admin());
-- drop policy if exists gf_custom_features_read on public.user_custom_features;
-- create policy gf_custom_features_read on public.user_custom_features for select to public
--   using (user_id = auth.uid() or public.gf_is_admin());
-- drop policy if exists gf_orders_admin_select on public.orders;
-- create policy gf_orders_admin_select on public.orders for select to authenticated using ((select public.gf_is_admin()));
-- drop policy if exists gf_order_items_admin_select on public.order_items;
-- create policy gf_order_items_admin_select on public.order_items for select to authenticated using ((select public.gf_is_admin()));
-- drop policy if exists gf_transactions_admin_select on public.transactions;
-- create policy gf_transactions_admin_select on public.transactions for select to authenticated using ((select public.gf_is_admin()));
-- drop policy if exists "Admin gerencia coupons da plataforma" on public.coupons;
-- create policy "Admin gerencia coupons da plataforma" on public.coupons for all to authenticated
--   using (producer_id is null and (select public.gf_is_admin())) with check (producer_id is null and (select public.gf_is_admin()));
-- drop policy if exists "Admin le coupons" on public.coupons;
-- create policy "Admin le coupons" on public.coupons for select to authenticated using ((select public.gf_is_admin()));
-- drop policy if exists "Admin gerencia pedidos de cupom" on public.affiliate_coupon_requests;
-- create policy "Admin gerencia pedidos de cupom" on public.affiliate_coupon_requests for all to authenticated
--   using ((select public.gf_is_admin())) with check ((select public.gf_is_admin()));
-- drop policy if exists "Admin gerencia afiliados evokaa" on public.platform_affiliates;
-- create policy "Admin gerencia afiliados evokaa" on public.platform_affiliates for all to authenticated
--   using ((select public.gf_is_admin())) with check ((select public.gf_is_admin()));
-- drop policy if exists "Admin gerencia indicados de afiliados" on public.platform_affiliate_producers;
-- create policy "Admin gerencia indicados de afiliados" on public.platform_affiliate_producers for all to authenticated
--   using ((select public.gf_is_admin())) with check ((select public.gf_is_admin()));
-- drop policy if exists "Admin gerencia links de afiliado" on public.affiliate_links;
-- create policy "Admin gerencia links de afiliado" on public.affiliate_links for all to authenticated
--   using ((select public.gf_is_admin())) with check ((select public.gf_is_admin()));
-- create or replace function public.gf_protect_producer_profile_privileges()
-- returns trigger language plpgsql set search_path = '' as $f$
-- begin
--   if (current_user in ('anon', 'authenticated')
--       or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
--      and not public.gf_is_admin() then
--     if tg_op = 'INSERT' then
--       if new.is_verified or new.commission_rate is distinct from 10.00
--          or new.webhook_url is not null or new.stripe_account_id is not null or new.woovi_account_id is not null then
--         raise exception 'Campo protegido não permitido' using errcode = '42501';
--       end if;
--     elsif new.is_verified is distinct from old.is_verified
--        or new.commission_rate is distinct from old.commission_rate
--        or new.webhook_url is distinct from old.webhook_url
--        or new.stripe_account_id is distinct from old.stripe_account_id
--        or new.woovi_account_id is distinct from old.woovi_account_id then
--       raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
--     end if;
--   end if;
--   return new;
-- end;
-- $f$;
-- create or replace function public.gf_protect_coupon_uses()
-- returns trigger language plpgsql set search_path = '' as $f$
-- begin
--   if (current_user in ('anon', 'authenticated')
--       or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
--      and not public.gf_is_admin() then
--     if tg_op = 'INSERT' then
--       if new.uses <> 0 then
--         raise exception 'Campo protegido não permitido' using errcode = '42501';
--       end if;
--     elsif new.uses is distinct from old.uses then
--       raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
--     end if;
--   end if;
--   return new;
-- end;
-- $f$;
-- create or replace function public.gf_protect_affiliate_link()
-- returns trigger language plpgsql set search_path = '' as $f$
-- begin
--   -- só trava quem edita pelo site (papéis do PostgREST); a contagem de cliques roda dentro de
--   -- affiliate_link_hit (security definer, como dona da função) e passa
--   if current_user in ('authenticated', 'anon') and not (select public.gf_is_admin())
--      and (new.slug is distinct from old.slug or new.affiliate_id is distinct from old.affiliate_id
--           or new.clicks is distinct from old.clicks or new.created_at is distinct from old.created_at) then
--     raise exception 'Só é possível alterar o nome de exibição e ativar/desativar o link.';
--   end if;
--   return new;
-- end;
-- $f$;
-- drop function if exists public.gf_admin_can_any(text[]);
-- commit;
-- =============================================================================
