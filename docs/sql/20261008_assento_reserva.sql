-- =============================================================================
-- Lugar marcado: escolher e reservar assento por 10 min — banco — 2026-10-08 (NÃO aplicado)
-- Aplicar à mão no SQL Editor do Supabase, DEPOIS de 20261021_pedidos_pendentes_expiram.sql e 20261022_pedido_gratis_e_estoque.sql
-- (este arquivo recria funções dos dois) e ANTES de mesclar o PR do front. NÃO vai para supabase/migrations (Decisão 02).
-- Idempotente (exceto o aviso do item 0). Antes de produção, testar com ROLLBACK pela API.
-- 0) seating_maps.is_active passa a nascer false e os mapas JÁ salvos são desligados (D4: o produtor precisa ativar de propósito).
--    O desligamento roda UMA vez (só se o padrão da coluna ainda é true): rodar de novo não apaga a ativação feita depois.
-- 1) pedido_assentos: um lugar (seat_key = ambiente:assento do JSON de seating_maps.environments) preso a um pedido, com
--    expira_em. Índice único parcial (event_id, seat_key) onde liberada_em é nulo: no máximo UM dono vivo por lugar. Sem
--    política de RLS e sem grant: o navegador só passa pelas funções abaixo. A reserva liberada NÃO é apagada (liberada_em):
--    fica o rastro de que o pedido tinha lugar, para o gatilho 4 recusar o pagamento tardio (D2).
-- 2) reservar_assentos(p_event, p_seats): security definer. Confere conta, evento aberto/link, mapa ativo, lugares válidos
--    (assento ou mesa, status livre, setor com ticketTypeId de tipo ativo, não coletivo, do evento) e o limite de 5 pedidos
--    por hora e conta no evento (Decisão 154); cria o pedido 'pending' e os itens com o PREÇO DO BANCO (passam pelos gatilhos
--    do 20261022: estoque, máximo por pedido, janela de venda, orders_um_pendente); libera reservas vencidas; segura os
--    lugares 10 min. Mesa = todas as cadeiras (seatsCount, senão capacity, senão 6) em ingressos do tipo do setor.
--    Corrida: o gatilho de estoque trava a linha do tipo e o índice único barra o 2º dono: só um comprador vence, o outro
--    recebe "Lugar acabou de ser escolhido" e a transação inteira (pedido incluído) é desfeita.
-- 3) assentos_ocupados(p_event): anon e authenticated; só seat_key e estado (vendido | reservado), nada pessoal; só de evento
--    aberto ou por link (evento_acesso).
-- 4) D1/D2: pedido com lugar vence em 10 min (estoque do 20261022 só conta pendente de lugar por 10 min; o vencimento
--    automático pedidos_pendentes_expirar também cancela pedido com lugar após 10 min). Gatilho BEFORE UPDATE em orders:
--    não vira 'paid' pedido cujo lugar venceu ou foi liberado (o gateway estorna). Pedido grátis com lugar, dentro do prazo,
--    passa (confirmar_pedido_gratis só faz UPDATE ... 'paid').
-- 5) Assunto de chat "Denunciar evento" (site e participant_evokaa), idempotente.
-- RISCO Fase 4 (gateway): o webhook que marca 'paid' recebe 22023 deste gatilho quando o lugar venceu e tem de estornar;
--    ele também não pode marcar 'paid' um pedido já 'cancelled' (a liberação cancela o pedido vencido).
-- ponytail: lugar liberado fica como linha com liberada_em (histórico); sem limpeza. Apagar liberadas com mais de 30 dias se crescer.
-- ponytail: o total vendido é contido pela lotação do tipo (#217), não pelo número de lugares do mapa; o produtor casa lotação e mapa.
-- ponytail: cron roda a cada 10 min; o vencimento "de verdade" acontece na hora pela própria reserva (libera) e por assentos_ocupados
--    (ignora vencida), o cron só arruma o status do pedido esquecido.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Mapa só aparece se o produtor ativar -----------------------------------------------------------------------------
do $$
begin
  if (select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'seating_maps' and column_name = 'is_active') = 'true' then
    update public.seating_maps set is_active = false;
    alter table public.seating_maps alter column is_active set default false;
  end if;
end $$;

-- 1. Reservas ----------------------------------------------------------------------------------------------------------
create table if not exists public.pedido_assentos (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  seat_key text not null,
  ticket_type_id uuid not null references public.ticket_types(id) on delete cascade,
  lugares int not null check (lugares >= 1),
  expira_em timestamptz not null,
  liberada_em timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists pedido_assentos_lugar_vivo on public.pedido_assentos (event_id, seat_key) where liberada_em is null;
create index if not exists pedido_assentos_pedido on public.pedido_assentos (order_id);
alter table public.pedido_assentos enable row level security;
revoke all on table public.pedido_assentos from public, anon, authenticated;
grant all on table public.pedido_assentos to service_role;

-- 1b. Estoque: pedido pendente COM lugar prende o estoque por 10 min (sem lugar, 30). Resto igual ao 20261022 ----------------
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
     and o.status = 'pending'
     and o.created_at > now() - case when exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)
                                     then interval '10 minutes' else interval '30 minutes' end;
  if v_sold + v_reservado + new.quantity > v_lotacao then
    raise exception 'Ingressos esgotados ou insuficientes (restam %)', greatest(v_lotacao - v_sold - v_reservado, 0) using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke execute on function public.order_items_estoque_guard() from public, anon, authenticated;

-- 2. Reservar ----------------------------------------------------------------------------------------------------------
create or replace function public.reservar_assentos(p_event uuid, p_seats text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_mapa jsonb;
  v_n int;
  v_ok int;
  v_sel jsonb;
  v_order uuid;
  v_expira timestamptz := now() + interval '10 minutes';
  v_nome text;
  v_email text;
  v_sub bigint := 0;
  v_taxa bigint := 0;
  l record;
begin
  if v_user is null then
    raise exception 'Entre na sua conta para escolher o lugar' using errcode = '42501';
  end if;
  if p_seats is null or cardinality(p_seats) < 1 or cardinality(p_seats) > 20 then
    raise exception 'Escolha de 1 a 20 lugares' using errcode = '22023';
  end if;
  if public.evento_acesso(p_event) is distinct from 'aberto' and public.evento_acesso(p_event) is distinct from 'link' then
    raise exception 'Evento indisponível para compra' using errcode = '22023';
  end if;
  -- mesma trava do gatilho orders_um_pendente: contagem e criação do pedido da mesma pessoa e evento em fila
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || p_event::text, 0));
  select count(*) into v_n from public.orders where user_id = v_user and event_id = p_event and created_at > now() - interval '1 hour';
  if v_n >= 5 then
    raise exception 'Você já fez 5 pedidos neste evento na última hora. Tente de novo mais tarde.' using errcode = '22023';
  end if;
  select environments into v_mapa from public.seating_maps where event_id = p_event and is_active;
  if v_mapa is null then
    raise exception 'Este evento não tem mapa de lugares disponível' using errcode = '22023';
  end if;

  -- lugares pedidos que existem, estão livres no mapa e têm setor com tipo de ingresso do evento; agrupa por tipo
  select coalesce(jsonb_agg(jsonb_build_object('seat_key', x.seat_key, 'tt', x.tt, 'lugares', x.lugares)), '[]'::jsonb) into v_sel
    from (
      select distinct (env.value->>'id') || ':' || (s.value->>'id') as seat_key,
             (sec.value->>'ticketTypeId')::uuid as tt,
             case when s.value->>'type' = 'table'
                  then greatest(coalesce(case when jsonb_typeof(s.value->'seatsCount') = 'number' then (s.value->>'seatsCount')::int end,
                                         case when jsonb_typeof(s.value->'capacity') = 'number' then (s.value->>'capacity')::int end, 6), 1)
                  else 1 end as lugares
        from jsonb_array_elements(case when jsonb_typeof(v_mapa) = 'array' then v_mapa else '[]'::jsonb end) env(value)
        cross join lateral jsonb_array_elements(case when jsonb_typeof(env.value->'seats') = 'array' then env.value->'seats' else '[]'::jsonb end) s(value)
        join lateral jsonb_array_elements(case when jsonb_typeof(env.value->'sections') = 'array' then env.value->'sections' else '[]'::jsonb end) sec(value)
          on sec.value->>'id' = s.value->>'sectionId'
       where (env.value->>'id') || ':' || (s.value->>'id') = any (p_seats)
         and s.value->>'type' in ('seat', 'table')
         and coalesce(s.value->>'status', 'free') = 'free'
         and sec.value->>'ticketTypeId' ~ '^[0-9a-fA-F-]{36}$'
    ) x
   where exists (select 1 from public.ticket_types tt
                  where tt.id = x.tt and tt.event_id = p_event and tt.is_active and tt.type is distinct from 'coletiva');
  v_ok := jsonb_array_length(v_sel);
  if v_ok <> (select count(distinct x) from unnest(p_seats) x) then
    raise exception 'Algum dos lugares escolhidos não está disponível' using errcode = '22023';
  end if;

  -- pedido pelo caminho do #217: preço do banco; os gatilhos conferem estoque, máximo, janela e cancelam o pendente anterior
  select coalesce(nullif(p.full_name, ''), nullif(u.raw_user_meta_data->>'full_name', '')),
         coalesce(nullif(p.email, ''), nullif(u.email, ''))
    into v_nome, v_email
    from (select 1) d
    left join public.profiles p on p.id = v_user
    left join auth.users u on u.id = v_user;
  for l in select r.tt, sum(r.lugares)::int as q, round(tt.price * 100)::bigint as c
             from jsonb_to_recordset(v_sel) r(seat_key text, tt uuid, lugares int) join public.ticket_types tt on tt.id = r.tt group by r.tt, tt.price loop
    v_sub := v_sub + l.c * l.q;
    v_taxa := v_taxa + case when l.c <= 0 then 0 else greatest(round(l.c * 10 / 100.0), 300) end * l.q; -- = app/src/lib/taxa.ts
  end loop;
  insert into public.orders (user_id, event_id, subtotal, service_fee, total, status, customer_name, customer_email)
  values (v_user, p_event, v_sub / 100.0, v_taxa / 100.0, (v_sub + v_taxa) / 100.0, 'pending', v_nome, v_email)
  returning id into v_order;
  insert into public.order_items (order_id, ticket_type_id, quantity, unit_price, subtotal)
  select v_order, r.tt, sum(r.lugares)::int, tt.price, tt.price * sum(r.lugares)
    from jsonb_to_recordset(v_sel) r(seat_key text, tt uuid, lugares int) join public.ticket_types tt on tt.id = r.tt
   group by r.tt, tt.price order by r.tt; -- mesma ordem de trava em todo pedido

  -- libera o que venceu ou ficou de pedido não pago: pedido pendente vencido é cancelado ANTES, e a reserva guarda o rastro
  update public.orders set status = 'cancelled'
   where status = 'pending' and id in (select order_id from public.pedido_assentos
                                        where event_id = p_event and liberada_em is null and expira_em <= now());
  update public.pedido_assentos pa set liberada_em = now(), expira_em = least(pa.expira_em, now())
    from public.orders o
   where o.id = pa.order_id and pa.event_id = p_event and pa.liberada_em is null
     and o.status <> 'paid' and (o.status <> 'pending' or pa.expira_em <= now());

  begin
    insert into public.pedido_assentos (order_id, event_id, seat_key, ticket_type_id, lugares, expira_em)
    select v_order, p_event, r.seat_key, r.tt, r.lugares, v_expira from jsonb_to_recordset(v_sel) r(seat_key text, tt uuid, lugares int);
  exception when unique_violation then
    raise exception 'Lugar acabou de ser escolhido' using errcode = '22023';
  end;
  return jsonb_build_object('order_id', v_order, 'expira_em', v_expira, 'agora', now()); -- 'agora' para a contagem do navegador não depender do relógio dele
end;
$$;
revoke execute on function public.reservar_assentos(uuid, text[]) from public, anon, authenticated;
grant execute on function public.reservar_assentos(uuid, text[]) to authenticated;

-- 3. Ocupados: só lugar e estado --------------------------------------------------------------------------------------
create or replace function public.assentos_ocupados(p_event uuid)
returns table (seat_key text, estado text)
language sql
stable
security definer
set search_path = ''
as $$
  select pa.seat_key, case when o.status = 'paid' then 'vendido' else 'reservado' end
    from public.pedido_assentos pa
    join public.orders o on o.id = pa.order_id
   where pa.event_id = p_event and pa.liberada_em is null
     and public.evento_acesso(p_event) in ('aberto', 'link')
     and (o.status = 'paid' or (o.status = 'pending' and pa.expira_em > now()));
$$;
revoke execute on function public.assentos_ocupados(uuid) from public, anon, authenticated;
grant execute on function public.assentos_ocupados(uuid) to anon, authenticated;

-- 4. Vencimento e pagamento tardio ---------------------------------------------------------------------------------------
create or replace function public.pedidos_pendentes_expirar(p_minutos int default 30)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare n int;
begin
  update public.orders o
     set status = 'cancelled'
   where o.status = 'pending'
     and (o.created_at < now() - make_interval(mins => greatest(p_minutos, 5))
          or (o.created_at < now() - interval '10 minutes'
              and exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)));
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.pedidos_pendentes_expirar(int) from public, anon, authenticated;
grant execute on function public.pedidos_pendentes_expirar(int) to service_role;

create or replace function public.orders_pago_assento_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.pedido_assentos pa
              where pa.order_id = new.id and (pa.liberada_em is not null or pa.expira_em <= now())) then
    raise exception 'O tempo do lugar acabou: o pagamento deste pedido não pode ser confirmado' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke execute on function public.orders_pago_assento_guard() from public, anon, authenticated;
drop trigger if exists orders_pago_assento_guard on public.orders;
create trigger orders_pago_assento_guard before update of status on public.orders
  for each row when (new.status = 'paid' and old.status is distinct from 'paid')
  execute function public.orders_pago_assento_guard();

-- 5. Assunto de chat "Denunciar evento" ---------------------------------------------------------------------------------
insert into public.chat_topics (audience, label, hint, department_id, urgent, position)
select v.audience, 'Denunciar evento', 'Conte o que há de errado e cole o link do evento. Também aceitamos denúncias em contato@evokaa.com.br.',
       d.id, false, 6
  from (values ('site'), ('participant_evokaa')) v(audience)
  join public.chat_departments d on d.slug = 'geral'
 where not exists (select 1 from public.chat_topics t where t.audience = v.audience and t.label = 'Denunciar evento');

-- Conferência
do $$
begin
  assert (select prosecdef from pg_proc where oid = 'public.reservar_assentos(uuid, text[])'::regprocedure), 'reservar_assentos não é security definer';
  assert not has_function_privilege('anon', 'public.reservar_assentos(uuid, text[])', 'execute'), 'anon reserva';
  assert has_function_privilege('authenticated', 'public.reservar_assentos(uuid, text[])', 'execute'), 'authenticated não reserva';
  assert has_function_privilege('anon', 'public.assentos_ocupados(uuid)', 'execute'), 'anon não lê ocupados';
  assert not has_table_privilege('authenticated', 'public.pedido_assentos', 'select'), 'authenticated lê pedido_assentos';
  assert not has_table_privilege('anon', 'public.pedido_assentos', 'select'), 'anon lê pedido_assentos';
  assert (select relrowsecurity from pg_class where oid = 'public.pedido_assentos'::regclass), 'RLS desligada em pedido_assentos';
  assert not has_function_privilege('authenticated', 'public.orders_pago_assento_guard()', 'execute'), 'authenticated executa o gatilho';
  assert not has_function_privilege('authenticated', 'public.pedidos_pendentes_expirar(int)', 'execute'), 'authenticated expira pedidos';
  assert exists (select 1 from pg_trigger where tgname = 'orders_pago_assento_guard' and tgrelid = 'public.orders'::regclass), 'gatilho de pagamento ausente';
  assert (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'seating_maps' and column_name = 'is_active') = 'false', 'is_active ainda nasce true';
  assert (select count(*) from public.chat_topics where label = 'Denunciar evento') = 2, 'assunto Denunciar evento não está em site e participant_evokaa';
  raise notice 'OK: lugar marcado e reserva conferidos';
end $$;
commit;

/* Desfazer (o front deste PR para de funcionar com mapa; mapas ficam desligados):
drop trigger if exists orders_pago_assento_guard on public.orders;
drop function if exists public.orders_pago_assento_guard();
drop function if exists public.assentos_ocupados(uuid);
drop function if exists public.reservar_assentos(uuid, text[]);
drop table if exists public.pedido_assentos;
alter table public.seating_maps alter column is_active set default true;
delete from public.chat_topics where label = 'Denunciar evento';
-- order_items_estoque_guard e pedidos_pendentes_expirar: reaplicar as versões de 20261022 e 20261021.
*/
