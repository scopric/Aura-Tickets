-- =============================================================================
-- Tela 06, fatia 2: venda no servidor com meia-entrada, taxa, cupom e reserva de 10 min. 2026-10-30 (NÃO aplicado)
-- ADITIVO: o caminho antigo (INSERT do navegador em orders/order_items) continua funcionando, só fica mais estreito
-- (políticas RESTRICTIVE, item 8). O arquivo B (20261030b_fechar_insert_navegador.sql) fecha o INSERT direto e só vem
-- DEPOIS do front publicado. Mudanças:
-- 1. Colunas: ticket_types.permite_meia (padrão true; UPDATE para authenticated: o produtor liga e desliga); order_items.beneficio
--    ('inteira'|'meia'), meia_tipo, taxa_unit; orders.reservado_ate. tickets NÃO ganha coluna: a portaria lê o benefício por
--    order_item_id. Tabela beneficios_uf (benefício estadual por UF), vazia, RLS ligada, SELECT para anon.
--    Benefícios nacionais fixos na reservar_ingressos: estudante, pcd, pcd_acompanhante, jovem_baixa_renda. Estadual só vale se
--    existir em beneficios_uf para a UF do evento (events.venue_state).
--    permite_meia = false em mesa e coletiva (UPDATE nos existentes; o guard também recusa). VIP TEM meia (decisão do Ricardo).
-- 2. evk_taxa_centavos(bigint, boolean) e evk_preco_meia(bigint): sem grant (só as funções abaixo usam).
--    Meia = floor(preço/2) em centavos, piso de 1 centavo. Taxa = 10%, mínimo R$ 3 por ingresso, 0 se o valor é 0 (espelha
--    app/src/lib/taxa.ts). Plano B da taxa na meia (sem o piso de R$ 3): trocar a linha marcada PISO_MEIA por 0.
-- 3. order_items_estoque_guard recriada a partir da definição de PRODUÇÃO (md5 783677ce…), preservando a cláusula de
--    pedido_assentos e a marca 'limite por CPF (20261028)'; marca nova 'meia (20261030)': (a) pedido pendente "vivo" =
--    reservado_ate no futuro; sem reservado_ate, a regra antiga (30 min, 10 com assento vivo); (b) cota de meia por tipo
--    = ceil(40% da lotação); item meia exige permite_meia, preço > 0, tipo fora de mesa/coletiva e fora do mapa de lugares,
--    meia_tipo preenchido, e não passa de cota - meias ocupadas ("Restam N meias neste ingresso"); inteira só vende até
--    lotação - max(0, cota - meias ocupadas). Lotação 0 = sem teto, meia sem teto. Cada ticket_type é o seu próprio grupo
--    (a fatia 3 traz o grupo). Tipo de lugar marcado: sem meia e sem reserva de cota (reservar_assentos não grava benefício;
--    ver relatório).
-- 4. confirmar_pedido_gratis recriada a partir de PRODUÇÃO (md5 e949efce…), preservando 'limite por CPF (20261028)': aceita
--    pedido COM CUPOM de total 0 (cupom de 100%: item de preço > 0, desconto no pedido) e recusa reserva vencida.
--    Sem cupom nada muda (item e tipo de preço 0, total 0).
-- 5. vitrine_ingressos(evento): por tipo ativo, preço, taxa, meia, disponíveis; sem dado pessoal; mesmo filtro de acesso
--    da página do evento (evento_acesso aberto/link, publicado e aprovado).
-- 6. reservar_ingressos(evento, itens, cupom, cpf): a ÚNICA porta de compra nova. Tudo em centavos (bigint) calculado no
--    servidor; reserva de 10 min fixos; no máximo 5 reservas por conta e evento por hora; a reserva anterior da conta
--    no evento é cancelada; e-mail do JWT; NÃO copia CPF nem telefone do perfil (CPF só se o tipo tem max_por_cpf).
--    CUPOM: não vale na meia; pedido só de meias com cupom é recusado; no misto o desconto é só nas inteiras.
--    RATEIO DO DESCONTO (determinístico, em centavos): D = desconto nominal (percentual: floor(base * % / 100); fixo: valor
--    * 100; limitado a max_discount e à base; base = subtotal das inteiras). Cada ingresso inteiro recebe
--    floor(D * preço_do_ingresso / base) centavos (proporcional ao preço, para baixo). O desconto efetivo do pedido é a soma
--    disso (pode ficar até N-1 centavos abaixo de D, N = ingressos inteiros; sempre a favor da casa). Cupom de 100% dá
--    exatamente o preço de cada ingresso.
--    TAXA (decisão do Ricardo, 30/10): sobre o preço COM desconto do ingresso: evk_taxa_centavos(preço - desconto do
--    ingresso); ingresso que fica em 0 não paga taxa. Mudar a regra = uma linha, marcada TAXA_BASE na função.
--    min_order_value do cupom é conferido contra o subtotal das inteiras (a base do desconto): suposição, ver relatório.
--    Pedido de total 0 nasce 'pending' e o front segue com confirmar_pedido_gratis.
-- 7. Políticas RESTRICTIVE de INSERT (authenticated): orders sem reservado_ate, cupom e desconto; order_items só inteira ao
--    preço do tipo, sem meia_tipo e sem taxa_unit. reservar_ingressos, reservar_assentos e os gatilhos são SECURITY
--    DEFINER (dono postgres): não passam por RLS.
-- REAPLICAR ARQUIVOS ANTIGOS: o bloco 0 de 20261027_ticket_types_grants_por_coluna.sql abortará (coluna nova permite_meia):
--    pôr permite_meia na lista e no grant se for reaplicado. A conferência da E4 (20261011) também abortará com reservado_ate
--    (e as colunas novas de order_items): classificar como RETIDAS se for reaplicada. authenticated NÃO lê reservado_ate,
--    meia_tipo nem taxa_unit (sem SELECT por coluna novo); o front lê pelo retorno da reservar_ingressos.
-- ORDEM: 0) 20261028_limite_por_cpf aplicado (o bloco 0 confere); 1) este arquivo; 2) front; 3) arquivo B.
-- Como aplicar: colar inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA TextEdit). Uma transação, idempotente.
-- Testes: supabase/tests/venda_servidor_meia.test.sql e supabase/tests/corrida_meia.sh (só em banco descartável). NÃO mover para supabase/migrations/.
-- ponytail: reserva de 5/hora e contagem de usos do cupom por contagem de pedidos (nada incrementa coupons.uses hoje).
-- ponytail: pedido pendente pago depois de reservado_ate (Pix lento) não revalida estoque aqui: é assunto do gateway (Fase 4).
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos (abortam) ------------------------------------------------------------------------------------------
do $$
declare d text;
begin
  if to_regclass('public.orders') is null or to_regclass('public.order_items') is null or to_regclass('public.ticket_types') is null
     or to_regclass('public.pedido_assentos') is null or to_regclass('public.coupons') is null or to_regclass('public.events') is null then
    raise exception 'faltam orders, order_items, ticket_types, pedido_assentos, coupons ou events';
  end if;
  if to_regprocedure('public.pr7_hmac(text)') is null or to_regprocedure('public.gf_mfa_ok()') is null
     or to_regprocedure('public.tipo_no_mapa(uuid)') is null or to_regprocedure('public.evento_acesso(uuid)') is null
     or to_regprocedure('public.mesa_pedido_guard()') is null then
    raise exception 'faltam pr7_hmac, gf_mfa_ok, tipo_no_mapa, evento_acesso ou mesa_pedido_guard';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'orders_cpf_hash' and tgrelid = 'public.orders'::regclass) then
    raise exception 'falta o gatilho orders_cpf_hash (20261028_limite_por_cpf)';
  end if;
  d := pg_get_functiondef('public.order_items_estoque_guard()'::regprocedure);
  if md5(d) <> '783677ce59ef02906bd27752455f5fbb' and position('meia (20261030)' in d) = 0 then
    raise exception 'order_items_estoque_guard mudou desde a leitura de produção (md5 %): refazer a partir da definição atual', md5(d);
  end if;
  d := pg_get_functiondef('public.confirmar_pedido_gratis(uuid)'::regprocedure);
  if md5(d) <> 'e949efceff9e652de092c9a8525242c3' and position('meia (20261030)' in d) = 0 then
    raise exception 'confirmar_pedido_gratis mudou desde a leitura de produção (md5 %): refazer a partir da definição atual', md5(d);
  end if;
end $$;

-- 1. Colunas e tabela ---------------------------------------------------------------------------------------------------
alter table public.ticket_types add column if not exists permite_meia boolean not null default true;
-- ponytail: vip fica com permite_meia true (decisão do Ricardo, 30/10: VIP tem meia); só mesa e coletiva não têm.
update public.ticket_types set permite_meia = false where type in ('mesa', 'coletiva') and permite_meia;
grant update (permite_meia) on public.ticket_types to authenticated;

alter table public.order_items add column if not exists beneficio text not null default 'inteira';
alter table public.order_items add column if not exists meia_tipo text;
alter table public.order_items add column if not exists taxa_unit numeric(10, 2);
alter table public.order_items drop constraint if exists order_items_beneficio_check;
alter table public.order_items add constraint order_items_beneficio_check check (beneficio in ('inteira', 'meia'));
alter table public.order_items drop constraint if exists order_items_meia_tipo_check;
alter table public.order_items add constraint order_items_meia_tipo_check check ((beneficio = 'meia') = (meia_tipo is not null));
alter table public.order_items drop constraint if exists order_items_taxa_unit_check;
alter table public.order_items add constraint order_items_taxa_unit_check check (taxa_unit >= 0);
alter table public.orders add column if not exists reservado_ate timestamptz;
create index if not exists orders_reserva_conta_evento_idx on public.orders (user_id, event_id, created_at) where reservado_ate is not null;

create table if not exists public.beneficios_uf (
  uf char(2) not null,
  codigo text not null,
  nome text not null,
  documento text not null,
  primary key (uf, codigo)
);
alter table public.beneficios_uf enable row level security;
revoke all on table public.beneficios_uf from public, anon, authenticated;
grant select on table public.beneficios_uf to anon, authenticated;
drop policy if exists "Benefícios estaduais são públicos" on public.beneficios_uf;
create policy "Benefícios estaduais são públicos" on public.beneficios_uf for select to anon, authenticated using (true);

-- 2. Preço da meia e taxa ---------------------------------------------------------------------------------------------
create or replace function public.evk_preco_meia(p_cent bigint)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case when coalesce(p_cent, 0) <= 0 then 0 else greatest(p_cent / 2, 1) end -- bigint / bigint arredonda para baixo
$$;
revoke all on function public.evk_preco_meia(bigint) from public, anon, authenticated;

-- espelho de app/src/lib/taxa.ts (taxaCentavos): 10%, mínimo R$ 3 por ingresso, 0 se o valor é 0
create or replace function public.evk_taxa_centavos(p_cent bigint, p_meia boolean default false)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case when coalesce(p_cent, 0) <= 0 then 0
              else greatest(round(p_cent * 10 / 100.0)::bigint, case when p_meia then 300 /*PISO_MEIA*/ else 300 end) end
$$;
revoke all on function public.evk_taxa_centavos(bigint, boolean) from public, anon, authenticated;

-- 3. Guard de estoque (produção + limite por CPF + meia) ----------------------------------------------------------------
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
  v_permite boolean;
  v_preco numeric;
  v_tipo text;
  v_meias int;
  v_cota int;
  v_reserva int;
  v_limite int;
  v_mapa boolean;
  v_meia_ok boolean;
begin
  select case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total
              when coalesce(tt.capacity, 0) > 0 then tt.capacity else 0 end,
         coalesce(tt.sold, 0), tt.min_per_order,
         case when tt.price = 0 then coalesce(tt.max_per_order, 10) else tt.max_per_order end,
         tt.max_por_cpf, tt.permite_meia, tt.price, tt.type
    into v_lotacao, v_sold, v_min, v_max, v_max_cpf, v_permite, v_preco, v_tipo
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
  -- meia (20261030): quem pode ter meia e a cota. Mesa, coletiva, preço 0 e permite_meia=false não têm meia; lugar marcado
  -- também não (a meia por assento depende de reservar_assentos, fatia 3). Quem não tem meia não segura cota.
  v_mapa := public.tipo_no_mapa(new.ticket_type_id);
  v_meia_ok := v_permite and v_tipo not in ('mesa', 'coletiva') and v_preco > 0;
  if new.beneficio = 'meia' then
    if not v_meia_ok then
      raise exception 'Este ingresso não tem meia-entrada' using errcode = '22023';
    end if;
    if v_mapa then
      raise exception 'Meia-entrada em lugar marcado ainda não está disponível' using errcode = '22023';
    end if;
    if new.meia_tipo is null then
      raise exception 'Informe o tipo de meia-entrada' using errcode = '22023';
    end if;
  end if;
  if v_lotacao = 0 then
    return new; -- sem lotação não se afirma esgotado (e a meia fica sem teto)
  end if;
  v_cota := case when v_meia_ok and not v_mapa then (v_lotacao * 4 + 9) / 10 else 0 end; -- ceil(40% da lotação do tipo); cada tipo é o seu grupo (fatia 3 traz o grupo)
  select coalesce(sum(oi.quantity), 0) into v_reservado
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.ticket_type_id = new.ticket_type_id and oi.id is distinct from new.id
     and o.status = 'pending'
     and coalesce(o.reservado_ate > now(), -- meia (20261030): reserva do servidor vale até reservado_ate; sem ele, a regra antiga
                  o.created_at > now() - case when exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)
                                     then interval '10 minutes' else interval '30 minutes' end);
  -- meia (20261030): meias já ocupadas (pagas + reservas vivas) e a reserva de vagas para a cota de meia
  select coalesce(sum(oi.quantity), 0) into v_meias
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.ticket_type_id = new.ticket_type_id and oi.id is distinct from new.id and oi.beneficio = 'meia'
     and (o.status = 'paid'
          or (o.status = 'pending'
              and coalesce(o.reservado_ate > now(), o.created_at > now() - case when exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)
                                     then interval '10 minutes' else interval '30 minutes' end)));
  v_reserva := greatest(v_cota - v_meias, 0);
  if new.beneficio = 'meia' and v_meias + new.quantity > v_cota then
    raise exception 'Restam % meias neste ingresso', v_reserva using errcode = '22023';
  end if;
  v_limite := v_lotacao - case when new.beneficio = 'meia' then 0 else v_reserva end; -- a inteira não come as vagas guardadas para a meia
  if v_sold + v_reservado + new.quantity > v_limite then
    raise exception 'Ingressos esgotados ou insuficientes (restam %)', greatest(v_limite - v_sold - v_reservado, 0) using errcode = '22023';
  end if;
  return new;
end;
$function$;

revoke execute on function public.order_items_estoque_guard() from public, anon, authenticated;

-- 4. Pedido gratuito (produção + limite por CPF + cupom de 100%) --------------------------------------------------------
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
  -- meia (20261030): reserva do servidor vencida não vira ingresso (o estoque já foi liberado)
  if o.reservado_ate is not null and o.reservado_ate <= now() then
    raise exception 'Reserva expirada, volte ao evento e escolha de novo' using errcode = '22023';
  end if;
  -- trava os itens e depois os tipos (por id, sem impasse) ANTES de conferir qualquer coisa
  perform 1 from public.order_items where order_id = o.id for update;
  perform 1 from public.ticket_types where id in (select ticket_type_id from public.order_items where order_id = o.id) order by id for update;
  select coalesce(sum(quantity), 0) into esperado from public.order_items where order_id = o.id;
  if esperado = 0 then
    raise exception 'Pedido sem itens' using errcode = '22023';
  end if;
  -- meia (20261030): pedido com cupom (coupon_id só nasce em reservar_ingressos; o navegador não consegue gravar) pode ter
  -- item de preço > 0 e total 0 (cupom de 100%); sem cupom, continua exigindo item e tipo de preço 0
  if o.total <> 0 or (o.coupon_id is null and exists (
       select 1 from public.order_items oi join public.ticket_types tt on tt.id = oi.ticket_type_id
        where oi.order_id = o.id and (oi.unit_price <> 0 or tt.price <> 0))) then
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
             where oi.order_id = o.id and (o.coupon_id is not null or (oi.unit_price = 0 and tt.price = 0)) loop
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

-- 5. Vitrine ------------------------------------------------------------------------------------------------------------
-- Mesma conta do guard, só leitura. Preço/taxa em reais; disponiveis e meias_disponiveis nulos = tipo sem lotação (sem teto).
create or replace function public.vitrine_ingressos(p_event_id uuid)
returns table (
  ticket_type_id uuid, nome text, preco numeric, taxa numeric, preco_meia numeric, taxa_meia numeric,
  permite_meia boolean, disponiveis int, meias_disponiveis int, meias_total int)
language sql
stable
security definer
set search_path = ''
as $$
  select x.id, x.name, x.cent / 100.0, public.evk_taxa_centavos(x.cent) / 100.0,
         case when x.meia_ok then public.evk_preco_meia(x.cent) / 100.0 end,
         case when x.meia_ok then public.evk_taxa_centavos(public.evk_preco_meia(x.cent), true) / 100.0 end,
         x.meia_ok,
         case when x.lot > 0 then greatest(x.lot - x.sold - x.res - greatest(x.cota - x.meias, 0), 0)::int end,
         case when x.meia_ok then case when x.lot > 0 then greatest(least(x.cota - x.meias, x.lot - x.sold - x.res), 0)::int end else 0 end,
         case when x.meia_ok and x.lot > 0 then x.cota else 0 end
    from (
      select tt.id, tt.name, tt.sort_order, tt.created_at, round(tt.price * 100)::bigint as cent,
             case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total when coalesce(tt.capacity, 0) > 0 then tt.capacity else 0 end as lot,
             coalesce(tt.sold, 0) as sold,
             (tt.permite_meia and tt.type not in ('mesa', 'coletiva') and tt.price > 0 and not public.tipo_no_mapa(tt.id)) as meia_ok,
             (select coalesce(sum(oi.quantity), 0) from public.order_items oi join public.orders o on o.id = oi.order_id
               where oi.ticket_type_id = tt.id and o.status = 'pending'
                 and coalesce(o.reservado_ate > now(), o.created_at > now() - case when exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)
                                     then interval '10 minutes' else interval '30 minutes' end))::int as res,
             (select coalesce(sum(oi.quantity), 0) from public.order_items oi join public.orders o on o.id = oi.order_id
               where oi.ticket_type_id = tt.id and oi.beneficio = 'meia' and (o.status = 'paid' or (o.status = 'pending'
                 and coalesce(o.reservado_ate > now(), o.created_at > now() - case when exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)
                                     then interval '10 minutes' else interval '30 minutes' end))))::int as meias,
             ((case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total when coalesce(tt.capacity, 0) > 0 then tt.capacity else 0 end) * 4 + 9) / 10 as cota
        from public.ticket_types tt
       where tt.event_id = p_event_id and tt.is_active
         and public.evento_acesso(p_event_id) in ('aberto', 'link')
         and exists (select 1 from public.events e where e.id = p_event_id and e.status = 'published' and e.approval_status = 'approved')
    ) x
   order by x.sort_order nulls last, x.created_at;
$$;
revoke all on function public.vitrine_ingressos(uuid) from public, anon, authenticated;
grant execute on function public.vitrine_ingressos(uuid) to anon, authenticated;

-- 6. Reserva no servidor ------------------------------------------------------------------------------------------------
create or replace function public.reservar_ingressos(p_event_id uuid, p_itens jsonb, p_cupom text default null, p_cpf text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  v_uid uuid := auth.uid();
  v_ev record;
  v_nome text;
  v_cup record;
  v_cup_id uuid;
  v_it record;
  v_base bigint := 0;       -- subtotal das inteiras (base do desconto)
  v_desc_nominal bigint := 0;
  v_cent bigint;
  v_d bigint;
  v_taxa_u bigint;
  v_sub bigint := 0;
  v_desc bigint := 0;
  v_taxa bigint := 0;
  v_total bigint;
  v_linhas jsonb := '[]'::jsonb;
  v_order uuid;
  v_ate timestamptz := now() + interval '10 minutes'; -- 10 min fixos, definidos aqui (o cliente não escolhe)
  v_cancel int;
  v_usos int;
  v_n_meia int;
  v_n_inteira int;
  v_cpf boolean;
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Entre na sua conta para comprar' using errcode = '42501';
  end if;
  if not public.gf_mfa_ok() then
    raise exception 'Confirme o código do 2FA' using errcode = '42501';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) not between 1 and 10 then
    raise exception 'Informe de 1 a 10 itens' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_itens) as x(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text)
              where x.ticket_type_id is null or x.quantidade is null or x.quantidade not between 1 and 100
                 or coalesce(x.beneficio, 'inteira') not in ('inteira', 'meia')) then
    raise exception 'Item inválido (ingresso, quantidade de 1 a 100, benefício inteira ou meia)' using errcode = '22023';
  end if;
  if (select count(*) - count(distinct (x.ticket_type_id, coalesce(x.beneficio, 'inteira'), x.meia_tipo))
        from jsonb_to_recordset(p_itens) as x(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text)) > 0 then
    raise exception 'Item repetido: some as quantidades do mesmo ingresso e benefício' using errcode = '22023';
  end if;
  select e.id, e.producer_id, upper(btrim(e.venue_state)) as uf into v_ev from public.events e
   where e.id = p_event_id and e.status = 'published' and e.approval_status = 'approved'
     and public.evento_acesso(e.id) in ('aberto', 'link');
  if not found then
    raise exception 'Evento indisponível para venda' using errcode = '22023';
  end if;
  -- meia_tipo: nacional fixo ou estadual cadastrado para a UF do evento
  for v_it in select x.meia_tipo, coalesce(x.beneficio, 'inteira') as beneficio
                from jsonb_to_recordset(p_itens) as x(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text) loop
    if v_it.beneficio = 'inteira' and v_it.meia_tipo is not null then
      raise exception 'Inteira não tem tipo de meia-entrada' using errcode = '22023';
    end if;
    if v_it.beneficio = 'meia' and (v_it.meia_tipo is null
       or not (v_it.meia_tipo in ('estudante', 'pcd', 'pcd_acompanhante', 'jovem_baixa_renda')
               or exists (select 1 from public.beneficios_uf b where b.uf = v_ev.uf and b.codigo = v_it.meia_tipo))) then
      raise exception 'Tipo de meia-entrada inválido para este evento' using errcode = '22023';
    end if;
  end loop;

  perform pg_advisory_xact_lock(hashtextextended('reserva:' || v_uid || ':' || p_event_id, 0));
  if (select count(*) from public.orders o
       where o.user_id = v_uid and o.event_id = p_event_id and o.reservado_ate is not null
         and o.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Muitas reservas neste evento. Tente de novo em alguns minutos.' using errcode = '22023';
  end if;
  update public.orders set status = 'cancelled'
   where user_id = v_uid and event_id = p_event_id and status = 'pending' and reservado_ate is not null;
  get diagnostics v_cancel = row_count;

  -- todos os tipos pedidos existem, estão ativos e são deste evento
  if (select count(distinct x.ticket_type_id) from jsonb_to_recordset(p_itens) as x(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text))
     <> (select count(*) from public.ticket_types tt where tt.event_id = p_event_id and tt.is_active
          and tt.id in (select x.ticket_type_id from jsonb_to_recordset(p_itens) as x(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text))) then
    raise exception 'Ingresso não encontrado ou indisponível' using errcode = '22023';
  end if;
  select coalesce(sum(round(tt.price * 100)::bigint * x.quantidade) filter (where coalesce(x.beneficio, 'inteira') = 'inteira'), 0),
         count(*) filter (where x.beneficio = 'meia'), count(*) filter (where coalesce(x.beneficio, 'inteira') = 'inteira'),
         coalesce(bool_or(tt.max_por_cpf is not null), false)
    into v_base, v_n_meia, v_n_inteira, v_cpf
    from jsonb_to_recordset(p_itens) as x(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text)
    join public.ticket_types tt on tt.id = x.ticket_type_id;

  -- cupom
  if btrim(coalesce(p_cupom, '')) <> '' then
    if v_n_inteira = 0 then
      raise exception 'O cupom não vale para meia-entrada: tire o cupom ou inclua ingressos inteiros' using errcode = '22023';
    end if;
    select * into v_cup from public.coupons c
     where upper(c.code) = upper(btrim(p_cupom)) and c.producer_id = v_ev.producer_id
       and (c.event_id is null or c.event_id = p_event_id) and c.is_active
       and (c.valid_from is null or c.valid_from <= now()) and (c.valid_until is null or c.valid_until > now())
       and c.audience in ('all', 'first_purchase')
     for update;
    if not found then
      raise exception 'Cupom inválido ou indisponível' using errcode = '22023';
    end if;
    v_cup_id := v_cup.id;
    if v_cup.audience = 'first_purchase' and exists (select 1 from public.orders o where o.user_id = v_uid and o.status = 'paid') then
      raise exception 'Este cupom é só para a primeira compra' using errcode = '22023';
    end if;
    if v_cup.min_order_value is not null and v_base < round(v_cup.min_order_value * 100)::bigint then
      raise exception 'Pedido mínimo de R$ % para este cupom', to_char(v_cup.min_order_value, 'FM999999990D00') using errcode = '22023';
    end if;
    select count(*) into v_usos from public.orders o
     where o.coupon_id = v_cup.id and (o.status = 'paid' or (o.status = 'pending' and o.reservado_ate > now()));
    if v_cup.max_uses is not null and v_usos >= v_cup.max_uses then
      raise exception 'Este cupom esgotou' using errcode = '22023';
    end if;
    select count(*) into v_usos from public.orders o
     where o.coupon_id = v_cup.id and o.user_id = v_uid and (o.status = 'paid' or (o.status = 'pending' and o.reservado_ate > now()));
    if v_cup.max_uses_per_user is not null and v_usos >= v_cup.max_uses_per_user then
      raise exception 'Você já usou este cupom' using errcode = '22023';
    end if;
    v_desc_nominal := case v_cup.discount_type
                        when 'percent' then floor(v_base * v_cup.discount_value / 100)::bigint
                        else round(v_cup.discount_value * 100)::bigint end;
    if v_cup.max_discount is not null then
      v_desc_nominal := least(v_desc_nominal, round(v_cup.max_discount * 100)::bigint);
    end if;
    v_desc_nominal := least(v_desc_nominal, v_base);
  end if;

  -- linhas (ordem de id do tipo: mesma ordem de trava em todo pedido, sem impasse)
  for v_it in select x.ticket_type_id, x.quantidade, coalesce(x.beneficio, 'inteira') as beneficio, x.meia_tipo,
                     round(tt.price * 100)::bigint as cent
                from jsonb_to_recordset(p_itens) as x(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text)
                join public.ticket_types tt on tt.id = x.ticket_type_id
               order by x.ticket_type_id, 3, x.meia_tipo loop
    if v_it.beneficio = 'meia' then
      v_cent := public.evk_preco_meia(v_it.cent);
      v_d := 0; -- cupom não vale na meia
    else
      v_cent := v_it.cent;
      v_d := case when v_base > 0 then (v_desc_nominal * v_cent) / v_base else 0 end; -- rateio: ver cabeçalho
    end if;
    v_taxa_u := public.evk_taxa_centavos(v_cent - v_d, v_it.beneficio = 'meia'); -- TAXA_BASE: preço com desconto (decisão do Ricardo, 30/10)
    v_sub := v_sub + v_cent * v_it.quantidade;
    v_desc := v_desc + v_d * v_it.quantidade;
    v_taxa := v_taxa + v_taxa_u * v_it.quantidade;
    v_linhas := v_linhas || jsonb_build_object('ticket_type_id', v_it.ticket_type_id, 'quantidade', v_it.quantidade,
      'beneficio', v_it.beneficio, 'meia_tipo', v_it.meia_tipo, 'cent', v_cent, 'desc_cent', v_d, 'taxa_cent', v_taxa_u);
  end loop;
  v_total := v_sub - v_desc + v_taxa;

  insert into public.orders (user_id, event_id, coupon_id, subtotal, discount, service_fee, total, status,
                             customer_name, customer_email, customer_cpf, reservado_ate)
  values (v_uid, p_event_id, v_cup_id, v_sub / 100.0, v_desc / 100.0, v_taxa / 100.0, v_total / 100.0, 'pending',
          (select nullif(btrim(p.full_name), '') from public.profiles p where p.id = v_uid),
          auth.jwt() ->> 'email', case when v_cpf then nullif(btrim(coalesce(p_cpf, '')), '') end, v_ate)
  returning id into v_order;

  -- um insert por item, em ordem: o guard e a mesa_pedido_guard enxergam os itens anteriores do mesmo pedido
  for v_it in select * from jsonb_to_recordset(v_linhas)
           as y(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text, cent bigint, taxa_cent bigint) loop
    insert into public.order_items (order_id, ticket_type_id, quantity, unit_price, taxa_unit, subtotal, beneficio, meia_tipo)
    values (v_order, v_it.ticket_type_id, v_it.quantidade, v_it.cent / 100.0, v_it.taxa_cent / 100.0,
            v_it.cent * v_it.quantidade / 100.0, v_it.beneficio, v_it.meia_tipo);
  end loop;

  return jsonb_build_object(
    'order_id', v_order, 'status', 'pending', 'subtotal', v_sub / 100.0, 'desconto', v_desc / 100.0, 'taxa', v_taxa / 100.0,
    'total', v_total / 100.0, 'reservado_ate', v_ate, 'agora', now(), 'itens', v_linhas,
    'aviso', case when v_cancel > 0 then 'Sua reserva anterior neste evento foi substituída por esta.' end);
end;
$$;
revoke all on function public.reservar_ingressos(uuid, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.reservar_ingressos(uuid, jsonb, text, text) to authenticated;

-- 7. O navegador não fabrica reserva, cupom, desconto, meia nem preço (RESTRICTIVE soma com as permissivas antigas) -------
drop policy if exists gf_orders_sem_reserva_falsa on public.orders;
create policy gf_orders_sem_reserva_falsa on public.orders as restrictive for insert to authenticated
  with check (reservado_ate is null and coupon_id is null and coalesce(discount, 0) = 0);
drop policy if exists gf_order_items_so_inteira on public.order_items;
create policy gf_order_items_so_inteira on public.order_items as restrictive for insert to authenticated
  with check (beneficio = 'inteira' and meia_tipo is null and taxa_unit is null
              and unit_price = (select tt.price from public.ticket_types tt where tt.id = ticket_type_id));

-- 8. Conferências (abortam) ---------------------------------------------------------------------------------------------
do $$
declare r text; f text; c record;
begin
  if position('limite por CPF (20261028)' in pg_get_functiondef('public.order_items_estoque_guard()'::regprocedure)) = 0
     or position('meia (20261030)' in pg_get_functiondef('public.order_items_estoque_guard()'::regprocedure)) = 0
     or position('pedido_assentos' in pg_get_functiondef('public.order_items_estoque_guard()'::regprocedure)) = 0
     or position('limite por CPF (20261028)' in pg_get_functiondef('public.confirmar_pedido_gratis(uuid)'::regprocedure)) = 0
     or position('meia (20261030)' in pg_get_functiondef('public.confirmar_pedido_gratis(uuid)'::regprocedure)) = 0 then
    raise exception 'guard ou confirmar_pedido_gratis sem as marcas esperadas';
  end if;
  foreach r in array array['anon', 'authenticated'] loop
    foreach f in array array['public.evk_taxa_centavos(bigint, boolean)', 'public.evk_preco_meia(bigint)', 'public.order_items_estoque_guard()'] loop
      if has_function_privilege(r, f, 'execute') then raise exception '% pode executar %', r, f; end if;
    end loop;
  end loop;
  if not has_function_privilege('anon', 'public.vitrine_ingressos(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.vitrine_ingressos(uuid)', 'execute') then
    raise exception 'vitrine_ingressos: anon e authenticated precisam executar';
  end if;
  if has_function_privilege('anon', 'public.reservar_ingressos(uuid, jsonb, text, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.reservar_ingressos(uuid, jsonb, text, text)', 'execute') then
    raise exception 'reservar_ingressos: só authenticated executa';
  end if;
  if has_function_privilege('anon', 'public.confirmar_pedido_gratis(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.confirmar_pedido_gratis(uuid)', 'execute') then
    raise exception 'EXECUTE de confirmar_pedido_gratis fora do esperado (só authenticated)';
  end if;
  if not has_column_privilege('authenticated', 'public.ticket_types', 'permite_meia', 'update') then
    raise exception 'authenticated sem UPDATE de permite_meia (o painel edita)';
  end if;
  if has_column_privilege('authenticated', 'public.orders', 'reservado_ate', 'select')
     or has_column_privilege('anon', 'public.orders', 'reservado_ate', 'select') then
    raise exception 'reservado_ate não deveria ser legível pelo navegador';
  end if;
  if exists (select 1 from public.ticket_types where type in ('mesa', 'coletiva') and permite_meia) then
    raise exception 'mesa/coletiva com permite_meia';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and permissive = 'RESTRICTIVE' and cmd = 'INSERT'
        and policyname in ('gf_orders_sem_reserva_falsa', 'gf_order_items_so_inteira')) <> 2 then
    raise exception 'faltam as políticas RESTRICTIVE de INSERT';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.beneficios_uf'::regclass) then
    raise exception 'RLS desligada em beneficios_uf';
  end if;
  -- casos de app/src/test/taxa.test.ts (10%, mínimo R$ 3, gratuito 0), em centavos
  for c in select * from (values (0, 0), (1000, 300), (2999, 300), (3000, 300), (10000, 1000), (3333, 333), (3005, 301),
                                 (2000, 300), (5000, 500), (-1000, 0)) v(cent, esperado) loop
    if public.evk_taxa_centavos(c.cent) <> c.esperado then
      raise exception 'evk_taxa_centavos(%) deu %, esperado %', c.cent, public.evk_taxa_centavos(c.cent), c.esperado;
    end if;
  end loop;
  if public.evk_preco_meia(5000) <> 2500 or public.evk_preco_meia(5001) <> 2500 or public.evk_preco_meia(1) <> 1
     or public.evk_preco_meia(0) <> 0 then
    raise exception 'evk_preco_meia fora do esperado';
  end if;
  if exists (select 1 from public.vitrine_ingressos(gen_random_uuid())) then
    raise exception 'vitrine_ingressos devolveu linhas para evento inexistente';
  end if;
end $$;

commit;

-- =============================================================================
-- DESFAZER (antes da 1ª venda): recriar guard e confirmar_pedido_gratis com as definições de produção guardadas ANTES de
-- aplicar (md5 783677ce… e e949efce…); depois:
--   drop policy if exists gf_orders_sem_reserva_falsa on public.orders; drop policy if exists gf_order_items_so_inteira on public.order_items;
--   drop function if exists public.reservar_ingressos(uuid, jsonb, text, text); drop function if exists public.vitrine_ingressos(uuid);
--   drop function if exists public.evk_taxa_centavos(bigint, boolean); drop function if exists public.evk_preco_meia(bigint);
--   drop table if exists public.beneficios_uf; drop index if exists public.orders_reserva_conta_evento_idx;
--   alter table public.orders drop column if exists reservado_ate;
--   alter table public.order_items drop column if exists meia_tipo, drop column if exists taxa_unit, drop column if exists beneficio;
--   alter table public.ticket_types drop column if exists permite_meia;
-- =============================================================================
