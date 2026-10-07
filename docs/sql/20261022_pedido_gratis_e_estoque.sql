-- =============================================================================
-- Pedido gratuito e estoque no servidor — banco — 2026-10-22 (NÃO aplicado)
-- Aplicar à mão no SQL Editor do Supabase, ANTES de mesclar o PR do front (Payment chama confirmar_pedido_gratis).
-- NÃO vai para supabase/migrations (Decisão 02). Idempotente. Antes de produção, testar com ROLLBACK pela API.
-- 1) order_items_estoque_guard (BEFORE INSERT/UPDATE em order_items): barra quantidade acima do disponível, fora de
--    min/max_per_order do tipo, fora da janela de venda (sale_start/sale_end) e de evento que já terminou.
--    Disponível = lotação real (quantity_total; capacity é legado; sem número = ilimitado, igual a app/src/lib/lotacao.ts)
--    menos ticket_types.sold menos o que está reservado em pedidos 'pending' com menos de 30 min (o mesmo prazo do cron
--    pedidos_pendentes_expirar). Trava a linha do tipo (for update) para dois pedidos simultâneos não passarem juntos.
--    Erro 22023 (o front já mostra a mensagem do banco em onError).
-- 1b) orders_um_pendente (BEFORE INSERT em orders): no máximo 1 pedido 'pending' por usuário e evento. O pedido pendente
--    anterior do mesmo usuário e evento é CANCELADO ao nascer o novo (o front cria outro quando total ou forma de pagamento
--    mudam e o cliente não tem UPDATE em orders; índice único faria esse fluxo falhar). Assim um usuário não esgota o
--    estoque empilhando pendentes. Trava por (usuário, evento) para duas inserções simultâneas.
-- 2) confirmar_pedido_gratis(p_order): o dono do pedido 'pending' (com menos de 30 min) de total 0 vira 'paid' e recebe os
--    ingressos, só se o BANCO confirmar que todos os itens têm preço 0 (ticket_types.price e order_items.unit_price).
--    Trava pedido, itens e tipos (nessa ordem, tipos por id) ANTES de conferir; emite só item de preço 0 e confere no fim
--    que emitiu tudo. Confere lotação (sold + quantidade <= lotação) e janela/fim do evento. Quem emite é a função
--    (security definer): o cliente continua sem INSERT em tickets. Soma sold/quantity_sold do tipo.
--    Usa pode_comprar (evento aberto/link e tipo ativo, 20261017). buyer_name/buyer_email NOT NULL: pedido, perfil, conta, ''.
-- ATENÇÃO (lotação em evento PAGO): até a Fase 4 este gatilho NÃO impede venda acima da lotação em evento pago, porque o
--    mock de pagamento não soma sold (só o pedido grátis soma). Só com o webhook do gateway somando sold a trava fecha.
-- RISCO: quando o gateway entrar, o webhook faz o mesmo (sold + tickets) e não pode contar o pedido grátis de novo (ele
--    já nasce 'paid'), e a regra de cancelar o pendente anterior (1b) precisa tratar Pix/boleto ainda não pago.
-- 2b) Limite POR CONTA em evento grátis (Decisão do Ricardo, 07/10): confirmar_pedido_gratis recusa se a soma de ingressos do
--    usuário no tipo (itens de pedidos 'paid' dele + o pedido atual) passar de coalesce(max_per_order, 10). O mesmo teto
--    (coalesce(max_per_order, 10)) vale por pedido no gatilho 1, SÓ para tipo grátis (price = 0); tipo pago sem
--    max_per_order não tem teto por pedido (nulo, como antes).
-- ponytail: impasse residual de ordem de travas: o gatilho trava o tipo e depois a FK pede o pedido; a RPC trava o pedido e
--    depois o tipo. Janela rara (INSERT de item contra confirmação do MESMO pedido); o Postgres detecta e aborta um dos dois
--    (40P01), o front mostra o erro e o cliente tenta de novo. Unificar a ordem se aparecer no log.
-- ponytail: em estoque PAGO o limite por pedido vale por pedido, não por conta; o teto real é max_per_order × nº de contas
--    (ou pedidos pendentes de 30 min). Limite por conta no pago entra com o gateway, junto do webhook.
-- ponytail: reserva por pedido pendente de 30 min fixa no código; mudar junto com o cron.
-- ponytail: fim do evento = mesma regra do front (end_date; senão início + 12 h; só dia = 24 h), data em America/Sao_Paulo.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Venda aberta: motivo de recusa (null = pode) ----------------------------------------------------------------------
create or replace function public.venda_bloqueada(p_ticket_type uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when x.fim <= now() then 'Este evento já terminou'
    when x.sale_start > now() then 'Vendas ainda não abriram'
    when x.sale_end <= now() then 'Vendas encerradas'
  end
  from (
    select tt.sale_start, tt.sale_end,
           coalesce(e.end_date, i.inicio + case when e.date is not null and e."time" is null then interval '24 hours' else interval '12 hours' end) as fim
      from public.ticket_types tt
      join public.events e on e.id = tt.event_id
      cross join lateral (select case when e.date is not null
          then (e.date + coalesce(e."time", time '00:00')) at time zone 'America/Sao_Paulo' else e.start_date end as inicio) i
     where tt.id = p_ticket_type) x;
$$;
revoke execute on function public.venda_bloqueada(uuid) from public, anon, authenticated;

-- 1. Estoque ---------------------------------------------------------------------------------------------------------
create or replace function public.order_items_estoque_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lotacao int;
  v_sold int;
  v_reservado int;
  v_min int;
  v_max int;
  v_no_pedido int;
  v_motivo text;
begin
  select case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total
              when coalesce(tt.capacity, 0) > 0 then tt.capacity else 0 end,
         coalesce(tt.sold, 0), tt.min_per_order,
         case when tt.price = 0 then coalesce(tt.max_per_order, 10) else tt.max_per_order end
    into v_lotacao, v_sold, v_min, v_max
    from public.ticket_types tt where tt.id = new.ticket_type_id for update;
  if not found then
    return new; -- tipo inexistente cai na FK
  end if;
  -- v_max: tipo grátis sem máximo definido = teto de 10; tipo pago sem máximo = sem teto por pedido (nulo)
  if new.quantity < 1 or new.quantity < coalesce(v_min, 1) then
    raise exception 'Quantidade fora do permitido por pedido (mínimo %)', coalesce(v_min, 1) using errcode = '22023';
  end if;
  -- o máximo vale por PEDIDO e tipo, não por linha (order_items não tem unique em (order_id, ticket_type_id)):
  -- soma as outras linhas do mesmo pedido e tipo (sem a própria, no UPDATE)
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
  if v_lotacao = 0 then
    return new; -- sem lotação não se afirma esgotado
  end if;
  select coalesce(sum(oi.quantity), 0) into v_reservado
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.ticket_type_id = new.ticket_type_id and oi.id is distinct from new.id
     and o.status = 'pending' and o.created_at > now() - interval '30 minutes';
  if v_sold + v_reservado + new.quantity > v_lotacao then
    raise exception 'Ingressos esgotados ou insuficientes (restam %)', greatest(v_lotacao - v_sold - v_reservado, 0) using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke execute on function public.order_items_estoque_guard() from public, anon, authenticated;
drop trigger if exists order_items_estoque_guard on public.order_items;
create trigger order_items_estoque_guard before insert or update of ticket_type_id, quantity on public.order_items
  for each row execute function public.order_items_estoque_guard();

-- 1b. Um pedido pendente por usuário e evento --------------------------------------------------------------------------
create or replace function public.orders_um_pendente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' then
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || new.event_id::text, 0));
    update public.orders set status = 'cancelled'
     where user_id = new.user_id and event_id = new.event_id and status = 'pending';
  end if;
  return new;
end;
$$;
revoke execute on function public.orders_um_pendente() from public, anon, authenticated;
drop trigger if exists orders_um_pendente on public.orders;
create trigger orders_um_pendente before insert on public.orders
  for each row execute function public.orders_um_pendente();

-- 2. Pedido gratuito -------------------------------------------------------------------------------------------------
create or replace function public.confirmar_pedido_gratis(p_order uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
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
$$;
revoke execute on function public.confirmar_pedido_gratis(uuid) from public, anon, authenticated;
grant execute on function public.confirmar_pedido_gratis(uuid) to authenticated;

-- Conferência
do $$
begin
  assert (select prosecdef from pg_proc where oid = 'public.confirmar_pedido_gratis(uuid)'::regprocedure), 'confirmar_pedido_gratis não é security definer';
  assert not has_function_privilege('anon', 'public.confirmar_pedido_gratis(uuid)', 'execute'), 'anon executa';
  assert has_function_privilege('authenticated', 'public.confirmar_pedido_gratis(uuid)', 'execute'), 'authenticated não executa';
  assert not has_function_privilege('authenticated', 'public.order_items_estoque_guard()', 'execute'), 'authenticated executa o gatilho';
  assert exists (select 1 from pg_trigger where tgname = 'order_items_estoque_guard' and tgrelid = 'public.order_items'::regclass), 'gatilho ausente';
  assert exists (select 1 from pg_trigger where tgname = 'orders_um_pendente' and tgrelid = 'public.orders'::regclass), 'gatilho orders_um_pendente ausente';
  assert not has_function_privilege('authenticated', 'public.venda_bloqueada(uuid)', 'execute'), 'authenticated executa venda_bloqueada';
  raise notice 'OK: pedido gratuito e estoque conferidos';
end $$;
commit;

/* Desfazer:
drop trigger if exists order_items_estoque_guard on public.order_items;
drop function if exists public.order_items_estoque_guard();
drop function if exists public.confirmar_pedido_gratis(uuid);
drop trigger if exists orders_um_pendente on public.orders;
drop function if exists public.orders_um_pendente();
drop function if exists public.venda_bloqueada(uuid);
*/
