-- =============================================================================
-- Limite de ingressos POR CPF do comprador (tela 06 do lançamento 16/10, fatia 1: banco). 2026-10-28 (NÃO aplicado)
-- O que muda:
-- 1. orders.customer_cpf_hmac (bytea): HMAC do CPF (public.pr7_hmac, chave no Vault). O CPF puro NUNCA fica gravado:
--    o gatilho orders_cpf_hash (BEFORE INSERT) valida o CPF (gf_cpf_valido; inválido = 22023), grava o hash e zera
--    customer_cpf. Hash mandado pelo cliente sem CPF é descartado: o hash só nasce do CPF validado.
--    "123.456.789-09" e "12345678909" dão o mesmo hash (pr7_hmac tira o que não é dígito).
--    Anti-sondagem: a mesma conta usa no máximo 3 CPFs DIFERENTES por hora (o 4º dá "Muitas tentativas com CPFs
--    diferentes..."; repetir o mesmo CPF não conta; CPF inválido falha antes e não conta). Limita só POR CONTA: o
--    cadastro é aberto, então quem cria várias contas sonda mais; o limite por IP fica para uma Edge Function antes do
--    checkout (pendência). O oráculo "esse CPF já comprou" continua possível, só mais caro.
-- 2. ticket_types.max_por_cpf (int > 0; nulo = sem limite) e UPDATE dela para authenticated (o produtor edita).
-- 3. order_items_estoque_guard (recriada a partir da definição de PRODUÇÃO, md5 140578e7…, com a cláusula de
--    pedido_assentos): depois de venda_bloqueada e ANTES do teste de lotação (vale mesmo sem lotação), se o tipo tem
--    max_por_cpf: pedido sem hash = "Informe o CPF do comprador para este ingresso"; soma itens do mesmo tipo em pedidos
--    do mesmo hash ('paid' de qualquer conta, ou 'pending' DA MESMA CONTA com menos de 30 min, 10 se tem assento vivo,
--    a mesma regra da reserva) + o pedido atual; pendente de OUTRA conta não segura o CPF (não deixa uma conta travar o
--    CPF alheio) e é rechecado ao pagar (3b); acima do limite = "Limite de N ingressos por CPF neste ingresso". A mensagem NÃO diz quantos o CPF já
--    tem (não deixa descobrir, tentando, quantos ingressos um CPF comprou). Trava por (tipo, hash).
-- 3b. orders_pago_cpf_guard (BEFORE UPDATE OF status, quando vira 'paid', qualquer papel, inclusive o gateway com
--    service_role): por tipo com max_por_cpf, este pedido + os 'paid' de outros pedidos do mesmo hash; acima = mesma
--    mensagem sem contagem. Mesma trava (tipo, hash), tipos em ordem de id. Roda depois de orders_pago_assento_guard
--    (ordem alfabética). confirmar_pedido_gratis também passa por ele ao gravar 'paid' (confere o mesmo que ela).
-- 4. confirmar_pedido_gratis (recriada a partir de PRODUÇÃO, md5 565433ef…): além do limite por conta (continua), o
--    mesmo limite por CPF contando pedidos 'paid' do mesmo hash, de qualquer conta. Mesma mensagem sem contagem.
-- 5. Colunas e grants: customer_cpf_hmac nasce SEM SELECT para anon e authenticated (a E4, 20261011, concede SELECT
--    em orders por coluna; coluna nova não entra). authenticated tem UPDATE de TABELA em orders (baseline), mas nenhuma
--    regra (RLS) permissiva de UPDATE: a conferência do fim aborta se surgir uma.
-- REAPLICAR ARQUIVOS ANTIGOS: o bloco 0 de 20261027_ticket_types_grants_por_coluna.sql passa a abortar (coluna nova
--    max_por_cpf): pôr max_por_cpf na lista e no grant se for reaplicado. A conferência da E4 (20261011) também aborta
--    (customer_cpf_hmac fora das listas): classificar como RETIDA se for reaplicada.
-- ORDEM: 0) 20261008_assento_reserva e 20261022 já aplicados (o bloco 0 confere); 1) este arquivo; 2) o PR do front (checkout com CPF e campo max_por_cpf no painel). Sem o front, tipo com
--    max_por_cpf preenchido recusa toda compra ("Informe o CPF"); enquanto ninguém preenche max_por_cpf, nada muda.
-- Pré-requisito: segredo pr7_pii_key no Vault (pr7_hmac falha fechado sem ele: pedido COM CPF dá erro 55000).
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA TextEdit). Uma transação, idempotente.
-- Testes: 20261028_limite_por_cpf_testes.sql, supabase/tests/limite_por_cpf.test.sql e supabase/tests/corrida_cpf.sh
-- (só em banco descartável). NÃO mover para supabase/migrations/.
-- ponytail: o limite de 3 CPFs/hora não trava a conta: duas inserções simultâneas da mesma conta podem passar do 3;
--    aceitável para anti-sondagem.
-- ponytail: janela de 30/10 min do pendente fixa no código, igual ao resto do guard; mudar junto com o cron.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos (abortam) ------------------------------------------------------------------------------------------
do $$
declare d text;
begin
  if to_regclass('public.orders') is null or to_regclass('public.order_items') is null
     or to_regclass('public.ticket_types') is null or to_regclass('public.pedido_assentos') is null then
    raise exception 'faltam orders, order_items, ticket_types ou pedido_assentos';
  end if;
  if to_regprocedure('public.pr7_hmac(text)') is null or to_regprocedure('public.gf_cpf_valido(text)') is null
     or to_regprocedure('public.order_items_estoque_guard()') is null
     or to_regprocedure('public.confirmar_pedido_gratis(uuid)') is null then
    raise exception 'faltam pr7_hmac, gf_cpf_valido, order_items_estoque_guard ou confirmar_pedido_gratis';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'orders_pago_assento_guard' and tgrelid = 'public.orders'::regclass) then
    raise exception 'falta o gatilho orders_pago_assento_guard (20261008): orders_pago_cpf_guard roda depois dele';
  end if;
  d := pg_get_functiondef('public.order_items_estoque_guard()'::regprocedure);
  if md5(d) <> '140578e72f563eee4d06f1efa3880504' and position('limite por CPF (20261028)' in d) = 0 then
    raise exception 'order_items_estoque_guard mudou desde 07/10 (md5 %): refazer a partir da definição atual', md5(d);
  end if;
  d := pg_get_functiondef('public.confirmar_pedido_gratis(uuid)'::regprocedure);
  if md5(d) <> '565433ef66f5c71615c767b5cde442f1' and position('limite por CPF (20261028)' in d) = 0 then
    raise exception 'confirmar_pedido_gratis mudou desde 07/10 (md5 %): refazer a partir da definição atual', md5(d);
  end if;
end $$;

-- 1. Colunas e índice -------------------------------------------------------------------------------------------------
alter table public.orders add column if not exists customer_cpf_hmac bytea;
alter table public.ticket_types add column if not exists max_por_cpf int check (max_por_cpf > 0);
create index if not exists orders_customer_cpf_hmac_idx on public.orders (customer_cpf_hmac) where customer_cpf_hmac is not null;
grant update (max_por_cpf) on public.ticket_types to authenticated;

-- 2. CPF vira hash na entrada -----------------------------------------------------------------------------------------
create or replace function public.orders_cpf_hash()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_cpf text := regexp_replace(coalesce(new.customer_cpf, ''), '\D', '', 'g');
begin
  new.customer_cpf_hmac := null; -- hash só nasce do CPF validado aqui
  if btrim(coalesce(new.customer_cpf, '')) <> '' then
    if not public.gf_cpf_valido(v_cpf) then
      raise exception 'CPF inválido' using errcode = '22023';
    end if;
    new.customer_cpf_hmac := public.pr7_hmac(v_cpf);
    -- anti-sondagem: no máximo 3 CPFs diferentes por conta por hora (repetir o mesmo CPF não conta)
    if new.user_id is not null
       and (select count(distinct o.customer_cpf_hmac) from public.orders o
             where o.user_id = new.user_id and o.customer_cpf_hmac is not null
               and o.created_at > now() - interval '1 hour') >= 3
       and not exists (select 1 from public.orders o
             where o.user_id = new.user_id and o.customer_cpf_hmac = new.customer_cpf_hmac
               and o.created_at > now() - interval '1 hour') then
      raise exception 'Muitas tentativas com CPFs diferentes. Tente de novo mais tarde.' using errcode = '22023';
    end if;
  end if;
  new.customer_cpf := null; -- o CPF puro nunca fica no banco
  return new;
end;
$$;
revoke all on function public.orders_cpf_hash() from public, anon, authenticated;
drop trigger if exists orders_cpf_hash on public.orders;
create trigger orders_cpf_hash before insert on public.orders
  for each row execute function public.orders_cpf_hash();

-- 3. Guard de estoque (produção + limite por CPF) ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_items_estoque_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_lotacao int;
  v_sold int;
  v_reservado int;
  v_min int;
  v_max int;
  v_no_pedido int;
  v_motivo text;
  v_max_cpf int;
  v_hash bytea;
  v_user uuid;
  v_outros int;
begin
  select case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total
              when coalesce(tt.capacity, 0) > 0 then tt.capacity else 0 end,
         coalesce(tt.sold, 0), tt.min_per_order,
         case when tt.price = 0 then coalesce(tt.max_per_order, 10) else tt.max_per_order end,
         tt.max_por_cpf
    into v_lotacao, v_sold, v_min, v_max, v_max_cpf
    from public.ticket_types tt where tt.id = new.ticket_type_id for update;
  if not found then
    return new; -- tipo inexistente cai na FK
  end if;
  -- v_max: tipo grátis sem máximo definido = teto de 10; tipo pago sem máximo = sem teto por pedido (nulo)
  if new.quantity < 1 or new.quantity < coalesce(v_min, 1) then
    raise exception 'Quantidade fora do permitido por pedido (mínimo %)', coalesce(v_min, 1) using errcode = '22023';
  end if;
  select coalesce(sum(oi.quantity), 0) + new.quantity into v_no_pedido
    from public.order_items oi
   where oi.order_id = new.order_id and oi.ticket_type_id = new.ticket_type_id and oi.id is distinct from new.id;
  if v_max is not null and v_no_pedido > v_max then
    raise exception 'Limite de % ingressos por pedido deste tipo', v_max using errcode = '22023';
  end if;
  v_motivo := public.venda_bloqueada(new.ticket_type_id);
  if v_motivo is not null then
    raise exception '%', v_motivo using errcode = '22023';
  end if;
  -- limite por CPF (20261028): antes do teste de lotação, vale mesmo sem lotação; a mensagem não diz quantos o CPF já tem
  if v_max_cpf is not null then
    select o.customer_cpf_hmac, o.user_id into v_hash, v_user from public.orders o where o.id = new.order_id;
    if v_hash is null then
      raise exception 'Informe o CPF do comprador para este ingresso' using errcode = '22023';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(new.ticket_type_id::text || encode(v_hash, 'hex'), 0));
    select coalesce(sum(oi.quantity), 0) into v_outros
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where oi.ticket_type_id = new.ticket_type_id and o.customer_cpf_hmac = v_hash
       and o.id <> new.order_id and oi.id is distinct from new.id
       and (o.status = 'paid'
            or (o.status = 'pending' and o.user_id = v_user -- pendente só da MESMA conta; o de outra é rechecado ao pagar
                and o.created_at > now() - case when exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)
                                                then interval '10 minutes' else interval '30 minutes' end));
    if v_no_pedido + v_outros > v_max_cpf then
      raise exception 'Limite de % ingressos por CPF neste ingresso', v_max_cpf using errcode = '22023';
    end if;
  end if;
  if v_lotacao = 0 then
    return new; -- sem lotação não se afirma esgotado
  end if;
  select coalesce(sum(oi.quantity), 0) into v_reservado
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.ticket_type_id = new.ticket_type_id and oi.id is distinct from new.id
     and o.status = 'pending'
     and o.created_at > now() - case when exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)
                                     then interval '10 minutes' else interval '30 minutes' end;
  if v_sold + v_reservado + new.quantity > v_lotacao then
    raise exception 'Ingressos esgotados ou insuficientes (restam %)', greatest(v_lotacao - v_sold - v_reservado, 0) using errcode = '22023';
  end if;
  return new;
end;
$function$;
revoke execute on function public.order_items_estoque_guard() from public, anon, authenticated;

-- 3b. Recheck na hora de pagar: pendentes de contas diferentes com o mesmo CPF não viram 'paid' juntos ---------------
create or replace function public.orders_pago_cpf_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare it record;
begin
  for it in select a.ticket_type_id, a.q, tt.max_por_cpf
              from (select oi.ticket_type_id, sum(oi.quantity) as q from public.order_items oi where oi.order_id = new.id group by 1) a
              join public.ticket_types tt on tt.id = a.ticket_type_id
             where tt.max_por_cpf is not null
             order by a.ticket_type_id loop
    if new.customer_cpf_hmac is null then
      raise exception 'Informe o CPF do comprador para este ingresso' using errcode = '22023';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(it.ticket_type_id::text || encode(new.customer_cpf_hmac, 'hex'), 0));
    if it.q + coalesce((select sum(oi.quantity) from public.order_items oi join public.orders o on o.id = oi.order_id
                         where oi.ticket_type_id = it.ticket_type_id and o.customer_cpf_hmac = new.customer_cpf_hmac
                           and o.status = 'paid' and o.id <> new.id), 0) > it.max_por_cpf then
      raise exception 'Limite de % ingressos por CPF neste ingresso', it.max_por_cpf using errcode = '22023';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.orders_pago_cpf_guard() from public, anon, authenticated;
drop trigger if exists orders_pago_cpf_guard on public.orders;
create trigger orders_pago_cpf_guard before update of status on public.orders
  for each row when (new.status = 'paid' and old.status is distinct from 'paid')
  execute function public.orders_pago_cpf_guard();

-- 4. Pedido gratuito (produção + limite por CPF) ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirmar_pedido_gratis(p_order uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  o public.orders%rowtype;
  v_nome text;
  v_email text;
  n int := 0;
  esperado int;
  it record;
  v_motivo text;
begin
  select * into o from public.orders where id = p_order and user_id = auth.uid() and status = 'pending' for update;
  if not found then
    raise exception 'Pedido não encontrado ou já processado' using errcode = '22023';
  end if;
  if o.created_at <= now() - interval '30 minutes' then
    raise exception 'Pedido expirado, volte ao evento e escolha de novo' using errcode = '22023';
  end if;
  -- trava os itens e depois os tipos (por id, sem impasse) ANTES de conferir qualquer coisa
  perform 1 from public.order_items where order_id = o.id for update;
  perform 1 from public.ticket_types where id in (select ticket_type_id from public.order_items where order_id = o.id) order by id for update;
  select coalesce(sum(quantity), 0) into esperado from public.order_items where order_id = o.id;
  if esperado = 0 then
    raise exception 'Pedido sem itens' using errcode = '22023';
  end if;
  if o.total <> 0 or exists (
       select 1 from public.order_items oi join public.ticket_types tt on tt.id = oi.ticket_type_id
        where oi.order_id = o.id and (oi.unit_price <> 0 or tt.price <> 0)) then
    raise exception 'Pedido não é gratuito' using errcode = '22023';
  end if;
  if exists (select 1 from public.order_items oi where oi.order_id = o.id and not public.pode_comprar(o.id, oi.ticket_type_id)) then
    raise exception 'Evento indisponível para compra' using errcode = '22023';
  end if;
  for it in select distinct oi.ticket_type_id from public.order_items oi where oi.order_id = o.id loop
    v_motivo := public.venda_bloqueada(it.ticket_type_id);
    if v_motivo is not null then raise exception '%', v_motivo using errcode = '22023'; end if;
  end loop;

  -- limite por conta: ingressos já comprados (pedidos 'paid') + os deste pedido, por tipo (tipos já travados acima)
  for it in select tt.name, coalesce(tt.max_per_order, 10) as teto, a.q + coalesce((
                select sum(oi2.quantity) from public.order_items oi2 join public.orders o2 on o2.id = oi2.order_id
                 where o2.user_id = o.user_id and o2.status = 'paid' and oi2.ticket_type_id = a.ticket_type_id), 0) as total
              from (select oi.ticket_type_id, sum(oi.quantity) as q from public.order_items oi where oi.order_id = o.id group by 1) a
              join public.ticket_types tt on tt.id = a.ticket_type_id loop
    if it.total > it.teto then
      raise exception 'Limite de % ingressos por pessoa em "%": você já tem % (com este pedido)', it.teto, it.name, it.total using errcode = '22023';
    end if;
  end loop;

  -- limite por CPF (20261028): pedidos 'paid' do mesmo CPF (qualquer conta) + este pedido; mensagem sem contagem
  for it in select tt.max_por_cpf as teto, a.q + coalesce((
                select sum(oi2.quantity) from public.order_items oi2 join public.orders o2 on o2.id = oi2.order_id
                 where o2.customer_cpf_hmac = o.customer_cpf_hmac and o2.status = 'paid' and oi2.ticket_type_id = a.ticket_type_id), 0) as total
              from (select oi.ticket_type_id, sum(oi.quantity) as q from public.order_items oi where oi.order_id = o.id group by 1) a
              join public.ticket_types tt on tt.id = a.ticket_type_id
             where tt.max_por_cpf is not null loop
    if o.customer_cpf_hmac is null then
      raise exception 'Informe o CPF do comprador para este ingresso' using errcode = '22023';
    end if;
    if it.total > it.teto then
      raise exception 'Limite de % ingressos por CPF neste ingresso', it.teto using errcode = '22023';
    end if;
  end loop;

  select coalesce(nullif(o.customer_name, ''), nullif(p.full_name, ''), nullif(u.raw_user_meta_data->>'full_name', ''), ''),
         coalesce(nullif(o.customer_email, ''), nullif(p.email, ''), nullif(u.email, ''), '')
    into v_nome, v_email
    from (select 1) d
    left join public.profiles p on p.id = o.user_id
    left join auth.users u on u.id = o.user_id;
  for it in select oi.id, oi.ticket_type_id, oi.quantity from public.order_items oi
              join public.ticket_types tt on tt.id = oi.ticket_type_id
             where oi.order_id = o.id and oi.unit_price = 0 and tt.price = 0 loop
    update public.ticket_types tt set sold = coalesce(tt.sold, 0) + it.quantity, quantity_sold = coalesce(tt.quantity_sold, 0) + it.quantity
     where tt.id = it.ticket_type_id
       and (case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total
                 when coalesce(tt.capacity, 0) > 0 then tt.capacity else null end is null
            or coalesce(tt.sold, 0) + it.quantity <= case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total else tt.capacity end);
    if not found then
      raise exception 'Ingressos esgotados' using errcode = '22023';
    end if;
    insert into public.tickets (order_item_id, order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, status)
    select it.id, o.id, it.ticket_type_id, o.event_id, o.user_id, v_nome, v_email, 'active'
      from generate_series(1, it.quantity);
    n := n + it.quantity;
  end loop;
  if n <> esperado then
    raise exception 'Emissão incompleta (% de %)', n, esperado using errcode = '22023';
  end if;
  update public.orders set status = 'paid' where id = o.id;
  return n;
end;
$function$;
revoke execute on function public.confirmar_pedido_gratis(uuid) from public, anon, authenticated;
grant execute on function public.confirmar_pedido_gratis(uuid) to authenticated;

-- 5. Conferências (abortam) -------------------------------------------------------------------------------------------
do $$
declare r text; f text;
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'customer_cpf_hmac')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ticket_types' and column_name = 'max_por_cpf') then
    raise exception 'coluna customer_cpf_hmac ou max_por_cpf ausente';
  end if;
  if (select count(*) from pg_trigger where tgname in ('orders_cpf_hash', 'orders_pago_cpf_guard')
        and tgrelid = 'public.orders'::regclass and tgenabled = 'O') <> 2 then
    raise exception 'gatilho orders_cpf_hash ou orders_pago_cpf_guard ausente ou desligado';
  end if;
  if position('limite por CPF (20261028)' in pg_get_functiondef('public.order_items_estoque_guard()'::regprocedure)) = 0
     or position('limite por CPF (20261028)' in pg_get_functiondef('public.confirmar_pedido_gratis(uuid)'::regprocedure)) = 0 then
    raise exception 'função recriada sem a marca do limite por CPF';
  end if;
  foreach r in array array['anon', 'authenticated'] loop
    foreach f in array array['public.orders_cpf_hash()', 'public.order_items_estoque_guard()', 'public.orders_pago_cpf_guard()'] loop
      if has_function_privilege(r, f, 'execute') then raise exception '% pode executar %', r, f; end if;
    end loop;
    if has_column_privilege(r, 'public.orders', 'customer_cpf_hmac', 'select') then
      raise exception '% lê customer_cpf_hmac', r;
    end if;
  end loop;
  if has_function_privilege('anon', 'public.confirmar_pedido_gratis(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.confirmar_pedido_gratis(uuid)', 'execute') then
    raise exception 'EXECUTE de confirmar_pedido_gratis fora do esperado (só authenticated)';
  end if;
  if not has_column_privilege('authenticated', 'public.ticket_types', 'max_por_cpf', 'update') then
    raise exception 'authenticated sem UPDATE de max_por_cpf (o painel edita)';
  end if;
  -- UPDATE de tabela em orders existe (baseline); quem impede o cliente de trocar o hash é a falta de regra permissiva
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and permissive = 'PERMISSIVE'
               and cmd in ('UPDATE', 'ALL') and roles && array['public', 'anon', 'authenticated']::name[]) then
    raise exception 'orders ganhou regra de UPDATE para o cliente: customer_cpf_hmac ficaria editável';
  end if;
end $$;

commit;

-- =============================================================================
-- DESFAZER: primeiro recriar as duas funções com a definição de antes (a de produção de 07/10, md5 do bloco 0; ler
-- com pg_get_functiondef ANTES de aplicar este arquivo e guardar), depois:
--   drop trigger if exists orders_cpf_hash on public.orders; drop function if exists public.orders_cpf_hash();
--   drop trigger if exists orders_pago_cpf_guard on public.orders; drop function if exists public.orders_pago_cpf_guard();
--   drop index if exists public.orders_customer_cpf_hmac_idx;
--   alter table public.orders drop column if exists customer_cpf_hmac;
--   alter table public.ticket_types drop column if exists max_por_cpf;
-- =============================================================================
