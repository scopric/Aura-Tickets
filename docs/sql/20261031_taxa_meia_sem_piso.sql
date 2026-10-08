-- =============================================================================
-- Taxa da meia sem o piso de R$ 3 (decisão do Ricardo, 08/10/2026; plano shiny-stirring-pascal).
-- A meia paga 10% sobre o preço da meia, sem mínimo; a inteira segue 10% com mínimo de R$ 3 (Decisão 192).
-- Muda SÓ public.evk_taxa_centavos(bigint, boolean): o gancho `case when p_meia then 300 /*PISO_MEIA*/ else 300 end` de
--   20261030a_venda_servidor_meia.sql vira `case when p_meia then 0 else 300 end`. reservar_ingressos e vitrine_ingressos já
--   passam p_meia e NÃO mudam. Assinatura, immutable, search_path vazio e revoke iguais. Espelho: app/src/lib/taxa.ts.
-- ORDEM: aplicar DEPOIS de 20261030a_venda_servidor_meia.sql (o bloco 0 recusa sem ela ou se a função difere da dela).
-- Como aplicar: ensaiar com ROLLBACK, depois colar inteiro no SQL Editor (UTF-8 via pbcopy, nunca TextEdit). Uma transação,
--   rodar de novo aborta no bloco 0 com erro (esperado: o md5 já é o da versão nova).
-- Testes: supabase/tests/taxa_meia_sem_piso.test.sql (só em banco local descartável).
-- NÃO mover para supabase/migrations/.
-- Desfazer (volta ao piso de R$ 3 também na meia): recriar a função com `case when p_meia then 300 else 300 end`
--   (bloco comentado no fim deste arquivo).
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisito: a função em produção é exatamente a de 20261030a.
--    md5 abaixo = md5(pg_get_functiondef('public.evk_taxa_centavos(bigint, boolean)'::regprocedure)) lido em produção em 08/10/2026 (20261030a já aplicada).
do $$
begin
  if to_regprocedure('public.evk_taxa_centavos(bigint, boolean)') is null then
    raise exception 'falta evk_taxa_centavos(bigint, boolean): aplicar antes 20261030a_venda_servidor_meia.sql';
  end if;
  if md5(pg_get_functiondef('public.evk_taxa_centavos(bigint, boolean)'::regprocedure)) <> 'ed444accb5478cb16c23b84d49d180cc' then
    raise exception 'evk_taxa_centavos mudou desde 20261030a (md5 diferente) ou o md5 não foi preenchido: conferir a definição atual';
  end if;
end $$;

-- 1. Meia: 10% sem mínimo. Inteira: 10% com mínimo de R$ 3. Valor 0 ou negativo: 0.
create or replace function public.evk_taxa_centavos(p_cent bigint, p_meia boolean default false)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case when coalesce(p_cent, 0) <= 0 then 0
              else greatest(round(p_cent * 10 / 100.0)::bigint, case when p_meia then 0 else 300 end) end
$$;
revoke all on function public.evk_taxa_centavos(bigint, boolean) from public, anon, authenticated;

-- 2. Auto-teste: sem efeito colateral; qualquer falha aborta a transação toda.
do $$
declare c record;
begin
  for c in select * from (values (1000, false, 300), (1000, true, 100), (0, true, 0), (1, true, 0), (4, true, 0), (5, true, 1),
                                 (1665, true, 167), (3333, false, 333), (-1000, true, 0), (10000, false, 1000)) v(cent, meia, esperado) loop
    if public.evk_taxa_centavos(c.cent, c.meia) <> c.esperado then
      raise exception 'evk_taxa_centavos(%, %) deu %, esperado %', c.cent, c.meia, public.evk_taxa_centavos(c.cent, c.meia), c.esperado;
    end if;
  end loop;
  if has_function_privilege('anon', 'public.evk_taxa_centavos(bigint, boolean)', 'execute')
     or has_function_privilege('authenticated', 'public.evk_taxa_centavos(bigint, boolean)', 'execute') then
    raise exception 'evk_taxa_centavos voltou a ter EXECUTE para anon/authenticated';
  end if;
  if not (select provolatile = 'i' and proconfig = array['search_path=""'] from pg_proc
          where oid = 'public.evk_taxa_centavos(bigint, boolean)'::regprocedure) then
    raise exception 'evk_taxa_centavos perdeu immutable ou search_path vazio';
  end if;
end $$;

commit;

-- Desfazer (rodar à parte, só se for preciso voltar ao piso de R$ 3 na meia):
-- begin;
-- create or replace function public.evk_taxa_centavos(p_cent bigint, p_meia boolean default false)
-- returns bigint language sql immutable set search_path = '' as $$
--   select case when coalesce(p_cent, 0) <= 0 then 0
--               else greatest(round(p_cent * 10 / 100.0)::bigint, case when p_meia then 300 /*PISO_MEIA*/ else 300 end) end
-- $$;
-- revoke all on function public.evk_taxa_centavos(bigint, boolean) from public, anon, authenticated;
-- commit;
