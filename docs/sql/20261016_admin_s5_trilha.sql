-- ⚠️ NÃO REAPLICAR após o passo 2 do PR 7 (docs/sql/20261007_pr7_cripto_passo2.sql).
-- Este script recria/usa colunas de PII em TEXTO (producer_profiles.cnpj, pix_key, bank_account e platform_affiliates.cpf, citadas nos gatilhos de auditoria e na redação da trilha; profiles.cpf e withdrawals.pix_key/bank_account na lista de ocultas) que o passo 2 APAGOU em produção (07/10/2026).
-- Reaplicar reintroduz PII em claro ou falha. Mantido como histórico; já aplicado no seu tempo.
-- =============================================================================
-- S5 do plano sparkling-gliding-harp (admin, Decisão 163 item 6): TRILHA DE AUDITORIA, PR1 (banco). 04/10/2026.
-- Plano: Claude/Entregas/2026-10-04 Admin — plano da trilha de auditoria (S5). Telas (leitura da trilha, menu, rota) ficam
-- para a S6 / PR2; este arquivo só grava e protege.
--   1. Tabela admin_audit_log (id, criado_em, autor, tipo 'acao'|'leitura', acao, tabela, objeto_id, antes, depois, motivo,
--      ip). IMUTÁVEL em três camadas: sem GRANT a ninguém (nem service_role) e RLS ligada sem regra permissiva; gatilho que
--      recusa UPDATE, DELETE e TRUNCATE (só a limpeza agendada apaga, e só o vencido); só gatilho e funções SECURITY
--      DEFINER (search_path '') inserem. Limite: o dono do banco pode desligar o gatilho (não se fecha dentro do Supabase).
--   2. audit_registra(): gatilho genérico AFTER por linha. Argumentos do gatilho: (coluna do id, colunas VIGIADAS, colunas
--      ocultas). LISTA DE PERMITIDAS: num UPDATE grava só as colunas vigiadas que mudaram (nunca updated_at; lista vazia
--      não grava nada); coluna que não está na lista nunca entra, mesmo mudando junto (o delete-account anonimiza
--      profiles e muda role, admin_permissions e is_verified no mesmo UPDATE: só essas três entram). Colunas ocultas
--      aparecem como "«oculto»" em antes e depois; INSERT e DELETE gravam só as vigiadas (ocultas mascaradas).
--      Motivo: cabeçalho x-evokaa-motivo (base64 UTF-8; sem ele, nulo).
--      IP: NÃO é gravado por enquanto (fica nulo): não está provado que o gateway impede forjar cf-connecting-ip e
--      x-forwarded-for, e IP é dado pessoal. audit_ip_cabecalho() fica pronta e desligada; liga na S6, depois de testar no
--      navegador (trocar o null por public.audit_ip_cabecalho() em audit_registra e nas duas RPCs).
--      INSERT e DELETE seguem a MESMA lista (o id do objeto vai em objeto_id): coluna futura nunca entra em claro.
--      OCULTOS A MAIS (o Jurídico pode liberar depois): dados pessoais de profiles e producer_profiles, pix e conta de
--      withdrawals, e-mail de admin_invites, nome e notas de platform_affiliates, nota de ai_credit_grants, assunto,
--      nome, e-mail e mensagem de contact_messages, user_agent e mensagem de feedback.
--      O motivo NÃO é obrigatório no banco: grava quando vem, nulo quando não vem. NÃO VERIFICADO em produção se o gateway
--      da Supabase deixa o cabeçalho x-evokaa-motivo e o IP chegarem a request.headers; por isso a obrigatoriedade
--      (comissão do produtor e taxa em platform_settings 'fees', Decisão 163) entra na S6, via RPC ou depois de testar
--      o cabeçalho no navegador.
--   3. Gatilhos (AFTER, nome próprio audit_<tabela>_<ins|upd|del>, WHEN só nas colunas que interessam; nenhuma função
--      alheia é recriada): profiles (role, admin_permissions, is_verified), admin_invites (token_hash oculto),
--      producer_profiles (comissão, is_verified; pix_key, bank_account, cnpj, stripe_account_id e
--      woovi_account_id ocultos; webhook_url, notification_settings e company_name nunca entram), withdrawals (status), revenue_advances (status e DELETE), platform_settings (tudo), events (só as 5 colunas de moderação), coupons (só da plataforma ou que deixou de ser, sem contar
--      `uses`), affiliate_coupon_requests, platform_affiliates (dados pessoais ocultos), platform_affiliate_producers,
--      affiliate_links (sem contar `clicks`), feedback e contact_messages (só UPDATE e DELETE; conteúdo oculto),
--      ai_settings, ai_credit_grants (só INSERT), chat_settings, kb_articles (body e busca ocultos), kb_termos, newsletters
--      (content oculto), producer_subscriptions, user_custom_features. Todas as 22 tabelas existem no baseline + docs/sql
--      (conferido no ensaio e no bloco 0).
--      FORA (como no plano): notifications, support_*, conversas do chat, access_logs, user_activities, tabelas do produtor
--      sem tela de admin. LIMITES CONHECIDOS: (a) convite_aceitar tira as claims do JWT durante o UPDATE de profiles
--      (20261002), então a linha de profiles do aceite sai com autor nulo; o autor está na linha de admin_invites
--      (status 'usado', used_by); (b) platform_settings.value é gravado inteiro (só key e value; updated_by/updated_at sozinhos não gravam): nenhum segredo pode morar nele
--      (AdminSettings já tirou a chave de CEP); (c) mudança feita por service_role/SQL Editor também entra, com autor nulo.
--   4. platform_settings.updated_by preenchido pelo gatilho BEFORE platform_settings_updated_by (autor = auth.uid()).
--      withdrawals.processed_by (coluna NOVA, FK para profiles, on delete set null) preenchida pelo BEFORE
--      withdrawals_quem_processou quando o status muda (sem sessão, como service_role ou webhook, zera: nunca
--      deixa o admin anterior). ORDEM: gatilhos BEFORE rodam em ordem alfabética do nome;
--      'withdrawals_quem_processou' vem DEPOIS de 'gf_protect_withdrawals' (S3, que trava toda coluna menos status e
--      processed_at para quem chega pelo site): a proteção vê a linha como o site mandou (processed_by igual ao antigo,
--      passa), e só depois o nosso gatilho preenche. Quem tenta gravar processed_by pelo site leva 42501 da S3.
--      O bloco 0 confere o md5 exato do gf_protect_withdrawals; a conferência final confere a ordem pelo nome.
--   5. RPCs: admin_usuario_ficha(p_user, p_motivo) (manage_users): devolve {perfil, atividades, ingressos} no formato que
--      Users.tsx lê (a lista de usuários, linha 136, segue por leitura direta até a S7b; a RPC cobre a ficha, linhas 174 e
--      182) e registra a leitura; admin_registrar_exportacao(p_tabela, p_linhas, p_motivo) (permissão da área: users e
--      profiles manage_users, events manage_events, orders, transactions e withdrawals manage_finance, user_activities
--      view_analytics; sem a permissão, 42501; tabela fora da lista, 22023); audit_registrar_servico(p_autor, ...) só para
--      service_role (Edge send-email, disparo de campanha). A Edge DEVE passar o autor vindo de getUser do JWT de quem
--      chamou, NUNCA do corpo da requisição (a função confia no argumento). Motivo das RPCs: o argumento, ou o cabeçalho; opcional.
--   6. view_audit entra em convite_permissoes_ok (a lista do convite; Edge admin-invite e TeamManager mudam no mesmo PR).
--      Recriada a partir da definição de 20261002_convite_colaborador.sql com UMA linha a mais.
--   7. Limpeza: audit_limpar() (2 anos para 'acao', 6 meses para 'leitura'; prazos provisórios, o Jurídico confirma),
--      agendada no pg_cron como limpar_admin_audit_log às 03:41 (sem `create extension`).
-- DESVIOS DO PLANO (motivo): producer_profiles também registra stripe_account_id e woovi_account_id (mascarados; são
-- as contas de recebimento que só o super_admin muda, Decisão 163 item 2); exportação aceita 'profiles' e 'withdrawals'
-- (nomes reais das tabelas que AdminSettings e Finance exportam; o plano só listava users, events, orders, transactions,
-- user_activities); objeto_id é text (ai_settings tem id inteiro); contact_messages e feedback não registram INSERT (é o
-- formulário público).
-- ORDEM DE APLICAÇÃO: depois do 20261014 (S3). Não depende do 20261015 (S4). Não muda o comportamento do site (nada é recusado
-- por falta de motivo).
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17). Uma transação só:
-- se o bloco 0 ou a conferência do fim falhar, nada é gravado. Idempotente. `set local lock_timeout = '5s'`: se algo
-- segurar as tabelas, desiste sem gravar; rodar de novo. NÃO mover para supabase/migrations/ (motivo no cabeçalho de
-- 20260927_security_hardening.sql). Teste: supabase/tests/admin_s5_trilha.test.sql (pgTAP; banco descartável).
--
-- PASSO 0 (só leitura; o bloco 0 também confere e aborta). md5 lido NO ENSAIO (banco montado do baseline + docs/sql); em
-- produção, rodar antes e comparar: se diferir, NÃO aplicar, refazer o bloco a partir da definição atual.
--   select 'convite_permissoes_ok' f, md5(pg_get_functiondef('public.convite_permissoes_ok(text[])'::regprocedure))
--   union all select 'gf_protect_withdrawals', md5(pg_get_functiondef('public.gf_protect_withdrawals()'::regprocedure));
--   convite_permissoes_ok a20b93ef210bdfd6e1f788d2451b28c7 | gf_protect_withdrawals 9c576419ef85417faa73fae3d6072a42
--   (2ª aplicação: convite_permissoes_ok aceita também o md5 da versão S5, 1b1c6f515a5f40fa44b382f2133a7281, gravado no bloco 0.)
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos e conferência das definições de produção ----------------------------------------------------------
do $$
declare
  t text;
  c text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron não está ligado: ligar em Database > Extensions antes de rodar este arquivo';
  end if;
  -- S3 aplicada
  if to_regprocedure('public.gf_admin_can_any(text[])') is null then
    raise exception 'falta public.gf_admin_can_any(text[]): aplique antes o 20261014_admin_s3_permissao_dinheiro.sql';
  end if;
  if to_regprocedure('public.gf_admin_can(text)') is null then raise exception 'falta public.gf_admin_can(text)'; end if;
  if to_regprocedure('public.gf_protect_withdrawals()') is null
     or not exists (select 1 from pg_trigger where tgrelid = 'public.withdrawals'::regclass
                    and tgname = 'gf_protect_withdrawals' and tgenabled = 'O') then
    raise exception 'gatilho gf_protect_withdrawals ausente ou desligado: aplique antes o 20261014_admin_s3_permissao_dinheiro.sql';
  end if;
  -- a ordem dos BEFORE (processed_by depois da proteção) vale para ESTA versão da proteção
  if md5(pg_get_functiondef('public.gf_protect_withdrawals()'::regprocedure)) <> '9c576419ef85417faa73fae3d6072a42' then
    raise exception 'public.gf_protect_withdrawals() mudou desde a S3 (md5 diferente): conferir a ordem e o processed_by antes de aplicar';
  end if;
  -- função recriada aqui: ou a do repositório (20261002) ou exatamente a deste arquivo (2ª aplicação)
  if to_regprocedure('public.convite_permissoes_ok(text[])') is null then
    raise exception 'falta public.convite_permissoes_ok(text[]): aplique antes o 20261002_convite_colaborador.sql';
  end if;
  if md5(pg_get_functiondef('public.convite_permissoes_ok(text[])'::regprocedure))
       not in ('a20b93ef210bdfd6e1f788d2451b28c7', '1b1c6f515a5f40fa44b382f2133a7281') then
    raise exception 'public.convite_permissoes_ok(text[]) mudou (md5 diferente do repositório e da S5): refazer o bloco a partir da definição atual';
  end if;
  -- tabelas auditadas
  foreach t in array array['profiles', 'admin_invites', 'producer_profiles', 'withdrawals', 'revenue_advances',
      'platform_settings', 'events', 'coupons', 'affiliate_coupon_requests', 'platform_affiliates',
      'platform_affiliate_producers', 'affiliate_links', 'feedback', 'contact_messages', 'ai_settings', 'ai_credit_grants',
      'chat_settings', 'kb_articles', 'kb_termos', 'newsletters', 'producer_subscriptions', 'user_custom_features',
      'user_activities', 'tickets'] loop
    if to_regclass('public.' || t) is null then raise exception 'falta a tabela public.%', t; end if;
  end loop;
  -- colunas citadas nas condições dos gatilhos e nas RPCs
  for t, c in select * from (values
      ('profiles', 'role'), ('profiles', 'admin_permissions'), ('profiles', 'is_verified'),
      ('admin_invites', 'status'), ('admin_invites', 'permissions'), ('admin_invites', 'token_hash'), ('admin_invites', 'expires_at'),
      ('producer_profiles', 'commission_rate'), ('producer_profiles', 'is_verified'), ('producer_profiles', 'pix_key'),
      ('producer_profiles', 'bank_account'), ('producer_profiles', 'cnpj'), ('producer_profiles', 'stripe_account_id'),
      ('producer_profiles', 'woovi_account_id'),
      ('withdrawals', 'status'), ('withdrawals', 'processed_at'), ('revenue_advances', 'status'),
      ('platform_settings', 'key'), ('platform_settings', 'updated_by'),
      ('events', 'approval_status'), ('events', 'approved_at'), ('events', 'approved_by'), ('events', 'rejection_reason'),
      ('events', 'featured_carousel'), ('coupons', 'producer_id'), ('coupons', 'uses'),
      ('affiliate_coupon_requests', 'status'), ('affiliate_coupon_requests', 'admin_notes'),
      ('affiliate_coupon_requests', 'coupon_id'), ('affiliate_links', 'clicks'), ('feedback', 'status'),
      ('feedback', 'admin_notes'), ('feedback', 'message'), ('kb_articles', 'body'), ('kb_articles', 'busca'),
      ('newsletters', 'content'), ('platform_affiliates', 'cpf'), ('platform_affiliates', 'payout_account_id'),
      ('user_activities', 'user_id'), ('user_activities', 'created_at'), ('tickets', 'user_id'), ('tickets', 'event_id'),
      ('producer_subscriptions', 'producer_id'), ('user_custom_features', 'user_id')) v(a, b) loop
    if not exists (select 1 from information_schema.columns where table_schema = 'public'
        and table_name = t and column_name = c) then
      raise exception 'falta %.%', t, c;
    end if;
  end loop;
  -- tabela e funções novas: ou não existem ou não colidem com o que não é desta S5
  if to_regclass('public.admin_audit_log') is not null
     and not exists (select 1 from information_schema.columns where table_schema = 'public'
                     and table_name = 'admin_audit_log' and column_name = 'objeto_id') then
    raise exception 'public.admin_audit_log já existe e não é a da S5';
  end if;
end $$;

-- 1. Tabela imutável --------------------------------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  -- sem chave estrangeira: a linha sobrevive à exclusão da conta
  autor uuid,
  tipo text not null constraint admin_audit_log_tipo_ok check (tipo in ('acao', 'leitura')),
  acao text not null constraint admin_audit_log_acao_ok check (char_length(acao) between 1 and 60),
  tabela text not null constraint admin_audit_log_tabela_ok check (char_length(tabela) between 1 and 60),
  objeto_id text constraint admin_audit_log_objeto_ok check (char_length(objeto_id) <= 80),
  antes jsonb,
  depois jsonb,
  motivo text constraint admin_audit_log_motivo_ok check (char_length(motivo) <= 500),
  ip inet
);
-- ponytail: sem partição (milhares de linhas por mês); rever acima de ~10 milhões de linhas
create index if not exists admin_audit_log_objeto_idx on public.admin_audit_log (tabela, objeto_id, criado_em desc);
create index if not exists admin_audit_log_autor_idx on public.admin_audit_log (autor, criado_em desc);
create index if not exists admin_audit_log_data_idx on public.admin_audit_log (criado_em desc);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from public, anon, authenticated, service_role;

-- vencido: acao 2 anos, leitura 6 meses (prazos provisórios; o Jurídico confirma). Uma definição só: a limpeza e o gatilho usam esta.
create or replace function public.audit_vencido(p_tipo text, p_em timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case p_tipo when 'acao' then p_em < now() - interval '2 years'
                     when 'leitura' then p_em < now() - interval '6 months'
                     else false end;
$$;

create or replace function public.audit_log_imutavel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- a única exceção: audit_limpar() liga a chave local e a linha já passou do prazo
  if tg_op = 'DELETE' and coalesce(current_setting('evokaa.audit_limpeza', true), '') = 'on'
     and public.audit_vencido(old.tipo, old.criado_em) then
    return old;
  end if;
  raise exception 'A trilha de auditoria não se altera nem se apaga.' using errcode = '42501';
end;
$$;
drop trigger if exists admin_audit_log_imutavel on public.admin_audit_log;
create trigger admin_audit_log_imutavel before update or delete on public.admin_audit_log
  for each row execute function public.audit_log_imutavel();
drop trigger if exists admin_audit_log_sem_truncate on public.admin_audit_log;
create trigger admin_audit_log_sem_truncate before truncate on public.admin_audit_log
  for each statement execute function public.audit_log_imutavel();

create or replace function public.audit_limpar()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  n bigint;
begin
  perform set_config('evokaa.audit_limpeza', 'on', true);
  delete from public.admin_audit_log a where public.audit_vencido(a.tipo, a.criado_em);
  get diagnostics n = row_count;
  perform set_config('evokaa.audit_limpeza', 'off', true);
  return n;
end;
$$;

-- 2. Motivo e IP do pedido (cabeçalhos que o PostgREST põe em request.headers) -----------------------------------------
create or replace function public.audit_motivo_cabecalho()
returns text
language plpgsql
stable
set search_path = ''
as $$
begin
  return nullif(left(btrim(convert_from(decode(nullif(
    current_setting('request.headers', true)::jsonb ->> 'x-evokaa-motivo', ''), 'base64'), 'UTF8')), 500), '');
exception when others then
  return null;
end;
$$;

create or replace function public.audit_ip_cabecalho()
returns inet
language plpgsql
stable
set search_path = ''
as $$
declare
  h jsonb;
  xff text[];
begin
  -- fora do bloco de declaração: valor inválido cai no EXCEPTION e vira nulo
  h := current_setting('request.headers', true)::jsonb;
  xff := string_to_array(h ->> 'x-forwarded-for', ',');
  return coalesce(nullif(btrim(h ->> 'cf-connecting-ip'), ''), nullif(btrim(xff[cardinality(xff)]), ''))::inet;
exception when others then
  return null;
end;
$$;

-- 3. Gatilho genérico -------------------------------------------------------------------------------------------------
-- Argumentos: (coluna do id, colunas vigiadas no UPDATE, colunas ocultas), listas separadas por vírgula.
create or replace function public.audit_registra()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := coalesce(nullif(tg_argv[0], ''), 'id');
  v_vigiadas text[] := string_to_array(coalesce(tg_argv[1], ''), ',');
  v_ocultar text[] := string_to_array(coalesce(tg_argv[2], ''), ',');
  v_old jsonb;
  v_new jsonb;
  v_antes jsonb;
  v_depois jsonb;
  v_motivo text;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;

  if tg_op = 'UPDATE' then
    -- só o que mudou E está na lista de vigiadas
    select coalesce(jsonb_object_agg(n.key, n.value), '{}'::jsonb) into v_depois
      from jsonb_each(v_new) n
      where n.key = any (v_vigiadas) and n.value is distinct from (v_old -> n.key);
    if v_depois = '{}'::jsonb then return null; end if;
    select coalesce(jsonb_object_agg(o.key, o.value), '{}'::jsonb) into v_antes
      from jsonb_each(v_old) o where v_depois ? o.key;
  elsif tg_op = 'INSERT' then
    -- a mesma lista de permitidas: coluna que não está nela (inclusive coluna futura) nunca entra
    select coalesce(jsonb_object_agg(n.key, n.value), '{}'::jsonb) into v_depois from jsonb_each(v_new) n where n.key = any (v_vigiadas);
  else
    select coalesce(jsonb_object_agg(o.key, o.value), '{}'::jsonb) into v_antes from jsonb_each(v_old) o where o.key = any (v_vigiadas);
  end if;

  -- colunas ocultas: o valor nunca entra na trilha, só o fato de existir ou mudar
  v_antes := v_antes || (select coalesce(jsonb_object_agg(k, to_jsonb('«oculto»'::text)), '{}'::jsonb)
                         from unnest(v_ocultar) k where v_antes ? k);
  v_depois := v_depois || (select coalesce(jsonb_object_agg(k, to_jsonb('«oculto»'::text)), '{}'::jsonb)
                           from unnest(v_ocultar) k where v_depois ? k);

  v_motivo := public.audit_motivo_cabecalho();

  insert into public.admin_audit_log (autor, tipo, acao, tabela, objeto_id, antes, depois, motivo, ip)
  values ((select auth.uid()), 'acao', case tg_op when 'INSERT' then 'criar' when 'UPDATE' then 'alterar' else 'excluir' end,
          tg_table_name, coalesce(v_new, v_old) ->> v_id, v_antes, v_depois, v_motivo, null /* IP desligado: public.audit_ip_cabecalho() na S6 */);
  return null;
end;
$$;

-- 4. platform_settings.updated_by e withdrawals.processed_by ----------------------------------------------------------
create or replace function public.platform_settings_updated_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- quem chega com sessão grava; service_role e SQL Editor (sem auth.uid) deixam como veio
  if (select auth.uid()) is not null then new.updated_by := (select auth.uid()); end if;
  return new;
end;
$$;
drop trigger if exists platform_settings_updated_by on public.platform_settings;
create trigger platform_settings_updated_by before insert or update on public.platform_settings
  for each row execute function public.platform_settings_updated_by();

alter table public.withdrawals add column if not exists processed_by uuid references public.profiles(id) on delete set null;
create index if not exists withdrawals_processed_by_idx on public.withdrawals (processed_by) where processed_by is not null;

-- Nome começa com 'w': roda DEPOIS de gf_protect_withdrawals (S3) na ordem alfabética dos BEFORE.
create or replace function public.withdrawals_quem_processou()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.processed_by := null; -- saque novo ainda não foi processado por ninguém
  elsif new.status is distinct from old.status then
    -- sem sessão (service_role, webhook) fica nulo: nunca mantém o admin do status anterior
    new.processed_by := (select auth.uid());
  end if;
  return new;
end;
$$;
drop trigger if exists withdrawals_quem_processou on public.withdrawals;
create trigger withdrawals_quem_processou before insert or update on public.withdrawals
  for each row execute function public.withdrawals_quem_processou();

-- 5. Gatilhos de auditoria (tabela por tabela; WHEN nas colunas que interessam) -----------------------------------------
-- Cada item: t = tabela; ins/upd/del = condição WHEN do gatilho (ausente = sem gatilho nesse evento); o = colunas
-- ocultas; v = colunas vigiadas no UPDATE.
do $$
declare
  spec jsonb := $j$[
    {"t":"profiles","upd":"old.role is distinct from new.role or old.admin_permissions is distinct from new.admin_permissions or old.is_verified is distinct from new.is_verified","v":"role,admin_permissions,is_verified","o":"email,full_name,phone,cpf,avatar_url,bio,city,birth_date,instagram,tiktok,linkedin,website,stripe_customer_id,avatar_moderacao_hash"},
    {"t":"admin_invites","ins":"true","upd":"old.status is distinct from new.status or old.permissions is distinct from new.permissions or old.token_hash is distinct from new.token_hash or old.expires_at is distinct from new.expires_at","v":"status,permissions,token_hash,expires_at","o":"token_hash,email"},
    {"t":"producer_profiles","upd":"old.commission_rate is distinct from new.commission_rate or old.is_verified is distinct from new.is_verified or old.pix_key is distinct from new.pix_key or old.bank_account is distinct from new.bank_account or old.cnpj is distinct from new.cnpj or old.stripe_account_id is distinct from new.stripe_account_id or old.woovi_account_id is distinct from new.woovi_account_id","v":"commission_rate,is_verified,pix_key,bank_account,cnpj,stripe_account_id,woovi_account_id","o":"pix_key,bank_account,cnpj,stripe_account_id,woovi_account_id,webhook_url,notification_settings,company_name,api_key"},
    {"t":"withdrawals","upd":"old.status is distinct from new.status","v":"status,processed_at,processed_by","o":"pix_key,bank_account"},
    {"t":"revenue_advances","upd":"old.status is distinct from new.status","del":"true","v":"producer_id,event_id,amount,status,transferred_at"},
    {"t":"platform_settings","ins":"true","upd":"old.key is distinct from new.key or old.value is distinct from new.value","del":"true","v":"key,value"},
    {"t":"events","upd":"old.approval_status is distinct from new.approval_status or old.approved_at is distinct from new.approved_at or old.approved_by is distinct from new.approved_by or old.rejection_reason is distinct from new.rejection_reason or old.featured_carousel is distinct from new.featured_carousel","v":"approval_status,approved_at,approved_by,rejection_reason,featured_carousel"},
    {"t":"coupons","ins":"new.producer_id is null","upd":"(old.producer_id is null or new.producer_id is null) and (to_jsonb(new) - 'uses' - 'updated_at') is distinct from (to_jsonb(old) - 'uses' - 'updated_at')","del":"old.producer_id is null","v":"producer_id,event_id,code,discount_type,discount_value,max_uses,valid_until,valid_from,is_active,description,max_uses_per_user,min_order_value,max_discount,audience,plans,duration,duration_months,affiliate_id,upgrade_from"},
    {"t":"affiliate_coupon_requests","upd":"old.status is distinct from new.status or old.admin_notes is distinct from new.admin_notes or old.coupon_id is distinct from new.coupon_id","del":"true","v":"affiliate_id,status,admin_notes,coupon_id,decided_at,decided_by,discount_percent,valid_days,plans"},
    {"t":"platform_affiliates","ins":"true","upd":"old.* is distinct from new.*","del":"true","v":"user_id,referral_code,recurring_percent,status,agreement_date,full_name,notes,cpf,payout_account_id","o":"full_name,notes,cpf,birth_date,email,phone,whatsapp,cep,street,street_number,complement,neighborhood,city,state,payout_account_id"},
    {"t":"platform_affiliate_producers","ins":"true","upd":"old.* is distinct from new.*","del":"true","v":"producer_id,affiliate_id,source,ended_at,ended_by,affiliate_link_id"},
    {"t":"affiliate_links","ins":"true","upd":"(to_jsonb(new) - 'clicks') is distinct from (to_jsonb(old) - 'clicks')","del":"true","v":"affiliate_id,slug,label,is_active"},
    {"t":"feedback","upd":"old.status is distinct from new.status or old.admin_notes is distinct from new.admin_notes","del":"true","v":"status,admin_notes,message,user_agent","o":"message,user_agent"},
    {"t":"contact_messages","upd":"old.* is distinct from new.*","del":"true","v":"name,email,phone,subject,message","o":"name,email,phone,subject,message"},
    {"t":"ai_settings","ins":"true","upd":"old.* is distinct from new.*","del":"true","v":"enabled,model_router,model_simple,model_complex,model_vision,prices,usd_brl,daily_cap_brl,hourly_limit,quotas,credit_cost,max_steps,max_output_tokens,key_updated_at,key_updated_by"},
    {"t":"ai_credit_grants","ins":"true","v":"user_id,amount,created_by","o":"note"},
    {"t":"chat_settings","ins":"true","upd":"old.* is distinct from new.*","v":"hours,response_time,team_email,bot_enabled"},
    {"t":"kb_articles","ins":"true","upd":"old.* is distinct from new.*","del":"true","v":"slug,title,body,keywords,audience,department_id,status,review_note","o":"body,busca"},
    {"t":"kb_termos","ins":"true","upd":"old.* is distinct from new.*","del":"true","v":"forma,normal"},
    {"t":"newsletters","ins":"true","upd":"old.* is distinct from new.*","del":"true","v":"title,content,status,sent_at,recipient_count","o":"content"},
    {"t":"producer_subscriptions","ins":"true","upd":"old.* is distinct from new.*","del":"true","v":"producer_id,plan,started_at,expires_at,is_active"},
    {"t":"user_custom_features","ins":"true","upd":"old.* is distinct from new.*","del":"true","v":"user_id,feature_key,expires_at"}
  ]$j$::jsonb;
  s jsonb;
  ev record;
  nome text;
begin
  for s in select * from jsonb_array_elements(spec) loop
    for ev in select * from (values ('ins', 'insert'), ('upd', 'update'), ('del', 'delete')) v(k, op) loop
      continue when s ->> ev.k is null;
      nome := 'audit_' || (s ->> 't') || '_' || ev.k;
      execute format('drop trigger if exists %I on public.%I', nome, s ->> 't');
      execute format('create trigger %I after %s on public.%I for each row when (%s) execute function public.audit_registra(%L, %L, %L)',
        nome, ev.op, s ->> 't', s ->> ev.k, 'id', coalesce(s ->> 'v', ''), coalesce(s ->> 'o', ''));
    end loop;
  end loop;
end $$;

-- 6. RPCs de leitura e de serviço -------------------------------------------------------------------------------------
-- Ficha do usuário (Users.tsx: perfil com plano e recursos, atividades e ingressos). Registra a leitura.
create or replace function public.admin_usuario_ficha(p_user uuid, p_motivo text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_perfil jsonb;
begin
  if not public.gf_admin_can('manage_users') then
    raise exception 'Só quem gerencia usuários vê a ficha.' using errcode = '42501';
  end if;
  select jsonb_build_object('id', p.id, 'email', p.email, 'full_name', p.full_name, 'phone', p.phone, 'role', p.role,
      'created_at', p.created_at, 'avatar_url', p.avatar_url,
      'producer_subscriptions', coalesce((select jsonb_agg(jsonb_build_object('plan', s.plan, 'expires_at', s.expires_at,
          'is_active', s.is_active)) from public.producer_subscriptions s where s.producer_id = p.id), '[]'::jsonb),
      'user_custom_features', coalesce((select jsonb_agg(jsonb_build_object('feature_key', f.feature_key,
          'expires_at', f.expires_at)) from public.user_custom_features f where f.user_id = p.id), '[]'::jsonb))
    into v_perfil from public.profiles p where p.id = p_user;
  if v_perfil is null then
    raise exception 'Usuário não encontrado.' using errcode = 'P0001';
  end if;
  insert into public.admin_audit_log (autor, tipo, acao, tabela, objeto_id, motivo, ip)
  values ((select auth.uid()), 'leitura', 'ver_ficha', 'profiles', p_user::text,
          coalesce(nullif(left(btrim(p_motivo), 500), ''), public.audit_motivo_cabecalho()), null /* IP desligado */);
  return jsonb_build_object('perfil', v_perfil,
    'atividades', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc)
      from (select * from public.user_activities where user_id = p_user order by created_at desc limit 1000) a), '[]'::jsonb),
    'ingressos', coalesce((select jsonb_agg(jsonb_build_object('event_id', t.event_id))
      from public.tickets t where t.user_id = p_user), '[]'::jsonb));
end;
$$;

-- Exportação de CSV: o front chama ANTES de baixar (sem registro, não baixa). Permissão da área da tabela.
create or replace function public.admin_registrar_exportacao(p_tabela text, p_linhas int, p_motivo text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_perm text := case p_tabela
    when 'users' then 'manage_users' when 'profiles' then 'manage_users'
    when 'events' then 'manage_events'
    when 'orders' then 'manage_finance' when 'transactions' then 'manage_finance' when 'withdrawals' then 'manage_finance'
    when 'user_activities' then 'view_analytics' end;
begin
  if v_perm is null then
    raise exception 'Tabela de exportação desconhecida.' using errcode = '22023';
  end if;
  if not public.gf_admin_can(v_perm) then
    raise exception 'Sem permissão para exportar esta área.' using errcode = '42501';
  end if;
  if p_linhas is null or p_linhas < 0 then
    raise exception 'Número de linhas inválido.' using errcode = '22023';
  end if;
  insert into public.admin_audit_log (autor, tipo, acao, tabela, depois, motivo, ip)
  values ((select auth.uid()), 'leitura', 'exportar', p_tabela, jsonb_build_object('linhas', p_linhas),
          coalesce(nullif(left(btrim(p_motivo), 500), ''), public.audit_motivo_cabecalho()), null /* IP desligado */);
end;
$$;

-- Registro feito por Edge Function com a chave de serviço (ex.: send-email, disparo de campanha). Só service_role executa.
-- p_autor: a Edge passa o id vindo de getUser do JWT de quem chamou, NUNCA do corpo da requisição.
create or replace function public.audit_registrar_servico(p_autor uuid, p_acao text, p_tabela text,
  p_objeto_id text default null, p_depois jsonb default null, p_motivo text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.admin_audit_log (autor, tipo, acao, tabela, objeto_id, depois, motivo, ip)
  values (p_autor, 'acao', p_acao, p_tabela, p_objeto_id, p_depois, nullif(left(btrim(p_motivo), 500), ''), null /* IP desligado */);
end;
$$;

-- 7. view_audit na lista do convite (a mesma de 20261002 e 1 linha a mais) ------------------------------------------------
create or replace function public.convite_permissoes_ok(p text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is not null
     and array_position(p, null) is null
     and p <@ array['manage_users', 'manage_affiliates', 'manage_events', 'manage_finance', 'view_analytics',
                    'manage_tickets', 'manage_settings', 'manage_feedback', 'manage_support', 'manage_newsletter',
                    'manage_coupons', 'moderate_mesa', 'manage_team', 'view_audit']::text[];
$$;

-- 8. Dono, EXECUTE e search_path: o Supabase dá EXECUTE a anon/authenticated por padrão; aqui só o mínimo -----------------
do $$
declare
  f regprocedure;
begin
  foreach f in array array[
    'public.audit_vencido(text, timestamptz)', 'public.audit_log_imutavel()', 'public.audit_limpar()',
    'public.audit_motivo_cabecalho()', 'public.audit_ip_cabecalho()', 'public.audit_registra()',
    'public.platform_settings_updated_by()', 'public.withdrawals_quem_processou()',
    'public.admin_usuario_ficha(uuid, text)', 'public.admin_registrar_exportacao(text, int, text)',
    'public.audit_registrar_servico(uuid, text, text, text, jsonb, text)']::regprocedure[] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
end;
$$;
grant execute on function public.admin_usuario_ficha(uuid, text), public.admin_registrar_exportacao(text, int, text) to authenticated;
grant execute on function public.audit_registrar_servico(uuid, text, text, text, jsonb, text) to service_role;
-- (gatilhos e auxiliares: só o banco chama, de dentro de funções do dono)

-- 9. Limpeza diária (pg_cron já conferido no bloco 0; NÃO usar `create extension`, erro 2BP01) --------------------------
select cron.unschedule('limpar_admin_audit_log') where exists (select 1 from cron.job where jobname = 'limpar_admin_audit_log');
select cron.schedule('limpar_admin_audit_log', '41 3 * * *', $$select public.audit_limpar()$$);

-- 10. Conferência obrigatória: se faltar algo, nada deste arquivo é gravado -----------------------------------------------
do $$
declare
  t text;
  n int;
  esperados text[] := array[
    'audit_profiles_upd', 'audit_admin_invites_ins', 'audit_admin_invites_upd', 'audit_producer_profiles_upd',
    'audit_withdrawals_upd', 'audit_revenue_advances_upd', 'audit_revenue_advances_del', 'audit_platform_settings_ins',
    'audit_platform_settings_upd', 'audit_platform_settings_del', 'audit_events_upd', 'audit_coupons_ins',
    'audit_coupons_upd', 'audit_coupons_del', 'audit_affiliate_coupon_requests_upd', 'audit_affiliate_coupon_requests_del',
    'audit_platform_affiliates_ins', 'audit_platform_affiliates_upd', 'audit_platform_affiliates_del',
    'audit_platform_affiliate_producers_ins', 'audit_platform_affiliate_producers_upd',
    'audit_platform_affiliate_producers_del', 'audit_affiliate_links_ins', 'audit_affiliate_links_upd',
    'audit_affiliate_links_del', 'audit_feedback_upd', 'audit_feedback_del', 'audit_contact_messages_upd',
    'audit_contact_messages_del', 'audit_ai_settings_ins', 'audit_ai_settings_upd', 'audit_ai_settings_del',
    'audit_ai_credit_grants_ins', 'audit_chat_settings_ins', 'audit_chat_settings_upd', 'audit_kb_articles_ins',
    'audit_kb_articles_upd', 'audit_kb_articles_del', 'audit_kb_termos_ins', 'audit_kb_termos_upd', 'audit_kb_termos_del',
    'audit_newsletters_ins', 'audit_newsletters_upd', 'audit_newsletters_del', 'audit_producer_subscriptions_ins',
    'audit_producer_subscriptions_upd', 'audit_producer_subscriptions_del', 'audit_user_custom_features_ins',
    'audit_user_custom_features_upd', 'audit_user_custom_features_del'];
begin
  -- tabela: RLS ligada, nenhum privilégio a ninguém da API
  if not (select relrowsecurity from pg_class where oid = 'public.admin_audit_log'::regclass) then
    raise exception 'admin_audit_log sem RLS';
  end if;
  foreach t in array array['anon', 'authenticated', 'service_role'] loop
    if has_table_privilege(t, 'public.admin_audit_log', 'select, insert, update, delete, truncate, references, trigger') then
      raise exception 'admin_audit_log: % ainda tem privilégio', t;
    end if;
  end loop;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_audit_log'
             and permissive = 'PERMISSIVE') then
    raise exception 'admin_audit_log tem regra permissiva';
  end if;
  -- imutabilidade
  if (select count(*) from pg_trigger where tgrelid = 'public.admin_audit_log'::regclass and not tgisinternal
        and tgenabled = 'O' and tgname in ('admin_audit_log_imutavel', 'admin_audit_log_sem_truncate')) <> 2 then
    raise exception 'gatilhos de imutabilidade ausentes ou desligados';
  end if;
  -- gatilhos de auditoria: todos, ligados, AFTER
  foreach t in array esperados loop
    if not exists (select 1 from pg_trigger where tgname = t and not tgisinternal and tgenabled = 'O'
                   and (tgtype & 2) = 0 and tgfoid = 'public.audit_registra()'::regprocedure) then
      raise exception 'gatilho % ausente, desligado ou não é AFTER de audit_registra', t;
    end if;
  end loop;
  select count(*) into n from pg_trigger where tgfoid = 'public.audit_registra()'::regprocedure and not tgisinternal;
  if n <> cardinality(esperados) then
    raise exception 'audit_registra tem % gatilhos (esperado %)', n, cardinality(esperados);
  end if;
  -- ordem dos BEFORE de withdrawals e platform_settings
  if not exists (select 1 from pg_trigger a, pg_trigger b
                 where a.tgrelid = 'public.withdrawals'::regclass and a.tgname = 'gf_protect_withdrawals'
                   and b.tgrelid = 'public.withdrawals'::regclass and b.tgname = 'withdrawals_quem_processou'
                   and a.tgenabled = 'O' and b.tgenabled = 'O' and (a.tgtype & 2) = 2 and (b.tgtype & 2) = 2
                   and a.tgname < b.tgname collate "C") then
    raise exception 'withdrawals_quem_processou precisa ser BEFORE e vir depois de gf_protect_withdrawals';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.platform_settings'::regclass
                 and tgname = 'platform_settings_updated_by' and tgenabled = 'O' and (tgtype & 2) = 2) then
    raise exception 'platform_settings_updated_by ausente';
  end if;
  -- funções: dono, SECURITY DEFINER onde precisa, search_path vazio, EXECUTE mínimo
  for t in select unnest(array['public.audit_limpar()', 'public.audit_registra()', 'public.admin_usuario_ficha(uuid, text)',
      'public.admin_registrar_exportacao(text, int, text)', 'public.audit_registrar_servico(uuid, text, text, text, jsonb, text)']) loop
    if not (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = t::regprocedure) then
      raise exception '% sem SECURITY DEFINER ou search_path', t;
    end if;
  end loop;
  if has_function_privilege('anon', 'public.admin_usuario_ficha(uuid, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.admin_usuario_ficha(uuid, text)', 'execute')
     or has_function_privilege('anon', 'public.admin_registrar_exportacao(text, int, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.admin_registrar_exportacao(text, int, text)', 'execute') then
    raise exception 'RPCs de admin: anon executa ou authenticated não executa';
  end if;
  if has_function_privilege('anon', 'public.audit_registrar_servico(uuid, text, text, text, jsonb, text)', 'execute')
     or has_function_privilege('authenticated', 'public.audit_registrar_servico(uuid, text, text, text, jsonb, text)', 'execute')
     or not has_function_privilege('service_role', 'public.audit_registrar_servico(uuid, text, text, text, jsonb, text)', 'execute') then
    raise exception 'audit_registrar_servico: só service_role executa';
  end if;
  foreach t in array array['public.audit_limpar()', 'public.audit_registra()', 'public.audit_vencido(text, timestamptz)',
      'public.audit_motivo_cabecalho()', 'public.audit_ip_cabecalho()'] loop
    if has_function_privilege('anon', t::regprocedure, 'execute') or has_function_privilege('authenticated', t::regprocedure, 'execute')
       or has_function_privilege('service_role', t::regprocedure, 'execute') then
      raise exception '%: executável pela API', t;
    end if;
  end loop;
  -- coluna e permissão novas
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'withdrawals'
                 and column_name = 'processed_by') then
    raise exception 'falta withdrawals.processed_by';
  end if;
  if not public.convite_permissoes_ok(array['view_audit', 'manage_users']) or public.convite_permissoes_ok(array['super_admin']) then
    raise exception 'convite_permissoes_ok: view_audit não entrou ou super_admin passou';
  end if;
  -- limpeza agendada
  if not exists (select 1 from cron.job where jobname = 'limpar_admin_audit_log' and schedule = '41 3 * * *') then
    raise exception 'job limpar_admin_audit_log não agendado';
  end if;
end $$;

commit;

-- Conferência (só leitura). Esperado: todos ligados (true), um ou mais gatilhos por tabela.
select c.relname::text as tabela, count(*) as gatilhos, bool_and(t.tgenabled = 'O') as ligados
from pg_trigger t join pg_class c on c.oid = t.tgrelid
where t.tgfoid = 'public.audit_registra()'::regprocedure and not t.tgisinternal
group by 1 order by 1;

-- =============================================================================
-- Desfazer (apaga a trilha inteira; só se a S5 nunca foi usada de verdade, senão guardar a tabela antes com
-- `create table ... as select`). Rodar os `drop` numa transação:
-- begin;
-- select cron.unschedule('limpar_admin_audit_log') where exists (select 1 from cron.job where jobname = 'limpar_admin_audit_log');
-- do $f$ declare r record; begin
--   for r in select tgrelid::regclass as tb, tgname from pg_trigger
--            where tgfoid = 'public.audit_registra()'::regprocedure and not tgisinternal loop
--     execute format('drop trigger %I on %s', r.tgname, r.tb);
--   end loop; end $f$;
-- drop trigger if exists platform_settings_updated_by on public.platform_settings;
-- drop trigger if exists withdrawals_quem_processou on public.withdrawals;
-- drop function if exists public.platform_settings_updated_by(), public.withdrawals_quem_processou();
-- alter table public.withdrawals drop column if exists processed_by;
-- drop function if exists public.admin_usuario_ficha(uuid, text), public.admin_registrar_exportacao(text, int, text),
--   public.audit_registrar_servico(uuid, text, text, text, jsonb, text), public.audit_registra(),
--   public.audit_limpar(), public.audit_motivo_cabecalho(), public.audit_ip_cabecalho();
-- drop table if exists public.admin_audit_log;
-- drop function if exists public.audit_log_imutavel(), public.audit_vencido(text, timestamptz);
-- create or replace function public.convite_permissoes_ok(p text[])
-- returns boolean
-- language sql
-- immutable
-- set search_path = ''
-- as $$
--   select p is not null
--      and array_position(p, null) is null
--      and p <@ array['manage_users', 'manage_affiliates', 'manage_events', 'manage_finance', 'view_analytics',
--                     'manage_tickets', 'manage_settings', 'manage_feedback', 'manage_support', 'manage_newsletter',
--                     'manage_coupons', 'moderate_mesa', 'manage_team']::text[];
-- $$;
-- -- corpo EXATO de 20261002_convite_colaborador.sql: confere o md5 da produção
-- do $f$ begin
--   if md5(pg_get_functiondef('public.convite_permissoes_ok(text[])'::regprocedure)) <> 'a20b93ef210bdfd6e1f788d2451b28c7' then
--     raise exception 'convite_permissoes_ok não voltou à versão de 20261002 (md5 diferente)';
--   end if;
-- end $f$;
-- commit;
-- (a tabela cai sem passar pelo gatilho de imutabilidade: DROP TABLE não é UPDATE, DELETE nem TRUNCATE)
-- =============================================================================
