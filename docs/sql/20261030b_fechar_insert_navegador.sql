-- =============================================================================
-- Tela 06, fatia 2 (parte B): fecha o INSERT direto do navegador em orders e order_items. 2026-10-30 (NÃO aplicado)
-- !!! NÃO APLICAR ANTES DO FRONT PUBLICADO !!! O checkout antigo (app/src/hooks/useCheckout.ts) grava orders e order_items
-- direto; depois deste arquivo ele para de funcionar. Só aplicar quando o front novo (que chama reservar_ingressos) estiver
-- no ar em produção. Pré-requisito: 20261030a_venda_servidor_meia.sql aplicado.
-- O que faz: tira o INSERT de authenticated em orders e order_items e apaga as políticas permissivas de INSERT. Daí em
-- diante, pedido só nasce por reservar_ingressos e reservar_assentos (SECURITY DEFINER, dono postgres, que não dependem
-- deste grant). service_role e o dono mantêm tudo.
-- Como aplicar: colar inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA TextEdit). Uma transação, idempotente.
-- =============================================================================
begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.reservar_ingressos(uuid, jsonb, text, text)') is null then
    raise exception 'aplique antes 20261030a_venda_servidor_meia.sql';
  end if;
end $$;

drop policy if exists "Usuários criam próprias compras" on public.orders;
drop policy if exists "Usuários inserem itens da própria compra" on public.order_items;
revoke insert on table public.orders from anon, authenticated;
revoke insert on table public.order_items from anon, authenticated;

do $$
begin
  if has_table_privilege('authenticated', 'public.orders', 'insert') or has_table_privilege('anon', 'public.orders', 'insert')
     or has_table_privilege('authenticated', 'public.order_items', 'insert') or has_table_privilege('anon', 'public.order_items', 'insert') then
    raise exception 'ainda há INSERT para o navegador em orders ou order_items';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('orders', 'order_items')
               and permissive = 'PERMISSIVE' and cmd in ('INSERT', 'ALL') and roles && array['public', 'anon', 'authenticated']::name[]) then
    raise exception 'ainda há política permissiva de INSERT para o navegador';
  end if;
end $$;

commit;

-- DESFAZER (reabre o caminho antigo):
--   grant insert on table public.orders, public.order_items to authenticated;
--   create policy "Usuários criam próprias compras" on public.orders as permissive for insert to authenticated
--     with check ((auth.uid() = user_id) and (status = 'pending'::text) and (evento_acesso(event_id) = any (array['aberto'::text, 'link'::text])));
--   create policy "Usuários inserem itens da própria compra" on public.order_items as permissive for insert to authenticated
--     with check ((quantity > 0) and pode_comprar(order_id, ticket_type_id));
-- =============================================================================
