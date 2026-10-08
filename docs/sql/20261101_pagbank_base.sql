-- =============================================================================
-- PagBank, base no banco (fatia 1) — 2026-11-01 (NÃO aplicado)
-- Aplicar à mão no SQL Editor do Supabase. NÃO vai para supabase/migrations (Decisão 02). Idempotente. Antes de produção, ensaio com ROLLBACK.
-- 1) webhook_events: um registro por evento do gateway, chave única (gateway, event_id). RLS ligado, sem política: só service_role (e o dono do banco).
--    payload: guardar só o mínimo necessário (nunca dado de cartão); quem grava é a Edge Function.
-- 2) Índice único parcial em orders(gateway_payment_id): o mesmo pagamento do gateway não paga dois pedidos. ABORTA se já houver duplicata.
-- 3) 'pagbank' no CHECK de payments.gateway (mantém stripe, woovi, pagseguro).
-- 4) confirmar_pedido_pago(order, gateway_payment_id, valor em centavos, event_id opcional): SÓ service_role. Retorna
--    'pago' | 'ja_pago' | 'valor_divergente' | 'estorno' | 'conflito' | 'nao_encontrado'. 'estorno' = o chamador devolve o dinheiro no PagBank
--    (pedido não vira paid: pagamento tardio, pedido fora do prazo, ou gatilho/lotação recusou). Todo desfecho é gravado em webhook_events
--    (event_id omitido = o próprio gateway_payment_id).
--    A emissão dos ingressos REPLICA o trecho de emissão de confirmar_pedido_gratis (20261030a): essa função é recriada a partir de
--    produção com conferência de md5 e depende de auth.uid(); mexer nela agora arrisca a venda gratuita. Se mudar lá (sold, tickets), mudar aqui.
--    Acrescenta price_paid (= unit_price do item) e beneficio (inteira/meia), que o gratuito deixa no padrão.
--    Diferença deliberada: não reconfere janela de venda nem pode_comprar (o cliente já pagou dentro do prazo do pedido); confere lotação.
-- ponytail: mesma lotação e mesmo prazo (30 min / reservado_ate) fixos no código, como o gratuito e o cron; mudar junto.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 1. webhook_events -----------------------------------------------------------------------------------------------------
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  gateway text not null,
  event_id text not null,
  order_id uuid references public.orders(id) on delete set null,
  recebido_em timestamptz not null default now(),
  resultado text,
  payload jsonb not null default '{}'::jsonb,
  constraint webhook_events_gateway_event_uk unique (gateway, event_id)
);
alter table public.webhook_events enable row level security;
revoke all on public.webhook_events from public, anon, authenticated;
grant all on public.webhook_events to service_role;

-- 2. Um pagamento do gateway, um pedido -----------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.orders where gateway_payment_id is not null group by gateway_payment_id having count(*) > 1) then
    raise exception 'orders.gateway_payment_id tem duplicata: resolver antes de criar o índice único';
  end if;
end $$;
create unique index if not exists orders_gateway_payment_id_uk on public.orders (gateway_payment_id) where gateway_payment_id is not null;

-- 3. 'pagbank' em payments.gateway ----------------------------------------------------------------------------------------
alter table public.payments drop constraint if exists payments_gateway_check;
alter table public.payments add constraint payments_gateway_check
  check (gateway = any (array['stripe'::text, 'woovi'::text, 'pagseguro'::text, 'pagbank'::text]));

-- 4. Confirmação de pedido pago -------------------------------------------------------------------------------------------
create or replace function public.confirmar_pedido_pago(p_order_id uuid, p_gateway_payment_id text, p_valor_pago_centavos integer, p_event_id text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
  v_ret text;   -- o que o chamador recebe
  v_res text;   -- o que fica em webhook_events.resultado
  v_nome text;
  v_email text;
  n int := 0;
  esperado int;
  it record;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    v_ret := 'nao_encontrado'; v_res := 'nao_encontrado';
  elsif o.status = 'paid' then
    if o.gateway_payment_id is not distinct from p_gateway_payment_id then
      v_ret := 'ja_pago'; v_res := 'ja_pago';
    else
      v_ret := 'conflito'; v_res := 'conflito_outro_pagamento';
    end if;
  elsif o.status <> 'pending' then
    -- cancelado pelo cron (ou failed/refunded): não revive, o chamador estorna
    v_ret := 'estorno'; v_res := 'pagamento_tardio';
  elsif o.created_at <= now() - interval '30 minutes' or (o.reservado_ate is not null and o.reservado_ate <= now()) then
    v_ret := 'estorno'; v_res := 'pagamento_tardio'; -- pendente vencido que o cron ainda não cancelou
  elsif p_valor_pago_centavos is distinct from round(o.total * 100)::int then
    v_ret := 'valor_divergente'; v_res := 'valor_divergente: pago ' || coalesce(p_valor_pago_centavos::text, 'null') || ', esperado ' || round(o.total * 100)::int;
  else
    begin
      -- trava itens e tipos (por id), como confirmar_pedido_gratis
      perform 1 from public.order_items where order_id = o.id for update;
      perform 1 from public.ticket_types where id in (select ticket_type_id from public.order_items where order_id = o.id) order by id for update;
      select coalesce(sum(quantity), 0) into esperado from public.order_items where order_id = o.id;
      if esperado = 0 then
        raise exception 'Pedido sem itens' using errcode = '22023';
      end if;
      select coalesce(nullif(o.customer_name, ''), nullif(p.full_name, ''), nullif(u.raw_user_meta_data->>'full_name', ''), ''),
             coalesce(nullif(o.customer_email, ''), nullif(p.email, ''), nullif(u.email, ''), '')
        into v_nome, v_email
        from (select 1) d
        left join public.profiles p on p.id = o.user_id
        left join auth.users u on u.id = o.user_id;
      -- emissão: mesma de confirmar_pedido_gratis (20261030a), para TODOS os itens (aqui o item é pago)
      for it in select oi.id, oi.ticket_type_id, oi.quantity, oi.unit_price, oi.beneficio from public.order_items oi where oi.order_id = o.id loop
        update public.ticket_types tt set sold = coalesce(tt.sold, 0) + it.quantity, quantity_sold = coalesce(tt.quantity_sold, 0) + it.quantity
         where tt.id = it.ticket_type_id
           and (case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total
                     when coalesce(tt.capacity, 0) > 0 then tt.capacity else null end is null
                or coalesce(tt.sold, 0) + it.quantity <= case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total else tt.capacity end);
        if not found then
          raise exception 'Ingressos esgotados' using errcode = '22023';
        end if;
        insert into public.tickets (order_item_id, order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, status, price_paid, beneficio)
        select it.id, o.id, it.ticket_type_id, o.event_id, o.user_id, v_nome, v_email, 'active', it.unit_price, it.beneficio
          from generate_series(1, it.quantity);
        n := n + it.quantity;
      end loop;
      if n <> esperado then
        raise exception 'Emissão incompleta (% de %)', n, esperado using errcode = '22023';
      end if;
      -- gatilhos orders_pago_assento_guard e orders_pago_cpf_guard disparam aqui (22023)
      update public.orders set status = 'paid', gateway_payment_id = p_gateway_payment_id, payment_gateway = 'pagbank' where id = o.id;
      insert into public.payments (order_id, gateway, gateway_payment_id, amount, status)
        values (o.id, 'pagbank', p_gateway_payment_id, o.total, 'completed');
      v_ret := 'pago'; v_res := 'pago';
    exception
      when sqlstate '22023' then
        v_ret := 'estorno'; v_res := 'estorno_recusado: ' || sqlerrm; -- subtransação desfeita: sem ticket, sold intacto, pedido segue pending
      when unique_violation then
        v_ret := 'conflito'; v_res := 'conflito_gateway_payment_id'; -- outro pedido já tem este gateway_payment_id
    end;
  end if;

  insert into public.webhook_events (gateway, event_id, order_id, resultado)
    values ('pagbank', coalesce(p_event_id, p_gateway_payment_id), (select id from public.orders where id = p_order_id), v_res)
  on conflict (gateway, event_id) do update set resultado = excluded.resultado, order_id = coalesce(excluded.order_id, public.webhook_events.order_id);
  return v_ret;
end;
$$;
revoke all on function public.confirmar_pedido_pago(uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.confirmar_pedido_pago(uuid, text, integer, text) to service_role;

-- Conferência
do $$
begin
  assert (select prosecdef from pg_proc where oid = 'public.confirmar_pedido_pago(uuid,text,integer,text)'::regprocedure), 'confirmar_pedido_pago não é security definer';
  assert not has_function_privilege('anon', 'public.confirmar_pedido_pago(uuid,text,integer,text)', 'execute'), 'anon executa';
  assert not has_function_privilege('authenticated', 'public.confirmar_pedido_pago(uuid,text,integer,text)', 'execute'), 'authenticated executa';
  assert has_function_privilege('service_role', 'public.confirmar_pedido_pago(uuid,text,integer,text)', 'execute'), 'service_role não executa';
  assert (select relrowsecurity from pg_class where oid = 'public.webhook_events'::regclass), 'webhook_events sem RLS';
  assert not has_table_privilege('authenticated', 'public.webhook_events', 'select'), 'authenticated lê webhook_events';
  assert exists (select 1 from pg_constraint where conname = 'payments_gateway_check' and pg_get_constraintdef(oid) like '%pagbank%'), 'CHECK sem pagbank';
  raise notice 'OK: base PagBank conferida';
end $$;
commit;

/* Desfazer:
drop function if exists public.confirmar_pedido_pago(uuid, text, integer, text);
drop index if exists public.orders_gateway_payment_id_uk;
drop table if exists public.webhook_events;
alter table public.payments drop constraint if exists payments_gateway_check;
alter table public.payments add constraint payments_gateway_check check (gateway = any (array['stripe'::text, 'woovi'::text, 'pagseguro'::text]));  -- falha se já houver payments 'pagbank'
*/
