-- Cupom: o código passa a ser único POR PRODUTOR, tem formato fixo e há um teto por produtor (achados médios da auditoria de segurança da tela Ingressos e Cupons, 08/10/2026).
-- Problema: hoje UNIQUE(code) e o índice coupons_code_upper_idx (upper(code)) são GLOBAIS. (1) Um produtor descobre códigos de OUTROS produtores por tentativa (o erro 23505
--   diz que o código já existe) e, se passar o código a um comprador, pode haver desconto indevido; (2) um produtor pode ocupar códigos comuns (PROMO10, BLACKFRIDAY) e impedir os demais.
-- O que faz:
--   1. troca a unicidade global por duas: (producer_id, upper(code)) para cupom de produtor e upper(code) só entre os cupons da plataforma (producer_id nulo: admin e afiliado);
--      a venda (20261030a, linha ~739) já busca o cupom por upper(code) FILTRANDO o produtor do evento, então não há ambiguidade;
--   2. gatilho gf_cupom_regras (BEFORE INSERT OR UPDATE OF code, producer_id), só para cupom de produtor:
--      a) formato do código (2 a 30 caracteres, letras, números, hífen e sublinhado, sem hífen no começo): vale quando o código NASCE ou MUDA. Não é CHECK de propósito:
--         um CHECK reavaliaria a linha em qualquer UPDATE e o cupom que já existe fora do formato (há 1 em produção em 08/10) deixaria de poder ser desativado ou editado;
--      b) teto de 5000 cupons por produtor, no INSERT (o limite de 500 por lote da tela continua só no navegador).
-- O que NÃO muda: política de acesso, gatilho gf_protect_coupon_uses, cupom de admin e de afiliado (producer_id nulo), a função de venda.
-- ORDEM: pode ser aplicado a qualquer momento, antes ou depois do front (o front já não mostra qual código colidiu).
-- Reaplicar: seguro (tudo idempotente). Como desfazer: `drop trigger gf_cupom_regras on public.coupons; drop function public.gf_cupom_regras();` e recriar
--   `alter table public.coupons add constraint coupons_code_key unique (code)` + `create unique index coupons_code_upper_idx on public.coupons (upper(code))`
--   (só se não houver código repetido entre produtores) e apagar os dois índices novos.
begin;
set local lock_timeout = '5s';

-- 0. Pré-checagem: dentro de cada produtor e entre os cupons da plataforma não pode haver código repetido por upper(code). Hoje o índice global já garante isso.
do $$
begin
  if exists (select 1 from public.coupons where producer_id is not null group by producer_id, upper(code) having count(*) > 1) then
    raise exception 'há código de cupom repetido dentro de um mesmo produtor: resolva antes de aplicar';
  end if;
  if exists (select 1 from public.coupons where producer_id is null group by upper(code) having count(*) > 1) then
    raise exception 'há código de cupom da plataforma repetido: resolva antes de aplicar';
  end if;
end $$;

-- 1. Unicidade por produtor. A nova entra ANTES de a antiga sair (nenhuma janela sem proteção).
create unique index if not exists coupons_produtor_code_idx on public.coupons (producer_id, upper(code)) where producer_id is not null;
create unique index if not exists coupons_plataforma_code_idx on public.coupons (upper(code)) where producer_id is null;
alter table public.coupons drop constraint if exists coupons_code_key;
drop index if exists public.coupons_code_upper_idx;

-- 2. Regras do cupom de produtor. Roda como dono e conta tudo do produtor (não depende da política de leitura).
--    ponytail: a contagem não trava lotes simultâneos; o excesso máximo é o tamanho de um lote da tela (500). Trocar por pg_advisory_xact_lock se isso importar.
create or replace function public.gf_cupom_regras() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.producer_id is null then
    return new;
  end if;
  if (tg_op = 'INSERT' or new.code is distinct from old.code or old.producer_id is null)
     and new.code !~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$' then
    raise exception 'coupons_code_formato: código de cupom inválido (use de 2 a 30 letras, números, hífen ou sublinhado)' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.coupons c where c.producer_id = new.producer_id) >= 5000 then
    raise exception 'coupons_teto: limite de 5000 cupons por produtor atingido' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function public.gf_cupom_regras() from public, anon, authenticated;

drop trigger if exists gf_cupom_regras on public.coupons;
create trigger gf_cupom_regras before insert or update of code, producer_id on public.coupons for each row execute function public.gf_cupom_regras();

-- 3. Conferência: o que tem de existir e o que tem de ter saído
do $$
begin
  if exists (select 1 from pg_constraint where conrelid = 'public.coupons'::regclass and conname = 'coupons_code_key') then raise exception 'coupons_code_key continua'; end if;
  if to_regclass('public.coupons_code_upper_idx') is not null then raise exception 'coupons_code_upper_idx continua'; end if;
  if to_regclass('public.coupons_produtor_code_idx') is null or to_regclass('public.coupons_plataforma_code_idx') is null then raise exception 'índice novo ausente'; end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.coupons'::regclass and tgname = 'gf_cupom_regras' and tgenabled = 'O') then raise exception 'gatilho gf_cupom_regras ausente'; end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.coupons'::regclass and tgname = 'gf_protect_coupon_uses' and tgenabled = 'O') then raise exception 'gf_protect_coupon_uses sumiu'; end if;
end $$;

commit;

-- Conferência depois do Run (leitura): esperado = índices coupons_pkey, coupons_produtor_code_idx, coupons_plataforma_code_idx; gatilho gf_cupom_regras = 1; unique_antiga = 0.
-- select (select string_agg(indexname, ',') from pg_indexes where schemaname = 'public' and tablename = 'coupons') as indices,
--        (select count(*) from pg_trigger where tgrelid = 'public.coupons'::regclass and tgname = 'gf_cupom_regras') as gatilho,
--        (select count(*) from pg_constraint where conrelid = 'public.coupons'::regclass and conname = 'coupons_code_key') as unique_antiga;
