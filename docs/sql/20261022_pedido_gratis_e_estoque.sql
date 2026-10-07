-- =============================================================================
-- Pedido gratuito e estoque no servidor — banco — 2026-10-22 (NÃO aplicado)
-- Aplicar à mão no SQL Editor do Supabase, ANTES de mesclar o PR do front (Payment chama confirmar_pedido_gratis).
-- NÃO vai para supabase/migrations (Decisão 02). Idempotente. Antes de produção, testar com ROLLBACK pela API.
-- 1) order_items_estoque_guard (BEFORE INSERT/UPDATE em order_items): barra quantidade acima do disponível.
--    Disponível = lotação real (quantity_total; capacity é legado; sem número = ilimitado, igual a app/src/lib/lotacao.ts)
--    menos ticket_types.sold menos o que está reservado em pedidos 'pending' com menos de 30 min (o mesmo prazo do cron
--    pedidos_pendentes_expirar). Trava a linha do tipo (for update) para dois pedidos simultâneos não passarem juntos.
--    Erro 22023 (o front já mostra a mensagem do banco em onError).
-- 2) confirmar_pedido_gratis(p_order): o dono do pedido 'pending' de total 0 vira 'paid' e recebe os ingressos, só se o
--    BANCO confirmar que todos os itens têm preço 0 (ticket_types.price e order_items.unit_price). Quem emite é a função
--    (security definer): o cliente continua sem INSERT em tickets. Soma sold/quantity_sold do tipo.
--    Usa pode_comprar (evento aberto/link e tipo ativo, 20261017). Confirma por cada item do pedido.
-- RISCO: sold hoje não é somado por nenhum outro caminho (sem webhook, Fase 4); quando o gateway entrar, o webhook faz o
--    mesmo (sold + tickets) e não pode contar o pedido grátis de novo (ele já nasce 'paid').
-- ponytail: janela de venda (sale_start/sale_end), data do evento, min/max_per_order não são conferidos aqui, só no front.
-- ponytail: reserva por pedido pendente de 30 min fixa no código; mudar junto com o cron.
-- =============================================================================
begin;
set local lock_timeout = '5s';

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
begin
  select case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total
              when coalesce(tt.capacity, 0) > 0 then tt.capacity else 0 end,
         coalesce(tt.sold, 0)
    into v_lotacao, v_sold
    from public.ticket_types tt where tt.id = new.ticket_type_id for update;
  if not found or v_lotacao = 0 then
    return new; -- tipo inexistente cai na FK; sem lotação não se afirma esgotado
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
  it record;
begin
  select * into o from public.orders where id = p_order and user_id = auth.uid() and status = 'pending' for update;
  if not found then
    raise exception 'Pedido não encontrado ou já processado' using errcode = '22023';
  end if;
  if not exists (select 1 from public.order_items where order_id = o.id) then
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

  select o.customer_name, o.customer_email into v_nome, v_email;
  for it in select oi.id, oi.ticket_type_id, oi.quantity from public.order_items oi where oi.order_id = o.id loop
    insert into public.tickets (order_item_id, order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, status)
    select it.id, o.id, it.ticket_type_id, o.event_id, o.user_id, v_nome, v_email, 'active'
      from generate_series(1, it.quantity);
    update public.ticket_types set sold = coalesce(sold, 0) + it.quantity, quantity_sold = coalesce(quantity_sold, 0) + it.quantity
     where id = it.ticket_type_id;
    n := n + it.quantity;
  end loop;
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
  raise notice 'OK: pedido gratuito e estoque conferidos';
end $$;
commit;

/* Desfazer:
drop trigger if exists order_items_estoque_guard on public.order_items;
drop function if exists public.order_items_estoque_guard();
drop function if exists public.confirmar_pedido_gratis(uuid);
*/
