-- =============================================================================
-- L4 do plano rosy-discovering-fog (produtor, empatar com o mercado): SQL de segurança do produtor. 04/10/2026.
-- Cinco ajustes, todos por regra (RLS), gatilho ou índice; nenhuma coluna nova:
--   (a) revenue_advances: sai a regra gf_revenue_advances_insert (ficha 30). Hoje o produtor grava pedido de
--       antecipação com qualquer valor pela API (amount, fee_pct, net_amount vêm do navegador; nada recalcula).
--       A tela (/producer/antecipacao) está escondida atrás de ComingSoonRoute: nenhum front grava hoje.
--   (b) producer_profiles: o gatilho gf_protect_producer_profile_privileges passa a proteger também webhook_url,
--       stripe_account_id e woovi_account_id (ficha 35). Continua protegendo is_verified e commission_rate.
--   (c) coupons: gatilho novo gf_protect_coupon_uses; o produtor não altera nem inventa `uses` (ficha 11).
--   (d) menu_items: regra de leitura, para authenticated, dos itens disponíveis de evento publicado e aprovado
--       (ficha 24). Hoje o Hub do participante sempre mostra "Cardápio não disponível".
--   (e) onboarding_logs: apaga as linhas repetidas por (user_id, step_name) e cria índice único nesse par
--       (ficha 01). O front (hooks/useTourLog.ts) passa a gravar com upsert onConflict 'user_id,step_name'.
--
-- ORDEM (obrigatória por causa do item e): (1) ANTES, rodar em produção a consulta de leitura do fim deste
-- cabeçalho e conferir o número de repetidas; (2) aplicar este SQL; (3) só então mesclar o PR do front
-- (fix/produtor-l4-sql-seguranca). Com o front antes do SQL, todo registro de tour e de "Dispensar" do Início
-- falha (42P10: o upsert não acha índice único para o onConflict) e mostra "Não foi possível guardar sua escolha".
-- Com o SQL antes do front, o front antigo (insert) só falha (23505) quando grava de novo um passo já gravado
-- (refazer um tour): a mesma mensagem, até o PR entrar. Os itens a-d independem do front.
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17).
-- Uma transação só: se a conferência do fim falhar, nada é gravado. Idempotente (pode rodar de novo).
-- `set local lock_timeout = '5s'`: se algo segurar as tabelas, o arquivo desiste sem gravar; rodar de novo.
-- NÃO mover para supabase/migrations/ (motivo no cabeçalho de 20260927_security_hardening.sql).
-- Teste: supabase/tests/produtor_seguranca_l4.test.sql (pgTAP; banco local, nunca em produção).
--
-- DECISÕES
-- 1. Travas por GATILHO, não por revoke de coluna: o baseline dá UPDATE na tabela inteira a authenticated, e
--    revogar UPDATE de uma coluna não tira o que veio pela tabela. Mesmo padrão e mesma condição do gatilho que já
--    existe (20260927_security_hardening.sql:106-130): vale para quem chega pela API como anon/authenticated
--    (current_user ou role do JWT) e não é admin (gf_is_admin). service_role (edge functions, delete-account)
--    e admin continuam gravando. Erro 42501, em vez de manter o valor antigo calado: a tela não pode dizer
--    "salvo" com o valor descartado (o plano pede que o UPDATE falhe). Mandar o MESMO valor passa.
-- 2. (b) No INSERT, as três colunas novas precisam vir nulas (o front cria o perfil sem elas; ver
--    hooks/useProducerSettings.ts). A função é a definição atual inteira (baseline = banco local), com as três
--    colunas a mais; nada do que ela já protegia sai.
-- 3. (c) Também no INSERT: `uses` precisa nascer 0. Só travar o UPDATE deixava a mesma brecha por outro caminho
--    (criar o cupom já com uses = 500). Nenhuma função do banco nem edge function grava `uses` hoje (conferido);
--    o checkout futuro (M5) incrementa pela chave de serviço ou por função própria (security definer roda como
--    postgres, mas o JWT segue authenticated: essa função terá de entrar na exceção do gatilho).
-- 4. (a) Só sai a regra de INSERT. Leitura do próprio pedido e update/delete do admin ficam. Nem o admin insere
--    pela API (nunca teve regra para isso); a antecipação volta com a função de cálculo no servidor (ficha 30,
--    item 4). A conferência é por "nenhuma regra permissiva de INSERT ou ALL", não por lista fixa.
-- 5. (d) Só para authenticated: o Hub fica na área logada (/app/hub, ProtectedRoute). O exists lê events com a
--    RLS de quem lê; a regra "Eventos públicos ou do produtor" já mostra evento publicado e aprovado. Nenhuma
--    regra de events lê menu_items: sem ciclo (42P17). A gf_mfa_aal2 RESTRICTIVE fica intacta. A regra do dono
--    (gf_menu_items_dono) não muda. Nome em ASCII (DECISÕES 2 de 20261005_produtor_acesso.sql).
-- 6. (e) Fica a linha MAIS RECENTE de cada (user_id, step_name) (created_at, desempate por id). É o mesmo
--    resultado que o upsert do front produz daqui em diante: o último registro de um passo sobrescreve
--    completed_at e skipped (refazer um tour e pulá-lo deixa "pulado"). O front só lê step_name, então nenhuma
--    tela muda. A tabela é travada (share row exclusive) antes do delete: insert concorrente espera o commit em
--    vez de criar repetida entre o delete e o índice. Linhas com user_id ou step_name nulos não entram no delete
--    (o índice único não as compara). O índice antigo idx_onboarding_user (só user_id) fica: tirar é outra tarefa.
--
-- CONSULTA DE LEITURA (rodar em produção ANTES; só leitura). Mostra quantas linhas o item (e) vai apagar:
--   select (select count(*) from public.onboarding_logs) as linhas,
--     coalesce(sum(n - 1), 0) as repetidas_a_apagar,
--     count(*) filter (where n > 1) as pares_repetidos,
--     coalesce(max(n), 0) as maior_repeticao
--   from (select count(*) as n from public.onboarding_logs
--         where user_id is not null and step_name is not null group by user_id, step_name) g;
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos
do $$
begin
  if to_regclass('public.revenue_advances') is null or to_regclass('public.producer_profiles') is null
     or to_regclass('public.coupons') is null or to_regclass('public.menu_items') is null
     or to_regclass('public.onboarding_logs') is null or to_regclass('public.events') is null then
    raise exception 'falta uma das tabelas: revenue_advances, producer_profiles, coupons, menu_items, onboarding_logs, events';
  end if;
  if to_regproc('public.gf_is_admin') is null then raise exception 'Falta public.gf_is_admin'; end if;
end $$;

-- a. revenue_advances: o produtor não cria pedido de antecipação pela API -------------------------------------------
drop policy if exists gf_revenue_advances_insert on public.revenue_advances;

-- b. producer_profiles: definição atual + webhook_url, stripe_account_id e woovi_account_id -------------------------
create or replace function public.gf_protect_producer_profile_privileges()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (current_user in ('anon', 'authenticated')
      or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
     and not public.gf_is_admin() then
    if tg_op = 'INSERT' then
      if new.is_verified or new.commission_rate is distinct from 10.00
         or new.webhook_url is not null or new.stripe_account_id is not null or new.woovi_account_id is not null then
        raise exception 'Campo protegido não permitido' using errcode = '42501';
      end if;
    elsif new.is_verified is distinct from old.is_verified
       or new.commission_rate is distinct from old.commission_rate
       or new.webhook_url is distinct from old.webhook_url
       or new.stripe_account_id is distinct from old.stripe_account_id
       or new.woovi_account_id is distinct from old.woovi_account_id then
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

-- c. coupons: `uses` só muda pela chave de serviço ou pelo admin ------------------------------------------------------
create or replace function public.gf_protect_coupon_uses()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (current_user in ('anon', 'authenticated')
      or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
     and not public.gf_is_admin() then
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

-- d. menu_items: quem está logado lê o cardápio disponível de evento publicado e aprovado ---------------------------
drop policy if exists gf_menu_items_evento_aprovado on public.menu_items;
create policy gf_menu_items_evento_aprovado on public.menu_items as permissive for select to authenticated
  using (
    is_available
    and exists (select 1 from public.events e
      where e.id = menu_items.event_id and e.status = 'published' and e.approval_status = 'approved')
  );

-- e. onboarding_logs: sem repetidas e com índice único (user_id, step_name) -----------------------------------------
lock table public.onboarding_logs in share row exclusive mode;
do $$
declare n integer;
begin
  delete from public.onboarding_logs o
  using (select id, row_number() over (partition by user_id, step_name order by created_at desc nulls last, id desc) as rn
         from public.onboarding_logs where user_id is not null and step_name is not null) r
  where o.id = r.id and r.rn > 1;
  get diagnostics n = row_count;
  raise notice 'onboarding_logs: % linha(s) repetida(s) apagada(s)', n;
end $$;
create unique index if not exists onboarding_logs_user_step_key on public.onboarding_logs (user_id, step_name);

-- Conferência que aborta (tudo ou nada) ------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'revenue_advances'
      and permissive = 'PERMISSIVE' and cmd in ('INSERT', 'ALL')) then
    raise exception 'revenue_advances ainda tem regra permissiva de INSERT ou ALL';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'revenue_advances'
      and policyname = 'gf_mfa_aal2' and permissive = 'RESTRICTIVE') then
    raise exception 'gf_mfa_aal2 sumiu de revenue_advances';
  end if;

  if (select prosrc from pg_proc where oid = 'public.gf_protect_producer_profile_privileges'::regproc)
     !~ 'webhook_url' then
    raise exception 'gf_protect_producer_profile_privileges sem as colunas novas';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.producer_profiles'::regclass
      and tgname = 'gf_protect_producer_profile_privileges' and tgenabled = 'O') then
    raise exception 'gatilho gf_protect_producer_profile_privileges ausente ou desligado';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.coupons'::regclass
      and tgname = 'gf_protect_coupon_uses' and tgenabled = 'O') then
    raise exception 'gatilho gf_protect_coupon_uses ausente ou desligado';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'menu_items'
      and policyname = 'gf_menu_items_evento_aprovado' and permissive = 'PERMISSIVE' and cmd = 'SELECT'
      and roles = array['authenticated']::name[] and qual like '%is_available%' and qual like '%approved%') then
    raise exception 'gf_menu_items_evento_aprovado fora do esperado';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'menu_items'
      and policyname = 'gf_mfa_aal2' and permissive = 'RESTRICTIVE') then
    raise exception 'gf_mfa_aal2 sumiu de menu_items';
  end if;

  if not exists (select 1 from pg_index i where i.indexrelid = 'public.onboarding_logs_user_step_key'::regclass
      and i.indisunique and i.indpred is null
      and pg_get_indexdef(i.indexrelid) like '%(user_id, step_name)') then
    raise exception 'onboarding_logs_user_step_key não é índice único (user_id, step_name)';
  end if;
end $$;

commit;

-- Conferência (só leitura). Esperado: revenue_advances sem regra de INSERT; menu_items com
-- gf_menu_items_evento_aprovado (SELECT, authenticated); os dois gatilhos; o índice único de onboarding_logs.
select 'regra' as item, tablename::text as tabela, policyname::text as nome, cmd::text as valor
from pg_policies where schemaname = 'public' and tablename in ('revenue_advances', 'menu_items')
union all
select 'gatilho', tgrelid::regclass::text, tgname::text, tgenabled::text
from pg_trigger where tgname in ('gf_protect_producer_profile_privileges', 'gf_protect_coupon_uses')
union all
select 'indice', tablename::text, indexname::text, indexdef
from pg_indexes where schemaname = 'public' and indexname = 'onboarding_logs_user_step_key'
order by 1, 2, 3;

-- =============================================================================
-- ENSAIO COM ROLLBACK: trocar o "commit;" do fim do bloco de conferência por "rollback;" e rodar tudo; as
-- conferências que abortam já rodaram dentro da transação, e nada fica gravado. Comportamento (o produtor não
-- insere antecipação, não grava as 3 colunas nem `uses`, lê o cardápio de evento aprovado, repetida dá 23505):
-- supabase/tests/produtor_seguranca_l4.test.sql, em banco local.
--
-- Desfazer (volta ao estado de antes; as linhas repetidas apagadas de onboarding_logs NÃO voltam, e o front do
-- PR passa a falhar no upsert: desfazer o PR junto):
-- begin;
-- create policy gf_revenue_advances_insert on public.revenue_advances
--   for insert to authenticated
--   with check (
--     producer_id = (select auth.uid())
--     and status = 'requested'
--     and transferred_at is null
--     and event_id in (select id from public.events where producer_id = (select auth.uid()))
--   );
-- create or replace function public.gf_protect_producer_profile_privileges()
-- returns trigger language plpgsql set search_path = '' as $$
-- begin
--   if (current_user in ('anon', 'authenticated')
--       or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
--      and not public.gf_is_admin() then
--     if tg_op = 'INSERT' then
--       if new.is_verified or new.commission_rate is distinct from 10.00 then
--         raise exception 'Campo protegido não permitido' using errcode = '42501';
--       end if;
--     elsif new.is_verified is distinct from old.is_verified
--        or new.commission_rate is distinct from old.commission_rate then
--       raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
--     end if;
--   end if;
--   return new;
-- end;
-- $$;
-- drop trigger if exists gf_protect_coupon_uses on public.coupons;
-- drop function if exists public.gf_protect_coupon_uses();
-- drop policy if exists gf_menu_items_evento_aprovado on public.menu_items;
-- drop index if exists public.onboarding_logs_user_step_key;
-- commit;
-- =============================================================================
