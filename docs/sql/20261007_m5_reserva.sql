-- =============================================================================
-- M5.1: reserva de ingressos no servidor, lotes, meia-entrada, taxa espelho e vitrine (01/10/2026).
-- Decisões 122, 130, 131 e 132; especificação "M5 Ingressos, lotes e conformidade legal" (cofre, Claude/Entregas).
-- Só banco: nenhuma tela muda neste arquivo (o front chama as funções no M5.2).
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17).
-- Uma transação só: se a conferência do fim falhar, nada é gravado. Idempotente (pode rodar de novo).
-- Testes: supabase/tests/reserva_ingressos.test.sql (pgTAP) e supabase/tests/corrida_reserva.sh (dois compradores
-- ao mesmo tempo); banco local, nunca em produção.
-- Pré-requisitos (a guarda do início aborta): mesa_pedido_guard() (20261003) e gf_mfa_ok() (20260930_2fa_no_banco).
-- NÃO exige o 20261006: a convivência com gf_protect_event_cancel não depende deste arquivo.
--
-- DECISÕES
-- 1. (Dec. 130) Lote é linha de ticket_types: colunas grupo (mesmo valor nos lotes do mesmo ingresso) e lote.
--    Linhas atuais ganham grupo próprio e lote 1, sem migrar dado. Sem tabela de lotes, sem agendador: o lote
--    vigente é calculado na hora da consulta (evk_lotes).
-- 2. (Dec. 130) Lote vigente = menor lote do grupo que está no período (is_active, sale_start vencido ou vazio,
--    sale_end futuro ou vazio), tem quantidade (capacity não nula) e tem vaga. Vaga do lote = capacity do lote
--    + sobra acumulada dos lotes anteriores (encerrados por data ou inativos) - vendido acumulado até ele.
--    Lote anterior reaberto não revende a sobra que já foi vendida num lote seguinte: além da vaga do lote, vale
--    a vaga do grupo (soma da capacity dos lotes já iniciados - vendidos e reservados do grupo todo).
-- 3. (Dec. 131) Só sale_end encerra o lote; sem sale_end vende durante o evento (nada corta no início do evento).
--    capacity nula não vende. Limite por conta (Dec. 130/131): por GRUPO (tipo de ingresso): já pagos + reservas
--    válidas da conta no grupo + o pedido <= coalesce(max_per_order do lote vigente, 10).
-- 4. (Dec. 132) Cota de meia por tipo (grupo), só em grupo pago: cota = ceil(0,4 x soma das capacity dos lotes do
--    grupo). Meia = metade do preço da inteira do lote vigente (divisão inteira em centavos, para baixo); inteira
--    e meia viram de lote juntas (um lote vigente por grupo). reserva_meia = max(0, cota - meias vendidas ou
--    reservadas), garantida pela capacidade RESTANTE DO TIPO INTEIRO, inclusive lotes futuros (vagas_total).
--    inteira disponível = min(vaga do lote vigente, vagas_total - reserva_meia); meia disponível = min(vaga do
--    lote vigente, vagas_total, reserva_meia). A vaga do lote vigente já é limitada pelas vagas dos lotes
--    iniciados (teto da regra anti-revenda do item 2).
--    A cota é piso de oferta: acima dela a Evokaa não oferece meia. Cota não é liberada perto do evento (pergunta
--    11 do jurídico em aberto). Gratuito: sem cota e sem meia.
-- 5. Estoque ocupado = itens de pedido 'paid' + itens de pedido 'pending' com reservado_ate no futuro. Reserva
--    vencida deixa de contar sozinha, sem agendador (Decreto 13.108, art. 13 §3º). Pedido 'pending' SEM
--    reservado_ate (caminho antigo do navegador, até o M5.3) não conta: nunca vira ingresso e travaria o estoque.
-- 6. Uma reserva aberta por conta e evento: a nova cancela a anterior (status 'cancelled'); se a nova for
--    recusada, a função inteira desfaz e a anterior continua. Índice único parcial garante.
-- 7. Preço travado: order_items.unit_price é o preço SEM taxa, taxa_unit é a taxa de cada ingresso, os dois
--    gravados na reserva; o pedido não muda se o lote virar. evk_taxa_centavos espelha app/src/lib/taxa.ts
--    (10%, mínimo R$ 3 por ingresso, gratuito 0, centavos inteiros; Decisão 88); a conferência do fim roda os
--    casos de app/src/test/taxa.test.ts de verdade.
-- 8. Reserva dura 10 minutos (Dec. 122). Total zero: o pedido já nasce 'paid', sem reservado_ate, e emite os
--    ingressos na hora (tickets com buyer_* do perfil, price_paid 0, beneficio).
-- 9. Ingresso oculto por código: ticket_types.codigo; a regra pública de leitura passa a exigir codigo nulo. O lote
--    com código só sai por vitrine_ingressos/reservar_ingressos com o código certo (sem diferenciar maiúsculas).
--    O código é conveniência, não senha: quem adivinha vê o lote. Linha cujo código não confere é ignorada em
--    TODA a conta do grupo (capacidade, cota, vendidos); por isso o lote com código deve ter grupo próprio.
--    DIVERGE da especificação 3.7 ("entra na base da cota"): escolha para não vazar estoque oculto na vitrine.
--    O jurídico confirma se o lote oculto conta na base; se contar, a cota do evento continua >= 40% porque
--    cada grupo tem a sua.
-- 10. Compra só pela função, sem tirar o INSERT antigo (isso é o M5.3): duas regras RESTRICTIVE de INSERT impedem
--     o navegador de fabricar uma reserva falsa (orders.reservado_ate nulo; order_items só em pedido do navegador).
-- 11. Match de Mesa: nenhuma regra repetida aqui. Os gatilhos mesa_pedido_guard (order_items) e mesa_idade_guard
--     (tickets) disparam nos inserts da função: 1 lugar por item, 18+, 1 item de mesa por pedido, 1 por conta.
-- 12. Concorrência: pg_advisory_xact_lock por conta e evento; depois, num comando só, as linhas de ticket_types
--     dos grupos pedidos com FOR NO KEY UPDATE ORDER BY id (sem deadlock entre compradores; não conflita com a
--     chave estrangeira); só depois lê o estoque (comando novo, enxerga o que o comprador anterior gravou).
--     Exige read committed (padrão do Supabase); outro nível é recusado.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- Guarda: pré-requisitos
do $$
begin
  if to_regprocedure('public.mesa_pedido_guard()') is null or to_regprocedure('public.gf_mfa_ok()') is null then
    raise exception 'Aplique antes docs/sql/20261003_mesa_coletiva.sql e docs/sql/20260930_2fa_no_banco.sql';
  end if;
end $$;

-- 1. Colunas (CHECK com drop + add: idempotente)
alter table public.ticket_types
  add column if not exists grupo uuid not null default gen_random_uuid(),
  add column if not exists lote smallint not null default 1,
  add column if not exists codigo text;
alter table public.ticket_types drop constraint if exists ticket_types_lote_check;
alter table public.ticket_types add constraint ticket_types_lote_check check (lote between 1 and 50);
alter table public.ticket_types drop constraint if exists ticket_types_codigo_check;
alter table public.ticket_types add constraint ticket_types_codigo_check
  check (codigo is null or codigo ~ '^[A-Za-z0-9_-]{3,40}$');

alter table public.order_items
  add column if not exists beneficio text not null default 'inteira',
  add column if not exists taxa_unit numeric(10,2);
alter table public.order_items drop constraint if exists order_items_beneficio_check;
alter table public.order_items add constraint order_items_beneficio_check check (beneficio in ('inteira', 'meia'));
alter table public.order_items drop constraint if exists order_items_taxa_unit_check;
alter table public.order_items add constraint order_items_taxa_unit_check check (taxa_unit >= 0);

alter table public.tickets add column if not exists beneficio text not null default 'inteira';
alter table public.tickets drop constraint if exists tickets_beneficio_check;
alter table public.tickets add constraint tickets_beneficio_check check (beneficio in ('inteira', 'meia'));

alter table public.orders add column if not exists reservado_ate timestamptz;

-- 2. Índices
create unique index if not exists ticket_types_evento_grupo_lote_key on public.ticket_types (event_id, grupo, lote);
create index if not exists idx_order_items_ticket_type on public.order_items (ticket_type_id);
create unique index if not exists orders_uma_reserva_aberta on public.orders (user_id, event_id)
  where status = 'pending' and reservado_ate is not null;

-- 3. Taxa espelho de app/src/lib/taxa.ts (taxaCentavos). Sem grant: só as funções abaixo a usam.
create or replace function public.evk_taxa_centavos(p_centavos int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case when coalesce(p_centavos, 0) <= 0 then 0
              else greatest(round(p_centavos * 10 / 100.0)::int, 300) end
$$;

-- 4. A ÚNICA regra de lote, cota e estoque. Uma linha por grupo visível com o código dado.
--    ticket_type_id nulo = nada à venda agora (esgotado, fora do período ou sem quantidade); nesse caso as
--    demais colunas descrevem o lote de referência (o próximo que ainda vai abrir, senão o último).
--    ponytail: recalcula o evento inteiro a cada chamada (evento tem poucos tipos); com milhares de linhas
--    por evento, materializar o estoque por tipo.
create or replace function public.evk_lotes(p_event_id uuid, p_codigo text)
returns table (
  grupo uuid, ticket_type_id uuid, lote smallint, nome text, descricao text, tipo text, sort_order int,
  preco_cent int, min_por_pedido int, max_por_conta int, vende_de timestamptz, vende_ate timestamptz,
  proximo_preco_cent int, vagas_lote int, inteira_disp int, meia_disp int, reserva_meia int,
  total_ingressos int, total_meias int, pago boolean)
language sql
stable
security definer
set search_path = ''
as $$
  -- ponytail: pedido 'pending' sem reservado_ate (caminho antigo) não ocupa estoque; o M5.3 fecha esse caminho.
  with ocupado as (
    select oi.ticket_type_id as tid, sum(oi.quantity)::int as vend,
           coalesce(sum(oi.quantity) filter (where oi.beneficio = 'meia'), 0)::int as vend_meia
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where o.event_id = p_event_id
       and (o.status = 'paid' or (o.status = 'pending' and o.reservado_ate > now()))
     group by oi.ticket_type_id
  ), t as (
    select tt.id, tt.grupo, tt.lote, tt.name, tt.description, tt.type, tt.sort_order, tt.price, tt.capacity,
           tt.min_per_order, tt.max_per_order, tt.sale_start, tt.sale_end, tt.is_active,
           coalesce(oc.vend, 0) as vend, coalesce(oc.vend_meia, 0) as vend_meia,
           round(tt.price * 100)::int as cent,
           (tt.capacity is not null and (tt.sale_start is null or tt.sale_start <= now())) as iniciado,
           (tt.is_active and tt.capacity is not null and (tt.sale_start is null or tt.sale_start <= now())
              and (tt.sale_end is null or tt.sale_end > now())) as vendavel
      from public.ticket_types tt
      left join ocupado oc on oc.tid = tt.id
     where tt.event_id = p_event_id
       -- ponytail: código é filtro, não senha (sem limite de tentativas); lote com código precisa de grupo próprio
       and (tt.codigo is null or upper(tt.codigo) = upper(btrim(p_codigo)))
  ), g as (
    select t.grupo, sum(coalesce(t.capacity, 0))::int as total,
           greatest(sum(case when t.iniciado then t.capacity else 0 end) - sum(t.vend), 0)::int as vagas_grupo,
           -- vagas_total: inclui a capacidade dos lotes futuros (que vão existir); base da reserva de meia
           greatest(sum(case when t.iniciado or (t.is_active and t.capacity is not null) then t.capacity else 0 end)
                    - sum(t.vend), 0)::int as vagas_total,
           bool_or(t.price > 0) as pago, sum(t.vend_meia)::int as vend_meia
      from t group by t.grupo
  ), w as (
    select t.*, g.vagas_grupo, g.vagas_total, g.pago, g.total, g.vend_meia as g_vend_meia,
           sum(case when t.iniciado then t.capacity else 0 end) over (partition by t.grupo order by t.lote
             rows between unbounded preceding and current row)
           - sum(t.vend) over (partition by t.grupo order by t.lote
             rows between unbounded preceding and current row) as avail
      from t join g using (grupo)
  ), w2 as (
    select w.*, (w.vendavel and w.avail > 0 and w.vagas_grupo > 0) as vigente,
           (not w.iniciado and w.is_active and w.capacity is not null) as futuro
      from w
  ), r as (
    select distinct on (w2.grupo) w2.*
      from w2
     order by w2.grupo,
              case when w2.vigente then 0 when w2.futuro then 1 else 2 end,
              case when w2.vigente or w2.futuro then w2.lote else -w2.lote end
  ), f as (
    select r.*,
           case when r.vigente then least(r.avail, r.vagas_grupo)::int else 0 end as vl,
           case when r.pago then (r.total * 4 + 9) / 10 else 0 end as cota
      from r
  )
  select f.grupo,
         case when f.vigente then f.id end,
         f.lote, f.name, f.description, f.type, f.sort_order,
         f.cent,
         coalesce(f.min_per_order, 1), coalesce(f.max_per_order, 10),
         f.sale_start, f.sale_end,
         case when f.vigente then
           (select round(n.price * 100)::int from w n
             where n.grupo = f.grupo and n.lote > f.lote and n.is_active and n.capacity is not null
               and (n.sale_end is null or n.sale_end > now())
             order by n.lote limit 1) end,
         f.vl,
         greatest(least(f.vl, f.vagas_total - greatest(f.cota - f.g_vend_meia, 0)), 0),
         case when f.vigente and f.pago and f.cent > 0 then least(f.vl, f.vagas_total, greatest(f.cota - f.g_vend_meia, 0)) else 0 end,
         greatest(f.cota - f.g_vend_meia, 0),
         f.total, f.cota, f.pago
    from f
$$;

-- 5. Vitrine pública: uma linha por (grupo, beneficio); sem dado pessoal
create or replace function public.vitrine_ingressos(p_event_id uuid, p_codigo text default null)
returns table (
  grupo uuid, beneficio text, ticket_type_id uuid, nome text, descricao text, tipo text, lote smallint,
  preco numeric, taxa numeric, total numeric, restantes int, vende_de timestamptz, vende_ate timestamptz,
  proximo_total numeric, min_por_pedido int, max_por_conta int, total_ingressos int, total_meias int)
language sql
stable
security definer
set search_path = ''
as $$
  select l.grupo, b.beneficio, l.ticket_type_id, l.nome, l.descricao, l.tipo, l.lote,
         (b.cent / 100.0)::numeric(10, 2),
         (public.evk_taxa_centavos(b.cent) / 100.0)::numeric(10, 2),
         ((b.cent + public.evk_taxa_centavos(b.cent)) / 100.0)::numeric(10, 2),
         b.restantes, l.vende_de, l.vende_ate,
         case when b.prox is not null then ((b.prox + public.evk_taxa_centavos(b.prox)) / 100.0)::numeric(10, 2) end,
         l.min_por_pedido, l.max_por_conta, l.total_ingressos, l.total_meias
    from public.evk_lotes(p_event_id, p_codigo) l
   cross join lateral (values
      (1, 'inteira', l.preco_cent, l.inteira_disp, l.proximo_preco_cent),
      (2, 'meia', l.preco_cent / 2, l.meia_disp, l.proximo_preco_cent / 2)) b(ord, beneficio, cent, restantes, prox)
   where (b.ord = 1 or (l.pago and l.preco_cent > 0))
     and exists (select 1 from public.events e
                  where e.id = p_event_id and e.status = 'published' and e.approval_status = 'approved')
   order by l.sort_order nulls last, l.nome, l.grupo, b.ord
$$;

-- 6. Reserva no servidor
create or replace function public.reservar_ingressos(p_event_id uuid, p_itens jsonb, p_codigo text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  v_uid uuid := auth.uid();
  v_perfil record;
  v_grupos uuid[];
  g uuid;
  l record;
  v_it record;
  v_qi int;
  v_qm int;
  v_ja int;
  v_linhas jsonb := '[]'::jsonb;
  v_sub bigint := 0;
  v_taxa bigint := 0;
  v_total bigint;
  v_ate timestamptz;
  v_status text;
  v_order uuid;
  v_item uuid;
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Entre na sua conta para comprar' using errcode = '42501';
  end if;
  if not public.gf_mfa_ok() then
    raise exception 'Confirme o código do 2FA' using errcode = '42501';
  end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'A reserva exige a transação em read committed' using errcode = '25000';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) not between 1 and 10 then
    raise exception 'Informe de 1 a 10 itens' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_itens) as x(grupo uuid, beneficio text, quantidade int)
              where x.grupo is null or x.beneficio is null or x.beneficio not in ('inteira', 'meia')
                 or x.quantidade is null or x.quantidade not between 1 and 100) then
    raise exception 'Item inválido (grupo, beneficio inteira ou meia, quantidade de 1 a 100)' using errcode = '22023';
  end if;
  if (select count(*) - count(distinct (x.grupo, x.beneficio))
        from jsonb_to_recordset(p_itens) as x(grupo uuid, beneficio text, quantidade int)) > 0 then
    raise exception 'Item repetido: some as quantidades do mesmo ingresso e benefício' using errcode = '22023';
  end if;
  select p.full_name, p.email, p.cpf, p.phone into v_perfil from public.profiles p where p.id = v_uid;
  if not found or btrim(coalesce(v_perfil.full_name, '')) = '' then
    raise exception 'Complete seu nome no perfil antes de comprar' using errcode = '22023';
  end if;
  if not exists (select 1 from public.events e
                  where e.id = p_event_id and e.status = 'published' and e.approval_status = 'approved') then
    raise exception 'Evento indisponível para venda' using errcode = '22023';
  end if;

  -- travas (DECISÕES 12): conta e evento, depois os tipos pedidos em ordem de id
  v_grupos := array(select distinct x.grupo from jsonb_to_recordset(p_itens) as x(grupo uuid, beneficio text, quantidade int));
  perform pg_advisory_xact_lock(hashtext('reserva:' || v_uid || ':' || p_event_id));
  perform 1 from public.ticket_types tt
   where tt.event_id = p_event_id and tt.grupo = any (v_grupos)
   order by tt.id for no key update;

  -- uma reserva aberta por conta e evento (DECISÕES 6); se algo falhar daqui em diante, tudo desfaz
  update public.orders set status = 'cancelled'
   where user_id = v_uid and event_id = p_event_id and status = 'pending' and reservado_ate is not null;

  foreach g in array v_grupos loop
    select coalesce(sum(x.quantidade) filter (where x.beneficio = 'inteira'), 0)::int,
           coalesce(sum(x.quantidade) filter (where x.beneficio = 'meia'), 0)::int
      into v_qi, v_qm
      from jsonb_to_recordset(p_itens) as x(grupo uuid, beneficio text, quantidade int) where x.grupo = g;
    -- comando novo depois das travas: enxerga o que o comprador anterior gravou
    -- ponytail: evk_lotes recalcula o evento todo por grupo pedido (no máximo 10 vezes); sem cache
    select * into l from public.evk_lotes(p_event_id, p_codigo) e where e.grupo = g;
    if not found then
      raise exception 'Ingresso não encontrado' using errcode = '22023';
    end if;
    if l.ticket_type_id is null then
      raise exception 'Ingresso "%" esgotado ou fora do período de vendas', l.nome using errcode = '22023';
    end if;
    if v_qm > 0 and not (l.pago and l.preco_cent > 0) then
      raise exception 'O ingresso "%" não tem meia-entrada', l.nome using errcode = '22023';
    end if;
    -- ponytail: o item não se divide entre lotes; se pedir mais que a vaga do lote vigente, recusa com "restam N"
    if v_qi > l.inteira_disp then
      raise exception 'Restam % ingresso(s) inteira de "%"', l.inteira_disp, l.nome using errcode = '22023';
    end if;
    if v_qm > l.meia_disp then
      raise exception 'Restam % meia(s) de "%"', l.meia_disp, l.nome using errcode = '22023';
    end if;
    if v_qi + v_qm > l.vagas_lote then
      raise exception 'Restam % ingresso(s) de "%"', l.vagas_lote, l.nome using errcode = '22023';
    end if;
    if v_qi + v_qm < l.min_por_pedido then
      raise exception 'Mínimo de % ingresso(s) por pedido em "%"', l.min_por_pedido, l.nome using errcode = '22023';
    end if;
    select coalesce(sum(oi.quantity), 0)::int into v_ja
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      join public.ticket_types tt on tt.id = oi.ticket_type_id
     where o.user_id = v_uid and o.event_id = p_event_id and tt.grupo = g
       and (o.status = 'paid' or (o.status = 'pending' and o.reservado_ate > now()));
    if v_ja + v_qi + v_qm > l.max_por_conta then
      raise exception 'Limite de % ingresso(s) por conta em "%" (você já tem %)', l.max_por_conta, l.nome, v_ja
        using errcode = '22023';
    end if;
    if v_qi > 0 then
      v_linhas := v_linhas || jsonb_build_object('ticket_type_id', l.ticket_type_id, 'grupo', g, 'lote', l.lote,
        'nome', l.nome, 'beneficio', 'inteira', 'quantidade', v_qi, 'cent', l.preco_cent,
        'taxa_cent', public.evk_taxa_centavos(l.preco_cent));
    end if;
    if v_qm > 0 then
      v_linhas := v_linhas || jsonb_build_object('ticket_type_id', l.ticket_type_id, 'grupo', g, 'lote', l.lote,
        'nome', l.nome, 'beneficio', 'meia', 'quantidade', v_qm, 'cent', l.preco_cent / 2,
        'taxa_cent', public.evk_taxa_centavos(l.preco_cent / 2));
    end if;
  end loop;

  select sum(y.cent::bigint * y.quantidade), sum(y.taxa_cent::bigint * y.quantidade) into v_sub, v_taxa
    from jsonb_to_recordset(v_linhas) as y(cent int, taxa_cent int, quantidade int);
  v_total := v_sub + v_taxa;
  v_status := case when v_total = 0 then 'paid' else 'pending' end;
  v_ate := case when v_total = 0 then null else now() + interval '10 minutes' end;

  insert into public.orders (user_id, event_id, subtotal, service_fee, total, status, reservado_ate,
                             customer_name, customer_email, customer_cpf, customer_phone)
  values (v_uid, p_event_id, v_sub / 100.0, v_taxa / 100.0, v_total / 100.0, v_status, v_ate,
          v_perfil.full_name, v_perfil.email, v_perfil.cpf, v_perfil.phone)
  returning id into v_order;

  -- um insert por item: o gatilho da mesa precisa enxergar o item anterior do mesmo pedido
  for v_it in select * from jsonb_to_recordset(v_linhas)
           as y(ticket_type_id uuid, grupo uuid, beneficio text, quantidade int, cent int, taxa_cent int) loop
    insert into public.order_items (order_id, ticket_type_id, quantity, unit_price, taxa_unit, subtotal, beneficio)
    values (v_order, v_it.ticket_type_id, v_it.quantidade, v_it.cent / 100.0, v_it.taxa_cent / 100.0,
            v_it.cent::bigint * v_it.quantidade / 100.0, v_it.beneficio)
    returning id into v_item;
    if v_total = 0 then
      insert into public.tickets (order_item_id, order_id, ticket_type_id, event_id, user_id,
                                  buyer_name, buyer_email, buyer_cpf, price_paid, beneficio)
      select v_item, v_order, v_it.ticket_type_id, p_event_id, v_uid,
             v_perfil.full_name, v_perfil.email, v_perfil.cpf, 0, v_it.beneficio
        from generate_series(1, v_it.quantidade);
    end if;
  end loop;

  return jsonb_build_object(
    'order_id', v_order, 'status', v_status, 'reservado_ate', v_ate, 'agora', now(),
    'subtotal', v_sub / 100.0, 'taxa', v_taxa / 100.0, 'total', v_total / 100.0,
    'itens', (select jsonb_agg(jsonb_build_object(
        'ticket_type_id', y.ticket_type_id, 'grupo', y.grupo, 'lote', y.lote, 'nome', y.nome,
        'beneficio', y.beneficio, 'quantidade', y.quantidade, 'preco', y.cent / 100.0,
        'taxa', y.taxa_cent / 100.0, 'total', (y.cent + y.taxa_cent) / 100.0))
      from jsonb_to_recordset(v_linhas)
        as y(ticket_type_id uuid, grupo uuid, lote int, nome text, beneficio text, quantidade int, cent int, taxa_cent int)));
end;
$$;

-- Privilégios: padrão do Supabase dá EXECUTE a anon e authenticated em função nova; aqui só o mínimo.
revoke all on function public.evk_taxa_centavos(int) from public, anon, authenticated, service_role;
revoke all on function public.evk_lotes(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.vitrine_ingressos(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.reservar_ingressos(uuid, jsonb, text) from public, anon, authenticated, service_role;
grant execute on function public.vitrine_ingressos(uuid, text) to anon, authenticated;
grant execute on function public.reservar_ingressos(uuid, jsonb, text) to authenticated;

-- 7. Lote com código não aparece na leitura pública da tabela
drop policy if exists "Ingressos à venda de evento aprovado" on public.ticket_types;
create policy "Ingressos à venda de evento aprovado" on public.ticket_types as permissive for select
  to anon, authenticated
  using (codigo is null and is_active and exists (
    select 1 from public.events e
     where e.id = ticket_types.event_id and e.status = 'published' and e.approval_status = 'approved'));

-- 8. O navegador não fabrica reserva: RESTRICTIVE soma (AND) com a permissiva antiga, que continua até o M5.3
drop policy if exists gf_orders_sem_reserva_falsa on public.orders;
create policy gf_orders_sem_reserva_falsa on public.orders as restrictive for insert to authenticated
  with check (reservado_ate is null);
drop policy if exists gf_order_items_sem_reserva_falsa on public.order_items;
create policy gf_order_items_sem_reserva_falsa on public.order_items as restrictive for insert to authenticated
  with check (exists (select 1 from public.orders o where o.id = order_id and o.reservado_ate is null));

-- Conferência obrigatória: se algo faltar, nada deste arquivo é gravado.
do $$
declare
  c record;
  f text;
begin
  -- colunas
  if (select count(*) from information_schema.columns where table_schema = 'public' and (
        (table_name = 'ticket_types' and column_name in ('grupo', 'lote', 'codigo'))
     or (table_name = 'order_items' and column_name in ('beneficio', 'taxa_unit'))
     or (table_name = 'tickets' and column_name = 'beneficio')
     or (table_name = 'orders' and column_name = 'reservado_ate'))) <> 7 then
    raise exception 'faltam colunas do M5.1';
  end if;
  if (select count(*) from pg_constraint where convalidated and conname in (
        'ticket_types_lote_check', 'ticket_types_codigo_check', 'order_items_beneficio_check',
        'order_items_taxa_unit_check', 'tickets_beneficio_check')) <> 5 then
    raise exception 'faltam CHECKs do M5.1';
  end if;
  if (select count(*) from pg_indexes where schemaname = 'public' and indexname in (
        'ticket_types_evento_grupo_lote_key', 'idx_order_items_ticket_type', 'orders_uma_reserva_aberta')) <> 3 then
    raise exception 'faltam índices do M5.1';
  end if;
  -- funções: dono, search_path vazio, privilégios
  foreach f in array array['public.evk_taxa_centavos(int)', 'public.evk_lotes(uuid, text)',
                           'public.vitrine_ingressos(uuid, text)', 'public.reservar_ingressos(uuid, jsonb, text)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and proowner = 'postgres'::regrole
                   and proconfig @> array['search_path=""']) then
      raise exception '%: dono diferente de postgres ou search_path não vazio', f;
    end if;
  end loop;
  foreach f in array array['public.evk_taxa_centavos(int)', 'public.evk_lotes(uuid, text)'] loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute')
       or has_function_privilege('service_role', f, 'execute') then
      raise exception '%: não pode ser executável pela API', f;
    end if;
  end loop;
  if not has_function_privilege('anon', 'public.vitrine_ingressos(uuid, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.vitrine_ingressos(uuid, text)', 'execute') then
    raise exception 'vitrine_ingressos: anon e authenticated precisam executar';
  end if;
  if has_function_privilege('anon', 'public.reservar_ingressos(uuid, jsonb, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.reservar_ingressos(uuid, jsonb, text)', 'execute') then
    raise exception 'reservar_ingressos: só authenticated executa';
  end if;
  if not exists (select 1 from pg_proc where oid = 'public.reservar_ingressos(uuid, jsonb, text)'::regprocedure
                 and prosecdef and proconfig @> array['lock_timeout=5s'])
     or not exists (select 1 from pg_proc where oid = 'public.evk_lotes(uuid, text)'::regprocedure and prosecdef)
     or not exists (select 1 from pg_proc where oid = 'public.vitrine_ingressos(uuid, text)'::regprocedure and prosecdef) then
    raise exception 'funções do M5.1 sem SECURITY DEFINER (ou reservar sem lock_timeout)';
  end if;
  -- regras de acesso
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticket_types'
                 and policyname = 'Ingressos à venda de evento aprovado' and permissive = 'PERMISSIVE' and cmd = 'SELECT'
                 and qual like '%codigo IS NULL%') then
    raise exception 'ticket_types: a leitura pública não exige codigo nulo';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and permissive = 'RESTRICTIVE' and cmd = 'INSERT'
        and policyname in ('gf_orders_sem_reserva_falsa', 'gf_order_items_sem_reserva_falsa')) <> 2 then
    raise exception 'faltam as regras RESTRICTIVE de INSERT em orders e order_items';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.order_items'::regclass
                 and tgname = 'mesa_pedido_guard' and tgenabled = 'O') then
    raise exception 'order_items sem o gatilho da mesa (mesa_pedido_guard)';
  end if;
  -- taxa espelho: os casos de app/src/test/taxa.test.ts rodados de verdade
  for c in select * from (values (0, 0), (1000, 300), (2999, 300), (3000, 300), (10000, 1000), (3333, 333),
                                 (3005, 301), (2000, 300), (5000, 500), (-1000, 0)) v(cent, esperado) loop
    if public.evk_taxa_centavos(c.cent) <> c.esperado then
      raise exception 'evk_taxa_centavos(%) deu %, esperado %', c.cent, public.evk_taxa_centavos(c.cent), c.esperado;
    end if;
  end loop;
  if public.evk_taxa_centavos(null) <> 0 then
    raise exception 'evk_taxa_centavos(null) deveria ser 0';
  end if;
  -- vitrine com evento inexistente: responde vazio, sem erro
  if exists (select 1 from public.vitrine_ingressos(gen_random_uuid(), null)) then
    raise exception 'vitrine_ingressos devolveu linhas para um evento que não existe';
  end if;
end $$;

commit;

-- Desfazer (só serve antes da 1ª venda: depois, order_items.beneficio e taxa_unit guardam o que foi cobrado):
-- begin;
-- drop policy if exists gf_order_items_sem_reserva_falsa on public.order_items;
-- drop policy if exists gf_orders_sem_reserva_falsa on public.orders;
-- drop policy if exists "Ingressos à venda de evento aprovado" on public.ticket_types;
-- create policy "Ingressos à venda de evento aprovado" on public.ticket_types as permissive for select
--   to anon, authenticated
--   using (is_active and exists (select 1 from public.events e
--     where e.id = ticket_types.event_id and e.status = 'published' and e.approval_status = 'approved'));
-- drop function if exists public.reservar_ingressos(uuid, jsonb, text);
-- drop function if exists public.vitrine_ingressos(uuid, text);
-- drop function if exists public.evk_lotes(uuid, text);
-- drop function if exists public.evk_taxa_centavos(int);
-- drop index if exists public.orders_uma_reserva_aberta;
-- drop index if exists public.idx_order_items_ticket_type;
-- drop index if exists public.ticket_types_evento_grupo_lote_key;
-- alter table public.orders drop column if exists reservado_ate;
-- alter table public.tickets drop column if exists beneficio;
-- alter table public.order_items drop column if exists taxa_unit, drop column if exists beneficio;
-- alter table public.ticket_types drop column if exists codigo, drop column if exists lote, drop column if exists grupo;
-- commit;
