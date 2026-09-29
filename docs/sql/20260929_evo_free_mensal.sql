-- Evo: o plano Free passa a renovar 5 créditos por mês, como os demais (decisão do Ricardo, 29/09/2026).
-- Antes: Free era amostra única (contava o uso de todo o tempo). Só troca o corpo de ai_saldo;
-- `create or replace` mantém as permissões (ninguém executa diretamente). Idempotente.
-- Aplicar DEPOIS de docs/sql/20260929_agente_evo.sql.
begin;

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

  -- módulo "agent" liberado e não vencido: sobe a cota até a do pro
  v_modulo := exists (
    select 1 from public.user_custom_features f
    where f.user_id = p_user
      and f.feature_key = 'agent'
      and (f.expires_at is null or f.expires_at > now())
  );
  if v_modulo and cota < coalesce((v_quotas->>'pro')::int, 0) then
    cota := (v_quotas->>'pro')::int;
  end if;

  -- todos os planos, Free incluído, renovam no dia 1º e não acumulam (Ricardo, 29/09/2026);
  -- concedido pelo admin vale só no mês da concessão
  periodo := 'mes';

  select coalesce(sum(g.amount), 0) into concedido
  from public.ai_credit_grants g
  where g.user_id = p_user
    and g.created_at >= v_mes;

  -- erro não gasta crédito do produtor (a pergunta que falhou não conta)
  select coalesce(sum(u.credits), 0) into usado
  from public.ai_usage u
  where u.user_id = p_user
    and u.status <> 'erro'
    and u.created_at >= v_mes;

  return next;
end;
$$;

commit;
