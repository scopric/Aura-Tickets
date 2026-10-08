-- =============================================================================
-- Risco ALTO achado pelo `seguranca` na tela 04 (07/10/2026), que já existia: `authenticated` tinha UPDATE na tabela
-- ticket_types inteira e a policy do produtor é ALL sem WITH CHECK. O produtor podia mandar um PATCH direto e zerar
-- `sold` e `quantity_sold`: o guard de estoque (#217, order_items_estoque_guard) calcula o estoque só com `sold`, então
-- o estoque "voltava" e o evento vendia além da lotação. Também podia trocar `event_id` do tipo (os compradores
-- "migravam" de evento). O gatilho gf_trava_venda_ingresso não cobre isso (dispara só se a quantidade muda).
-- Conserto: UPDATE só nas colunas que o produtor realmente edita. Fora dele ficam: id, event_id, sold, quantity_sold,
-- created_at, updated_at. Quem grava `sold`/`quantity_sold` é função security definer (confirmar_pedido_gratis, #217),
-- que roda como dono da tabela e não passa por estes grants. service_role e o dono mantêm tudo.
-- `anon` também perde o UPDATE de tabela (a RLS já o barrava; fica sem a permissão em vez de depender só dela).
-- INSERT e DELETE não mudam. O app nunca atualiza essas colunas: useEvents.ts (update: name, description, price,
-- capacity, quantity_total, perks, inclui_bebida, sale_start, sale_end), PainelEvento.tsx (is_active).
-- Como aplicar: colar inteiro no SQL Editor (UTF-8 via pbcopy, nunca TextEdit). Uma transação, idempotente.
-- Testes: 20261027_ticket_types_grants_por_coluna_testes.sql (só em banco descartável). NÃO mover para supabase/migrations/.
-- =============================================================================
begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public.ticket_types') is null then
    raise exception 'public.ticket_types não existe';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ticket_types'
             and column_name not in ('id','event_id','name','description','price','capacity','quantity_total','sold','quantity_sold',
               'min_per_order','max_per_order','valid_from','valid_until','sale_start','sale_end','perks','perks_array','type',
               'sort_order','is_active','created_at','updated_at','inclui_bebida')) then
    raise exception 'ticket_types ganhou coluna nova desde 07/10: decidir se entra no grant de UPDATE e refazer a lista';
  end if;
end $$;

revoke update on table public.ticket_types from anon, authenticated;
grant update (name, description, price, capacity, quantity_total, min_per_order, max_per_order, valid_from, valid_until,
              sale_start, sale_end, perks, perks_array, type, sort_order, is_active, inclui_bebida)
  on public.ticket_types to authenticated;

-- Conferências (abortam) ---------------------------------------------------------------------------------------
do $$
declare c text;
begin
  foreach c in array array['id','event_id','sold','quantity_sold','created_at','updated_at'] loop
    if has_column_privilege('authenticated', 'public.ticket_types', c, 'update') then
      raise exception 'authenticated ainda pode atualizar %', c;
    end if;
    if has_column_privilege('anon', 'public.ticket_types', c, 'update') then
      raise exception 'anon ainda pode atualizar %', c;
    end if;
  end loop;
  foreach c in array array['name','description','price','capacity','quantity_total','min_per_order','max_per_order','valid_from','valid_until',
                           'sale_start','sale_end','perks','perks_array','type','sort_order','is_active','inclui_bebida'] loop
    if not has_column_privilege('authenticated', 'public.ticket_types', c, 'update') then
      raise exception 'authenticated perdeu o UPDATE de % (o painel edita)', c;
    end if;
  end loop;
  if not has_column_privilege('service_role', 'public.ticket_types', 'sold', 'update') then
    raise exception 'service_role perdeu o UPDATE de sold';
  end if;
end $$;

commit;
