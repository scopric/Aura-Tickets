-- =============================================================================
-- Evo, o agente de IA do produtor (Etapa 1) — banco — 2026-09-29
-- Aplicar à mão no SQL Editor do Supabase. NÃO vai para supabase/migrations (Decisão 02).
-- Contrato: ai_settings (1 linha), ai_usage (registro de cada chamada), ai_credit_grants
-- (créditos extras dados pelo admin) e as funções que o servidor (Edge Function "agent",
-- service_role) e o front (authenticated) chamam.
-- A chave do Gemini fica no Vault (segredo "gemini_api_key"); só o service_role a lê.
-- Nenhuma função grava a chave em tabela, log ou mensagem de erro.
-- O Supabase dá EXECUTE/ALL a anon e authenticated por padrão (default privileges): por isso
-- cada função e tabela tem revoke explícito seguido do grant mínimo.
-- Pré-requisitos: public.profiles.admin_permissions (text[]) e a extensão
-- supabase_vault. Idempotente: pode rodar de novo.
-- =============================================================================
begin;

-- 0. gf_admin_can: admin com a permissão pedida (ou super_admin). As telas de admin já exigem
--    a permissão (ProtectedRoute requiredPermission); aqui o banco exige a mesma coisa.
create or replace function public.gf_admin_can(p text)
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
      and ('super_admin' = any(pr.admin_permissions) or p = any(pr.admin_permissions))
  );
$$;
revoke all on function public.gf_admin_can(text) from public, anon, authenticated, service_role;
grant execute on function public.gf_admin_can(text) to authenticated;

-- 1. ai_settings: uma linha só (id = 1). Admin (manage_settings) lê e altera; ninguém insere nem apaga.
create table if not exists public.ai_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  model_router text not null default 'gemini-3.1-flash-lite',
  model_simple text not null default 'gemini-3.1-flash-lite',
  model_complex text not null default 'gemini-3.8-flash',
  model_vision text not null default 'gemini-3.8-flash',
  -- US$ por 1 milhão de tokens (ai.google.dev/gemini-api/docs/pricing, 29/09/2026;
  -- os 3.x Flash dobram em 01/01/2027)
  prices jsonb not null default '{"gemini-3.1-flash-lite":{"in":0.25,"out":1.5},"gemini-3.5-flash-lite":{"in":0.30,"out":2.5},"gemini-3.8-flash":{"in":0.75,"out":3.75},"gemini-3.7-flash":{"in":0.75,"out":3.75},"gemini-3.1-pro-preview":{"in":2,"out":12}}',
  usd_brl numeric(8,4) not null default 5.213,
  daily_cap_brl numeric(10,2) not null default 50,
  hourly_limit int not null default 20,
  quotas jsonb not null default '{"free":5,"starter":5,"plus":20,"pro":60,"enterprise":1000}',
  credit_cost jsonb not null default '{"simples":1,"complexo":3,"imagem":5}',
  max_steps int not null default 5 check (max_steps between 1 and 8),
  max_output_tokens int not null default 2048 check (max_output_tokens between 256 and 8192),
  key_updated_at timestamptz,
  key_updated_by uuid,
  updated_at timestamptz default now()
);
insert into public.ai_settings (id) values (1) on conflict do nothing;

alter table public.ai_settings enable row level security;
revoke all on public.ai_settings from anon, authenticated;
grant select, update on public.ai_settings to authenticated;
drop policy if exists ai_settings_admin_select on public.ai_settings;
create policy ai_settings_admin_select on public.ai_settings
  for select to authenticated
  using ((select public.gf_admin_can('manage_settings')));
drop policy if exists ai_settings_admin_update on public.ai_settings;
create policy ai_settings_admin_update on public.ai_settings
  for update to authenticated
  using ((select public.gf_admin_can('manage_settings')))
  with check ((select public.gf_admin_can('manage_settings')));

-- 2. ai_usage: uma linha por pergunta. Só o servidor grava (via ai_reserve/ai_finish).
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  mode text not null check (mode in ('chat', 'planejar', 'ping')),
  tier text not null check (tier in ('simples', 'complexo', 'imagem', 'fora_do_escopo')),
  model text,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  cost_usd numeric(12,6) not null default 0,
  credits int not null default 0,
  steps int not null default 0,
  tools text[] not null default '{}',
  status text not null default 'pendente' check (status in ('pendente', 'ok', 'erro')),
  resumo text check (char_length(resumo) <= 500),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);
create index if not exists ai_usage_created_idx on public.ai_usage (created_at);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;
drop policy if exists ai_usage_select_own_or_admin on public.ai_usage;
create policy ai_usage_select_own_or_admin on public.ai_usage
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.gf_admin_can('manage_settings')));

-- 3. ai_credit_grants: créditos extras. Dono e admin leem; só admin concede.
create table if not exists public.ai_credit_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null check (amount between 1 and 10000),
  note text check (char_length(note) <= 200),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
-- índice da FK; também atende a soma "concedido no mês" de ai_saldo
create index if not exists ai_credit_grants_user_created_idx on public.ai_credit_grants (user_id, created_at);

alter table public.ai_credit_grants enable row level security;
revoke all on public.ai_credit_grants from anon, authenticated;
grant select, insert on public.ai_credit_grants to authenticated;
drop policy if exists ai_credit_grants_select_own_or_admin on public.ai_credit_grants;
create policy ai_credit_grants_select_own_or_admin on public.ai_credit_grants
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.gf_admin_can('manage_settings')));
drop policy if exists ai_credit_grants_admin_insert on public.ai_credit_grants;
create policy ai_credit_grants_admin_insert on public.ai_credit_grants
  for insert to authenticated
  with check ((select public.gf_admin_can('manage_settings')) and created_by = (select auth.uid()));

-- 4. ai_saldo (interna): regra única de plano/cota/uso, usada por ai_reserve, ai_precheck e ai_balance.
--    SECURITY INVOKER e sem EXECUTE para ninguém: só roda de dentro das funções SECURITY
--    DEFINER acima dela (que executam como o dono). "Mês" e "hoje" no fuso de São Paulo.
create or replace function public.ai_saldo(p_user uuid)
returns table (plano text, cota int, concedido int, usado int, periodo text)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_quotas jsonb;
  v_mes timestamptz := date_trunc('month', now(), 'America/Sao_Paulo');
  v_modulo boolean;
begin
  select s.quotas into v_quotas from public.ai_settings s where s.id = 1;

  select ps.plan into plano
  from public.producer_subscriptions ps
  where ps.producer_id = p_user
    and ps.is_active
    and (ps.expires_at is null or ps.expires_at > now());
  plano := coalesce(plano, 'free');
  cota := coalesce((v_quotas->>plano)::int, 0);

  -- módulo "agent" liberado e não vencido: sobe a cota até a do pro e passa a contar por mês
  v_modulo := exists (
    select 1 from public.user_custom_features f
    where f.user_id = p_user
      and f.feature_key = 'agent'
      and (f.expires_at is null or f.expires_at > now())
  );
  if v_modulo and cota < coalesce((v_quotas->>'pro')::int, 0) then
    cota := (v_quotas->>'pro')::int;
  end if;

  -- free sem módulo é amostra: conta o uso de todo o tempo; os demais, o mês corrente
  periodo := case when plano = 'free' and not v_modulo then 'total' else 'mes' end;

  -- concedido segue o mesmo período do usado (senão, no "total", o saldo ficaria negativo para
  -- sempre depois da virada do mês)
  select coalesce(sum(g.amount), 0) into concedido
  from public.ai_credit_grants g
  where g.user_id = p_user
    and (periodo = 'total' or g.created_at >= v_mes);

  -- erro não gasta crédito do produtor (a pergunta que falhou não conta)
  select coalesce(sum(u.credits), 0) into usado
  from public.ai_usage u
  where u.user_id = p_user
    and u.status <> 'erro'
    and (periodo = 'total' or u.created_at >= v_mes);

  return next;
end;
$$;

-- 4a. ai_custo (interna): US$ de uma chamada pelos preços de ai_settings.prices.
--     Modelo sem preço NÃO falha (a IA já respondeu; perder o registro seria pior): usa o maior
--     preço de entrada e o maior de saída da tabela (conservador) e avisa com raise warning.
--     Sem EXECUTE para ninguém (só roda de dentro das funções abaixo).
create or replace function public.ai_custo(p_model text, p_in bigint, p_out bigint)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
  v_prices jsonb;
  v_in numeric;
  v_out numeric;
begin
  select s.prices into v_prices from public.ai_settings s where s.id = 1;
  v_in := (v_prices -> p_model ->> 'in')::numeric;
  v_out := (v_prices -> p_model ->> 'out')::numeric;
  if v_in is null or v_out is null then
    raise warning 'ai_settings.prices sem preço para o modelo %; usando o maior preço da tabela', p_model;
    select max((p.value ->> 'in')::numeric), max((p.value ->> 'out')::numeric)
      into v_in, v_out
    from jsonb_each(v_prices) p;
  end if;
  return (greatest(coalesce(p_in, 0), 0) * coalesce(v_in, 0)
        + greatest(coalesce(p_out, 0), 0) * coalesce(v_out, 0)) / 1e6;
end;
$$;

-- 4b. ai_portoes (interna): desligado, teto diário e limite por hora, na mesma ordem para
--     ai_reserve e ai_precheck. Devolve null se passou, ou {ok:false, motivo}. Sem EXECUTE.
--     Custo de hoje = finalizadas de hoje + estimativa das pendentes das últimas 2 h (pior caso:
--     max_steps + 2 chamadas, cada uma com 20 mil tokens de entrada e max_output_tokens de saída).
--     ponytail: estimativa de pior caso, sem lock global; várias perguntas simultâneas ainda podem
--     passar um pouco do teto. Pendente com mais de 2 h é abandonada (função caiu) e fica fora.
create or replace function public.ai_portoes(p_user uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  s public.ai_settings;
begin
  select * into s from public.ai_settings where id = 1;
  if not coalesce(s.enabled, false) then
    return jsonb_build_object('ok', false, 'motivo', 'desligado');
  end if;

  if ((select coalesce(sum(u.cost_usd), 0) from public.ai_usage u
       where u.created_at >= date_trunc('day', now(), 'America/Sao_Paulo')
         and u.status <> 'pendente')
      + (select coalesce(sum(public.ai_custo(u.model,
                                             (s.max_steps + 2) * 20000,
                                             (s.max_steps + 2) * s.max_output_tokens)), 0)
         from public.ai_usage u
         where u.status = 'pendente' and u.created_at > now() - interval '2 hours')
     ) * s.usd_brl >= s.daily_cap_brl then
    return jsonb_build_object('ok', false, 'motivo', 'teto_diario');
  end if;

  if (select count(*) from public.ai_usage u
      where u.user_id = p_user and u.created_at > now() - interval '1 hour') >= s.hourly_limit then
    return jsonb_build_object('ok', false, 'motivo', 'limite_hora');
  end if;

  return null;
end;
$$;

-- 5. ai_set_gemini_key: admin grava/troca a chave no Vault.
create or replace function public.ai_set_gemini_key(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := trim(p_key);
  v_id uuid;
begin
  if not public.gf_admin_can('manage_settings') then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if v_key is null or char_length(v_key) not between 20 and 200 then
    raise exception 'Chave inválida: deve ter entre 20 e 200 caracteres' using errcode = '22023';
  end if;

  select s.id into v_id from vault.secrets s where s.name = 'gemini_api_key';
  if v_id is null then
    perform vault.create_secret(v_key, 'gemini_api_key', 'Chave da API do Google Gemini (Evo)');
  else
    perform vault.update_secret(v_id, v_key);
  end if;

  update public.ai_settings
  set key_updated_at = now(), key_updated_by = auth.uid()
  where id = 1;
end;
$$;

-- 6. ai_key_status: admin vê se há chave e os 4 últimos caracteres (nunca a chave).
create or replace function public.ai_key_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_ok boolean;
begin
  if not public.gf_admin_can('manage_settings') then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;

  select d.decrypted_secret into v_key
  from vault.decrypted_secrets d
  where d.name = 'gemini_api_key';
  v_ok := coalesce(v_key, '') <> '';

  return jsonb_build_object(
    'configurada', v_ok,
    'final_4', case when v_ok then right(v_key, 4) end,
    'atualizada_em', case when v_ok then (select s.key_updated_at from public.ai_settings s where s.id = 1) end
  );
end;
$$;

-- 7. ai_get_gemini_key: só o servidor (service_role) lê a chave.
create or replace function public.ai_get_gemini_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select d.decrypted_secret
  from vault.decrypted_secrets d
  where d.name = 'gemini_api_key'
  limit 1;
$$;

-- 8. ai_reserve: o servidor reserva o crédito ANTES de chamar a IA.
--    O lock por usuário serializa duas perguntas simultâneas do mesmo produtor.
create or replace function public.ai_reserve(p_user uuid, p_tier text, p_mode text, p_model text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.ai_settings;
  v record;
  v_barrado jsonb;
  v_custo int;
  v_id uuid;
begin
  if p_user is null
     or coalesce(p_tier, '') not in ('simples', 'complexo', 'imagem', 'fora_do_escopo')
     or coalesce(p_mode, '') not in ('chat', 'planejar', 'ping') then
    raise exception 'Parâmetros inválidos' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('ai:' || p_user::text));

  v_barrado := public.ai_portoes(p_user);
  if v_barrado is not null then
    return v_barrado;
  end if;

  select * into s from public.ai_settings where id = 1;
  if p_tier = 'fora_do_escopo' or p_mode = 'ping' then
    v_custo := 0;
  else
    v_custo := (s.credit_cost->>p_tier)::int;
    if v_custo is null then
      raise exception 'ai_settings.credit_cost sem valor para o tier %', p_tier using errcode = '22023';
    end if;
  end if;

  select * into v from public.ai_saldo(p_user);
  if v.usado + v_custo > v.cota + v.concedido then
    return jsonb_build_object('ok', false, 'motivo', 'sem_credito');
  end if;

  insert into public.ai_usage (user_id, mode, tier, model, credits)
  values (p_user, p_mode, p_tier, p_model, v_custo)
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'custo', v_custo,
    'restante', v.cota + v.concedido - v.usado - v_custo
  );
end;
$$;

-- 8b. ai_precheck: os mesmos portões do ai_reserve, sem lock e sem gravar nada. O servidor
--     chama ANTES do classificador (que já é uma chamada paga ao Gemini), para não gastar
--     com quem não pode perguntar. sem_credito = restante menor que o menor custo positivo.
create or replace function public.ai_precheck(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v record;
  v_barrado jsonb;
  v_restante int;
  v_menor int;
begin
  if p_user is null then
    raise exception 'Parâmetros inválidos' using errcode = '22023';
  end if;

  v_barrado := public.ai_portoes(p_user);
  if v_barrado is not null then
    return v_barrado;
  end if;

  select min(c.value::int) into v_menor
  from public.ai_settings s, jsonb_each_text(s.credit_cost) c
  where s.id = 1 and c.value::int > 0;

  select * into v from public.ai_saldo(p_user);
  v_restante := v.cota + v.concedido - v.usado;
  if v_restante < coalesce(v_menor, 0) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_credito');
  end if;

  return jsonb_build_object('ok', true, 'restante', v_restante);
end;
$$;

-- 9. ai_finish: o servidor fecha a linha pendente com tokens e custo.
--    Erro antes de chamar a IA (p_called = false) devolve o crédito (e ai_saldo não conta
--    nenhuma linha com status 'erro'). Os tokens do roteador chegam somados aos do modelo
--    principal e são cobrados pelo preço do principal (conservador: o roteador é o mais barato).
create or replace function public.ai_finish(
  p_id uuid, p_tokens_in int, p_tokens_out int, p_steps int, p_tools text[],
  p_status text, p_resumo text, p_called boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tin int := greatest(coalesce(p_tokens_in, 0), 0);
  v_tout int := greatest(coalesce(p_tokens_out, 0), 0);
  v_model text;
  v_cost numeric(12,6);
begin
  if coalesce(p_status, '') not in ('ok', 'erro') then
    raise exception 'Status inválido' using errcode = '22023';
  end if;

  select u.model into v_model
  from public.ai_usage u
  where u.id = p_id and u.status = 'pendente'
  for update;
  if not found then
    return jsonb_build_object('cost_usd', null);
  end if;

  v_cost := public.ai_custo(v_model, v_tin, v_tout);

  update public.ai_usage u
  set tokens_in = v_tin,
      tokens_out = v_tout,
      cost_usd = v_cost,
      credits = case when p_status = 'erro' and not coalesce(p_called, false) then 0 else u.credits end,
      steps = greatest(coalesce(p_steps, 0), 0),
      tools = coalesce(p_tools, '{}'),
      status = p_status,
      resumo = left(p_resumo, 500),
      finished_at = now()
  where u.id = p_id;

  return jsonb_build_object('cost_usd', v_cost);
end;
$$;

-- 9b. ai_log: registra uma chamada paga que não passou por ai_reserve (linha já finalizada,
--     sem crédito): (a) o roteador rodou e a reserva foi recusada; (b) ping do admin.
create or replace function public.ai_log(
  p_user uuid, p_mode text, p_tier text, p_model text,
  p_tokens_in int, p_tokens_out int, p_resumo text, p_status text default 'erro'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(p_status, '') not in ('ok', 'erro') then
    raise exception 'Status inválido' using errcode = '22023';
  end if;

  insert into public.ai_usage (user_id, mode, tier, model, tokens_in, tokens_out, cost_usd,
                               credits, status, resumo, finished_at)
  values (p_user, p_mode, p_tier, p_model,
          greatest(coalesce(p_tokens_in, 0), 0), greatest(coalesce(p_tokens_out, 0), 0),
          public.ai_custo(p_model, p_tokens_in, p_tokens_out),
          0, p_status, left(p_resumo, 500), now());
end;
$$;

-- 10. ai_balance: saldo do próprio usuário logado (o front mostra).
create or replace function public.ai_balance()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_enabled boolean;
  v record;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  select s.enabled into v_enabled from public.ai_settings s where s.id = 1;
  select * into v from public.ai_saldo(v_user);

  return jsonb_build_object(
    'habilitado', coalesce(v_enabled, false),
    'plano', v.plano,
    'cota', v.cota,
    'concedido', v.concedido,
    'usado', v.usado,
    'restante', greatest(v.cota + v.concedido - v.usado, 0),
    'periodo', v.periodo
  );
end;
$$;

-- 11. ai_grant_credits: SECURITY INVOKER; quem barra não-admin é a regra de insert.
create or replace function public.ai_grant_credits(p_user uuid, p_amount int, p_note text)
returns uuid
language sql
set search_path = ''
as $$
  insert into public.ai_credit_grants (user_id, amount, note)
  values (p_user, p_amount, p_note)
  returning id;
$$;

-- 12. ai_admin_resumo: painel de custos do admin. Período [p_de, p_ate).
create or replace function public.ai_admin_resumo(p_de timestamptz, p_ate timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_usd_brl numeric;
  v_out jsonb;
begin
  if not public.gf_admin_can('manage_settings') then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if p_de is null or p_ate is null or p_ate <= p_de then
    raise exception 'Período inválido' using errcode = '22023';
  end if;

  select s.usd_brl into v_usd_brl from public.ai_settings s where s.id = 1;

  -- "pergunta" = pedido de produtor atendido ou cobrado; pings do admin e recusas do roteador
  -- ficam só em "chamadas" (todas as linhas, que também têm custo)
  with u as (
    select a.*, (a.mode <> 'ping' and (a.credits > 0 or a.status = 'ok')) as pergunta
    from public.ai_usage a
    where a.created_at >= p_de and a.created_at < p_ate
  )
  select jsonb_build_object(
    'totais', (
      select jsonb_build_object(
        'usd', coalesce(sum(u.cost_usd), 0),
        'brl', round(coalesce(sum(u.cost_usd), 0) * v_usd_brl, 2),
        'perguntas', count(*) filter (where u.pergunta),
        'chamadas', count(*),
        'custo_medio_brl', round(coalesce(sum(u.cost_usd), 0) * v_usd_brl / nullif(count(*) filter (where u.pergunta), 0), 4)
      ) from u
    ),
    'por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object('dia', x.dia, 'usd', x.usd, 'perguntas', x.n) order by x.dia), '[]')
      from (
        select (u.created_at at time zone 'America/Sao_Paulo')::date as dia,
               sum(u.cost_usd) as usd, count(*) filter (where u.pergunta) as n
        from u group by 1
      ) x
    ),
    'por_produtor', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'user_id', x.user_id, 'nome', p.full_name, 'email', p.email,
               'usd', x.usd, 'perguntas', x.n, 'creditos', x.cr) order by x.usd desc), '[]')
      from (
        select u.user_id, sum(u.cost_usd) as usd, count(*) filter (where u.pergunta) as n, sum(u.credits) as cr
        from u group by u.user_id
        order by usd desc
        limit 20
      ) x
      left join public.profiles p on p.id = x.user_id
    ),
    'por_modelo', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'model', x.model, 'usd', x.usd, 'perguntas', x.n,
               'tokens_in', x.tin, 'tokens_out', x.tout) order by x.usd desc), '[]')
      from (
        select u.model, sum(u.cost_usd) as usd, count(*) filter (where u.pergunta) as n,
               sum(u.tokens_in) as tin, sum(u.tokens_out) as tout
        from u group by u.model
      ) x
    ),
    'por_modo', (
      select coalesce(jsonb_agg(jsonb_build_object('mode', x.mode, 'usd', x.usd, 'perguntas', x.n) order by x.usd desc), '[]')
      from (
        select u.mode, sum(u.cost_usd) as usd, count(*) filter (where u.pergunta) as n
        from u group by u.mode
      ) x
    ),
    'historico', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', x.id, 'created_at', x.created_at, 'nome', p.full_name, 'email', p.email,
               'mode', x.mode, 'tier', x.tier, 'model', x.model,
               'tokens_in', x.tokens_in, 'tokens_out', x.tokens_out,
               'cost_usd', x.cost_usd, 'credits', x.credits, 'status', x.status)
             order by x.created_at desc), '[]')
      from (select * from u order by u.created_at desc limit 100) x
      left join public.profiles p on p.id = x.user_id
    )
  ) into v_out;

  return v_out;
end;
$$;

-- 13. agent_meus_eventos: eventos do próprio produtor, sem nenhum dado de comprador.
--     SECURITY INVOKER: se o RLS de tickets não deixar o produtor ver, a contagem dá 0.
create or replace function public.agent_meus_eventos()
returns table (
  id uuid, title text, start_date timestamptz, status text,
  capacity int, venue_city text, ingressos bigint
)
language sql
stable
set search_path = ''
as $$
  select e.id, e.title, e.start_date, e.status, e.capacity, e.venue_city,
         (select count(*)
          from public.tickets t
          join public.ticket_types tt on tt.id = t.ticket_type_id
          where tt.event_id = e.id) as ingressos
  from public.events e
  where e.producer_id = (select auth.uid())
  order by e.start_date desc;
$$;

-- 14. Quem executa o quê (o Supabase dá EXECUTE a anon/authenticated por padrão).
revoke all on function public.ai_saldo(uuid) from public, anon, authenticated, service_role;
revoke all on function public.ai_portoes(uuid) from public, anon, authenticated, service_role;
revoke all on function public.ai_custo(text, bigint, bigint) from public, anon, authenticated, service_role;

revoke all on function public.ai_log(uuid, text, text, text, int, int, text, text) from public, anon, authenticated, service_role;
grant execute on function public.ai_log(uuid, text, text, text, int, int, text, text) to service_role;

revoke all on function public.ai_precheck(uuid) from public, anon, authenticated, service_role;
grant execute on function public.ai_precheck(uuid) to service_role;

revoke all on function public.ai_set_gemini_key(text) from public, anon, authenticated, service_role;
grant execute on function public.ai_set_gemini_key(text) to authenticated;

revoke all on function public.ai_key_status() from public, anon, authenticated, service_role;
grant execute on function public.ai_key_status() to authenticated;

revoke all on function public.ai_get_gemini_key() from public, anon, authenticated, service_role;
grant execute on function public.ai_get_gemini_key() to service_role;

revoke all on function public.ai_reserve(uuid, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.ai_reserve(uuid, text, text, text) to service_role;

revoke all on function public.ai_finish(uuid, int, int, int, text[], text, text, boolean) from public, anon, authenticated, service_role;
grant execute on function public.ai_finish(uuid, int, int, int, text[], text, text, boolean) to service_role;

revoke all on function public.ai_balance() from public, anon, authenticated, service_role;
grant execute on function public.ai_balance() to authenticated;

revoke all on function public.ai_grant_credits(uuid, int, text) from public, anon, authenticated, service_role;
grant execute on function public.ai_grant_credits(uuid, int, text) to authenticated;

revoke all on function public.ai_admin_resumo(timestamptz, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.ai_admin_resumo(timestamptz, timestamptz) to authenticated;

revoke all on function public.agent_meus_eventos() from public, anon, authenticated, service_role;
grant execute on function public.agent_meus_eventos() to authenticated;

commit;

-- =============================================================================
-- TESTES (rodar à mão no editor SQL, dentro de begin; … rollback;)
-- Cada bloco desfaz tudo no fim. Rodar um bloco por vez.
-- =============================================================================
--
-- T1. Dois reserves com saldo 1: só o primeiro passa.
--     (Sequencial na mesma sessão; o lock por usuário garante o mesmo resultado quando as
--     duas chamadas chegam juntas, em sessões diferentes.)
-- begin;
-- do $$
-- declare u uuid; r1 jsonb; r2 jsonb;
-- begin
--   select p.id into u from public.profiles p
--   where not exists (select 1 from public.ai_usage a where a.user_id = p.id)
--     and not exists (select 1 from public.ai_credit_grants g where g.user_id = p.id)
--     and not exists (select 1 from public.producer_subscriptions s where s.producer_id = p.id)
--     and not exists (select 1 from public.user_custom_features f where f.user_id = p.id and f.feature_key = 'agent')
--   limit 1;
--   update public.ai_settings
--   set enabled = true, quotas = quotas || '{"free":1}', hourly_limit = 20, daily_cap_brl = 50
--   where id = 1;
--   r1 := public.ai_reserve(u, 'simples', 'chat', 'gemini-3.1-flash-lite');
--   r2 := public.ai_reserve(u, 'simples', 'chat', 'gemini-3.1-flash-lite');
--   assert (r1->>'ok')::boolean and (r1->>'restante')::int = 0, format('r1 = %s', r1);
--   assert not (r2->>'ok')::boolean and r2->>'motivo' = 'sem_credito', format('r2 = %s', r2);
--   raise notice 'T1 OK: % | %', r1, r2;
-- end $$;
-- rollback;
--
-- T2. Produtor (authenticated) não executa ai_get_gemini_key.
-- select has_function_privilege('anon', 'public.ai_get_gemini_key()', 'execute') as anon,           -- false
--        has_function_privilege('authenticated', 'public.ai_get_gemini_key()', 'execute') as authn, -- false
--        has_function_privilege('service_role', 'public.ai_get_gemini_key()', 'execute') as srv;    -- true
-- begin;
-- set local role authenticated;
-- select set_config('request.jwt.claims',
--   (select json_build_object('sub', id, 'role', 'authenticated')::text from public.profiles where role = 'producer' limit 1), true);
-- select public.ai_get_gemini_key();  -- esperado: ERROR 42501 permission denied for function ai_get_gemini_key
-- rollback;
--
-- T3. update em ai_usage como authenticated é negado.
-- select has_table_privilege('authenticated', 'public.ai_usage', 'update') as upd,  -- false
--        has_table_privilege('authenticated', 'public.ai_usage', 'insert') as ins,  -- false
--        has_table_privilege('authenticated', 'public.ai_usage', 'delete') as del;  -- false
-- begin;
-- set local role authenticated;
-- update public.ai_usage set credits = 0;  -- esperado: ERROR 42501 permission denied for table ai_usage
-- rollback;
--
-- T4. Módulo "agent" vencido não dá cota do pro; válido dá.
-- begin;
-- do $$
-- declare u uuid; b jsonb;
-- begin
--   select p.id into u from public.profiles p
--   where not exists (select 1 from public.producer_subscriptions s where s.producer_id = p.id)
--     and not exists (select 1 from public.user_custom_features f where f.user_id = p.id and f.feature_key = 'agent')
--   limit 1;
--   perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
--   perform set_config('request.jwt.claim.sub', u::text, true);  -- auth.uid() antigo lê só esta
--   insert into public.user_custom_features (user_id, feature_key, expires_at)
--   values (u, 'agent', now() - interval '1 day');
--   b := public.ai_balance();
--   assert (b->>'cota')::int = (select (quotas->>'free')::int from public.ai_settings where id = 1), format('vencido: %s', b);
--   update public.user_custom_features set expires_at = now() + interval '30 days'
--   where user_id = u and feature_key = 'agent';
--   b := public.ai_balance();
--   assert (b->>'cota')::int = (select (quotas->>'pro')::int from public.ai_settings where id = 1), format('válido: %s', b);
--   raise notice 'T4 OK';
-- end $$;
-- rollback;
--
-- T5. Quem executa cada função (esperado: ai_saldo, ai_portoes e ai_custo ninguém; ai_get_gemini_key,
--     ai_precheck, ai_reserve, ai_finish e ai_log só service_role; as demais só authenticated; anon em nenhuma).
-- select p.oid::regprocedure as funcao,
--        p.prosecdef as security_definer,
--        p.proconfig as config,
--        has_function_privilege('anon', p.oid, 'execute') as anon,
--        has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
--        has_function_privilege('service_role', p.oid, 'execute') as service_role,
--        (select string_agg(rp.grantee, ', ' order by rp.grantee)
--         from information_schema.routine_privileges rp
--         where rp.routine_schema = 'public'
--           and rp.specific_name = p.proname || '_' || p.oid
--           and rp.privilege_type = 'EXECUTE') as grants
-- from pg_proc p
-- where p.pronamespace = 'public'::regnamespace
--   and (p.proname like 'ai\_%' or p.proname = 'agent_meus_eventos')
-- order by 1;
--
-- T6. ai_precheck: com saldo passa sem gravar nada; sem saldo dá sem_credito; mas fora_do_escopo
--     (custo 0) ainda passa no ai_reserve; desligado barra os dois.
-- begin;
-- do $$
-- declare u uuid; antes bigint; r jsonb;
-- begin
--   select p.id into u from public.profiles p
--   where not exists (select 1 from public.ai_usage a where a.user_id = p.id)
--     and not exists (select 1 from public.ai_credit_grants g where g.user_id = p.id)
--     and not exists (select 1 from public.producer_subscriptions s where s.producer_id = p.id)
--     and not exists (select 1 from public.user_custom_features f where f.user_id = p.id and f.feature_key = 'agent')
--   limit 1;
--   update public.ai_settings
--   set enabled = true, quotas = quotas || '{"free":1}', hourly_limit = 20, daily_cap_brl = 50
--   where id = 1;
--   select count(*) into antes from public.ai_usage;
--   r := public.ai_precheck(u);
--   assert (r->>'ok')::boolean and (r->>'restante')::int = 1, format('com saldo: %s', r);
--   assert (select count(*) from public.ai_usage) = antes, 'precheck gravou linha';
--   perform public.ai_reserve(u, 'simples', 'chat', 'gemini-3.1-flash-lite');
--   r := public.ai_precheck(u);
--   assert not (r->>'ok')::boolean and r->>'motivo' = 'sem_credito', format('sem saldo: %s', r);
--   r := public.ai_reserve(u, 'fora_do_escopo', 'chat', 'gemini-3.1-flash-lite');
--   assert (r->>'ok')::boolean, format('fora_do_escopo: %s', r);
--   update public.ai_settings set enabled = false where id = 1;
--   r := public.ai_precheck(u);
--   assert r->>'motivo' = 'desligado', format('desligado: %s', r);
--   raise notice 'T6 OK';
-- end $$;
-- rollback;
--
-- T7. free com módulo "agent" válido conta por mês: uso do mês passado não pesa.
-- begin;
-- do $$
-- declare u uuid; b jsonb;
-- begin
--   select p.id into u from public.profiles p
--   where not exists (select 1 from public.ai_usage a where a.user_id = p.id)
--     and not exists (select 1 from public.ai_credit_grants g where g.user_id = p.id)
--     and not exists (select 1 from public.producer_subscriptions s where s.producer_id = p.id)
--     and not exists (select 1 from public.user_custom_features f where f.user_id = p.id and f.feature_key = 'agent')
--   limit 1;
--   perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
--   perform set_config('request.jwt.claim.sub', u::text, true);
--   insert into public.ai_usage (user_id, mode, tier, credits, status, created_at)
--   values (u, 'chat', 'simples', 4, 'ok', date_trunc('month', now(), 'America/Sao_Paulo') - interval '1 day');
--   b := public.ai_balance();
--   assert b->>'periodo' = 'total' and (b->>'usado')::int = 4, format('free sem módulo: %s', b);
--   insert into public.user_custom_features (user_id, feature_key, expires_at)
--   values (u, 'agent', now() + interval '30 days');
--   b := public.ai_balance();
--   assert b->>'periodo' = 'mes' and (b->>'usado')::int = 0, format('free com módulo: %s', b);
--   raise notice 'T7 OK';
-- end $$;
-- rollback;
